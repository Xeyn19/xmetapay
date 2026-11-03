import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type EducationScope = "basic" | "higher" | "both";

export type AcademicTrackReadiness = {
  basic: { ready: boolean; gradeLevels: number; sections: number; enrollments: number };
  higher: { ready: boolean; programs: number; yearLevels: number; periods: number; sections: number; enrollments: number };
};

export type CollegeAcademicSetupData = {
  ready: boolean;
  warning: string | null;
  schoolId: number | null;
  educationScope: EducationScope;
  selectedYear: { id: number; name: string; startsOn: string; endsOn: string; status: "upcoming" | "active" | "closed" } | null;
  years: Array<{ id: number; name: string; startsOn: string; endsOn: string; status: "upcoming" | "active" | "closed" }>;
  periods: Array<{ id: number; name: string; type: string; status: string; startsOn: string; endsOn: string }>;
  programs: Array<{ id: number; code: string; name: string; levels: Array<{ id: number; name: string }> }>;
  sections: Array<{ id: number; name: string; periodId: number; periodName: string; levelId: number; levelName: string }>;
  students: Array<{ id: number; name: string; reference: string }>;
  enrollments: Array<{ id: number; studentName: string; reference: string; periodName: string; programName: string; levelName: string; sectionName: string | null }>;
};

export class SchoolAcademicError extends Error {}

export async function getSchoolAcademicReadiness(schoolId: number, activeSchoolYearId: number | null): Promise<{ educationScope: EducationScope; tracks: AcademicTrackReadiness; ready: boolean }> {
  const [schoolRows, basicRows, higherRows] = await Promise.all([
    pool.execute<Array<RowDataPacket & { education_scope: EducationScope }>>("SELECT education_scope FROM schools WHERE id=:schoolId LIMIT 1", { schoolId }),
    pool.execute<Array<RowDataPacket & { grade_levels: number; sections: number; enrollments: number }>>(`SELECT
      (SELECT COUNT(*) FROM grade_levels WHERE school_id=:schoolId) grade_levels,
      (SELECT COUNT(*) FROM sections WHERE school_id=:schoolId AND school_year_id=:yearId) sections,
      (SELECT COUNT(*) FROM enrollments e JOIN students st ON st.id=e.student_id WHERE st.school_id=:schoolId AND e.school_year_id=:yearId AND e.status='enrolled') enrollments`, { schoolId, yearId: activeSchoolYearId ?? 0 }),
    pool.execute<Array<RowDataPacket & { programs: number; year_levels: number; periods: number; sections: number; enrollments: number }>>(`SELECT
      (SELECT COUNT(*) FROM academic_programs WHERE school_id=:schoolId AND status='active') programs,
      (SELECT COUNT(*) FROM program_year_levels pyl JOIN academic_programs ap ON ap.id=pyl.program_id WHERE ap.school_id=:schoolId AND ap.status='active') year_levels,
      (SELECT COUNT(*) FROM academic_periods WHERE school_id=:schoolId AND school_year_id=:yearId) periods,
      (SELECT COUNT(*) FROM college_sections cs JOIN academic_periods ap ON ap.id=cs.academic_period_id WHERE cs.school_id=:schoolId AND ap.school_year_id=:yearId) sections,
      (SELECT COUNT(*) FROM college_enrollments ce JOIN students st ON st.id=ce.student_id WHERE st.school_id=:schoolId AND ce.school_year_id=:yearId AND ce.status='enrolled') enrollments`, { schoolId, yearId: activeSchoolYearId ?? 0 }),
  ]);
  const educationScope = schoolRows[0][0]?.education_scope ?? "basic";
  const basic = basicRows[0][0] ?? { grade_levels: 0, sections: 0, enrollments: 0 };
  const higher = higherRows[0][0] ?? { programs: 0, year_levels: 0, periods: 0, sections: 0, enrollments: 0 };
  const tracks = {
    basic: { ready: Boolean(activeSchoolYearId && Number(basic.grade_levels) > 0 && Number(basic.sections) > 0), gradeLevels: Number(basic.grade_levels), sections: Number(basic.sections), enrollments: Number(basic.enrollments) },
    higher: { ready: Boolean(activeSchoolYearId && Number(higher.programs) > 0 && Number(higher.year_levels) > 0 && Number(higher.periods) > 0 && Number(higher.sections) > 0), programs: Number(higher.programs), yearLevels: Number(higher.year_levels), periods: Number(higher.periods), sections: Number(higher.sections), enrollments: Number(higher.enrollments) },
  };
  return { educationScope, tracks, ready: educationScope === "basic" ? tracks.basic.ready : educationScope === "higher" ? tracks.higher.ready : tracks.basic.ready && tracks.higher.ready };
}

