import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import {
  labelForAdminStaffRole,
  normalizeAdminStaffRole,
  type AdminStaffRole,
} from "@/lib/admin/permissions";

export type AdminSchoolContext = {
  adminName: string;
  adminInitials: string;
  staffRole: AdminStaffRole;
  staffRoleLabel: string;
  schoolId: number | null;
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

export type AdminSchoolSetupFormData = {
  schoolName: string;
  schoolCode: string;
  schoolYearName: string;
  startsOn: string;
  endsOn: string;
  grades: Array<{
    name: string;
    sections: string[];
  }>;
};

export type ResolvedAdminSchoolSetup = {
  schoolId: number | null;
  schoolYearId: number | null;
  schoolYearName: string | null;
  gradeLevelCount: number;
  sectionCount: number;
  warning: string | null;
};

const fallbackContext: AdminSchoolContext = {
  adminName: "School administrator",
  adminInitials: "SA",
  staffRole: "school_administrator",
  staffRoleLabel: "School administrator",
  schoolId: null,
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
    const school = await resolveSchoolForProfile(profile);

    if (!school) {
      return {
        ...baseContext,
        warning: setupMissingSchoolWarning(profile.staff_role),
      };
    }

    const [activeSchoolYear, gradeLevelCount, sectionCount] = await Promise.all([
      getActiveSchoolYear(school.id),
      countGradeLevels(school.id),
      countSections(school.id),
    ]);

    return {
      ...baseContext,
      schoolId: school.id,
      schoolName: school.name,
      schoolCode: school.code,
      activeSchoolYear,
      gradeLevelCount,
      sectionCount,
      databaseReady: Boolean(activeSchoolYear && gradeLevelCount > 0 && sectionCount > 0),
      warning: setupWarning(profile.staff_role, activeSchoolYear, gradeLevelCount, sectionCount),
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

export async function getResolvedAdminSchoolSetup(userId: number): Promise<ResolvedAdminSchoolSetup> {
  try {
    const profile = await getAdminProfile(userId);

    if (!profile) {
      return {
        schoolId: null,
        schoolYearId: null,
        schoolYearName: null,
        gradeLevelCount: 0,
        sectionCount: 0,
        warning: "Admin profile was not found.",
      };
    }

    const school = await resolveSchoolForProfile(profile);

    if (!school) {
      return {
        schoolId: null,
        schoolYearId: null,
        schoolYearName: null,
        gradeLevelCount: 0,
        sectionCount: 0,
        warning: setupMissingSchoolWarning(profile.staff_role),
      };
    }

    const [activeSchoolYear, gradeLevelCount, sectionCount] = await Promise.all([
      getActiveSchoolYear(school.id),
      countGradeLevels(school.id),
      countSections(school.id),
    ]);

    return {
      schoolId: school.id,
      schoolYearId: activeSchoolYear?.id ?? null,
      schoolYearName: activeSchoolYear?.name ?? null,
      gradeLevelCount,
      sectionCount,
      warning: setupWarning(profile.staff_role, activeSchoolYear, gradeLevelCount, sectionCount),
    };
  } catch (error) {
    return {
      schoolId: null,
      schoolYearId: null,
      schoolYearName: null,
      gradeLevelCount: 0,
      sectionCount: 0,
      warning: missingSchoolSetupTables(error)
        ? "Import database/full-schema-v1.sql to enable school setup records."
        : "School setup records are unavailable. Confirm MySQL/XAMPP is running.",
    };
  }
}

export async function getAdminSchoolSetupFormData(userId: number): Promise<AdminSchoolSetupFormData> {
  let profile: AdminProfileRow | null = null;

  try {
    profile = await getAdminProfile(userId);
  } catch {
    profile = await tryGetAdminProfileOnly(userId);
  }

  if (!profile) {
    return emptySetupFormData("School");
  }

  try {
    const school = await resolveSchoolForProfile(profile);
    const schoolName = school?.name ?? profile.school_name;
    const schoolCode = school?.code ?? schoolCodeFor(schoolName);
    const activeYear = school ? await getActiveSchoolYear(school.id) : null;
    const grades = school && activeYear ? await getGradeSectionRows(school.id, activeYear.id) : [];

    return {
      schoolName,
      schoolCode,
      schoolYearName: activeYear?.name ?? "",
      startsOn: activeYear?.startsOn ?? "",
      endsOn: activeYear?.endsOn ?? "",
      grades: grades.length > 0 ? grades : [{ name: "", sections: [""] }],
    };
  } catch {
    return emptySetupFormData(profile.school_name);
  }
}

async function getAdminProfile(userId: number) {
  const [rows] = await pool.execute<AdminProfileRow[]>(
    `SELECT u.name AS admin_name, ap.user_id, ap.school_id, ap.school_name, ap.staff_role
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
    try {
      const [rows] = await pool.execute<AdminProfileRow[]>(
        `SELECT u.name AS admin_name, ap.user_id, NULL AS school_id, ap.school_name, ap.staff_role
         FROM users u
         JOIN admin_profiles ap ON ap.user_id = u.id
         WHERE u.id = :userId
         LIMIT 1`,
        { userId },
      );

      return rows[0] ?? null;
    } catch {
      return null;
    }
  }
}

async function getSchoolById(schoolId: number) {
  const [rows] = await pool.execute<SchoolRow[]>(
    `SELECT id, name, code, status
     FROM schools
     WHERE id = :schoolId
     LIMIT 1`,
    { schoolId },
  );

  return rows[0] ?? null;
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

async function resolveSchoolForProfile(profile: AdminProfileRow) {
  const school = profile.school_id
    ? (await getSchoolById(profile.school_id)) ?? (await getSchoolByName(profile.school_name))
    : await getSchoolByName(profile.school_name);

  if (school && profile.school_id !== school.id) {
    await linkAdminProfileToSchool(profile.user_id, school.id);
  }

  return school;
}

async function linkAdminProfileToSchool(userId: number, schoolId: number) {
  await pool.execute(
    `UPDATE admin_profiles
     SET school_id = :schoolId
     WHERE user_id = :userId AND (school_id IS NULL OR school_id <> :schoolId)`,
    { userId, schoolId },
  );
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

function setupMissingSchoolWarning(staffRole: string) {
  return normalizeAdminStaffRole(staffRole) === "school_administrator"
    ? "Set up school records before viewing database-backed admin pages."
    : "Ask a school administrator to set up this school first.";
}

function setupWarning(
  staffRole: string,
  activeSchoolYear: Awaited<ReturnType<typeof getActiveSchoolYear>>,
  gradeLevelCount: number,
  sectionCount: number,
) {
  const missing: string[] = [];

  if (!activeSchoolYear) {
    missing.push("an active school year");
  }

  if (gradeLevelCount === 0) {
    missing.push("grade levels");
  }

  if (sectionCount === 0) {
    missing.push("sections");
  }

  if (missing.length === 0) {
    return null;
  }

  const missingText = missing.join(", ");

  return normalizeAdminStaffRole(staffRole) === "school_administrator"
    ? `Complete school setup by adding ${missingText}.`
    : `Ask a school administrator to complete ${missingText}.`;
}

function contextFromProfile(profile: AdminProfileRow): AdminSchoolContext {
  const staffRole = normalizeAdminStaffRole(profile.staff_role) ?? "school_administrator";

  return {
    adminName: profile.admin_name,
    adminInitials: initialsFor(profile.admin_name),
    staffRole,
    staffRoleLabel: labelForAdminStaffRole(staffRole),
    schoolId: profile.school_id,
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

function formatDate(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

async function getGradeSectionRows(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<GradeSectionRow[]>(
    `SELECT gl.id, gl.name AS grade_name, sec.name AS section_name
     FROM grade_levels gl
     LEFT JOIN sections sec ON sec.grade_level_id = gl.id AND sec.school_year_id = :schoolYearId
     WHERE gl.school_id = :schoolId
     ORDER BY gl.sort_order ASC, gl.name ASC, sec.name ASC`,
    { schoolId, schoolYearId },
  );
  const grades = new Map<number, { name: string; sections: string[] }>();

  for (const row of rows) {
    const grade = grades.get(row.id) ?? { name: row.grade_name, sections: [] };

    if (row.section_name) {
      grade.sections.push(row.section_name);
    }

    grades.set(row.id, grade);
  }

  return [...grades.values()].map((grade) => ({
    name: grade.name,
    sections: grade.sections.length > 0 ? grade.sections : [""],
  }));
}

function emptySetupFormData(schoolName: string): AdminSchoolSetupFormData {
  return {
    schoolName,
    schoolCode: schoolCodeFor(schoolName),
    schoolYearName: "",
    startsOn: "",
    endsOn: "",
    grades: [{ name: "", sections: [""] }],
  };
}

function schoolCodeFor(schoolName: string) {
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

function missingSchoolSetupTables(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR");
}

type AdminProfileRow = RowDataPacket & {
  user_id: number;
  admin_name: string;
  school_id: number | null;
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

type GradeSectionRow = RowDataPacket & {
  id: number;
  grade_name: string;
  section_name: string | null;
};
