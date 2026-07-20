"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import { getAdminStaffRole } from "@/lib/admin/access";
import { canManageSchoolSetup } from "@/lib/admin/permissions";
import {
  applyRolloverPromotions,
  parseRolloverPromotions,
  RolloverValidationError,
} from "@/lib/enrollment/rollover";
import { adminSchoolYearCookieName } from "@/lib/school/setup";

type SetupGradeInput = {
  name: string;
  sections: string[];
};

type SchoolYearStructureGradeInput = {
  id: number | null;
  name: string;
  sections: Array<{ id: number | null; name: string }>;
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
  sectionSchoolYearId: number | null;
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
    const sectionSchoolYearId = await resolveSectionSchoolYearId(
      connection,
      schoolId,
      input.data.sectionSchoolYearId,
      schoolYearId,
    );
    const gradeLevelIds = await ensureGradeLevels(connection, schoolId, input.data.grades);
    await ensureSections(connection, schoolId, sectionSchoolYearId, input.data.grades, gradeLevelIds);

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
      description: "Your school years, grades, and selected-year sections now use your real school records.",
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

  redirect(redirectTo === "/admin/onboarding/school-setup" ? "/admin/dashboard" : redirectTo);
}

export async function updateSchoolDetailsAction(formData: FormData) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  const schoolName = normalizeLabel(textValue(formData, "schoolName")).slice(0, 180);
  const schoolCode = normalizeCode(textValue(formData, "schoolCode"));

  if (!canManageSchoolSetup(staffRole)) {
    await setupActionToast("School details not saved", "Only school administrators can change school details.");
    redirect("/admin/dashboard");
  }

  if (!schoolName || !schoolCode) {
    await setupActionToast("School details not saved", "Enter the school name and code.");
    redirect("/admin/school-setup");
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const profile = await getAdminProfileForUpdate(connection, session.userId);

    if (!profile?.school_id) {
      throw new Error("School setup is incomplete.");
    }

    await connection.execute(
      `UPDATE schools
       SET name = :schoolName, code = :schoolCode
       WHERE id = :schoolId`,
      { schoolId: profile.school_id, schoolName, schoolCode },
    );
    await connection.execute(
      `UPDATE admin_profiles
       SET school_name = :schoolName
       WHERE school_id = :schoolId`,
      { schoolId: profile.school_id, schoolName },
    );
    await connection.commit();
    revalidateAdminSchoolYearPaths();
    await setupActionToast("School details saved", "The school name and code are up to date.");
  } catch {
    await connection?.rollback().catch(() => undefined);
    await setupActionToast("School details not saved", "Use a unique school code and try again.");
  } finally {
    connection?.release();
  }

  redirect("/admin/school-setup");
}

export async function createSchoolYearAction(formData: FormData) {
  await saveSchoolYearMetadata(formData, "create");
}

export async function updateSchoolYearAction(formData: FormData) {
  await saveSchoolYearMetadata(formData, "update");
}

export async function saveSchoolYearStructureAction(formData: FormData) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  const schoolYearId = positiveIntegerValue(formData, "schoolYearId");
  const grades = parseSchoolYearStructure(textValue(formData, "gradeSetup"));
  const redirectTo = schoolYearId ? `/admin/school-setup/years/${schoolYearId}` : "/admin/school-setup";

  if (!canManageSchoolSetup(staffRole)) {
    await setupActionToast("Structure not saved", "Only school administrators can manage grades and sections.");
    redirect("/admin/dashboard");
  }

  if (!schoolYearId || grades.length === 0 || grades.some((grade) => grade.sections.length === 0)) {
    await setupActionToast("Structure not saved", "Add at least one grade and one section for every grade.");
    redirect(redirectTo);
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const profile = await getAdminProfileForUpdate(connection, session.userId);

    if (!profile?.school_id || !(await schoolYearBelongsToSchool(connection, profile.school_id, schoolYearId))) {
      throw new Error("Choose a valid school year for this school.");
    }

    await saveFocusedSchoolYearStructure(connection, profile.school_id, schoolYearId, grades);
    await connection.commit();
    revalidatePath(redirectTo);
    revalidatePath("/admin/school-setup");
    await setupActionToast("Year structure saved", "Grades and sections are ready for this school year.");
  } catch {
    await connection?.rollback().catch(() => undefined);
    await setupActionToast("Structure not saved", "Check the grade and section names, then try again.");
  } finally {
    connection?.release();
  }

  redirect(redirectTo);
}