export async function updateSchoolEducationScope(connection: PoolConnection, schoolId: number, nextScope: EducationScope) {
  const [rows] = await connection.execute<Array<RowDataPacket & { education_scope: EducationScope }>>("SELECT education_scope FROM schools WHERE id=:schoolId LIMIT 1 FOR UPDATE", { schoolId });
  const current = rows[0]?.education_scope;
  if (!current) throw new SchoolAcademicError("School setup was not found.");
  const removesBasic = (current === "basic" || current === "both") && nextScope === "higher";
  const removesHigher = (current === "higher" || current === "both") && nextScope === "basic";
  if (removesBasic) {
    const [counts] = await connection.execute<Array<RowDataPacket & { total: number }>>(`SELECT
      (SELECT COUNT(*) FROM grade_levels WHERE school_id=:schoolId) +
      (SELECT COUNT(*) FROM sections WHERE school_id=:schoolId) +
      (SELECT COUNT(*) FROM enrollments e JOIN students st ON st.id=e.student_id WHERE st.school_id=:schoolId) total`, { schoolId });
    if (Number(counts[0]?.total) > 0) throw new SchoolAcademicError("Basic Education cannot be removed while grades, sections, or K–12 enrollments exist. Choose Both to keep those records.");
  }
  if (removesHigher) {
    const [counts] = await connection.execute<Array<RowDataPacket & { total: number }>>(`SELECT
      (SELECT COUNT(*) FROM academic_programs WHERE school_id=:schoolId) +
      (SELECT COUNT(*) FROM academic_periods WHERE school_id=:schoolId) +
      (SELECT COUNT(*) FROM college_sections WHERE school_id=:schoolId) +
      (SELECT COUNT(*) FROM college_enrollments ce JOIN students st ON st.id=ce.student_id WHERE st.school_id=:schoolId) +
      (SELECT COUNT(*) FROM fee_schedules WHERE school_id=:schoolId AND education_level='higher') total`, { schoolId });
    if (Number(counts[0]?.total) > 0) throw new SchoolAcademicError("Higher Education cannot be removed while college programs, periods, sections, enrollments, or tuition packages exist. Choose Both to keep those records.");
  }
  await connection.execute("UPDATE schools SET education_scope=:nextScope WHERE id=:schoolId", { schoolId, nextScope });
}

