"use server";

import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";

const defaultSchoolYear = {
  name: "2025-2026",
  startsOn: "2025-06-01",
  endsOn: "2026-03-31",
};

const defaultGradeLevels = Array.from({ length: 10 }, (_, index) => ({
  name: `Grade ${index + 1}`,
  sortOrder: index + 1,
}));

const starterSectionName = "Section A";

export async function initializeSchoolSetupAction() {
  const session = await requireRole("admin");
  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const profile = await getAdminProfileForUpdate(connection, session.userId);

    if (!profile) {
      throw new Error("Admin profile was not found.");
    }

    const schoolId = await ensureSchool(connection, profile, session.userId);
    await connection.execute(
      `UPDATE admin_profiles
       SET school_id = :schoolId
       WHERE user_id = :userId`,
      { schoolId, userId: session.userId },
    );

    const schoolYearId = await ensureSchoolYear(connection, schoolId);
    const gradeLevelIds = await ensureGradeLevels(connection, schoolId);
    await ensureSections(connection, schoolId, schoolYearId, gradeLevelIds);

    await connection.commit();
    await setAuthFlashToast({
      role: "admin",
      title: "School setup ready",
      description: "Your school year, grade levels, and starter sections are ready.",
    });
  } catch {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await setAuthFlashToast({
      role: "admin",
      title: "School setup not completed",
      description: "Import the school setup migration, confirm MySQL is running, then try again.",
    });
  } finally {
    connection?.release();
  }

  redirect("/admin/dashboard");
}

async function getAdminProfileForUpdate(connection: PoolConnection, userId: number) {
  const [rows] = await connection.execute<AdminProfileRow[]>(
    `SELECT id, user_id, school_id, school_name
     FROM admin_profiles
     WHERE user_id = :userId
     LIMIT 1
     FOR UPDATE`,
    { userId },
  );

  return rows[0] ?? null;
}

async function ensureSchool(connection: PoolConnection, profile: AdminProfileRow, userId: number) {
  if (profile.school_id) {
    const linkedSchool = await getSchoolById(connection, profile.school_id);

    if (linkedSchool) {
      return linkedSchool.id;
    }
  }

  const existingSchool = await getSchoolByName(connection, profile.school_name);

  if (existingSchool) {
    return existingSchool.id;
  }

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO schools (name, code, status)
     VALUES (:name, :code, 'active')
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       status = VALUES(status),
       id = LAST_INSERT_ID(id)`,
    {
      name: profile.school_name,
      code: schoolCodeFor(profile.school_name, userId),
    },
  );

  return Number(result.insertId);
}

async function getSchoolById(connection: PoolConnection, schoolId: number) {
  const [rows] = await connection.execute<SchoolRow[]>(
    `SELECT id
     FROM schools
     WHERE id = :schoolId
     LIMIT 1`,
    { schoolId },
  );

  return rows[0] ?? null;
}

async function getSchoolByName(connection: PoolConnection, schoolName: string) {
  const [rows] = await connection.execute<SchoolRow[]>(
    `SELECT id
     FROM schools
     WHERE name = :schoolName
     ORDER BY status = 'active' DESC, id ASC
     LIMIT 1`,
    { schoolName },
  );

  return rows[0] ?? null;
}

async function ensureSchoolYear(connection: PoolConnection, schoolId: number) {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO school_years (school_id, name, starts_on, ends_on, status)
     VALUES (:schoolId, :name, :startsOn, :endsOn, 'active')
     ON DUPLICATE KEY UPDATE
       starts_on = VALUES(starts_on),
       ends_on = VALUES(ends_on),
       status = VALUES(status),
       id = LAST_INSERT_ID(id)`,
    {
      schoolId,
      name: defaultSchoolYear.name,
      startsOn: defaultSchoolYear.startsOn,
      endsOn: defaultSchoolYear.endsOn,
    },
  );

  return Number(result.insertId);
}

async function ensureGradeLevels(connection: PoolConnection, schoolId: number) {
  const gradeLevelIds: number[] = [];

  for (const gradeLevel of defaultGradeLevels) {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO grade_levels (school_id, name, sort_order)
       VALUES (:schoolId, :name, :sortOrder)
       ON DUPLICATE KEY UPDATE
         sort_order = VALUES(sort_order),
         id = LAST_INSERT_ID(id)`,
      {
        schoolId,
        name: gradeLevel.name,
        sortOrder: gradeLevel.sortOrder,
      },
    );

    gradeLevelIds.push(Number(result.insertId));
  }

  return gradeLevelIds;
}

async function ensureSections(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
  gradeLevelIds: number[],
) {
  for (const gradeLevelId of gradeLevelIds) {
    await connection.execute(
      `INSERT INTO sections (school_id, school_year_id, grade_level_id, name)
       VALUES (:schoolId, :schoolYearId, :gradeLevelId, :name)
       ON DUPLICATE KEY UPDATE
         school_id = VALUES(school_id),
         id = LAST_INSERT_ID(id)`,
      {
        schoolId,
        schoolYearId,
        gradeLevelId,
        name: starterSectionName,
      },
    );
  }
}

function schoolCodeFor(schoolName: string, userId: number) {
  const initials = schoolName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 8);

  return `${initials || "SCHOOL"}-${userId}`.slice(0, 40);
}

type AdminProfileRow = RowDataPacket & {
  id: number;
  user_id: number;
  school_id: number | null;
  school_name: string;
};

type SchoolRow = RowDataPacket & {
  id: number;
};
