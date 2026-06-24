"use server";

import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { createSession, deleteSession, setAuthFlashToast, type PortalRole } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password.mjs";
import { linkParentToStudentByReference } from "@/lib/students/records";
import { parseLoginForm, parseRegisterForm } from "@/lib/auth/validation.mjs";

export type AuthFormState = {
  message: string;
  errors?: Record<string, string>;
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
      `INSERT INTO users (role, name, email, phone, password_hash)
       VALUES (:role, :name, :email, :phone, :passwordHash)`,
      {
        role: parsed.data.role,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        passwordHash,
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
    } else {
      await connection.execute(
        `INSERT INTO parent_profiles (user_id, student_name, student_reference, relationship)
         VALUES (:userId, :studentName, :studentReference, :relationship)`,
        {
          userId: userResult.insertId,
          studentName: parsed.data.profile.studentName,
          studentReference: parsed.data.profile.studentReference,
          relationship: parsed.data.profile.relationship,
        },
      );

      try {
        await linkParentToStudentByReference(
          connection,
          userResult.insertId,
          parsed.data.profile.studentReference,
        );
      } catch {
        // Parent accounts can be created before the school has imported or added the student record.
      }
    }

    await connection.commit();
    await createSession({ userId: userResult.insertId, role, name: parsed.data.name });
    await setAuthFlashToast({
      role,
      title: "Account created",
      description: role === "admin"
        ? "Welcome to the school admin dashboard."
        : "Welcome to your parent portal.",
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    return duplicateAccount(error)
      ? { message: "An account already exists for this portal using that email or phone." }
      : { message: "Unable to create the account. Check that MySQL/XAMPP is running and try again." };
  } finally {
    connection?.release();
  }

  redirect(role === "admin" ? "/admin/dashboard" : "/parent/dashboard");
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

    if (!user || user.status !== "active") {
      return { message: "Invalid login details or inactive account." };
    }

    const validPassword = await verifyPassword(parsed.data.password, user.password_hash);

    if (!validPassword) {
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
  } catch {
    return { message: "Unable to sign in. Check that MySQL/XAMPP is running and try again." };
  }

  redirect(role === "admin" ? "/admin/dashboard" : "/parent/dashboard");
}

export async function logoutAction(role: PortalRole) {
  await deleteSession();
  await setAuthFlashToast({
    role,
    title: "Signed out",
    description: role === "admin"
      ? "You have signed out of the school admin dashboard."
      : "You have signed out of the parent portal.",
  });

  redirect(role === "admin" ? "/admin/login?signedOut=1" : "/parent/login?signedOut=1");
}

function duplicateAccount(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
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