export async function getCollegeAcademicSetupData(userId: number, requestedYearId?: number | null): Promise<CollegeAcademicSetupData> {
  try {
    const [profileRows] = await pool.execute<Array<RowDataPacket & { school_id: number; staff_role: string; education_scope: EducationScope }>>(`SELECT ap.school_id,ap.staff_role,s.education_scope FROM admin_profiles ap JOIN schools s ON s.id=ap.school_id WHERE ap.user_id=:userId LIMIT 1`, { userId });
    const profile = profileRows[0];
    if (!profile || profile.staff_role !== "school_administrator") return emptyCollegeData("Only the school administrator can manage college academics.");
    const [yearRows] = await pool.execute<Array<RowDataPacket & { id: number; name: string; starts_on: string; ends_on: string; status: "upcoming" | "active" | "closed" }>>(`SELECT id,name,DATE_FORMAT(starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(ends_on,'%Y-%m-%d') ends_on,status FROM school_years WHERE school_id=:schoolId ORDER BY status='active' DESC,starts_on DESC,id DESC`, { schoolId: profile.school_id });
    const years = yearRows.map(row => ({ id: row.id, name: row.name, startsOn: row.starts_on, endsOn: row.ends_on, status: row.status }));
    const selectedYear = years.find(year => year.id === requestedYearId) ?? years.find(year => year.status === "active") ?? years[0] ?? null;
    if (!selectedYear) return { ...emptyCollegeData("Add a school year before configuring college academics."), schoolId: profile.school_id, educationScope: profile.education_scope, years };
    const [periodRows, programRows, sectionRows, studentRows, enrollmentRows] = await Promise.all([
      pool.execute<Array<RowDataPacket & { id:number;name:string;period_type:string;status:string;starts_on:string;ends_on:string }>>(`SELECT id,name,period_type,status,DATE_FORMAT(starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(ends_on,'%Y-%m-%d') ends_on FROM academic_periods WHERE school_id=:schoolId AND school_year_id=:yearId ORDER BY sort_order,id`, { schoolId: profile.school_id, yearId: selectedYear.id }),
      pool.execute<Array<RowDataPacket & { program_id:number;code:string;program_name:string;level_id:number|null;level_name:string|null }>>(`SELECT ap.id program_id,ap.code,ap.name program_name,pyl.id level_id,pyl.name level_name FROM academic_programs ap LEFT JOIN program_year_levels pyl ON pyl.program_id=ap.id WHERE ap.school_id=:schoolId AND ap.status='active' ORDER BY ap.name,pyl.level_number`, { schoolId: profile.school_id }),
      pool.execute<Array<RowDataPacket & { id:number;name:string;period_id:number;period_name:string;level_id:number;level_name:string }>>(`SELECT cs.id,cs.name,prd.id period_id,prd.name period_name,pyl.id level_id,CONCAT(pr.code,' · ',pyl.name) level_name FROM college_sections cs JOIN academic_periods prd ON prd.id=cs.academic_period_id JOIN program_year_levels pyl ON pyl.id=cs.program_year_level_id JOIN academic_programs pr ON pr.id=pyl.program_id WHERE cs.school_id=:schoolId AND prd.school_year_id=:yearId ORDER BY prd.sort_order,pr.name,pyl.level_number,cs.name`, { schoolId: profile.school_id, yearId: selectedYear.id }),
      pool.execute<Array<RowDataPacket & { id:number;name:string;student_reference:string }>>(`SELECT id,CONCAT_WS(' ',first_name,NULLIF(middle_name,''),last_name) name,student_reference FROM students WHERE school_id=:schoolId AND status='active' ORDER BY last_name,first_name`, { schoolId: profile.school_id }),
      pool.execute<Array<RowDataPacket & { id:number;student_name:string;student_reference:string;period_name:string;program_name:string;level_name:string;section_name:string|null }>>(`SELECT ce.id,CONCAT_WS(' ',st.first_name,NULLIF(st.middle_name,''),st.last_name) student_name,st.student_reference,prd.name period_name,pr.name program_name,pyl.name level_name,cs.name section_name FROM college_enrollments ce JOIN students st ON st.id=ce.student_id JOIN academic_periods prd ON prd.id=ce.academic_period_id JOIN academic_programs pr ON pr.id=ce.program_id JOIN program_year_levels pyl ON pyl.id=ce.program_year_level_id LEFT JOIN college_sections cs ON cs.id=ce.college_section_id WHERE st.school_id=:schoolId AND ce.school_year_id=:yearId AND ce.status='enrolled' ORDER BY student_name`, { schoolId: profile.school_id, yearId: selectedYear.id }),
    ]);
    const programs = new Map<number, CollegeAcademicSetupData["programs"][number]>();
    for (const row of programRows[0]) { const program = programs.get(row.program_id) ?? { id: row.program_id, code: row.code, name: row.program_name, levels: [] }; if (row.level_id && row.level_name) program.levels.push({ id: row.level_id, name: row.level_name }); programs.set(row.program_id, program); }
    return { ready: true, warning: null, schoolId: profile.school_id, educationScope: profile.education_scope, selectedYear, years,
      periods: periodRows[0].map(row => ({ id:row.id,name:row.name,type:row.period_type,status:row.status,startsOn:row.starts_on,endsOn:row.ends_on })), programs:[...programs.values()],
      sections: sectionRows[0].map(row => ({ id:row.id,name:row.name,periodId:row.period_id,periodName:row.period_name,levelId:row.level_id,levelName:row.level_name })),
      students: studentRows[0].map(row => ({ id:row.id,name:row.name,reference:row.student_reference })), enrollments:enrollmentRows[0].map(row => ({ id:row.id,studentName:row.student_name,reference:row.student_reference,periodName:row.period_name,programName:row.program_name,levelName:row.level_name,sectionName:row.section_name })) };
  } catch { return emptyCollegeData("College academic setup is unavailable. Confirm the tuition assessment migration and MySQL are ready."); }
}

export async function createCollegePeriod(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;name:string;periodType:string;startsOn:string;endsOn:string}) {
  if(!p.name||!["semester","trimester","summer","custom"].includes(p.periodType)||!p.startsOn||!p.endsOn||p.startsOn>p.endsOn) throw new SchoolAcademicError("Enter a valid academic period and date range.");
  const [years]=await connection.execute<Array<RowDataPacket&{starts_on:string;ends_on:string;status:string}>>(`SELECT DATE_FORMAT(starts_on,'%Y-%m-%d') starts_on,DATE_FORMAT(ends_on,'%Y-%m-%d') ends_on,status FROM school_years WHERE id=:schoolYearId AND school_id=:schoolId LIMIT 1`,p);
  if(!years[0]||years[0].status==="closed"||p.startsOn<years[0].starts_on||p.endsOn>years[0].ends_on) throw new SchoolAcademicError("Period dates must stay inside an active or upcoming school year.");
  await connection.execute(`INSERT INTO academic_periods (school_id,school_year_id,name,period_type,starts_on,ends_on,status) VALUES (:schoolId,:schoolYearId,:name,:periodType,:startsOn,:endsOn,'upcoming')`,p);
}

