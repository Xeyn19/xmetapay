"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getAdminStaffRole } from "@/lib/admin/access";
import { canManageSchoolSetup } from "@/lib/admin/permissions";
import { adminSchoolYearCookieName } from "@/lib/school/setup";

type SetupGradeInput = {
  name: string;
  sections: string[];
};

type SetupSchoolYearInput = {
  name: string;
  startsOn: string;
  endsOn: string;
  status: "upcoming" | "active" | "closed";
};

type SetupInput = {
  schoolName: string;
  schoolCode: string;
  schoolYears: SetupSchoolYearInput[];
  grades: SetupGradeInput[];
};

export async function saveSchoolSetupAction(formData: FormData) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  const redirectTo = schoolSetupRedirectTarget(formData);

  if (!canManageSchoolSetup(staffRole)) {
    await setAuthFlashToast({
      role: "admin",
      title: "School setup not saved",
      description: "Only school administrators can set up school records.",
    });
    redirect("/admin/dashboard");
  }

  const input = parseSchoolSetupForm(formData);

  if (!input.ok) {
    await setAuthFlashToast({
      role: "admin",
      title: "School setup not saved",
      description: input.message,
    });
    redirect(redirectTo);
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const profile = await getAdminProfileForUpdate(connection, session.userId);

    if (!profile) {
      throw new Error("Admin profile was not found.");
    }

    const schoolId = await ensureSchool(connection, profile, session.userId, input.data);
    await connection.execute(
      `UPDATE admin_profiles
       SET school_id = :schoolId, school_name = :schoolName
       WHERE user_id = :userId`,
      { schoolId, schoolName: input.data.schoolName, userId: session.userId },
    );
    await linkSameSchoolStaffProfiles(connection, schoolId, profile.school_name, input.data.schoolName);

    const schoolYearId = await ensureSchoolYears(connection, schoolId, input.data.schoolYears);
    const gradeLevelIds = await ensureGradeLevels(connection, schoolId, input.data.grades);
    await ensureSections(connection, schoolId, schoolYearId, input.data.grades, gradeLevelIds);

    await connection.commit();
    const cookieStore = await cookies();
    cookieStore.set(adminSchoolYearCookieName, String(schoolYearId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    await setAuthFlashToast({
      role: "admin",
      title: "School setup saved",
      description: "Your school years, active-year grades, and sections now use your real school records.",
    });
  } catch {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await setAuthFlashToast({
      role: "admin",
      title: "School setup not saved",
      description: "Check that the school code is unique and MySQL/XAMPP is running, then try again.",
    });
    redirect(redirectTo);
  } finally {
    connection?.release();
  }

  redirect("/admin/dashboard");
}

function parseSchoolSetupForm(formData: FormData) {
  const schoolName = textValue(formData, "schoolName");
  const schoolCode = normalizeCode(textValue(formData, "schoolCode"));
  const schoolYears = parseSchoolYearSetup(textValue(formData, "schoolYearSetup"));
  const grades = parseGradeSetup(textValue(formData, "gradeSetup"));

  if (!schoolName || !schoolCode) {
    return { ok: false as const, message: "Complete the school name and code." };
  }

  if (schoolYears.length === 0) {
    return { ok: false as const, message: "Add at least one school year." };
  }

  if (schoolYears.filter((year) => year.status === "active").length !== 1) {
    return { ok: false as const, message: "Choose exactly one active school year." };
  }

  if (new Set(schoolYears.map((year) => year.name.toLowerCase())).size !== schoolYears.length) {
    return { ok: false as const, message: "School year names must be unique." };
  }

  if (schoolYears.some((year) => new Date(year.startsOn) >= new Date(year.endsOn))) {
    return { ok: false as const, message: "Each school year end date must be after its start date." };
  }

  if (grades.length === 0) {
    return { ok: false as const, message: "Add at least one grade level." };
  }

  if (grades.some((grade) => grade.sections.length === 0)) {
    return { ok: false as const, message: "Every grade level needs at least one section." };
  }

  return {
    ok: true as const,
    data: {
      schoolName,
      schoolCode,
      schoolYears,
      grades,
    },
  };
}

function parseSchoolYearSetup(value: string): SetupSchoolYearInput[] {
  try {
    const parsed = JSON.parse(value) as Array<{ name?: unknown; startsOn?: unknown; endsOn?: unknown; status?: unknown }>;
    return parsed
      .map((year) => {
        const name = normalizeLabel(String(year.name ?? "")).slice(0, 40);
        const startsOn = normalizeDate(String(year.startsOn ?? ""));
        const endsOn = normalizeDate(String(year.endsOn ?? ""));
        const status = normalizeSchoolYearStatus(year.status);

        return { name, startsOn, endsOn, status };
      })
      .filter((year) => Boolean(year.name && year.startsOn && year.endsOn));
  } catch {
    return [];
  }
}

function parseGradeSetup(value: string) {
  try {
    const parsed = JSON.parse(value) as Array<{ name?: unknown; sections?: unknown }>;
    const seenGrades = new Set<string>();

    return parsed
      .map((grade) => {
        const name = normalizeLabel(String(grade.name ?? ""));
        const sections = Array.isArray(grade.sections)
          ? grade.sections
              .map((section) => normalizeLabel(String(section)))
              .filter(Boolean)
          : [];
        const uniqueSections = [...new Set(sections)];

        return { name, sections: uniqueSections };
      })
      .filter((grade) => {
        const key = grade.name.toLowerCase();
        const keep = Boolean(grade.name) && !seenGrades.has(key);

        if (keep) {
          seenGrades.add(key);
        }

        return keep;
      });
  } catch {
    return [];
  }
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function schoolSetupRedirectTarget(formData: FormData) {
  const value = textValue(formData, "redirectTo");

  return value === "/admin/onboarding/school-setup" ? value : "/admin/school-setup";
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 60);
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function normalizeSchoolYearStatus(value: unknown): SetupSchoolYearInput["status"] {
  return value === "active" || value === "closed" ? value : "upcoming";
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
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

async function ensureSchool(connection: PoolConnection, profile: AdminProfileRow, userId: number, input: SetupInput) {
  const existingSchool = profile.school_id
    ? await getSchoolById(connection, profile.school_id)
    : await getSchoolByCodeOrName(connection, input.schoolCode, input.schoolName);

  if (existingSchool) {
    await connection.execute(
      `UPDATE schools
       SET name = :name, code = :code, status = 'active'
       WHERE id = :schoolId`,
      {
        schoolId: existingSchool.id,
        name: input.schoolName,
        code: input.schoolCode,
      },
    );

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
      name: input.schoolName,
      code: input.schoolCode || schoolCodeFor(input.schoolName, userId),
    },
  );

  return Number(result.insertId);
}

async function linkSameSchoolStaffProfiles(
  connection: PoolConnection,
  schoolId: number,
  previousSchoolName: string,
  currentSchoolName: string,
) {
  await connection.execute(
    `UPDATE admin_profiles
     SET school_id = :schoolId
     WHERE school_id IS NULL
       AND (school_name = :previousSchoolName OR school_name = :currentSchoolName)`,
    { schoolId, previousSchoolName, currentSchoolName },
  );
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

async function getSchoolByCodeOrName(connection: PoolConnection, schoolCode: string, schoolName: string) {
  const [rows] = await connection.execute<SchoolRow[]>(
    `SELECT id
     FROM schools
     WHERE code = :schoolCode OR name = :schoolName
     ORDER BY code = :schoolCode DESC, status = 'active' DESC, id ASC
     LIMIT 1`,
    { schoolCode, schoolName },
  );

  return rows[0] ?? null;
}

async function ensureSchoolYears(connection: PoolConnection, schoolId: number, schoolYears: SetupSchoolYearInput[]) {
  const activeYear = schoolYears.find((year) => year.status === "active");

  if (!activeYear) {
    throw new Error("Active school year was not found.");
  }

  await connection.execute(
    `UPDATE school_years
     SET status = 'closed'
     WHERE school_id = :schoolId AND name <> :activeYearName AND status = 'active'`,
    { schoolId, activeYearName: activeYear.name },
  );

  let activeYearId = 0;

  for (const year of schoolYears) {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO school_years (school_id, name, starts_on, ends_on, status)
       VALUES (:schoolId, :name, :startsOn, :endsOn, :status)
       ON DUPLICATE KEY UPDATE
         starts_on = VALUES(starts_on),
         ends_on = VALUES(ends_on),
         status = VALUES(status),
         id = LAST_INSERT_ID(id)`,
      {
        schoolId,
        name: year.name,
        startsOn: year.startsOn,
        endsOn: year.endsOn,
        status: year.status,
      },
    );

    if (year.status === "active") {
      activeYearId = Number(result.insertId);
    }
  }

  return activeYearId;
}

async function ensureGradeLevels(connection: PoolConnection, schoolId: number, grades: SetupGradeInput[]) {
  const gradeLevelIds: number[] = [];

  for (const [index, gradeLevel] of grades.entries()) {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO grade_levels (school_id, name, sort_order)
       VALUES (:schoolId, :name, :sortOrder)
       ON DUPLICATE KEY UPDATE
         sort_order = VALUES(sort_order),
         id = LAST_INSERT_ID(id)`,
      {
        schoolId,
        name: gradeLevel.name,
        sortOrder: index + 1,
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
  grades: SetupGradeInput[],
  gradeLevelIds: number[],
) {
  for (const [index, gradeLevel] of grades.entries()) {
    for (const sectionName of gradeLevel.sections) {
      await connection.execute(
        `INSERT INTO sections (school_id, school_year_id, grade_level_id, name)
         VALUES (:schoolId, :schoolYearId, :gradeLevelId, :name)
         ON DUPLICATE KEY UPDATE
           school_id = VALUES(school_id),
           id = LAST_INSERT_ID(id)`,
        {
          schoolId,
          schoolYearId,
          gradeLevelId: gradeLevelIds[index],
          name: sectionName,
        },
      );
    }
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
