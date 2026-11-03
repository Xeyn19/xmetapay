import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import {
  getSchoolAcademicReadiness,
  SchoolAcademicError,
  updateSchoolEducationScope,
  type EducationScope,
} from "@/lib/school/academic-offerings";

export type SchoolProfileDraft = {
  schoolName: string;
  schoolCode: string;
  educationScope: EducationScope;
};

export type SchoolYearDraft = {
  name: string;
  startsOn: string;
  endsOn: string;
};

export type BasicEducationSetupDraft = {
  grades: Array<{ name: string; sections: string[] }>;
};

export type CollegeInitialSetupDraft = {
  periodType: "semester" | "trimester" | "summer" | "custom";
  periodName: string;
  startsOn: string;
  endsOn: string;
  programs: Array<{
    code: string;
    name: string;
    levelCount: number;
    sections: Array<{ levelNumber: number; name: string }>;
  }>;
};

export type SchoolOnboardingState = {
  schoolId: number | null;
  schoolName: string;
  schoolCode: string;
  educationScope: EducationScope;
  activeYear: { id: number; name: string; startsOn: string; endsOn: string } | null;
  grades: Array<{ name: string; sections: string[] }>;
  college: {
    period: { name: string; type: CollegeInitialSetupDraft["periodType"]; startsOn: string; endsOn: string } | null;
    programs: Array<{
      code: string;
      name: string;
      levelCount: number;
      sections: Array<{ name: string; levelNumber: number }>;
    }>;
  };
  readiness: {
    profile: boolean;
    schoolYear: boolean;
    basic: boolean;
    college: boolean;
    complete: boolean;
  };
  counts: { gradeLevels: number; basicSections: number; programs: number; yearLevels: number; periods: number; collegeSections: number };
  currentStep: 1 | 2 | 3 | 4 | 5;
  warning: string | null;
};

export class SchoolOnboardingError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
  }
}

export function suggestSchoolCode(schoolName: string) {
  return schoolName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 12) || "SCHOOL";
}