export async function createCollegeProgram(connection:PoolConnection,p:{schoolId:number;code:string;name:string;levelCount:number}) { if(!p.code||!p.name||p.levelCount<1||p.levelCount>8) throw new SchoolAcademicError("Enter a program code, name, and 1 to 8 year levels."); const [r]=await connection.execute<ResultSetHeader>(`INSERT INTO academic_programs (school_id,code,name) VALUES (:schoolId,:code,:name)`,p); for(let i=1;i<=p.levelCount;i++) await connection.execute(`INSERT INTO program_year_levels (program_id,level_number,name) VALUES (:programId,:level,:name)`,{programId:r.insertId,level:i,name:`Year ${i}`}); }
export async function activateCollegePeriod(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;periodId:number}) { const [rows]=await connection.execute<Array<RowDataPacket&{id:number}>>(`SELECT ap.id FROM academic_periods ap JOIN school_years sy ON sy.id=ap.school_year_id WHERE ap.id=:periodId AND ap.school_id=:schoolId AND ap.school_year_id=:schoolYearId AND ap.status<>'closed' AND sy.status='active' FOR UPDATE`,p); if(!rows[0]) throw new SchoolAcademicError("Only a period in the active school year can be activated."); await connection.execute(`UPDATE academic_periods SET status='upcoming' WHERE school_id=:schoolId AND school_year_id=:schoolYearId AND status='active'`,p); await connection.execute(`UPDATE academic_periods SET status='active' WHERE id=:periodId`,p); }
export async function createCollegeAcademicSection(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;periodId:number;levelId:number;name:string}) { if(!p.name) throw new SchoolAcademicError("Enter a college section name."); const [rows]=await connection.execute<Array<RowDataPacket&{id:number}>>(`SELECT ap.id FROM academic_periods ap JOIN school_years sy ON sy.id=ap.school_year_id AND sy.status<>'closed' JOIN program_year_levels pyl ON pyl.id=:levelId JOIN academic_programs pr ON pr.id=pyl.program_id AND pr.school_id=ap.school_id WHERE ap.id=:periodId AND ap.school_id=:schoolId AND ap.school_year_id=:schoolYearId`,p); if(!rows[0]) throw new SchoolAcademicError("Choose a school-owned period and program year level."); await connection.execute(`INSERT INTO college_sections (school_id,academic_period_id,program_year_level_id,name) VALUES (:schoolId,:periodId,:levelId,:name)`,p); }
export async function enrollCollegeAcademicStudent(connection:PoolConnection,p:{schoolId:number;schoolYearId:number;studentId:number;periodId:number;levelId:number;sectionId:number|null}) { const [rows]=await connection.execute<Array<RowDataPacket&{program_id:number}>>(`SELECT pyl.program_id FROM students st JOIN program_year_levels pyl ON pyl.id=:levelId JOIN academic_programs pr ON pr.id=pyl.program_id AND pr.school_id=st.school_id JOIN academic_periods ap ON ap.id=:periodId AND ap.school_id=st.school_id AND ap.school_year_id=:schoolYearId AND ap.status='active' JOIN school_years sy ON sy.id=ap.school_year_id AND sy.status='active' WHERE st.id=:studentId AND st.school_id=:schoolId`,p); if(!rows[0]) throw new SchoolAcademicError("College placement requires a school-owned student, program level, and active period."); if(p.sectionId){const [sections]=await connection.execute<Array<RowDataPacket&{id:number}>>(`SELECT id FROM college_sections WHERE id=:sectionId AND school_id=:schoolId AND academic_period_id=:periodId AND program_year_level_id=:levelId`,p);if(!sections[0])throw new SchoolAcademicError("Choose a matching section.");} await connection.execute(`INSERT INTO college_enrollments (student_id,school_year_id,academic_period_id,program_id,program_year_level_id,college_section_id,status) VALUES (:studentId,:schoolYearId,:periodId,:programId,:levelId,:sectionId,'enrolled')`,{...p,programId:rows[0].program_id}); }

function emptyCollegeData(warning:string):CollegeAcademicSetupData { return { ready:false,warning,schoolId:null,educationScope:"basic",selectedYear:null,years:[],periods:[],programs:[],sections:[],students:[],enrollments:[] }; }
