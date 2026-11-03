import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

await loadEnv();
const host = process.env.DB_HOST ?? "localhost";
if (!["localhost", "127.0.0.1", "::1"].includes(host.toLowerCase())) throw new Error("Refusing to run: tuition QA data is local-database only.");
const adminUserId = Number(process.env.QA_ADMIN_USER_ID ?? process.argv.find(value => value.startsWith("--admin="))?.split("=")[1]);
if (!Number.isInteger(adminUserId) || adminUserId <= 0) throw new Error("Set QA_ADMIN_USER_ID or pass --admin=<existing school administrator user id>.");
const connection = await mysql.createConnection({ host, port:Number(process.env.DB_PORT ?? 3306), user:process.env.DB_USER, password:process.env.DB_PASSWORD, database:process.env.DB_NAME, namedPlaceholders:true });
const cleanup = process.argv.includes("--cleanup");
try {
  await connection.beginTransaction();
  const [admins] = await connection.execute(`SELECT ap.school_id,sy.id school_year_id,DATE_FORMAT(sy.starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(sy.ends_on,'%Y-%m-%d') ends_on FROM admin_profiles ap JOIN school_years sy ON sy.school_id=ap.school_id AND sy.status='active' WHERE ap.user_id=:adminUserId AND ap.staff_role='school_administrator' LIMIT 1 FOR UPDATE`,{adminUserId});
  if (!admins[0]) throw new Error("The QA admin must be an existing school administrator with an active school year.");
  const row=admins[0];const context={schoolId:Number(row.school_id),schoolYearId:Number(row.school_year_id),startsOn:row.starts_on,endsOn:row.ends_on};
  if(cleanup){
    const [used]=await connection.execute(`SELECT COUNT(*) total FROM student_assessments sa JOIN fee_schedules fs ON fs.id=sa.fee_schedule_id WHERE fs.school_id=:schoolId AND fs.name LIKE 'QA-%'`,context);if(Number(used[0].total)>0)throw new Error("QA assessments exist. Cleanup refuses to remove posted financial history.");
    await connection.execute(`DELETE FROM assessment_credit_types WHERE school_id=:schoolId AND code LIKE 'QA-%'`,context);
    await connection.execute(`DELETE pyl FROM program_year_levels pyl JOIN academic_programs ap ON ap.id=pyl.program_id WHERE ap.school_id=:schoolId AND ap.code LIKE 'QA-%'`,context);
    await connection.execute(`DELETE FROM academic_programs WHERE school_id=:schoolId AND code LIKE 'QA-%'`,context);
    await connection.execute(`DELETE FROM academic_periods WHERE school_id=:schoolId AND name LIKE 'QA-%'`,context);
  }else{
    await connection.execute(`INSERT INTO assessment_credit_types (school_id,code,name,source_kind,requires_reference,max_percent,created_by_user_id) VALUES (:schoolId,'QA-VOUCHER','QA DepEd voucher','government',TRUE,50,:adminUserId) ON DUPLICATE KEY UPDATE name=VALUES(name),max_percent=VALUES(max_percent)`,{...context,adminUserId});
    await connection.execute(`INSERT INTO academic_programs (school_id,code,name) VALUES (:schoolId,'QA-BSIT','QA Bachelor of Science in Information Technology') ON DUPLICATE KEY UPDATE name=VALUES(name)`,context);
    const [programs]=await connection.execute(`SELECT id FROM academic_programs WHERE school_id=:schoolId AND code='QA-BSIT'`,context);
    for(let level=1;level<=4;level++)await connection.execute(`INSERT INTO program_year_levels (program_id,level_number,name) VALUES (:programId,:level,:name) ON DUPLICATE KEY UPDATE name=VALUES(name)`,{programId:programs[0].id,level,name:`Year ${level}`});
    await connection.execute(`INSERT INTO academic_periods (school_id,school_year_id,name,period_type,starts_on,ends_on,status) VALUES (:schoolId,:schoolYearId,'QA-First Semester','semester',:startsOn,:endsOn,'upcoming') ON DUPLICATE KEY UPDATE starts_on=VALUES(starts_on),ends_on=VALUES(ends_on)`,context);
    await connection.execute(`UPDATE schools SET education_scope=CASE WHEN education_scope='basic' THEN 'both' ELSE education_scope END WHERE id=:schoolId`,context);
  }
  await connection.commit();
  console.log(cleanup?"Removed only unused QA-prefixed tuition setup records.":"Created or refreshed safe QA-prefixed tuition setup records.");
}catch(error){await connection.rollback();throw error;}finally{await connection.end();}

async function loadEnv(){for(const file of [".env.local",".env"]){try{const source=await readFile(file,"utf8");for(const line of source.split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^['"]|['"]$/g,"");}}catch{}}}