export async function getSchoolOnboardingState(userId: number): Promise<SchoolOnboardingState> {
  try {
    const [profileRows] = await pool.execute<Array<RowDataPacket & {
      school_id: number | null;
      profile_school_name: string;
      school_name: string | null;
      school_code: string | null;
      education_scope: EducationScope | null;
    }>>(
      `SELECT ap.school_id, ap.school_name AS profile_school_name,
              s.name AS school_name, s.code AS school_code, s.education_scope
       FROM admin_profiles ap
       LEFT JOIN schools s ON s.id = ap.school_id
       WHERE ap.user_id = :userId
       LIMIT 1`,
      { userId },
    );
    const profile = profileRows[0];
    const fallbackName = profile?.profile_school_name || "School";

    if (!profile?.school_id || !profile.school_name || !profile.school_code) {
      return emptyOnboardingState(fallbackName);
    }

    const schoolId = profile.school_id;
    const [yearRows] = await pool.execute<Array<RowDataPacket & { id: number; name: string; starts_on: string; ends_on: string }>>(
      `SELECT id, name, DATE_FORMAT(starts_on, '%Y-%m-%d') AS starts_on,
              DATE_FORMAT(ends_on, '%Y-%m-%d') AS ends_on
       FROM school_years
       WHERE school_id = :schoolId AND status = 'active'
       ORDER BY starts_on DESC, id DESC
       LIMIT 1`,
      { schoolId },
    );
    const year = yearRows[0] ?? null;
    const activeYear = year ? { id: year.id, name: year.name, startsOn: year.starts_on, endsOn: year.ends_on } : null;
    const [gradeRows, periodRows, programRows, sectionRows] = await Promise.all([
      activeYear
        ? pool.execute<Array<RowDataPacket & { grade_name: string; section_name: string | null }>>(
            `SELECT gl.name AS grade_name, sec.name AS section_name
             FROM grade_levels gl
             LEFT JOIN sections sec ON sec.grade_level_id = gl.id AND sec.school_year_id = :yearId
             WHERE gl.school_id = :schoolId
             ORDER BY gl.sort_order, gl.name, sec.name`,
            { schoolId, yearId: activeYear.id },
          )
        : Promise.resolve([[]] as unknown as [Array<RowDataPacket & { grade_name: string; section_name: string | null }>, unknown]),
      activeYear
        ? pool.execute<Array<RowDataPacket & { name: string; period_type: CollegeInitialSetupDraft["periodType"]; starts_on: string; ends_on: string }>>(
            `SELECT name, period_type, DATE_FORMAT(starts_on, '%Y-%m-%d') starts_on,
                    DATE_FORMAT(ends_on, '%Y-%m-%d') ends_on
             FROM academic_periods
             WHERE school_id = :schoolId AND school_year_id = :yearId
             ORDER BY status = 'active' DESC, sort_order, id
             LIMIT 1`,
            { schoolId, yearId: activeYear.id },
          )
        : Promise.resolve([[]] as unknown as [Array<RowDataPacket & { name: string; period_type: CollegeInitialSetupDraft["periodType"]; starts_on: string; ends_on: string }>, unknown]),
      pool.execute<Array<RowDataPacket & { id: number; code: string; name: string; level_count: number }>>(
        `SELECT ap.id, ap.code, ap.name, COUNT(pyl.id) AS level_count
         FROM academic_programs ap
         LEFT JOIN program_year_levels pyl ON pyl.program_id = ap.id
         WHERE ap.school_id = :schoolId AND ap.status = 'active'
         GROUP BY ap.id, ap.code, ap.name
         ORDER BY ap.name, ap.id`,
        { schoolId },
      ),
      activeYear
        ? pool.execute<Array<RowDataPacket & { program_id: number; name: string; level_number: number }>>(
            `SELECT pyl.program_id, cs.name, pyl.level_number
             FROM college_sections cs
             JOIN academic_periods prd ON prd.id = cs.academic_period_id
             JOIN program_year_levels pyl ON pyl.id = cs.program_year_level_id
             WHERE cs.school_id = :schoolId AND prd.school_year_id = :yearId
             ORDER BY pyl.level_number, cs.name, cs.id`,
            { schoolId, yearId: activeYear.id },
          )
        : Promise.resolve([[]] as unknown as [Array<RowDataPacket & { program_id: number; name: string; level_number: number }>, unknown]),
    ]);

    const grades = new Map<string, string[]>();
    for (const row of gradeRows[0]) {
      const sections = grades.get(row.grade_name) ?? [];
      if (row.section_name) sections.push(row.section_name);
      grades.set(row.grade_name, sections);
    }
    const academics = await getSchoolAcademicReadiness(schoolId, activeYear?.id ?? null);
    const scope = profile.education_scope ?? "basic";
    const readiness = {
      profile: true,
      schoolYear: Boolean(activeYear),
      basic: scope === "higher" || academics.tracks.basic.ready,
      college: scope === "basic" || academics.tracks.higher.ready,
      complete: Boolean(activeYear && academics.ready),
    };
    const period = periodRows[0][0];
    const sectionsByProgram = new Map<number, Array<{ name: string; levelNumber: number }>>();
    for (const section of sectionRows[0]) {
      const sections = sectionsByProgram.get(Number(section.program_id)) ?? [];
      sections.push({ name: section.name, levelNumber: Number(section.level_number) });
      sectionsByProgram.set(Number(section.program_id), sections);
    }

    return {
      schoolId,
      schoolName: profile.school_name,
      schoolCode: profile.school_code,
      educationScope: scope,
      activeYear,
      grades: [...grades].map(([name, sections]) => ({ name, sections })),
      college: {
        period: period ? { name: period.name, type: period.period_type, startsOn: period.starts_on, endsOn: period.ends_on } : null,
        programs: programRows[0].map((program) => ({
          code: program.code,
          name: program.name,
          levelCount: Number(program.level_count),
          sections: sectionsByProgram.get(Number(program.id)) ?? [],
        })),
      },
      readiness,
      counts: {
        gradeLevels: academics.tracks.basic.gradeLevels,
        basicSections: academics.tracks.basic.sections,
        programs: academics.tracks.higher.programs,
        yearLevels: academics.tracks.higher.yearLevels,
        periods: academics.tracks.higher.periods,
        collegeSections: academics.tracks.higher.sections,
      },
      currentStep: resolveCurrentStep(readiness, scope),
      warning: null,
    };
  } catch (error) {
    console.error("[school-onboarding:read]", error instanceof Error ? error.message : error);
    return { ...emptyOnboardingState("School"), warning: "School setup is temporarily unavailable. Confirm MySQL/XAMPP is running." };
  }
}

