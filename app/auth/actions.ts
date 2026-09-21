"use server";

import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { createSession, deleteSession, setAuthFlashToast, type PortalRole } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password.mjs";
import { parseLoginForm, parseRegisterForm } from "@/lib/auth/validation.mjs";
import { PRODUCT_NAME } from "@/lib/brand";
import { ParentSchoolScopeError, validateActiveRegistrationSchool } from "@/lib/parents/school-scope";
import { saveParentRegistrationReferences } from "@/lib/parents/registration-approval";

export type AuthFormState = {
  message: string;
  errors?: Record<string, string>;
  tone?: "error" | "info" | "warning";
};

const initialState: AuthFormState = { message: "" };

export async function registerAction(role: PortalRole, _state: AuthFormState = initialState, formData: FormData): Promise<AuthFormState> {
  void _state;
  const parsed = parseRegisterForm(role, formData);

  if (!parsed.ok) {
    return { message: "Please fix the highlighted fields.", errors: parsed.errors };
  }

  let connection: PoolConnection | null = null;

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [userResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (role, name, email, phone, password_hash, status)
       VALUES (:role, :name, :email, :phone, :passwordHash, :status)`,
      {
        role: parsed.data.role,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        passwordHash,
        status: "pending",
      },
    );

    if (role === "admin") {
      await connection.execute(
        `INSERT INTO admin_profiles (user_id, school_name, staff_role)
         VALUES (:userId, :schoolName, :staffRole)`,
        {
          userId: userResult.insertId,
          schoolName: parsed.data.profile.schoolName,
          staffRole: parsed.data.profile.staffRole,
        },
      );
      await tryLinkAdminProfileToExistingSchool(connection, userResult.insertId, parsed.data.profile.schoolName);
    } else {
      await validateActiveRegistrationSchool(connection, parsed.data.profile.schoolId);
      if (parsed.data.profile.studentReferences.length === 0) {
        const [schoolMatches] = await connection.execute<RowDataPacket[]>(
          `SELECT pg.id FROM pending_student_guardians pg
           JOIN students st ON st.id = pg.student_id AND st.school_id = pg.school_id
           WHERE pg.school_id = :schoolId AND pg.parent_email = :email AND pg.status = 'pending'
           LIMIT 1`,
          { schoolId: parsed.data.profile.schoolId, email: parsed.data.email },
        );
        if (schoolMatches.length === 0) {
          await connection.rollback();
          return { message: "Enter a student reference or ask your school to record your email during enrollment.", errors: { studentReferences: "No school-recorded parent email was found. Enter a student reference." } };
        }
      }
      await connection.execute(
        `INSERT INTO parent_profiles (user_id, school_id, student_name, student_reference, relationship)
         VALUES (:userId, :schoolId, :studentName, :studentReference, :relationship)`,
        {
          userId: userResult.insertId,
          schoolId: parsed.data.profile.schoolId,
          studentName: parsed.data.profile.studentName,
          studentReference: parsed.data.profile.studentReference,
          relationship: parsed.data.profile.relationship,
        },
      );

      await saveParentRegistrationReferences(
        connection,
        userResult.insertId,
        parsed.data.profile.schoolId,
        parsed.data.profile.studentReferences ?? [parsed.data.profile.studentReference],
      );
    }

    await connection.commit();
    if (role === "parent") {
      await setAuthFlashToast({
        role,
        title: "Registration submitted",
        description: "Your school will review your request. You can sign in after approval.",
      });
    } else {
      await setAuthFlashToast({
        role,
        title: "Registration submitted",
        description: `Your admin account is waiting for ${PRODUCT_NAME} approval.`,
      });
    }
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    logAuthDatabaseError("register", error);

    return duplicateAccount(error)
      ? { message: "An account already exists for this portal using that email or phone." }
      : error instanceof ParentSchoolScopeError
        ? { message: error.message, errors: { schoolId: error.message } }
        : { message: databaseFailureMessage("create the account") };
  } finally {
    connection?.release();
  }

  redirect(role === "admin" ? "/admin/login?pendingApproval=1" : "/parent/login?registrationSubmitted=1");
}

export async function loginAction(role: PortalRole, _state: AuthFormState = initialState, formData: FormData): Promise<AuthFormState> {
  void _state;
  const parsed = parseLoginForm(role, formData);

  if (!parsed.ok) {
    return { message: "Please enter your login details.", errors: parsed.errors };
  }

  try {
    const [rows] = await pool.execute<AuthUserRow[]>(
      `SELECT id, role, name, email, phone, password_hash, status
       FROM users
       WHERE role = :role AND (email = :identifier OR phone = :identifier)
       LIMIT 1`,
      {
        role,
        identifier: parsed.data.identifier,
      },
    );
    const user = rows[0];

    if (!user) {
      return { message: "Invalid login details or inactive account." };
    }

    const validPassword = await verifyPassword(parsed.data.password, user.password_hash);

    if (!validPassword) {
      return { message: "Invalid login details or inactive account." };
    }

    if (user.status === "pending") {
      return {
        message: role === "admin"
          ? `Your admin account is waiting for ${PRODUCT_NAME} approval.`
          : "Your registration is waiting for your school's approval. Please try again after the school reviews it.",
        tone: "info",
      };
    }

    if (user.status === "disabled") {
      if (role === "parent") {
        const [reviewRows] = await pool.execute<ParentReviewRow[]>(
          `SELECT decision FROM parent_registration_reviews
           WHERE parent_user_id = :userId ORDER BY id DESC LIMIT 1`,
          { userId: user.id },
        );
        if (reviewRows[0]?.decision === "rejected") {
          return {
            message: "Your registration was not approved. Please contact your school for help.",
            tone: "warning",
          };
        }
      }
      return {
        message: role === "admin"
          ? "Your admin account was not approved or is currently disabled."
          : "Your account is currently disabled.",
        tone: "warning",
      };
    }

    if (user.status !== "active") {
      return { message: "Invalid login details or inactive account." };
    }

    await pool.execute(
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id",
      { id: user.id },
    );
    await createSession({ userId: user.id, role, name: user.name });
    await setAuthFlashToast({
      role,
      title: "Signed in",
      description: role === "admin"
        ? "Welcome back to the school admin dashboard."
        : "Welcome back to your parent portal.",
    });
  } catch (error) {
    logAuthDatabaseError("login", error);

    return { message: databaseFailureMessage("sign in") };
  }

  redirect(role === "admin" ? "/admin/dashboard" : "/parent/dashboard");
}

export async function logoutAction(role: PortalRole) {
  await deleteSession();

  redirect(role === "admin" ? "/admin/login?signedOut=1" : "/parent/login?signedOut=1");
}

function duplicateAccount(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}

function databaseFailureMessage(action: string) {
  return process.env.NODE_ENV === "production"
    ? `Unable to ${action}. The production database connection is unavailable.`
    : `Unable to ${action}. Check that MySQL/XAMPP is running and try again.`;
}

function logAuthDatabaseError(action: "login" | "register", error: unknown) {
  if (duplicateAccount(error)) {
    return;
  }

  console.error("[auth:database]", {
    action,
    ...databaseErrorDetails(error),
  });
}

function databaseErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { name: "UnknownError" };
  }

  const details: Record<string, unknown> = {};

  for (const key of ["name", "code", "errno", "sqlState", "fatal"]) {
    if (key in error) {
      details[key] = error[key as keyof typeof error];
    }
  }

  return details;
}

async function tryLinkAdminProfileToExistingSchool(
  connection: PoolConnection,
  userId: number,
  schoolName: string,
) {
  try {
    await connection.execute(
      `UPDATE admin_profiles ap
       SET ap.school_id = (
         SELECT matched_school.id
         FROM (
           SELECT id
           FROM schools
           WHERE name = :schoolName
           ORDER BY status = 'active' DESC, id ASC
           LIMIT 1
         ) matched_school
       )
       WHERE ap.user_id = :userId
         AND ap.school_id IS NULL
         AND ap.school_name = :schoolName
         AND EXISTS (
           SELECT 1
           FROM schools
           WHERE name = :schoolName
         )`,
      { userId, schoolName },
    );
  } catch (error) {
    if (!missingFullSchema(error)) {
      throw error;
    }
  }
}

function missingFullSchema(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR");
}

type AuthUserRow = RowDataPacket & {
  id: number;
  role: PortalRole;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  status: "active" | "pending" | "disabled";
};

type ParentReviewRow = RowDataPacket & {
  decision: "approved" | "rejected" | "reopened";
};
