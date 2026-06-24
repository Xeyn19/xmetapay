import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type AdminSchoolContext = {
  adminName: string;
  adminInitials: string;
  staffRole: string;
  staffRoleLabel: string;
  schoolName: string;
  schoolCode: string | null;
  activeSchoolYear: {
    id: number;
    name: string;
    startsOn: string;
    endsOn: string;
  } | null;
  gradeLevelCount: number;
  sectionCount: number;
  databaseReady: boolean;
  warning: string | null;
};

const fallbackContext: AdminSchoolContext = {
  adminName: "School administrator",
  adminInitials: "SA",
  staffRole: "school_administrator",
  staffRoleLabel: "School administrator",
  schoolName: "School setup pending",
  schoolCode: null,
  activeSchoolYear: null,
  gradeLevelCount: 0,
  sectionCount: 0,
  databaseReady: false,
  warning: "Import the full schema and create school setup records.",
};

export async function getAdminSchoolContext(userId: number): Promise<AdminSchoolContext> {
  try {
    const profile = await getAdminProfile(userId);

    if (!profile) {
      return fallbackContext;
    }

    const baseContext = contextFromProfile(profile);
    const school = await getSchoolByName(profile.school_name);

    if (!school) {
      return {
        ...baseContext,
        warning: "Create the matching school record after importing the full schema.",
      };
    }

    const [activeSchoolYear, gradeLevelCount, sectionCount] = await Promise.all([
      getActiveSchoolYear(school.id),
      countGradeLevels(school.id),
      countSections(school.id),
    ]);

    return {
      ...baseContext,
      schoolName: school.name,
      schoolCode: school.code,
      activeSchoolYear,
      gradeLevelCount,
      sectionCount,
      databaseReady: true,
      warning: activeSchoolYear ? null : "Create an active school year for this school.",
    };
  } catch (error) {
    if (missingSchoolSetupTables(error)) {
      const profile = await tryGetAdminProfileOnly(userId);

      return profile
        ? {
            ...contextFromProfile(profile),
            warning: "Import database/full-schema-v1.sql to enable school setup records.",
          }
        : fallbackContext;
    }

    return fallbackContext;
  }
}

async function getAdminProfile(userId: number) {
  const [rows] = await pool.execute<AdminProfileRow[]>(
    `SELECT u.name AS admin_name, ap.school_name, ap.staff_role
     FROM users u
     JOIN admin_profiles ap ON ap.user_id = u.id
     WHERE u.id = :userId
     LIMIT 1`,
    { userId },
  );

  return rows[0] ?? null;
}

async function tryGetAdminProfileOnly(userId: number) {
  try {
    return await getAdminProfile(userId);
  } catch {
    return null;
  }
}

async function getSchoolByName(schoolName: string) {
  const [rows] = await pool.execute<SchoolRow[]>(
    `SELECT id, name, code, status
     FROM schools
     WHERE name = :schoolName
     ORDER BY status = 'active' DESC, id ASC
     LIMIT 1`,
    { schoolName },
  );

  return rows[0] ?? null;
}

async function getActiveSchoolYear(schoolId: number) {
  const [rows] = await pool.execute<SchoolYearRow[]>(
    `SELECT id, name, starts_on, ends_on
     FROM school_years
     WHERE school_id = :schoolId AND status = 'active'
     ORDER BY starts_on DESC, id DESC
     LIMIT 1`,
    { schoolId },
  );
  const row = rows[0];

  return row
    ? {
        id: row.id,
        name: row.name,
        startsOn: formatDate(row.starts_on),
        endsOn: formatDate(row.ends_on),
      }
    : null;
}

async function countGradeLevels(schoolId: number) {
  const [rows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS total FROM grade_levels WHERE school_id = :schoolId",
    { schoolId },
  );

  return Number(rows[0]?.total ?? 0);
}

async function countSections(schoolId: number) {
  const [rows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS total FROM sections WHERE school_id = :schoolId",
    { schoolId },
  );

  return Number(rows[0]?.total ?? 0);
}

function contextFromProfile(profile: AdminProfileRow): AdminSchoolContext {
  return {
    adminName: profile.admin_name,
    adminInitials: initialsFor(profile.admin_name),
    staffRole: profile.staff_role,
    staffRoleLabel: labelForStaffRole(profile.staff_role),
    schoolName: profile.school_name,
    schoolCode: null,
    activeSchoolYear: null,
    gradeLevelCount: 0,
    sectionCount: 0,
    databaseReady: false,
    warning: null,
  };
}

function initialsFor(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "SA";
}

function labelForStaffRole(role: string) {
  return role
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function missingSchoolSetupTables(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR");
}

type AdminProfileRow = RowDataPacket & {
  admin_name: string;
  school_name: string;
  staff_role: string;
};

type SchoolRow = RowDataPacket & {
  id: number;
  name: string;
  code: string;
  status: "active" | "inactive";
};

type SchoolYearRow = RowDataPacket & {
  id: number;
  name: string;
  starts_on: Date | string;
  ends_on: Date | string;
};

type CountRow = RowDataPacket & {
  total: number;
};
