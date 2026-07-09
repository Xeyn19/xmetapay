"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { createSession, deleteSession, requireSuperAdmin, setAuthFlashToast } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password.mjs";

export type SuperAdminLoginState = {
  message: string;
  errors?: Record<string, string>;
};

const initialState: SuperAdminLoginState = { message: "" };

export async function superAdminLoginAction(
  _state: SuperAdminLoginState = initialState,
  formData: FormData,
): Promise<SuperAdminLoginState> {
  void _state;
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const errors: Record<string, string> = {};

  if (!email) {
    errors.email = "Email is required.";
  }

  if (!password) {
    errors.password = "Password is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { message: "Please enter your company login details.", errors };
  }

  try {
    const [rows] = await pool.execute<SuperAdminUserRow[]>(
      `SELECT id, role, name, email, password_hash, status
       FROM users
       WHERE role = 'super_admin' AND email = :email
       LIMIT 1`,
      { email },
    );
    const user = rows[0];

    if (!user || user.status !== "active") {
      return { message: "Invalid company login details or inactive account." };
    }

    const validPassword = await verifyPassword(password, user.password_hash);

    if (!validPassword) {
      return { message: "Invalid company login details or inactive account." };
    }

    await pool.execute(
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id",
      { id: user.id },
    );
    await createSession({ userId: user.id, role: "super_admin", name: user.name });
    await setAuthFlashToast({
      role: "super_admin",
      title: "Signed in",
      description: "Welcome to XMETA company monitoring.",
    });
  } catch (error) {
    console.error("[super-admin:login]", databaseErrorDetails(error));

    return {
      message: process.env.NODE_ENV === "production"
        ? "Unable to sign in. The production database connection is unavailable."
        : "Unable to sign in. Check that MySQL/XAMPP is running and try again.",
    };
  }

  redirect("/super-admin/dashboard");
}

export async function superAdminLogoutAction() {
  await deleteSession();
  await setAuthFlashToast({
    role: "super_admin",
    title: "Signed out",
    description: "You have signed out of company monitoring.",
  });

  redirect("/login?signedOut=1");
}

export async function updateSchoolAdminStatusAction(formData: FormData) {
  await requireSuperAdmin();

  const userId = Number(value(formData, "userId"));
  const nextStatus = value(formData, "status");

  if (!Number.isInteger(userId) || userId <= 0 || !["active", "disabled"].includes(nextStatus)) {
    await setAuthFlashToast({
      role: "super_admin",
      title: "Account not updated",
      description: "Choose a valid school admin account and status.",
    });
    redirect("/super-admin/dashboard");
  }

  await pool.execute(
    `UPDATE users
     SET status = :status
     WHERE id = :userId
       AND role = 'admin'`,
    {
      userId,
      status: nextStatus,
    },
  );

  await setAuthFlashToast({
    role: "super_admin",
    title: "School admin updated",
    description: nextStatus === "active" ? "The school admin can sign in again." : "The school admin account is disabled.",
  });
  revalidatePath("/super-admin/dashboard");
  redirect("/super-admin/dashboard");
}

function value(formData: FormData, key: string) {
  const fieldValue = formData.get(key);
  return typeof fieldValue === "string" ? fieldValue.trim() : "";
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

type SuperAdminUserRow = RowDataPacket & {
  id: number;
  role: "super_admin";
  name: string;
  email: string;
  password_hash: string;
  status: "active" | "pending" | "disabled";
};
