import "server-only";

import { cookies } from "next/headers";
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
  selectedSchoolYear: AdminSchoolYearOption | null;
  selectedSchoolYearIsActive: boolean;
  schoolYears: AdminSchoolYearOption[];
  gradeLevelCount: number;
  sectionCount: number;
  databaseReady: boolean;
  warning: string | null;
};

export type AdminSchoolYearOption = {
  id: number;
  name: string;
  startsOn: string;
  endsOn: string;
  status: "upcoming" | "active" | "closed";
};

export type AdminSchoolSetupFormData = {
  schoolName: string;
  schoolCode: string;
  schoolYears: Array<{
    name: string;
    startsOn: string;
    endsOn: string;
    status: "upcoming" | "active" | "closed";
  }>;
  grades: Array<{
    name: string;
    sections: string[];
  }>;
};

export type AdminSchoolSetupOverview = {
  schoolName: string;
  schoolCode: string;
  schoolStatus: "active" | "inactive" | "pending";
  warning: string | null;
  kpis: Array<{
    label: string;
    value: string;
    note: string;
    tone: "orange" | "green" | "red" | "blue" | "purple" | "teal";
  }>;
  schoolYears: Array<{
    id: number;
    name: string;
    startsOn: string;
    endsOn: string;
    status: "upcoming" | "active" | "closed";
    sectionCount: number;
    enrollmentCount: number;
    feeTypeCount: number;
  }>;
  activeYear: {
    id: number;
    name: string;
    startsOn: string;
    endsOn: string;
  } | null;
  activeYearGrades: Array<{
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

export type ResolvedAdminSchoolViewSetup = ResolvedAdminSchoolSetup & {
  activeSchoolYearId: number | null;
  activeSchoolYearName: string | null;
  selectedSchoolYearStatus: AdminSchoolYearOption["status"] | null;
  selectedSchoolYearIsActive: boolean;
};

export const adminSchoolYearCookieName = "xmetapay_admin_school_year_id";

const fallbackContext: AdminSchoolContext = {
  adminName: "School administrator",
  adminInitials: "SA",
  staffRole: "school_administrator",
  staffRoleLabel: "School administrator",
  schoolId: null,
  schoolName: "School setup pending",
  schoolCode: null,
  activeSchoolYear: null,
  selectedSchoolYear: null,
  selectedSchoolYearIsActive: false,
  schoolYears: [],
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

    const [schoolYears, activeSchoolYear, gradeLevelCount, sectionCount] = await Promise.all([
      getSchoolYearRows(school.id),
      getActiveSchoolYear(school.id),
      countGradeLevels(school.id),
      countSections(school.id),
    ]);
    const selectedSchoolYear = await resolveSelectedSchoolYear(schoolYears, activeSchoolYear);

    return {
      ...baseContext,
      schoolId: school.id,
      schoolName: school.name,
      schoolCode: school.code,
      activeSchoolYear,
      selectedSchoolYear,
      selectedSchoolYearIsActive: Boolean(selectedSchoolYear && selectedSchoolYear.id === activeSchoolYear?.id),
      schoolYears,
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

export async function getResolvedAdminSchoolViewSetup(userId: number): Promise<ResolvedAdminSchoolViewSetup> {
  try {
    const profile = await getAdminProfile(userId);

    if (!profile) {
      return emptyViewSetup("Admin profile was not found.");
    }

    const school = await resolveSchoolForProfile(profile);

    if (!school) {
      return emptyViewSetup(setupMissingSchoolWarning(profile.staff_role));
    }

    const [schoolYears, activeSchoolYear, gradeLevelCount, sectionCount] = await Promise.all([
      getSchoolYearRows(school.id),
      getActiveSchoolYear(school.id),
      countGradeLevels(school.id),
      countSections(school.id),
    ]);
    const selectedSchoolYear = await resolveSelectedSchoolYear(schoolYears, activeSchoolYear);

    return {
      schoolId: school.id,
      schoolYearId: selectedSchoolYear?.id ?? null,
      schoolYearName: selectedSchoolYear?.name ?? null,
      activeSchoolYearId: activeSchoolYear?.id ?? null,
      activeSchoolYearName: activeSchoolYear?.name ?? null,
      selectedSchoolYearStatus: selectedSchoolYear?.status ?? null,
      selectedSchoolYearIsActive: Boolean(selectedSchoolYear && selectedSchoolYear.id === activeSchoolYear?.id),
      gradeLevelCount,
      sectionCount,
      warning: setupWarning(profile.staff_role, activeSchoolYear, gradeLevelCount, sectionCount),
    };
  } catch (error) {
    return emptyViewSetup(
      missingSchoolSetupTables(error)
        ? "Import database/full-schema-v1.sql to enable school setup records."
        : "School setup records are unavailable. Confirm MySQL/XAMPP is running.",
    );
  }
}

export async function canSelectAdminSchoolYear(userId: number, schoolYearId: number) {
  if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
    return false;
  }

  const profile = await getAdminProfile(userId);
  const school = profile ? await resolveSchoolForProfile(profile) : null;

  if (!school) {
    return false;
  }

  const [rows] = await pool.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT id
     FROM school_years
     WHERE id = :schoolYearId AND school_id = :schoolId
     LIMIT 1`,
    { schoolYearId, schoolId: school.id },
  );

  return Boolean(rows[0]);
}

export async function getAdminSchoolSetupOverview(userId: number): Promise<AdminSchoolSetupOverview> {
  let profile: AdminProfileRow | null = null;

  try {
    profile = await getAdminProfile(userId);
  } catch {
    profile = await tryGetAdminProfileOnly(userId);
  }

  if (!profile) {
    return emptySetupOverview("School", "Admin profile was not found.");
  }

  try {
    const school = await resolveSchoolForProfile(profile);

    if (!school) {
      return emptySetupOverview(profile.school_name, setupMissingSchoolWarning(profile.staff_role));
    }

    const [schoolYears, activeSchoolYear, gradeLevelCount, sectionCount] = await Promise.all([
      getSchoolYearOverviewRows(school.id),
      getActiveSchoolYear(school.id),
      countGradeLevels(school.id),
      countSections(school.id),
    ]);
    const activeYearGrades = activeSchoolYear ? await getGradeSectionRows(school.id, activeSchoolYear.id) : [];
    const upcomingCount = schoolYears.filter((year) => year.status === "upcoming").length;
    const activeYearSections = activeYearGrades.reduce((total, grade) => total + grade.sections.filter(Boolean).length, 0);
    const warning = schoolYears.length === 0
      ? "Add at least one school year."
      : setupWarning(profile.staff_role, activeSchoolYear, gradeLevelCount, sectionCount);

    return {
      schoolName: school.name,
      schoolCode: school.code,
      schoolStatus: school.status,
      warning,
      kpis: [
        {
          label: "School years",
          value: String(schoolYears.length),
          note: schoolYears.length === 1 ? "1 year configured" : `${schoolYears.length} years configured`,
          tone: "blue",
        },
        {
          label: "Active year",
          value: activeSchoolYear?.name ?? "Pending",
          note: activeSchoolYear ? `${activeSchoolYear.startsOn} to ${activeSchoolYear.endsOn}` : "Choose one active school year",
          tone: activeSchoolYear ? "green" : "red",
        },
        {
          label: "Upcoming years",
          value: String(upcomingCount),
          note: upcomingCount === 1 ? "1 future year prepared" : `${upcomingCount} future years prepared`,
          tone: "purple",
        },
        {
          label: "Active-year sections",
          value: String(activeYearSections),
          note: activeYearSections > 0 ? `${gradeLevelCount} grade levels` : "Add sections for the active year",
          tone: activeYearSections > 0 ? "orange" : "red",
        },
      ],
      schoolYears,
      activeYear: activeSchoolYear,
      activeYearGrades,
    };
  } catch (error) {
    return emptySetupOverview(
      profile.school_name,
      missingSchoolSetupTables(error)
        ? "Import database/full-schema-v1.sql to enable school setup records."
        : "School setup records are unavailable. Confirm MySQL/XAMPP is running.",
    );
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
    const schoolYears = school ? await getSchoolYearRows(school.id) : [];
    const activeYear = schoolYears.find((year) => year.status === "active") ?? null;
    const grades = school && activeYear ? await getGradeSectionRows(school.id, activeYear.id) : [];

    return {
      schoolName,
      schoolCode,
      schoolYears: schoolYears.length > 0
        ? schoolYears.map(({ name, startsOn, endsOn, status }) => ({ name, startsOn, endsOn, status }))
        : [{ name: "", startsOn: "", endsOn: "", status: "active" }],
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

async function getSchoolYearRows(schoolId: number) {
  const [rows] = await pool.execute<Array<SchoolYearRow & { status: "upcoming" | "active" | "closed" }>>(
    `SELECT id, name, starts_on, ends_on, status
     FROM school_years
     WHERE school_id = :schoolId
     ORDER BY status = 'active' DESC, starts_on DESC, id DESC`,
    { schoolId },
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startsOn: formatDate(row.starts_on),
    endsOn: formatDate(row.ends_on),
    status: normalizeSchoolYearStatus(row.status),
  }));
}

async function getSchoolYearOverviewRows(schoolId: number) {
  const [rows] = await pool.execute<Array<SchoolYearRow & {
    status: "upcoming" | "active" | "closed";
    section_count: number;
    enrollment_count: number;
    fee_type_count: number;
  }>>(
    `SELECT sy.id, sy.name, sy.starts_on, sy.ends_on, sy.status,
            COUNT(DISTINCT sec.id) AS section_count,
            COUNT(DISTINCT e.id) AS enrollment_count,
            COUNT(DISTINCT ft.id) AS fee_type_count
     FROM school_years sy
     LEFT JOIN sections sec ON sec.school_year_id = sy.id
     LEFT JOIN enrollments e ON e.school_year_id = sy.id
     LEFT JOIN fee_types ft ON ft.school_year_id = sy.id
     WHERE sy.school_id = :schoolId
     GROUP BY sy.id, sy.name, sy.starts_on, sy.ends_on, sy.status
     ORDER BY sy.status = 'active' DESC, sy.starts_on DESC, sy.id DESC`,
    { schoolId },
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startsOn: formatDate(row.starts_on),
    endsOn: formatDate(row.ends_on),
    status: normalizeSchoolYearStatus(row.status),
    sectionCount: Number(row.section_count ?? 0),
    enrollmentCount: Number(row.enrollment_count ?? 0),
    feeTypeCount: Number(row.fee_type_count ?? 0),
  }));
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
    selectedSchoolYear: null,
    selectedSchoolYearIsActive: false,
    schoolYears: [],
    gradeLevelCount: 0,
    sectionCount: 0,
    databaseReady: false,
    warning: null,
  };
}

function emptyViewSetup(warning: string): ResolvedAdminSchoolViewSetup {
  return {
    schoolId: null,
    schoolYearId: null,
    schoolYearName: null,
    activeSchoolYearId: null,
    activeSchoolYearName: null,
    selectedSchoolYearStatus: null,
    selectedSchoolYearIsActive: false,
    gradeLevelCount: 0,
    sectionCount: 0,
    warning,
  };
}

async function resolveSelectedSchoolYear(
  schoolYears: AdminSchoolYearOption[],
  activeSchoolYear: AdminSchoolContext["activeSchoolYear"],
) {
  const cookieStore = await cookies();
  const cookieYearId = Number(cookieStore.get(adminSchoolYearCookieName)?.value);
  const selectedFromCookie = Number.isInteger(cookieYearId)
    ? schoolYears.find((year) => year.id === cookieYearId)
    : null;

  if (selectedFromCookie) {
    return selectedFromCookie;
  }

  if (activeSchoolYear) {
    return schoolYears.find((year) => year.id === activeSchoolYear.id)
      ?? { ...activeSchoolYear, status: "active" as const };
  }

  return schoolYears[0] ?? null;
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
    schoolYears: [{ name: "", startsOn: "", endsOn: "", status: "active" }],
    grades: [{ name: "", sections: [""] }],
  };
}

function emptySetupOverview(schoolName: string, warning: string | null): AdminSchoolSetupOverview {
  return {
    schoolName,
    schoolCode: schoolCodeFor(schoolName),
    schoolStatus: "pending",
    warning,
    kpis: [
      { label: "School years", value: "0", note: "Add at least one school year", tone: "red" },
      { label: "Active year", value: "Pending", note: "Choose one active school year", tone: "red" },
      { label: "Upcoming years", value: "0", note: "No future years prepared", tone: "purple" },
      { label: "Active-year sections", value: "0", note: "Add sections for the active year", tone: "red" },
    ],
    schoolYears: [],
    activeYear: null,
    activeYearGrades: [],
  };
}

function normalizeSchoolYearStatus(value: unknown): "upcoming" | "active" | "closed" {
  return value === "active" || value === "closed" ? value : "upcoming";
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
