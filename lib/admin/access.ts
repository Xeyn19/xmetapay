import "server-only";

import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

import { canAccessAdminPath, normalizeAdminStaffRole, type AdminStaffRole } from "./permissions";

export async function getAdminStaffRole(adminUserId: number): Promise<AdminStaffRole | null> {
  try {
    const [rows] = await pool.execute<AdminStaffRoleRow[]>(
      `SELECT staff_role
       FROM admin_profiles
       WHERE user_id = :adminUserId
       LIMIT 1`,
      { adminUserId },
    );

    return normalizeAdminStaffRole(rows[0]?.staff_role);
  } catch {
    return null;
  }
}

export async function requireAdminPageAccess(adminUserId: number, pathname: string) {
  const staffRole = await getAdminStaffRole(adminUserId);

  if (!canAccessAdminPath(staffRole, pathname)) {
    redirect("/admin/dashboard");
  }

  return staffRole;
}

type AdminStaffRoleRow = RowDataPacket & {
  staff_role: string;
};
