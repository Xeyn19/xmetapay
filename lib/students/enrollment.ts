import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

const studentSexes = new Set(["male", "female"]);
const studentTypes = new Set(["new", "transferee", "returned"]);

export type StudentName = {
  firstName: string;
  lastName: string;
};

export type StudentBatchResult = {
  createdCount: number;
  duplicateRows: number[];
  invalidRows: number[];
};

export type ExistingEnrollmentBatchResult = {
  enrolledCount: number;
  duplicateCount: number;
  invalidCount: number;
  skippedCount: number;
};

export async function createStudentForActiveYear(adminUserId: number, formData: FormData): Promise<StudentName> {
  const input = parseStudentForm(formData);

  if (!input.ok) {
    throw new Error(input.message);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const setup = await requireActiveSetup(connection, adminUserId);
    await requireValidSection(connection, setup.schoolId, setup.schoolYearId, input.data.gradeLevelId, input.data.sectionId);
    const studentId = await insertStudent(connection, setup.schoolId, input.data);
    await insertEnrollment(connection, studentId, setup.schoolYearId, input.data);
    await connection.commit();

    return { firstName: input.data.firstName, lastName: input.data.lastName };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function createStudentsForActiveYear(adminUserId: number, formData: FormData): Promise<StudentBatchResult> {
  const input = parseBatchStudentsForm(formData);

  if (!input.ok) {
    throw new Error(input.message);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const setup = await requireActiveSetup(connection, adminUserId);
    const duplicateRows: number[] = [];
    const invalidRows: number[] = [];
    const seenReferences = new Set<string>();
    let createdCount = 0;

    for (const [index, row] of input.data.entries()) {
      const rowNumber = index + 1;

      if (!validStudentInput(row)) {
        invalidRows.push(rowNumber);
        continue;
      }

      const normalizedReference = row.studentReference.toLowerCase();

      if (seenReferences.has(normalizedReference) || await studentReferenceExists(connection, setup.schoolId, row.studentReference)) {
        duplicateRows.push(rowNumber);
        continue;
      }

      seenReferences.add(normalizedReference);

      if (!await validSection(connection, setup.schoolId, setup.schoolYearId, row.gradeLevelId, row.sectionId)) {
        invalidRows.push(rowNumber);
        continue;
      }

      try {
        const studentId = await insertStudent(connection, setup.schoolId, row);
        await insertEnrollment(connection, studentId, setup.schoolYearId, row);
        createdCount += 1;
      } catch (error) {
        if (isDuplicateEntry(error)) {
          duplicateRows.push(rowNumber);
          continue;
        }
        throw error;
      }
    }

    await connection.commit();
    return { createdCount, duplicateRows, invalidRows };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function enrollExistingStudentsForActiveYear(
  adminUserId: number,
  formData: FormData,
): Promise<ExistingEnrollmentBatchResult> {
  const input = parseExistingStudentPlacements(formData);

  if (!input.ok) {
    throw new Error(input.message);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const setup = await requireActiveSetup(connection, adminUserId);
    let enrolledCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let skippedCount = 0;

    for (const placement of input.data) {
      if (!validPlacement(placement)) {
        invalidCount += 1;
        continue;
      }

      if (!await studentBelongsToSchool(connection, placement.studentId, setup.schoolId)) {
        skippedCount += 1;
        continue;
      }

      if (await enrollmentExists(connection, placement.studentId, setup.schoolYearId)) {
        duplicateCount += 1;
        continue;
      }

      if (!await validSection(connection, setup.schoolId, setup.schoolYearId, placement.gradeLevelId, placement.sectionId)) {
        invalidCount += 1;
        continue;
      }

      try {
        await insertEnrollment(connection, placement.studentId, setup.schoolYearId, placement);
        enrolledCount += 1;
      } catch (error) {
        if (isDuplicateEntry(error)) {
          duplicateCount += 1;
          continue;
        }
        throw error;
      }
    }

    await connection.commit();
    return { enrolledCount, duplicateCount, invalidCount, skippedCount };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY");
}

function parseStudentForm(formData: FormData) {
  const data: StudentInput = {
    studentReference: formValue(formData, "studentReference"),
    firstName: formValue(formData, "firstName"),
    middleName: formValue(formData, "middleName") || null,
    lastName: formValue(formData, "lastName"),
    birthdate: formValue(formData, "birthdate") || null,
    sex: formValue(formData, "sex"),
    studentType: formValue(formData, "studentType"),
    gradeLevelId: Number(formValue(formData, "gradeLevelId")),
    sectionId: Number(formValue(formData, "sectionId")),
  };

  return validStudentInput(data)
    ? { ok: true as const, data }
    : { ok: false as const, message: "Complete the required student fields." };
}

function parseBatchStudentsForm(formData: FormData) {
  const parsed = parseJsonArray(formValue(formData, "students"), "Add at least one student row.", "The student list could not be read. Try again.");

  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.data.length > 50) {
    return { ok: false as const, message: "Add up to 50 students at a time." };
  }

  return {
    ok: true as const,
    data: parsed.data.map((item): StudentInput => ({
      studentReference: stringProperty(item, "studentReference"),
      firstName: stringProperty(item, "firstName"),
      middleName: stringProperty(item, "middleName") || null,
      lastName: stringProperty(item, "lastName"),
      birthdate: stringProperty(item, "birthdate") || null,
      sex: stringProperty(item, "sex"),
      studentType: stringProperty(item, "studentType"),
      gradeLevelId: numberProperty(item, "gradeLevelId"),
      sectionId: numberProperty(item, "sectionId"),
    })),
  };
}

function parseExistingStudentPlacements(formData: FormData) {
  const parsed = parseJsonArray(formValue(formData, "placements"), "Select at least one existing student.", "The selected student placements could not be read. Try again.");

  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.data.length > 200) {
    return { ok: false as const, message: "Enroll up to 200 existing students at a time." };
  }

  return {
    ok: true as const,
    data: parsed.data.map((item): ExistingPlacement => ({
      studentId: numberProperty(item, "studentId"),
      gradeLevelId: numberProperty(item, "gradeLevelId"),
      sectionId: numberProperty(item, "sectionId"),
      studentType: stringProperty(item, "studentType"),
    })),
  };
}

function parseJsonArray(raw: string, emptyMessage: string, invalidMessage: string) {
  if (!raw) {
    return { ok: false as const, message: emptyMessage };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? { ok: true as const, data: parsed }
      : { ok: false as const, message: emptyMessage };
  } catch {
    return { ok: false as const, message: invalidMessage };
  }
}

function validStudentInput(input: StudentInput) {
  return Boolean(
    input.studentReference
    && input.firstName
    && input.lastName
    && studentSexes.has(input.sex)
    && studentTypes.has(input.studentType)
    && Number.isInteger(input.gradeLevelId)
    && input.gradeLevelId > 0
    && Number.isInteger(input.sectionId)
    && input.sectionId > 0,
  );
}

function validPlacement(input: ExistingPlacement) {
  return input.studentId > 0
    && input.gradeLevelId > 0
    && input.sectionId > 0
    && studentTypes.has(input.studentType);
}

async function requireActiveSetup(connection: PoolConnection, adminUserId: number) {
  const [profileRows] = await connection.execute<AdminProfileSetupRow[]>(
    `SELECT ap.user_id, ap.school_id, ap.school_name
     FROM admin_profiles ap
     WHERE ap.user_id = :adminUserId
     LIMIT 1
     FOR UPDATE`,
    { adminUserId },
  );
  const profile = profileRows[0];

  if (!profile) {
    throw new Error("Ask a school administrator to complete school setup first.");
  }

  const schoolId = await resolveSchoolIdForProfile(connection, profile);

  if (!schoolId) {
    throw new Error("Ask a school administrator to complete school setup first.");
  }

  const [yearRows] = await connection.execute<SchoolYearRow[]>(
    `SELECT id
     FROM school_years
     WHERE school_id = :schoolId AND status = 'active'
     ORDER BY starts_on DESC, id DESC
     LIMIT 1`,
    { schoolId },
  );

  if (!yearRows[0]) {
    throw new Error("Ask a school administrator to complete school setup first.");
  }

  return { schoolId, schoolYearId: yearRows[0].id };
}

async function resolveSchoolIdForProfile(connection: PoolConnection, profile: AdminProfileSetupRow) {
  const school = profile.school_id
    ? (await getSchoolById(connection, profile.school_id)) ?? await getSchoolByName(connection, profile.school_name)
    : await getSchoolByName(connection, profile.school_name);
  const schoolId = school?.id ?? null;

  if (schoolId && profile.school_id !== schoolId) {
    await connection.execute(
      `UPDATE admin_profiles
       SET school_id = :schoolId
       WHERE user_id = :userId AND (school_id IS NULL OR school_id <> :schoolId)`,
      { schoolId, userId: profile.user_id },
    );
  }

  return schoolId;
}

async function requireValidSection(connection: PoolConnection, schoolId: number, schoolYearId: number, gradeLevelId: number, sectionId: number) {
  if (!await validSection(connection, schoolId, schoolYearId, gradeLevelId, sectionId)) {
    throw new Error("Choose a section under the selected grade.");
  }
}

async function validSection(connection: PoolConnection, schoolId: number, schoolYearId: number, gradeLevelId: number, sectionId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id
     FROM sections
     WHERE id = :sectionId
       AND school_id = :schoolId
       AND school_year_id = :schoolYearId
       AND grade_level_id = :gradeLevelId
     LIMIT 1`,
    { sectionId, schoolId, schoolYearId, gradeLevelId },
  );
  return rows.length > 0;
}

async function insertStudent(connection: PoolConnection, schoolId: number, input: StudentInput) {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO students (school_id, student_reference, first_name, middle_name, last_name, birthdate, sex, status)
     VALUES (:schoolId, :studentReference, :firstName, :middleName, :lastName, :birthdate, :sex, 'active')`,
    { schoolId, ...input },
  );
  return result.insertId;
}

async function insertEnrollment(connection: PoolConnection, studentId: number, schoolYearId: number, input: EnrollmentPlacement) {
  await connection.execute(
    `INSERT INTO enrollments (student_id, school_year_id, grade_level_id, section_id, student_type, status, submitted_at, enrolled_at)
     VALUES (:studentId, :schoolYearId, :gradeLevelId, :sectionId, :studentType, 'enrolled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    { studentId, schoolYearId, gradeLevelId: input.gradeLevelId, sectionId: input.sectionId, studentType: input.studentType },
  );
}

async function studentReferenceExists(connection: PoolConnection, schoolId: number, studentReference: string) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM students
     WHERE school_id = :schoolId AND LOWER(student_reference) = LOWER(:studentReference)
     LIMIT 1`,
    { schoolId, studentReference },
  );
  return rows.length > 0;
}

async function studentBelongsToSchool(connection: PoolConnection, studentId: number, schoolId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM students WHERE id = :studentId AND school_id = :schoolId LIMIT 1`,
    { studentId, schoolId },
  );
  return rows.length > 0;
}

async function enrollmentExists(connection: PoolConnection, studentId: number, schoolYearId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM enrollments WHERE student_id = :studentId AND school_year_id = :schoolYearId LIMIT 1`,
    { studentId, schoolYearId },
  );
  return rows.length > 0;
}

async function getSchoolById(connection: PoolConnection, schoolId: number) {
  const [rows] = await connection.execute<SchoolMatchRow[]>("SELECT id FROM schools WHERE id = :schoolId LIMIT 1", { schoolId });
  return rows[0] ?? null;
}

async function getSchoolByName(connection: PoolConnection, schoolName: string) {
  const [rows] = await connection.execute<SchoolMatchRow[]>(
    `SELECT id FROM schools WHERE name = :schoolName ORDER BY status = 'active' DESC, id ASC LIMIT 1`,
    { schoolName },
  );
  return rows[0] ?? null;
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function stringProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property.trim() : "";
}

function numberProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object") return 0;
  const parsed = Number((value as Record<string, unknown>)[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

type EnrollmentPlacement = { gradeLevelId: number; sectionId: number; studentType: string };
type ExistingPlacement = EnrollmentPlacement & { studentId: number };
type StudentInput = EnrollmentPlacement & {
  studentReference: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthdate: string | null;
  sex: string;
};
type AdminProfileSetupRow = RowDataPacket & { user_id: number; school_id: number | null; school_name: string };
type SchoolMatchRow = RowDataPacket & { id: number };
type SchoolYearRow = RowDataPacket & { id: number };
