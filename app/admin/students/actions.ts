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

function messageForError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Check that MySQL/XAMPP is running and the school setup is complete.";
}

function value(formData: FormData, key: string) {
  const fieldValue = formData.get(key);

  return typeof fieldValue === "string" ? fieldValue.trim() : "";
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
