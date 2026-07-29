import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getResolvedAdminSchoolViewSetup } from "@/lib/school/setup";

const studentSexes = new Set(["male", "female"]);
const studentTypes = new Set(["new", "transferee", "returned"]);
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export type StudentProfileField =
  | "studentReference"
  | "firstName"
  | "middleName"
  | "lastName"
  | "birthdate"
  | "sex"
  | "gradeLevelId"
  | "sectionId"
  | "studentType";

export class StudentProfileValidationError extends Error {
  fieldErrors: Partial<Record<StudentProfileField, string>>;

  constructor(message: string, fieldErrors: Partial<Record<StudentProfileField, string>> = {}) {
    super(message);
    this.name = "StudentProfileValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export async function updateAdminStudentProfile(adminUserId: number, formData: FormData) {
  const input = parseStudentProfileForm(formData);
  const setup = await getResolvedAdminSchoolViewSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    throw new StudentProfileValidationError("Complete the school and school-year setup before editing student details.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const student = await lockStudent(connection, input.studentId, setup.schoolId);

    if (!student) {
      throw new StudentProfileValidationError("This student is unavailable or does not belong to your school.");
    }

    await requireUniqueReference(connection, setup.schoolId, input.studentId, input.studentReference);
    const placement = input.enrollmentId
      ? await validatePlacementUpdate(connection, setup, input)
      : null;

    await connection.execute<ResultSetHeader>(
      `UPDATE students
       SET student_reference = :studentReference,
           first_name = :firstName,
           middle_name = :middleName,
           last_name = :lastName,
           birthdate = :birthdate,
           sex = :sex
       WHERE id = :studentId AND school_id = :schoolId`,
      {
        studentId: input.studentId,
        schoolId: setup.schoolId,
        studentReference: input.studentReference,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        birthdate: input.birthdate,
        sex: input.sex,
      },
    );

    if (placement) {
      await connection.execute<ResultSetHeader>(
        `UPDATE enrollments
         SET grade_level_id = :gradeLevelId,
             section_id = :sectionId,
             student_type = :studentType
         WHERE id = :enrollmentId
           AND student_id = :studentId
           AND school_year_id = :schoolYearId`,
        {
          enrollmentId: placement.id,
          studentId: input.studentId,
          schoolYearId: placement.schoolYearId,
          gradeLevelId: input.gradeLevelId,
          sectionId: input.sectionId,
          studentType: input.studentType,
        },
      );
    }

    await connection.commit();

    return {
      studentId: input.studentId,
      fullName: [input.firstName, input.middleName, input.lastName].filter(Boolean).join(" "),
      placementUpdated: Boolean(placement),
    };
  } catch (error) {
    await connection.rollback().catch(() => undefined);

    if (isDuplicateEntry(error)) {
      throw new StudentProfileValidationError(
        "That student reference is already used by another student in this school.",
        { studentReference: "Use a unique student reference for this school." },
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

function parseStudentProfileForm(formData: FormData) {
  const input = {
    studentId: positiveInteger(formData.get("studentId")),
    enrollmentId: optionalPositiveInteger(formData.get("enrollmentId")),
    studentReference: formValue(formData, "studentReference"),
    firstName: formValue(formData, "firstName"),
    middleName: formValue(formData, "middleName") || null,
    lastName: formValue(formData, "lastName"),
    birthdate: formValue(formData, "birthdate") || null,
    sex: formValue(formData, "sex"),
    gradeLevelId: optionalPositiveInteger(formData.get("gradeLevelId")),
    sectionId: optionalPositiveInteger(formData.get("sectionId")),
    studentType: formValue(formData, "studentType"),
  };
  const fieldErrors: Partial<Record<StudentProfileField, string>> = {};

  if (!input.studentId) {
    throw new StudentProfileValidationError("Choose a valid student profile.");
  }

  requiredText(fieldErrors, "studentReference", input.studentReference, 60, "Student reference");
  requiredText(fieldErrors, "firstName", input.firstName, 80, "First name");
  optionalText(fieldErrors, "middleName", input.middleName, 80, "Middle name");
  requiredText(fieldErrors, "lastName", input.lastName, 80, "Last name");

  if (input.birthdate && (!validDateKey(input.birthdate) || input.birthdate > todayDateKey())) {
    fieldErrors.birthdate = "Enter a real birthdate that is not in the future.";
  }

  if (!studentSexes.has(input.sex)) {
    fieldErrors.sex = "Choose Male or Female.";
  }

  if (input.enrollmentId) {
    if (!input.gradeLevelId) fieldErrors.gradeLevelId = "Choose a grade level.";
    if (!input.sectionId) fieldErrors.sectionId = "Choose a section.";
    if (!studentTypes.has(input.studentType)) fieldErrors.studentType = "Choose a valid student type.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new StudentProfileValidationError("Correct the highlighted student details.", fieldErrors);
  }

  return input;
}

async function lockStudent(connection: PoolConnection, studentId: number, schoolId: number) {
  const [rows] = await connection.execute<StudentLockRow[]>(
    `SELECT id
     FROM students
     WHERE id = :studentId AND school_id = :schoolId
     LIMIT 1
     FOR UPDATE`,
    { studentId, schoolId },
  );

  return rows[0] ?? null;
}

async function requireUniqueReference(
  connection: PoolConnection,
  schoolId: number,
  studentId: number,
  studentReference: string,
) {
  const [rows] = await connection.execute<StudentLockRow[]>(
    `SELECT id
     FROM students
     WHERE school_id = :schoolId
       AND LOWER(student_reference) = LOWER(:studentReference)
       AND id <> :studentId
     LIMIT 1
     FOR UPDATE`,
    { schoolId, studentId, studentReference },
  );

  if (rows.length > 0) {
    throw new StudentProfileValidationError(
      "That student reference is already used by another student in this school.",
      { studentReference: "Use a unique student reference for this school." },
    );
  }
}

async function validatePlacementUpdate(
  connection: PoolConnection,
  setup: Awaited<ReturnType<typeof getResolvedAdminSchoolViewSetup>>,
  input: ReturnType<typeof parseStudentProfileForm>,
) {
  if (!setup.selectedSchoolYearIsActive || !setup.activeSchoolYearId || setup.schoolYearId !== setup.activeSchoolYearId) {
    throw new StudentProfileValidationError(
      "The active school year changed or a historical year is selected. Refresh before editing placement.",
    );
  }

  const [yearRows] = await connection.execute<SchoolYearLockRow[]>(
    `SELECT id
     FROM school_years
     WHERE id = :schoolYearId AND school_id = :schoolId AND status = 'active'
     LIMIT 1
     FOR UPDATE`,
    { schoolYearId: setup.activeSchoolYearId, schoolId: setup.schoolId },
  );

  if (!yearRows[0]) {
    throw new StudentProfileValidationError("The active school year changed. Refresh before editing placement.");
  }

  const [enrollmentRows] = await connection.execute<EnrollmentLockRow[]>(
    `SELECT id, school_year_id
     FROM enrollments
     WHERE id = :enrollmentId
       AND student_id = :studentId
       AND school_year_id = :schoolYearId
     LIMIT 1
     FOR UPDATE`,
    {
      enrollmentId: input.enrollmentId,
      studentId: input.studentId,
      schoolYearId: setup.activeSchoolYearId,
    },
  );
  const enrollment = enrollmentRows[0];

  if (!enrollment) {
    throw new StudentProfileValidationError(
      "The active-year enrollment is unavailable. Use Enroll existing students before editing placement.",
    );
  }

  const [sectionRows] = await connection.execute<StudentLockRow[]>(
    `SELECT s.id
     FROM sections s
     JOIN grade_levels gl ON gl.id = s.grade_level_id
     WHERE s.id = :sectionId
       AND s.school_id = :schoolId
       AND s.school_year_id = :schoolYearId
       AND s.grade_level_id = :gradeLevelId
       AND gl.school_id = :schoolId
     LIMIT 1`,
    {
      sectionId: input.sectionId,
      schoolId: setup.schoolId,
      schoolYearId: setup.activeSchoolYearId,
      gradeLevelId: input.gradeLevelId,
    },
  );

  if (!sectionRows[0]) {
    throw new StudentProfileValidationError("Choose a section under the selected grade and active school year.", {
      sectionId: "Choose a section that belongs to the selected grade.",
    });
  }

  return { id: enrollment.id, schoolYearId: enrollment.school_year_id };
}

function requiredText(
  errors: Partial<Record<StudentProfileField, string>>,
  field: StudentProfileField,
  value: string,
  maxLength: number,
  label: string,
) {
  if (!value) errors[field] = `${label} is required.`;
  else if (value.length > maxLength) errors[field] = `${label} must be ${maxLength} characters or fewer.`;
}

function optionalText(
  errors: Partial<Record<StudentProfileField, string>>,
  field: StudentProfileField,
  value: string | null,
  maxLength: number,
  label: string,
) {
  if (value && value.length > maxLength) errors[field] = `${label} must be ${maxLength} characters or fewer.`;
}

function validDateKey(value: string) {
  if (!dateKeyPattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function positiveInteger(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function optionalPositiveInteger(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  return positiveInteger(value);
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY");
}

type StudentLockRow = RowDataPacket & { id: number };
type SchoolYearLockRow = RowDataPacket & { id: number };
type EnrollmentLockRow = RowDataPacket & { id: number; school_year_id: number };