export async function saveSchoolProfileStep(userId: number, draft: SchoolProfileDraft) {
  const schoolName = normalizeLabel(draft.schoolName, 180);
  const schoolCode = normalizeCode(draft.schoolCode);
  if (!schoolName) throw new SchoolOnboardingError("Enter the official school name.", "schoolName");
  if (!schoolCode) throw new SchoolOnboardingError("Enter a short school code.", "schoolCode");
  if (!["basic", "higher", "both"].includes(draft.educationScope)) throw new SchoolOnboardingError("Choose the school’s academic offering.", "educationScope");

  return withTransaction(async (connection) => {
    const profile = await lockAdminProfile(connection, userId);
    if (!profile) throw new SchoolOnboardingError("Admin profile was not found.");
    let schoolId = profile.school_id;
    if (schoolId) {
      await updateSchoolEducationScope(connection, schoolId, draft.educationScope);
      const [conflict] = await connection.execute<Array<RowDataPacket & { id: number }>>(
        "SELECT id FROM schools WHERE code = :schoolCode AND id <> :schoolId LIMIT 1",
        { schoolCode, schoolId },
      );
      if (conflict[0]) throw new SchoolOnboardingError("That school code is already used. Try another short code.", "schoolCode");
      await connection.execute(
        "UPDATE schools SET name = :schoolName, code = :schoolCode, status = 'active' WHERE id = :schoolId",
        { schoolName, schoolCode, schoolId },
      );
    } else {
      const [sameName] = await connection.execute<Array<RowDataPacket & { id: number; education_scope: EducationScope }>>(
        "SELECT id, education_scope FROM schools WHERE name = :schoolName ORDER BY status = 'active' DESC LIMIT 1 FOR UPDATE",
        { schoolName },
      );
      if (sameName[0]) {
        schoolId = sameName[0].id;
        await updateSchoolEducationScope(connection, schoolId, draft.educationScope);
      } else {
        const [conflict] = await connection.execute<Array<RowDataPacket & { id: number }>>(
          "SELECT id FROM schools WHERE code = :schoolCode LIMIT 1",
          { schoolCode },
        );
        if (conflict[0]) throw new SchoolOnboardingError("That school code is already used. Try another short code.", "schoolCode");
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO schools (name, code, education_scope, status)
           VALUES (:schoolName, :schoolCode, :educationScope, 'active')`,
          { schoolName, schoolCode, educationScope: draft.educationScope },
        );
        schoolId = Number(result.insertId);
      }
    }
    await connection.execute(
      "UPDATE admin_profiles SET school_id = :schoolId, school_name = :schoolName WHERE user_id = :userId",
      { schoolId, schoolName, userId },
    );
    return schoolId;
  });
}

export async function saveSchoolYearStep(userId: number, draft: SchoolYearDraft) {
  const name = normalizeLabel(draft.name, 40);
  const startsOn = normalizeDate(draft.startsOn);
  const endsOn = normalizeDate(draft.endsOn);
  if (!name) throw new SchoolOnboardingError("Enter a school year name, such as 2028–2029.", "yearName");
  if (!startsOn || !endsOn || startsOn >= endsOn) throw new SchoolOnboardingError("Choose valid start and end dates.", "yearDates");

  return withTransaction(async (connection) => {
    const profile = await lockAdminProfile(connection, userId);
    if (!profile?.school_id) throw new SchoolOnboardingError("Save the school profile first.");
    const [activeRows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM school_years WHERE school_id = :schoolId AND status = 'active' ORDER BY id LIMIT 1 FOR UPDATE",
      { schoolId: profile.school_id },
    );
    const activeId = activeRows[0]?.id;
    if (activeId) {
      await connection.execute(
        `UPDATE school_years SET name = :name, starts_on = :startsOn, ends_on = :endsOn
         WHERE id = :activeId AND school_id = :schoolId`,
        { name, startsOn, endsOn, activeId, schoolId: profile.school_id },
      );
      return activeId;
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO school_years (school_id, name, starts_on, ends_on, status)
       VALUES (:schoolId, :name, :startsOn, :endsOn, 'active')
       ON DUPLICATE KEY UPDATE starts_on = VALUES(starts_on), ends_on = VALUES(ends_on), status = 'active', id = LAST_INSERT_ID(id)`,
      { schoolId: profile.school_id, name, startsOn, endsOn },
    );
    return Number(result.insertId);
  });
}

export async function saveBasicEducationStep(userId: number, draft: BasicEducationSetupDraft) {
  const grades = normalizeGrades(draft.grades);
  if (!grades.length) throw new SchoolOnboardingError("Choose at least one Philippine education level.", "grades");
  if (grades.some((grade) => !grade.sections.length)) throw new SchoolOnboardingError("Every selected grade needs at least one section.", "grades");

  return withTransaction(async (connection) => {
    const context = await lockSchoolContext(connection, userId);
    if (context.education_scope === "higher") throw new SchoolOnboardingError("Basic Education is not enabled for this school.");
    for (const [index, grade] of grades.entries()) {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO grade_levels (school_id, name, sort_order)
         VALUES (:schoolId, :name, :sortOrder)
         ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), id = LAST_INSERT_ID(id)`,
        { schoolId: context.school_id, name: grade.name, sortOrder: index + 1 },
      );
      const gradeLevelId = Number(result.insertId);
      for (const section of grade.sections) {
        await connection.execute(
          `INSERT INTO sections (school_id, school_year_id, grade_level_id, name)
           VALUES (:schoolId, :yearId, :gradeLevelId, :section)
           ON DUPLICATE KEY UPDATE school_id = VALUES(school_id)`,
          { schoolId: context.school_id, yearId: context.school_year_id, gradeLevelId, section },
        );
      }
    }
  });
}

export async function saveCollegeInitialStep(userId: number, draft: CollegeInitialSetupDraft) {
  const periodName = normalizeLabel(draft.periodName, 80);
  const programs = normalizeCollegePrograms(draft.programs);
  const startsOn = normalizeDate(draft.startsOn);
  const endsOn = normalizeDate(draft.endsOn);
  if (!["semester", "trimester", "summer", "custom"].includes(draft.periodType)) throw new SchoolOnboardingError("Choose a valid academic period type.", "periodType");
  if (!periodName) throw new SchoolOnboardingError("Enter the academic period name.", "periodName");
  if (!programs.length) throw new SchoolOnboardingError("Add at least one college program.", "programs");
  if (programs.length > 30) throw new SchoolOnboardingError("Add no more than 30 programs during onboarding.", "programs");
  if (programs.some((program) => !program.code || !program.name)) throw new SchoolOnboardingError("Enter a code and complete name for every college program.", "programs");
  if (programs.some((program) => program.levelCount < 1 || program.levelCount > 6)) throw new SchoolOnboardingError("Choose between 1 and 6 year levels for every program.", "programs");
  if (programs.some((program) => !program.sections.length)) throw new SchoolOnboardingError("Add at least one section for every college program.", "programs");
  if (programs.reduce((total, program) => total + program.sections.length, 0) > 200) throw new SchoolOnboardingError("Add no more than 200 college sections during onboarding.", "programs");
  if (programs.some((program) => program.sections.some((section) => section.levelNumber < 1 || section.levelNumber > program.levelCount))) throw new SchoolOnboardingError("Choose a valid year level for every college section.", "programs");

  return withTransaction(async (connection) => {
    const context = await lockSchoolContext(connection, userId);
    if (context.education_scope === "basic") throw new SchoolOnboardingError("Higher Education is not enabled for this school.");
    if (!startsOn || !endsOn || startsOn < context.starts_on || endsOn > context.ends_on || startsOn >= endsOn) {
      throw new SchoolOnboardingError("Period dates must stay inside the active school year.", "periodDates");
    }
    const [periodResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO academic_periods (school_id, school_year_id, name, period_type, starts_on, ends_on, status)
       VALUES (:schoolId, :yearId, :periodName, :periodType, :startsOn, :endsOn, 'active')
       ON DUPLICATE KEY UPDATE period_type = VALUES(period_type), starts_on = VALUES(starts_on),
         ends_on = VALUES(ends_on), status = 'active', id = LAST_INSERT_ID(id)`,
      { schoolId: context.school_id, yearId: context.school_year_id, periodName, periodType: draft.periodType, startsOn, endsOn },
    );
    const periodId = Number(periodResult.insertId);
    await connection.execute(
      "UPDATE academic_periods SET status = 'upcoming' WHERE school_id = :schoolId AND school_year_id = :yearId AND id <> :periodId AND status = 'active'",
      { schoolId: context.school_id, yearId: context.school_year_id, periodId },
    );
    for (const program of programs) {
      const [programResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO academic_programs (school_id, code, name, status)
         VALUES (:schoolId, :programCode, :programName, 'active')
         ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'active', id = LAST_INSERT_ID(id)`,
        { schoolId: context.school_id, programCode: program.code, programName: program.name },
      );
      const programId = Number(programResult.insertId);
      const levelIds = new Map<number, number>();
      for (let level = 1; level <= program.levelCount; level += 1) {
        const [levelResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO program_year_levels (program_id, level_number, name)
           VALUES (:programId, :level, :name)
           ON DUPLICATE KEY UPDATE name = VALUES(name), id = LAST_INSERT_ID(id)`,
          { programId, level, name: `Year ${level}` },
        );
        levelIds.set(level, Number(levelResult.insertId));
      }
      for (const section of program.sections) {
        const levelId = levelIds.get(section.levelNumber);
        if (!levelId) throw new SchoolOnboardingError("Choose a valid year level for every college section.", "programs");
        await connection.execute(
          `INSERT INTO college_sections (school_id, academic_period_id, program_year_level_id, name)
           VALUES (:schoolId, :periodId, :levelId, :sectionName)
           ON DUPLICATE KEY UPDATE school_id = VALUES(school_id)`,
          { schoolId: context.school_id, periodId, levelId, sectionName: section.name },
        );
      }
    }
  });
}

