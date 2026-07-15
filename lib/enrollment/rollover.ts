import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export type RolloverDecision = "promote" | "repeat" | "skip";
export type RolloverStudentType = "new" | "transferee" | "returned";

export type RolloverPromotion = {
  studentId: number;
  targetGradeLevelId: number;
  targetSectionId: number;
  decision: RolloverDecision;
  studentType: RolloverStudentType;
};

export type RolloverResult = {
  promotedCount: number;
  repeatCount: number;
  skippedCount: number;
  duplicateCount: number;
  reviewCount: number;
};

export class RolloverValidationError extends Error {}

export function parseRolloverPromotions(raw: string): RolloverPromotion[] {
  if (!raw) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.slice(0, 200).map((item) => ({
    studentId: positiveInteger(item, "studentId"),
    targetGradeLevelId: positiveInteger(item, "targetGradeLevelId"),
    targetSectionId: positiveInteger(item, "targetSectionId"),
    decision: decisionValue(item),
    studentType: studentTypeValue(item),
  }));
}

export async function applyRolloverPromotions(
  connection: PoolConnection,
  {
    schoolId,
    sourceSchoolYearId,
    targetSchoolYearId,
    promotions,
  }: {
    schoolId: number;
    sourceSchoolYearId: number;
    targetSchoolYearId: number;
    promotions: RolloverPromotion[];
  },
): Promise<RolloverResult> {
  if (sourceSchoolYearId === targetSchoolYearId) {
    throw new RolloverValidationError("Choose different source and target school years.");
  }

  const sourceYear = await getSchoolYear(connection, schoolId, sourceSchoolYearId);
  const targetYear = await getSchoolYear(connection, schoolId, targetSchoolYearId);

  if (!sourceYear || !targetYear) {
    throw new RolloverValidationError("Choose valid school years from this school.");
  }

  if (targetYear.status !== "upcoming") {
    throw new RolloverValidationError("Only an upcoming school year can receive rollover enrollments.");
  }

  const result: RolloverResult = {
    promotedCount: 0,
    repeatCount: 0,
    skippedCount: 0,
    duplicateCount: 0,
    reviewCount: 0,
  };

  for (const promotion of promotions) {
    if (promotion.decision === "skip") {
      result.skippedCount += 1;
      continue;
    }

    if (!promotion.studentId || !promotion.targetGradeLevelId || !promotion.targetSectionId) {
      result.reviewCount += 1;
      continue;
    }

    const sourceStudent = await getSourceStudent(connection, schoolId, sourceSchoolYearId, promotion.studentId);
    const targetSection = await getTargetSection(connection, schoolId, targetSchoolYearId, promotion.targetSectionId);

    if (!sourceStudent || !targetSection || targetSection.grade_level_id !== promotion.targetGradeLevelId) {
      result.reviewCount += 1;
      continue;
    }

    if (await hasTargetEnrollment(connection, promotion.studentId, targetSchoolYearId)) {
      result.duplicateCount += 1;
      continue;
    }

    await connection.execute(
      `INSERT INTO enrollments (
         student_id, school_year_id, grade_level_id, section_id, student_type, status, submitted_at, enrolled_at
       ) VALUES (
         :studentId, :schoolYearId, :gradeLevelId, :sectionId, :studentType, 'enrolled', NOW(), NOW()
       )`,
      {
        studentId: sourceStudent.id,
        schoolYearId: targetSchoolYearId,
        gradeLevelId: targetSection.grade_level_id,
      sectionId: targetSection.id,
      studentType: promotion.studentType,
      },
    );

    if (promotion.decision === "repeat") {
      result.repeatCount += 1;
    } else {
      result.promotedCount += 1;
    }
  }

  return result;
}

async function getSchoolYear(connection: PoolConnection, schoolId: number, schoolYearId: number) {
  const [rows] = await connection.execute<Array<RowDataPacket & {
    id: number;
    status: "upcoming" | "active" | "closed";
  }>>(
    `SELECT id, status
     FROM school_years
     WHERE id = :schoolYearId AND school_id = :schoolId
     LIMIT 1
     FOR UPDATE`,
    { schoolId, schoolYearId },
  );

  return rows[0] ?? null;
}

async function getSourceStudent(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
  studentId: number,
) {
  const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT st.id
     FROM students st
     JOIN enrollments e ON e.student_id = st.id
     WHERE st.id = :studentId
       AND st.school_id = :schoolId
       AND e.school_year_id = :schoolYearId
       AND e.status = 'enrolled'
     LIMIT 1
     FOR UPDATE`,
    { studentId, schoolId, schoolYearId },
  );

  return rows[0] ?? null;
}

async function getTargetSection(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
  sectionId: number,
) {
  const [rows] = await connection.execute<Array<RowDataPacket & {
    id: number;
    grade_level_id: number;
  }>>(
    `SELECT sec.id, sec.grade_level_id
     FROM sections sec
     JOIN school_years sy ON sy.id = sec.school_year_id
     JOIN grade_levels gl ON gl.id = sec.grade_level_id
     WHERE sec.id = :sectionId
       AND sec.school_id = :schoolId
       AND sec.school_year_id = :schoolYearId
       AND sy.school_id = :schoolId
       AND gl.school_id = :schoolId
     LIMIT 1`,
    { sectionId, schoolId, schoolYearId },
  );

  return rows[0] ?? null;
}

async function hasTargetEnrollment(connection: PoolConnection, studentId: number, schoolYearId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id
     FROM enrollments
     WHERE student_id = :studentId AND school_year_id = :schoolYearId
     LIMIT 1`,
    { studentId, schoolYearId },
  );

  return rows.length > 0;
}

function positiveInteger(value: unknown, key: string) {
  if (typeof value !== "object" || value === null) {
    return 0;
  }

  const parsed = Number((value as Record<string, unknown>)[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function decisionValue(value: unknown): RolloverDecision {
  if (typeof value !== "object" || value === null) {
    return "skip";
  }

  const decision = (value as Record<string, unknown>).decision;
  return decision === "promote" || decision === "repeat" ? decision : "skip";
}

function studentTypeValue(value: unknown): RolloverStudentType {
  if (typeof value !== "object" || value === null) return "returned";
  const type = (value as Record<string, unknown>).studentType;
  return type === "new" || type === "transferee" || type === "returned" ? type : "returned";
}
