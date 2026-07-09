import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type SuperAdminDashboardData = {
  stats: {
    schools: number;
    adminAccounts: number;
    activeAdmins: number;
    disabledAdmins: number;
  };
  schoolRows: SuperAdminSchoolRow[];
  adminRows: SuperAdminAccountRow[];
  recentAdmins: SuperAdminAccountRow[];
};

export type SuperAdminSchoolRow = {
  id: number;
  name: string;
  code: string;
  status: string;
  adminCount: number;
  parentCount: number;
  studentCount: number;
  activeYear: string;
};

export type SuperAdminAccountRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  schoolName: string;
  staffRole: string;
  status: "active" | "pending" | "disabled";
  lastLogin: string;
  createdAt: string;
};

export async function getSuperAdminDashboardData(): Promise<SuperAdminDashboardData> {
  try {
    const [[stats], [schoolRows], [adminRows]] = await Promise.all([
      pool.execute<StatsRow[]>(
        `SELECT
           (SELECT COUNT(*) FROM schools) AS schools,
           (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admin_accounts,
           (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active') AS active_admins,
           (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'disabled') AS disabled_admins`,
      ),
      pool.execute<SchoolRow[]>(
        `SELECT
           s.id,
           s.name,
           s.code,
           s.status,
           COUNT(DISTINCT admin_users.id) AS admin_count,
           COUNT(DISTINCT parent_users.id) AS parent_count,
           COUNT(DISTINCT st.id) AS student_count,
           COALESCE(active_year.name, 'Pending') AS active_year
         FROM schools s
         LEFT JOIN admin_profiles ap ON ap.school_id = s.id
         LEFT JOIN users admin_users ON admin_users.id = ap.user_id AND admin_users.role = 'admin'
         LEFT JOIN school_years active_year ON active_year.school_id = s.id AND active_year.status = 'active'
         LEFT JOIN students st ON st.school_id = s.id
         LEFT JOIN student_guardians sg ON sg.student_id = st.id
         LEFT JOIN users parent_users ON parent_users.id = sg.parent_user_id AND parent_users.role = 'parent'
         GROUP BY s.id, s.name, s.code, s.status, active_year.name
         ORDER BY s.name ASC`,
      ),
      pool.execute<AdminRow[]>(
        `SELECT
           u.id,
           u.name,
           u.email,
           u.phone,
           u.status,
           u.last_login_at,
           u.created_at,
           ap.school_name,
           ap.staff_role,
           COALESCE(s.name, ap.school_name) AS resolved_school_name
         FROM users u
         JOIN admin_profiles ap ON ap.user_id = u.id
         LEFT JOIN schools s ON s.id = ap.school_id
         WHERE u.role = 'admin'
         ORDER BY u.created_at DESC, u.id DESC`,
      ),
    ]);

    const adminAccounts = adminRows.map(formatAdminRow);

    return {
      stats: {
        schools: Number(stats[0]?.schools ?? 0),
        adminAccounts: Number(stats[0]?.admin_accounts ?? 0),
        activeAdmins: Number(stats[0]?.active_admins ?? 0),
        disabledAdmins: Number(stats[0]?.disabled_admins ?? 0),
      },
      schoolRows: schoolRows.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        status: statusLabel(row.status),
        adminCount: Number(row.admin_count),
        parentCount: Number(row.parent_count),
        studentCount: Number(row.student_count),
        activeYear: row.active_year,
      })),
      adminRows: adminAccounts,
      recentAdmins: adminAccounts.slice(0, 5),
    };
  } catch (error) {
    if (!missingFullSchema(error)) {
      throw error;
    }

    const [adminRows] = await pool.execute<AdminRow[]>(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.phone,
         u.status,
         u.last_login_at,
         u.created_at,
         ap.school_name,
         ap.staff_role,
         ap.school_name AS resolved_school_name
       FROM users u
       JOIN admin_profiles ap ON ap.user_id = u.id
       WHERE u.role = 'admin'
       ORDER BY u.created_at DESC, u.id DESC`,
    );
    const adminAccounts = adminRows.map(formatAdminRow);

    return {
      stats: {
        schools: 0,
        adminAccounts: adminAccounts.length,
        activeAdmins: adminAccounts.filter((account) => account.status === "active").length,
        disabledAdmins: adminAccounts.filter((account) => account.status === "disabled").length,
      },
      schoolRows: [],
      adminRows: adminAccounts,
      recentAdmins: adminAccounts.slice(0, 5),
    };
  }
}

function formatAdminRow(row: AdminRow): SuperAdminAccountRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "Pending",
    schoolName: row.resolved_school_name ?? row.school_name,
    staffRole: staffRoleLabel(row.staff_role),
    status: row.status,
    lastLogin: formatDateTime(row.last_login_at),
    createdAt: formatDateTime(row.created_at),
  };
}

function staffRoleLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value instanceof Date ? value : new Date(value));
}

function missingFullSchema(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR");
}

type StatsRow = RowDataPacket & {
  schools: number;
  admin_accounts: number;
  active_admins: number;
  disabled_admins: number;
};

type SchoolRow = RowDataPacket & {
  id: number;
  name: string;
  code: string;
  status: string;
  admin_count: number;
  parent_count: number;
  student_count: number;
  active_year: string;
};

type AdminRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: "active" | "pending" | "disabled";
  last_login_at: Date | string | null;
  created_at: Date | string;
  school_name: string;
  staff_role: string;
  resolved_school_name: string | null;
};