async function withTransaction<T>(work: (connection: PoolConnection) => Promise<T>) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    if (error instanceof SchoolOnboardingError || error instanceof SchoolAcademicError) throw error;
    if (isDuplicate(error)) throw new SchoolOnboardingError("A record with that name or code already exists. Use a different value.");
    throw error;
  } finally {
    connection.release();
  }
}

async function lockAdminProfile(connection: PoolConnection, userId: number) {
  const [rows] = await connection.execute<Array<RowDataPacket & { school_id: number | null; school_name: string }>>(
    "SELECT school_id, school_name FROM admin_profiles WHERE user_id = :userId LIMIT 1 FOR UPDATE",
    { userId },
  );
  return rows[0] ?? null;
}

async function lockSchoolContext(connection: PoolConnection, userId: number) {
  const [rows] = await connection.execute<Array<RowDataPacket & {
    school_id: number;
    education_scope: EducationScope;
    school_year_id: number;
    starts_on: string;
    ends_on: string;
  }>>(
    `SELECT s.id AS school_id, s.education_scope, sy.id AS school_year_id,
            DATE_FORMAT(sy.starts_on, '%Y-%m-%d') starts_on, DATE_FORMAT(sy.ends_on, '%Y-%m-%d') ends_on
     FROM admin_profiles ap
     JOIN schools s ON s.id = ap.school_id
     JOIN school_years sy ON sy.school_id = s.id AND sy.status = 'active'
     WHERE ap.user_id = :userId
     LIMIT 1 FOR UPDATE`,
    { userId },
  );
  if (!rows[0]) throw new SchoolOnboardingError("Save an active school year first.");
  return rows[0];
}