export async function prepareSchoolYearRolloverAction(formData: FormData) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);

  if (!canManageSchoolSetup(staffRole)) {
    await setAuthFlashToast({
      role: "admin",
      title: "Rollover not saved",
      description: "Only school administrators can prepare school year rollovers.",
    });
    redirect("/admin/dashboard");
  }

  const sourceSchoolYearId = positiveIntegerValue(formData, "sourceSchoolYearId");
  const targetSchoolYearId = positiveIntegerValue(formData, "targetSchoolYearId");
  const promotions = parseRolloverPromotions(textValue(formData, "promotions"));

  if (!sourceSchoolYearId || !targetSchoolYearId || promotions.length === 0) {
    await setAuthFlashToast({
      role: "admin",
      title: "Rollover not saved",
      description: "Review at least one student placement and choose both school years.",
    });
    redirect("/admin/school-setup/rollover");
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const profile = await getAdminProfileForUpdate(connection, session.userId);

    if (!profile?.school_id) {
      throw new RolloverValidationError("Complete school setup before preparing a rollover.");
    }

    const result = await applyRolloverPromotions(connection, {
      schoolId: profile.school_id,
      sourceSchoolYearId,
      targetSchoolYearId,
      promotions,
    });

    await connection.commit();
    const cookieStore = await cookies();
    cookieStore.set(adminSchoolYearCookieName, String(targetSchoolYearId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    revalidatePath("/admin/school-setup");
    revalidatePath("/admin/students");
    revalidatePath("/admin/student-profile");
    await setAuthFlashToast({
      role: "admin",
      title: "Rollover prepared",
      description: rolloverSummary(result),
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await setAuthFlashToast({
      role: "admin",
      title: "Rollover not saved",
      description: error instanceof RolloverValidationError
        ? error.message
        : "Unable to prepare rollover enrollments. Check MySQL/XAMPP and try again.",
    });
  } finally {
    connection?.release();
  }

  redirect("/admin/school-setup/rollover");
}

function rolloverSummary(result: Awaited<ReturnType<typeof applyRolloverPromotions>>) {
  return [
    `${result.promotedCount} promoted`,
    `${result.repeatCount} repeat placement${result.repeatCount === 1 ? "" : "s"}`,
    `${result.skippedCount} skipped`,
    `${result.duplicateCount} already enrolled`,
    `${result.reviewCount} needing review`,
  ].join(". ") + ".";
}

export async function activateSchoolYearAction(formData: FormData) {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  const targetSchoolYearId = positiveIntegerValue(formData, "schoolYearId");
  let activatedYearName = "selected school year";
  let connection: PoolConnection | null = null;

  if (!canManageSchoolSetup(staffRole)) {
    await setAuthFlashToast({
      role: "admin",
      title: "School year not activated",
      description: "Only school administrators can activate a school year.",
    });
    redirect("/admin/dashboard");
  }

  if (!targetSchoolYearId) {
    await setAuthFlashToast({
      role: "admin",
      title: "School year not activated",
      description: "Choose an upcoming school year to activate.",
    });
    redirect("/admin/school-setup");
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const profile = await getAdminProfileForUpdate(connection, session.userId);

    if (!profile?.school_id) {
      throw new ActivationValidationError("Complete school setup before activating a school year.");
    }

    const targetYear = await getSchoolYearActivationTargetForUpdate(connection, profile.school_id, targetSchoolYearId);

    if (!targetYear) {
      throw new ActivationValidationError("Choose a valid school year for this school.");
    }

    activatedYearName = targetYear.name;

    if (targetYear.status !== "upcoming") {
      throw new ActivationValidationError("Only upcoming school years can be activated.");
    }

    const duplicateNameCount = await countSchoolYearsWithName(connection, profile.school_id, targetYear.name);

    if (duplicateNameCount > 1) {
      throw new ActivationValidationError("Rename duplicate school years before activating one.");
    }

    const sectionCount = await countSectionsForSchoolYear(connection, profile.school_id, targetYear.id);

    if (sectionCount === 0) {
      throw new ActivationValidationError(`Add sections for ${targetYear.name} before activating it.`);
    }

    await getActiveSchoolYearForUpdate(connection, profile.school_id);
    await connection.execute(
      `UPDATE school_years
       SET status = 'closed'
       WHERE school_id = :schoolId
         AND status = 'active'
         AND id <> :targetSchoolYearId`,
      { schoolId: profile.school_id, targetSchoolYearId: targetYear.id },
    );
    await connection.execute(
      `UPDATE school_years
       SET status = 'active'
       WHERE id = :targetSchoolYearId
         AND school_id = :schoolId`,
      { schoolId: profile.school_id, targetSchoolYearId: targetYear.id },
    );

    await connection.commit();
    const cookieStore = await cookies();
    cookieStore.set(adminSchoolYearCookieName, String(targetYear.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    revalidateAdminSchoolYearPaths();
    await setAuthFlashToast({
      role: "admin",
      title: "School year activated",
      description: `${targetYear.name} is now the active year. New records will use this school year.`,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    await setAuthFlashToast({
      role: "admin",
      title: "School year not activated",
      description: error instanceof ActivationValidationError
        ? error.message
        : `Unable to activate ${activatedYearName}. Check MySQL/XAMPP and try again.`,
    });
  } finally {
    connection?.release();
  }

  redirect("/admin/school-setup");
}

async function saveSchoolYearMetadata(formData: FormData, mode: "create" | "update") {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  const schoolYearId = positiveIntegerValue(formData, "schoolYearId");
  const name = normalizeLabel(textValue(formData, "name")).slice(0, 40);
  const startsOn = normalizeDate(textValue(formData, "startsOn"));
  const endsOn = normalizeDate(textValue(formData, "endsOn"));
  const title = mode === "create" ? "School year not added" : "School year not updated";

  if (!canManageSchoolSetup(staffRole)) {
    await setupActionToast(title, "Only school administrators can manage school years.");
    redirect("/admin/dashboard");
  }

  if (!name || !startsOn || !endsOn || new Date(startsOn) >= new Date(endsOn) || (mode === "update" && !schoolYearId)) {
    await setupActionToast(title, "Enter a unique year name and a valid date range.");
    redirect("/admin/school-setup");
  }

  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const profile = await getAdminProfileForUpdate(connection, session.userId);

    if (!profile?.school_id) {
      throw new Error("School setup is incomplete.");
    }

    if (mode === "create") {
      await connection.execute(
        `INSERT INTO school_years (school_id, name, starts_on, ends_on, status)
         VALUES (:schoolId, :name, :startsOn, :endsOn, 'upcoming')`,
        { schoolId: profile.school_id, name, startsOn, endsOn },
      );
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE school_years
         SET name = :name, starts_on = :startsOn, ends_on = :endsOn
         WHERE id = :schoolYearId AND school_id = :schoolId`,
        { schoolId: profile.school_id, schoolYearId, name, startsOn, endsOn },
      );

      if (result.affectedRows === 0) {
        throw new Error("School year was not found.");
      }
    }

    await connection.commit();
    revalidatePath("/admin/school-setup");
    if (schoolYearId) {
      revalidatePath(`/admin/school-setup/years/${schoolYearId}`);
    }
    await setupActionToast(
      mode === "create" ? "School year added" : "School year updated",
      mode === "create" ? `${name} is ready for structure setup.` : `${name} details are up to date.`,
    );
  } catch {
    await connection?.rollback().catch(() => undefined);
    await setupActionToast(title, "Use a unique school-year name and try again.");
  } finally {
    connection?.release();
  }

  redirect("/admin/school-setup");
}

async function schoolYearBelongsToSchool(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
) {
  const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT id
     FROM school_years
     WHERE id = :schoolYearId AND school_id = :schoolId
     LIMIT 1
     FOR UPDATE`,
    { schoolId, schoolYearId },
  );

  return Boolean(rows[0]);
}

async function setupActionToast(title: string, description: string) {
  await setAuthFlashToast({ role: "admin", title, description });
}

function parseSchoolSetupForm(formData: FormData) {
  const schoolName = textValue(formData, "schoolName");
  const schoolCode = normalizeCode(textValue(formData, "schoolCode"));
  const schoolYears = parseSchoolYearSetup(textValue(formData, "schoolYearSetup"));
  const sectionSchoolYearId = positiveIntegerValue(formData, "sectionSchoolYearId");
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
      sectionSchoolYearId,
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

function parseSchoolYearStructure(value: string): SchoolYearStructureGradeInput[] {
  try {
    const parsed = JSON.parse(value) as Array<{
      id?: unknown;
      name?: unknown;
      sections?: Array<{ id?: unknown; name?: unknown }>;
    }>;
    const seenGrades = new Set<string>();

    return parsed.map((grade) => {
      const name = normalizeLabel(String(grade.name ?? ""));
      const sections = Array.isArray(grade.sections)
        ? grade.sections.map((section) => ({
            id: positiveInteger(section.id),
            name: normalizeLabel(String(section.name ?? "")),
          })).filter((section) => Boolean(section.name))
        : [];
      const key = name.toLowerCase();
      if (!name || seenGrades.has(key) || new Set(sections.map((section) => section.name.toLowerCase())).size !== sections.length) {
        throw new Error("Invalid or duplicate grade/section names.");
      }
      seenGrades.add(key);
      return { id: positiveInteger(grade.id), name, sections };
    });
  } catch {
    return [];
  }
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function positiveIntegerValue(formData: FormData, key: string) {
  const parsed = Number(textValue(formData, key));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

async function resolveSectionSchoolYearId(
  connection: PoolConnection,
  schoolId: number,
  requestedSchoolYearId: number | null,
  activeSchoolYearId: number,
) {
  if (!requestedSchoolYearId) {
    return activeSchoolYearId;
  }

  const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT id
     FROM school_years
     WHERE id = :schoolYearId AND school_id = :schoolId
     LIMIT 1`,
    { schoolYearId: requestedSchoolYearId, schoolId },
  );

  return rows[0]?.id ?? activeSchoolYearId;
}

async function getSchoolYearActivationTargetForUpdate(connection: PoolConnection, schoolId: number, schoolYearId: number) {
  const [rows] = await connection.execute<Array<RowDataPacket & {
    id: number;
    name: string;
    status: "upcoming" | "active" | "closed";
  }>>(
    `SELECT id, name, status
     FROM school_years
     WHERE id = :schoolYearId AND school_id = :schoolId
     LIMIT 1
     FOR UPDATE`,
    { schoolYearId, schoolId },
  );

  return rows[0] ?? null;
}

async function getActiveSchoolYearForUpdate(connection: PoolConnection, schoolId: number) {
  const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT id
     FROM school_years
     WHERE school_id = :schoolId AND status = 'active'
     FOR UPDATE`,
    { schoolId },
  );

  return rows;
}

async function countSectionsForSchoolYear(connection: PoolConnection, schoolId: number, schoolYearId: number) {
  const [rows] = await connection.execute<Array<RowDataPacket & { section_count: number }>>(
    `SELECT COUNT(*) AS section_count
     FROM sections
     WHERE school_id = :schoolId AND school_year_id = :schoolYearId`,
    { schoolId, schoolYearId },
  );

  return Number(rows[0]?.section_count ?? 0);
}

async function countSchoolYearsWithName(connection: PoolConnection, schoolId: number, schoolYearName: string) {
  const [rows] = await connection.execute<Array<RowDataPacket & { year_count: number }>>(
    `SELECT COUNT(*) AS year_count
     FROM school_years
     WHERE school_id = :schoolId AND LOWER(name) = LOWER(:schoolYearName)`,
    { schoolId, schoolYearName },
  );

  return Number(rows[0]?.year_count ?? 0);
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

async function saveFocusedSchoolYearStructure(
  connection: PoolConnection,
  schoolId: number,
  schoolYearId: number,
  grades: SchoolYearStructureGradeInput[],
) {
  for (const [index, grade] of grades.entries()) {
    let gradeLevelId = grade.id;

    if (gradeLevelId) {
      const [ownedGrades] = await connection.execute<Array<RowDataPacket & { id: number }>>(
        "SELECT id FROM grade_levels WHERE id = :gradeLevelId AND school_id = :schoolId LIMIT 1 FOR UPDATE",
        { gradeLevelId, schoolId },
      );
      if (!ownedGrades[0]) throw new Error("Grade level does not belong to this school.");
      await connection.execute(
        "UPDATE grade_levels SET name = :name, sort_order = :sortOrder WHERE id = :gradeLevelId AND school_id = :schoolId",
        { gradeLevelId, schoolId, name: grade.name, sortOrder: index + 1 },
      );
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO grade_levels (school_id, name, sort_order)
         VALUES (:schoolId, :name, :sortOrder)
         ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), id = LAST_INSERT_ID(id)`,
        { schoolId, name: grade.name, sortOrder: index + 1 },
      );
      gradeLevelId = Number(result.insertId);
    }

    for (const section of grade.sections) {
      if (section.id) {
        const [ownedSections] = await connection.execute<Array<RowDataPacket & { id: number }>>(
          `SELECT id FROM sections
           WHERE id = :sectionId AND school_id = :schoolId AND school_year_id = :schoolYearId
           LIMIT 1 FOR UPDATE`,
          { sectionId: section.id, schoolId, schoolYearId },
        );
        if (!ownedSections[0]) throw new Error("Section does not belong to this school year.");
        await connection.execute(
          `UPDATE sections SET grade_level_id = :gradeLevelId, name = :name
           WHERE id = :sectionId AND school_id = :schoolId AND school_year_id = :schoolYearId`,
          { sectionId: section.id, schoolId, schoolYearId, gradeLevelId, name: section.name },
        );
      } else {
        await connection.execute(
          `INSERT INTO sections (school_id, school_year_id, grade_level_id, name)
           VALUES (:schoolId, :schoolYearId, :gradeLevelId, :name)`,
          { schoolId, schoolYearId, gradeLevelId, name: section.name },
        );
      }
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

function revalidateAdminSchoolYearPaths() {
  [
    "/admin/dashboard",
    "/admin/school-setup",
    "/admin/students",
    "/admin/student-profile",
    "/admin/parents",
    "/admin/tuition",
    "/admin/other-fees",
    "/admin/collections",
    "/admin/allowance",
    "/admin/store-transactions",
    "/admin/reports",
  ].forEach((path) => revalidatePath(path));
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

class ActivationValidationError extends Error {}
