"use server";

import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getAdminStaffRole } from "@/lib/admin/access";
import { canManageStudents } from "@/lib/admin/permissions";

export async function createStudentAction(formData: FormData) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  let connection: PoolConnection | null = null;

  try {
    if (!canManageStudents(staffRole)) {
      throw new Error("Your staff role cannot add or enroll students.");
    }

    const input = parseStudentForm(formData);

    if (!input.ok) {
      throw new Error(input.message);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const setup = await getAdminSetupForUpdate(connection, session.userId);

    if (!setup?.school_id || !setup.school_year_id) {
      throw new Error("Ask a school administrator to complete school setup first.");
    }

    const section = await getSection(connection, setup.school_id, setup.school_year_id, input.data.sectionId);

    if (!section || section.grade_level_id !== input.data.gradeLevelId) {
      throw new Error("Choose a section under the selected grade.");
    }

    const [studentResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO students (school_id, student_reference, first_name, middle_name, last_name, birthdate, status)
       VALUES (:schoolId, :studentReference, :firstName, :middleName, :lastName, :birthdate, 'active')`,
      {
        schoolId: setup.school_id,
        studentReference: input.data.studentReference,
        firstName: input.data.firstName,
        middleName: input.data.middleName,
        lastName: input.data.lastName,
        birthdate: input.data.birthdate,
      },
    );

    await connection.execute(
      `INSERT INTO enrollments (student_id, school_year_id, grade_level_id, section_id, status, submitted_at, enrolled_at)
       VALUES (:studentId, :schoolYearId, :gradeLevelId, :sectionId, 'enrolled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      {
        studentId: studentResult.insertId,
        schoolYearId: setup.school_year_id,
        gradeLevelId: input.data.gradeLevelId,
        sectionId: input.data.sectionId,
      },
    );

    await connection.commit();
    await setAuthFlashToast({
      role: "admin",
      title: "Student added",
      description: `${input.data.firstName} ${input.data.lastName} is enrolled for the active school year.`,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await setAuthFlashToast({
      role: "admin",
      title: "Student not added",
      description: duplicateStudent(error)
        ? "That student reference already exists for this school."
        : messageForError(error),
    });
  } finally {
    connection?.release();
  }

  redirect("/admin/students");
}

export async function enrollExistingStudentAction(formData: FormData) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  let connection: PoolConnection | null = null;

  try {
    if (!canManageStudents(staffRole)) {
      throw new Error("Your staff role cannot enroll students.");
    }

    const studentId = positiveInteger(formData.get("studentId"));
    const gradeLevelId = positiveInteger(formData.get("gradeLevelId"));
    const sectionId = positiveInteger(formData.get("sectionId"));

    if (!studentId || !gradeLevelId || !sectionId) {
      throw new Error("Choose a student, grade, and section.");
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const setup = await getAdminSetupForUpdate(connection, session.userId);

    if (!setup?.school_id || !setup.school_year_id) {
      throw new Error("Ask a school administrator to complete school setup first.");
    }

    const [studentRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id
       FROM students
       WHERE id = :studentId AND school_id = :schoolId
       LIMIT 1`,
      { studentId, schoolId: setup.school_id },
    );

    if (studentRows.length === 0) {
      throw new Error("That student is not part of this school.");
    }

    const [existingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, status
       FROM enrollments
       WHERE student_id = :studentId AND school_year_id = :schoolYearId
       LIMIT 1`,
      { studentId, schoolYearId: setup.school_year_id },
    );

    if (existingRows.length > 0) {
      throw new Error("This student is already enrolled for the active school year.");
    }

    const section = await getSection(connection, setup.school_id, setup.school_year_id, sectionId);

    if (!section || section.grade_level_id !== gradeLevelId) {
      throw new Error("Choose a section under the selected grade.");
    }

    await connection.execute(
      `INSERT INTO enrollments (student_id, school_year_id, grade_level_id, section_id, status, submitted_at, enrolled_at)
       VALUES (:studentId, :schoolYearId, :gradeLevelId, :sectionId, 'enrolled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      { studentId, schoolYearId: setup.school_year_id, gradeLevelId, sectionId },
    );

    const [nameRows] = await connection.execute<RowDataPacket[]>(
      `SELECT first_name, last_name
       FROM students
       WHERE id = :studentId
       LIMIT 1`,
      { studentId },
    );

    await connection.commit();
    await setAuthFlashToast({
      role: "admin",
      title: "Student enrolled",
      description: `${nameRows[0]?.first_name ?? "Student"} ${nameRows[0]?.last_name ?? ""} is now enrolled for the active school year.`,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await setAuthFlashToast({
      role: "admin",
      title: "Student not enrolled",
      description: duplicateEnrollment(error) ? "This student is already enrolled for the active school year." : messageForError(error),
    });
  } finally {
    connection?.release();
  }

  redirect("/admin/students");
}

export async function enrollExistingStudentsBatchAction(formData: FormData) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  let connection: PoolConnection | null = null;

  try {
    if (!canManageStudents(staffRole)) {
      throw new Error("Your staff role cannot enroll students.");
    }

    const input = parseExistingStudentPlacements(formData);

    if (!input.ok) {
      throw new Error(input.message);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const setup = await getAdminSetupForUpdate(connection, session.userId);

    if (!setup?.school_id || !setup.school_year_id) {
      throw new Error("Ask a school administrator to complete school setup first.");
    }

    let enrolledCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let skippedCount = 0;

    for (const placement of input.data) {
      if (placement.studentId <= 0 || placement.gradeLevelId <= 0 || placement.sectionId <= 0) {
        invalidCount += 1;
        continue;
      }

      const [studentRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id
         FROM students
         WHERE id = :studentId AND school_id = :schoolId
         LIMIT 1`,
        { studentId: placement.studentId, schoolId: setup.school_id },
      );

      if (studentRows.length === 0) {
        skippedCount += 1;
        continue;
      }

      const [existingRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id
         FROM enrollments
         WHERE student_id = :studentId AND school_year_id = :schoolYearId
         LIMIT 1`,
        { studentId: placement.studentId, schoolYearId: setup.school_year_id },
      );

      if (existingRows.length > 0) {
        duplicateCount += 1;
        continue;
      }

      const section = await getSection(connection, setup.school_id, setup.school_year_id, placement.sectionId);

      if (!section || section.grade_level_id !== placement.gradeLevelId) {
        invalidCount += 1;
        continue;
      }

      try {
        await connection.execute(
          `INSERT INTO enrollments (student_id, school_year_id, grade_level_id, section_id, status, submitted_at, enrolled_at)
           VALUES (:studentId, :schoolYearId, :gradeLevelId, :sectionId, 'enrolled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          {
            studentId: placement.studentId,
            schoolYearId: setup.school_year_id,
            gradeLevelId: placement.gradeLevelId,
            sectionId: placement.sectionId,
          },
        );
        enrolledCount += 1;
      } catch (error) {
        if (duplicateEnrollment(error)) {
          duplicateCount += 1;
          continue;
        }
        throw error;
      }
    }

    await connection.commit();
    await setAuthFlashToast({
      role: "admin",
      title: enrolledCount > 0 ? "Students enrolled" : "No students enrolled",
      description: existingEnrollmentBatchSummary(enrolledCount, duplicateCount, invalidCount, skippedCount),
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await setAuthFlashToast({
      role: "admin",
      title: "Students not enrolled",
      description: messageForError(error),
    });
  } finally {
    connection?.release();
  }

  redirect("/admin/students");
}

export async function createStudentsBatchAction(formData: FormData) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  let connection: PoolConnection | null = null;

  try {
    if (!canManageStudents(staffRole)) {
      throw new Error("Your staff role cannot add or enroll students.");
    }

    const input = parseBatchStudentsForm(formData);

    if (!input.ok) {
      throw new Error(input.message);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const setup = await getAdminSetupForUpdate(connection, session.userId);

    if (!setup?.school_id || !setup.school_year_id) {
      throw new Error("Ask a school administrator to complete school setup first.");
    }

    const duplicateRows: number[] = [];
    const invalidRows: number[] = [];
    const seenReferences = new Set<string>();
    let createdCount = 0;

    for (const [index, row] of input.data.entries()) {
      const rowNumber = index + 1;

      if (
        !row.studentReference
        || !row.firstName
        || !row.lastName
        || !Number.isInteger(row.gradeLevelId)
        || row.gradeLevelId <= 0
        || !Number.isInteger(row.sectionId)
        || row.sectionId <= 0
      ) {
        invalidRows.push(rowNumber);
        continue;
      }

      const normalizedReference = row.studentReference.toLowerCase();

      if (seenReferences.has(normalizedReference) || await studentReferenceExists(connection, setup.school_id, row.studentReference)) {
        duplicateRows.push(rowNumber);
        continue;
      }

      seenReferences.add(normalizedReference);
      const section = await getSection(connection, setup.school_id, setup.school_year_id, row.sectionId);

      if (!section || section.grade_level_id !== row.gradeLevelId) {
        invalidRows.push(rowNumber);
        continue;
      }

      try {
        const [studentResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO students (school_id, student_reference, first_name, middle_name, last_name, birthdate, status)
           VALUES (:schoolId, :studentReference, :firstName, :middleName, :lastName, :birthdate, 'active')`,
          {
            schoolId: setup.school_id,
            studentReference: row.studentReference,
            firstName: row.firstName,
            middleName: row.middleName,
            lastName: row.lastName,
            birthdate: row.birthdate,
          },
        );

        await connection.execute(
          `INSERT INTO enrollments (student_id, school_year_id, grade_level_id, section_id, status, submitted_at, enrolled_at)
           VALUES (:studentId, :schoolYearId, :gradeLevelId, :sectionId, 'enrolled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          {
            studentId: studentResult.insertId,
            schoolYearId: setup.school_year_id,
            gradeLevelId: row.gradeLevelId,
            sectionId: row.sectionId,
          },
        );
        createdCount += 1;
      } catch (error) {
        if (duplicateStudent(error)) {
          duplicateRows.push(rowNumber);
          continue;
        }
        throw error;
      }
    }

    await connection.commit();
    await setAuthFlashToast({
      role: "admin",
      title: createdCount > 0 ? "Students added" : "Students not added",
      description: batchSummary(createdCount, duplicateRows, invalidRows),
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await setAuthFlashToast({
      role: "admin",
      title: "Students not added",
      description: messageForError(error),
    });
  } finally {
    connection?.release();
  }

  redirect("/admin/students");
}

function parseStudentForm(formData: FormData) {
  const data = {
    studentReference: value(formData, "studentReference"),
    firstName: value(formData, "firstName"),
    middleName: value(formData, "middleName") || null,
    lastName: value(formData, "lastName"),
    birthdate: value(formData, "birthdate") || null,
    gradeLevelId: Number(value(formData, "gradeLevelId")),
    sectionId: Number(value(formData, "sectionId")),
  };

  if (!data.studentReference || !data.firstName || !data.lastName || !data.gradeLevelId || !data.sectionId) {
    return { ok: false as const, message: "Complete the required student fields." };
  }

  return { ok: true as const, data };
}

function positiveInteger(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseExistingStudentPlacements(formData: FormData) {
  const raw = value(formData, "placements");

  if (!raw) {
    return { ok: false as const, message: "Select at least one existing student." };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false as const, message: "The selected student placements could not be read. Try again." };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false as const, message: "Select at least one existing student." };
  }

  if (parsed.length > 200) {
    return { ok: false as const, message: "Enroll up to 200 existing students at a time." };
  }

  return {
    ok: true as const,
    data: parsed.map((item) => ({
      studentId: numberProperty(item, "studentId"),
      gradeLevelId: numberProperty(item, "gradeLevelId"),
      sectionId: numberProperty(item, "sectionId"),
    })),
  };
}

function parseBatchStudentsForm(formData: FormData) {
  const raw = value(formData, "students");

  if (!raw) {
    return { ok: false as const, message: "Add at least one student row." };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false as const, message: "The student list could not be read. Try again." };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false as const, message: "Add at least one student row." };
  }

  if (parsed.length > 50) {
    return { ok: false as const, message: "Add up to 50 students at a time." };
  }

  const rows: BatchStudentInput[] = [];

  for (const item of parsed) {
    rows.push({
      studentReference: stringProperty(item, "studentReference"),
      firstName: stringProperty(item, "firstName"),
      middleName: stringProperty(item, "middleName") || null,
      lastName: stringProperty(item, "lastName"),
      birthdate: stringProperty(item, "birthdate") || null,
      gradeLevelId: Number(stringProperty(item, "gradeLevelId")),
      sectionId: Number(stringProperty(item, "sectionId")),
    });
  }

  return { ok: true as const, data: rows };
}

function stringProperty(valueToCheck: unknown, key: string) {
  if (typeof valueToCheck !== "object" || valueToCheck === null) {
    return "";
  }

  const property = (valueToCheck as Record<string, unknown>)[key];
  return typeof property === "string" ? property.trim() : "";
}

async function studentReferenceExists(connection: PoolConnection, schoolId: number, studentReference: string) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id
     FROM students
     WHERE school_id = :schoolId AND LOWER(student_reference) = LOWER(:studentReference)
     LIMIT 1`,
    { schoolId, studentReference },
  );

  return rows.length > 0;
}

function batchSummary(createdCount: number, duplicateRows: number[], invalidRows: number[]) {
  const parts = [`${createdCount} student${createdCount === 1 ? "" : "s"} added.`];

  if (duplicateRows.length > 0) {
    parts.push(`${duplicateRows.length} skipped because the reference already exists (row${duplicateRows.length === 1 ? "" : "s"} ${duplicateRows.join(", ")}).`);
  }

  if (invalidRows.length > 0) {
    parts.push(`${invalidRows.length} row${invalidRows.length === 1 ? "" : "s"} need correction (row${invalidRows.length === 1 ? "" : "s"} ${invalidRows.join(", ")}).`);
  }

  return parts.join(" ");
}

async function getAdminSetupForUpdate(connection: PoolConnection, adminUserId: number) {
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
    return null;
  }

  const schoolId = await resolveSchoolIdForProfile(connection, profile);

  if (!schoolId) {
    return { school_id: null, school_year_id: null };
  }

  const [rows] = await connection.execute<AdminSetupRow[]>(
    `SELECT :schoolId AS school_id, sy.id AS school_year_id
     FROM school_years sy
     WHERE sy.school_id = :schoolId AND sy.status = 'active'
     ORDER BY sy.starts_on DESC, sy.id DESC
     LIMIT 1`,
    { schoolId },
  );

  return rows[0] ?? { school_id: schoolId, school_year_id: null };
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

async function getSchoolById(connection: PoolConnection, schoolId: number) {
  const [rows] = await connection.execute<SchoolMatchRow[]>(
    `SELECT id
     FROM schools
     WHERE id = :schoolId
     LIMIT 1`,
    { schoolId },
  );

  return rows[0] ?? null;
}

async function getSchoolByName(connection: PoolConnection, schoolName: string) {
  const [rows] = await connection.execute<SchoolMatchRow[]>(
    `SELECT id
     FROM schools
     WHERE name = :schoolName
     ORDER BY status = 'active' DESC, id ASC
     LIMIT 1`,
    { schoolName },
  );

  return rows[0] ?? null;
}

async function getSection(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
  sectionId: number,
) {
  const [rows] = await connection.execute<SectionRow[]>(
    `SELECT id, grade_level_id
     FROM sections
     WHERE id = :sectionId AND school_id = :schoolId AND school_year_id = :schoolYearId
     LIMIT 1`,
    { sectionId, schoolId, schoolYearId },
  );

  return rows[0] ?? null;
}

function duplicateStudent(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}

function duplicateEnrollment(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY");
}

function existingEnrollmentBatchSummary(enrolled: number, duplicates: number, invalid: number, skipped: number) {
  const parts = [
    `${enrolled} student${enrolled === 1 ? "" : "s"} enrolled`,
    duplicates > 0 ? `${duplicates} already enrolled` : "",
    invalid > 0 ? `${invalid} row${invalid === 1 ? "" : "s"} need${invalid === 1 ? "s" : ""} correction` : "",
    skipped > 0 ? `${skipped} student${skipped === 1 ? "" : "s"} skipped` : "",
  ].filter(Boolean);

  return parts.join(". ") + ".";
}

function messageForError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Check that MySQL/XAMPP is running and the school setup is complete.";
}

function value(formData: FormData, key: string) {
  const fieldValue = formData.get(key);

  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}

function numberProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return 0;
  }

  const parsed = Number((value as Record<string, unknown>)[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

type AdminSetupRow = RowDataPacket & {
  school_id: number | null;
  school_year_id: number | null;
};

type AdminProfileSetupRow = RowDataPacket & {
  user_id: number;
  school_id: number | null;
  school_name: string;
};

type SchoolMatchRow = RowDataPacket & {
  id: number;
};

type SectionRow = RowDataPacket & {
  id: number;
  grade_level_id: number;
};

type BatchStudentInput = {
  studentReference: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthdate: string | null;
  gradeLevelId: number;
  sectionId: number;
};