function normalizeGrades(grades: BasicEducationSetupDraft["grades"]) {
  const seen = new Set<string>();
  return grades.flatMap((grade) => {
    const name = normalizeLabel(grade.name, 60);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return [];
    seen.add(key);
    const sections = [...new Set(grade.sections.map((section) => normalizeLabel(section, 60)).filter(Boolean))];
    return [{ name, sections }];
  });
}

function normalizeCollegePrograms(programs: CollegeInitialSetupDraft["programs"]) {
  const seenCodes = new Set<string>();
  return programs.map((program) => {
    const code = normalizeCode(program.code).slice(0, 30);
    const name = normalizeLabel(program.name, 140);
    const levelCount = Number(program.levelCount);
    if (seenCodes.has(code)) throw new SchoolOnboardingError(`Program code ${code || "(blank)"} is listed more than once.`, "programs");
    seenCodes.add(code);
    const seenSections = new Set<string>();
    const sections = program.sections.flatMap((section) => {
      const sectionName = normalizeLabel(section.name, 60);
      const levelNumber = Number(section.levelNumber);
      const key = `${levelNumber}:${sectionName.toLowerCase()}`;
      if (!sectionName || !Number.isInteger(levelNumber) || seenSections.has(key)) return [];
      seenSections.add(key);
      return [{ name: sectionName, levelNumber }];
    });
    return { code, name, levelCount, sections };
  });
}

function resolveCurrentStep(readiness: SchoolOnboardingState["readiness"], scope: EducationScope): 1 | 2 | 3 | 4 | 5 {
  if (!readiness.profile) return 1;
  if (!readiness.schoolYear) return 2;
  if (scope !== "higher" && !readiness.basic) return 3;
  if (scope !== "basic" && !readiness.college) return 4;
  return 5;
}

function emptyOnboardingState(schoolName: string): SchoolOnboardingState {
  return {
    schoolId: null,
    schoolName,
    schoolCode: suggestSchoolCode(schoolName),
    educationScope: "basic",
    activeYear: null,
    grades: [],
    college: { period: null, programs: [] },
    readiness: { profile: false, schoolYear: false, basic: false, college: true, complete: false },
    counts: { gradeLevels: 0, basicSections: 0, programs: 0, yearLevels: 0, periods: 0, collegeSections: 0 },
    currentStep: 1,
    warning: null,
  };
}

function normalizeLabel(value: string, length: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, length);
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function isDuplicate(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}
