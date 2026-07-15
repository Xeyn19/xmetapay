import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type SuperAdminDashboardData = {
  stats: {
    schools: number;
    adminAccounts: number;
    pendingAdmins: number;
    activeAdmins: number;
    disabledAdmins: number;
  };
  schoolRows: SuperAdminSchoolRow[];
  adminRows: SuperAdminAccountRow[];
  recentAdmins: SuperAdminAccountRow[];
  registrationTrend: SuperAdminRegistrationTrendRow[];
  registrationTrendMeta: SuperAdminRegistrationTrendMeta;
};

export type SuperAdminRegistrationTrendRow = {
  label: string;
  period: string;
  active: number;
  pending: number;
  disabled: number;
  total: number;
};

export type RegistrationTrendPreset = "daily" | "weekly" | "monthly" | "custom";

export type SuperAdminRegistrationTrendOptions = {
  preset?: string;
  from?: string;
  to?: string;
};

export type SuperAdminRegistrationTrendMeta = {
  preset: RegistrationTrendPreset;
  granularity: "daily" | "weekly" | "monthly";
  from: string;
  to: string;
  label: string;
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

export async function getSuperAdminDashboardData(
  options: SuperAdminRegistrationTrendOptions = {},
): Promise<SuperAdminDashboardData> {
  const trendConfig = getRegistrationTrendConfig(options);

  try {
    const [[stats], [schoolRows], [adminRows], [registrationTrendRows]] = await Promise.all([
      pool.execute<StatsRow[]>(
        `SELECT
           (SELECT COUNT(*) FROM schools) AS schools,
           (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admin_accounts,
           (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'pending') AS pending_admins,
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
      pool.execute<RegistrationTrendRow[]>(
        `SELECT
           ${trendConfig.bucketExpression} AS bucket_key,
           SUM(u.status = 'active') AS active_count,
           SUM(u.status = 'pending') AS pending_count,
           SUM(u.status = 'disabled') AS disabled_count
         FROM users u
         WHERE u.role = 'admin'
           AND u.created_at >= :fromDate
           AND u.created_at < :toDate
         GROUP BY ${trendConfig.bucketExpression}
         ORDER BY bucket_key ASC`,
        { fromDate: trendConfig.fromDateTime, toDate: trendConfig.toDateTime },
      ),
    ]);

    const adminAccounts = adminRows.map(formatAdminRow);

    return {
      stats: {
        schools: Number(stats[0]?.schools ?? 0),
        adminAccounts: Number(stats[0]?.admin_accounts ?? 0),
        pendingAdmins: Number(stats[0]?.pending_admins ?? 0),
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
      registrationTrend: buildRegistrationTrend(registrationTrendRows, trendConfig),
      registrationTrendMeta: trendConfig.meta,
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
        pendingAdmins: adminAccounts.filter((account) => account.status === "pending").length,
        activeAdmins: adminAccounts.filter((account) => account.status === "active").length,
        disabledAdmins: adminAccounts.filter((account) => account.status === "disabled").length,
      },
      schoolRows: [],
      adminRows: adminAccounts,
      recentAdmins: adminAccounts.slice(0, 5),
      registrationTrend: buildRegistrationTrendFromAdmins(adminRows, trendConfig),
      registrationTrendMeta: trendConfig.meta,
    };
  }
}

function buildRegistrationTrend(rows: RegistrationTrendCounts[], config: RegistrationTrendConfig): SuperAdminRegistrationTrendRow[] {
  const countsByBucket = new Map(rows.map((row) => [normalizeBucketKey(row.bucket_key), row]));
  const cursor = new Date(`${config.fromDate}T00:00:00`);
  const end = new Date(`${config.toDate}T00:00:00`);
  const result: SuperAdminRegistrationTrendRow[] = [];

  while (cursor < end) {
    const period = getBucketKey(cursor, config.granularity);
    const row = countsByBucket.get(period);
    const active = Number(row?.active_count ?? 0);
    const pending = Number(row?.pending_count ?? 0);
    const disabled = Number(row?.disabled_count ?? 0);

    result.push({
      label: formatTrendLabel(cursor, config.granularity),
      period,
      active,
      pending,
      disabled,
      total: active + pending + disabled,
    });
    advanceCursor(cursor, config.granularity);
  }

  return result;
}

function buildRegistrationTrendFromAdmins(rows: AdminRow[], config: RegistrationTrendConfig): SuperAdminRegistrationTrendRow[] {
  const counts = new Map<string, RegistrationTrendCounts>();

  rows.forEach((row) => {
    const date = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
    if (date < new Date(`${config.fromDate}T00:00:00`) || date >= new Date(`${config.toDate}T00:00:00`)) {
      return;
    }
    const bucketKey = getBucketKey(date, config.granularity);
    const current = counts.get(bucketKey) ?? {
      bucket_key: bucketKey,
      active_count: 0,
      pending_count: 0,
      disabled_count: 0,
    };

    if (row.status === "active") {
      current.active_count += 1;
    } else if (row.status === "pending") {
      current.pending_count += 1;
    } else {
      current.disabled_count += 1;
    }
    counts.set(bucketKey, current);
  });

  return buildRegistrationTrend([...counts.values()], config);
}

function getRegistrationTrendConfig(options: SuperAdminRegistrationTrendOptions): RegistrationTrendConfig {
  const now = new Date();
  const preset = isTrendPreset(options.preset) ? options.preset : "monthly";
  let granularity: RegistrationTrendConfig["granularity"] = preset === "daily"
    ? "daily"
    : preset === "weekly"
      ? "weekly"
      : "monthly";
  let from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  let to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (preset === "daily") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (preset === "weekly") {
    const monday = startOfWeek(now);
    from = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 77);
    to = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  } else if (preset === "custom") {
    const requestedFrom = parseDateOnly(options.from);
    const requestedTo = parseDateOnly(options.to);
    if (requestedFrom && requestedTo && requestedFrom <= requestedTo) {
      const spanDays = Math.floor((requestedTo.getTime() - requestedFrom.getTime()) / 86400000) + 1;
      granularity = spanDays <= 45 ? "daily" : spanDays <= 180 ? "weekly" : "monthly";
      from = granularity === "weekly" ? startOfWeek(requestedFrom) : granularity === "monthly" ? new Date(requestedFrom.getFullYear(), requestedFrom.getMonth(), 1) : requestedFrom;
      const requestedEnd = new Date(requestedTo.getFullYear(), requestedTo.getMonth(), requestedTo.getDate() + 1);
      to = granularity === "weekly" ? new Date(startOfWeek(requestedEnd).getTime() + 7 * 86400000) : granularity === "monthly" ? new Date(requestedEnd.getFullYear(), requestedEnd.getMonth() + 1, 1) : requestedEnd;
    } else {
      return getRegistrationTrendConfig({ preset: "monthly" });
    }
  }

  const fromDate = formatDateOnly(from);
  const toDate = formatDateOnly(to);
  return {
    granularity,
    fromDate,
    toDate,
    fromDateTime: `${fromDate} 00:00:00`,
    toDateTime: `${toDate} 00:00:00`,
    bucketExpression: granularity === "daily"
      ? "DATE(u.created_at)"
      : granularity === "weekly"
        ? "DATE_SUB(DATE(u.created_at), INTERVAL WEEKDAY(u.created_at) DAY)"
        : "DATE_FORMAT(u.created_at, '%Y-%m-01')",
    meta: {
      preset,
      granularity,
      from: fromDate,
      to: formatDateOnly(new Date(to.getTime() - 86400000)),
      label: formatRangeLabel(from, new Date(to.getTime() - 86400000)),
    },
  };
}

function isTrendPreset(value: string | undefined): value is RegistrationTrendPreset {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "custom";
}

function parseDateOnly(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function formatDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatRangeLabel(from: Date, to: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).formatRange(from, to);
}

function formatTrendLabel(date: Date, granularity: RegistrationTrendConfig["granularity"]) {
  if (granularity === "monthly") {
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function getBucketKey(date: Date, granularity: RegistrationTrendConfig["granularity"]) {
  const value = granularity === "weekly" ? startOfWeek(date) : new Date(date.getFullYear(), granularity === "monthly" ? date.getMonth() : date.getMonth(), granularity === "monthly" ? 1 : date.getDate());
  return formatDateOnly(value);
}

function normalizeBucketKey(value: string | Date) {
  return formatDateOnly(value instanceof Date ? value : new Date(String(value).slice(0, 10) + "T00:00:00"));
}

function advanceCursor(cursor: Date, granularity: RegistrationTrendConfig["granularity"]) {
  if (granularity === "monthly") {
    cursor.setMonth(cursor.getMonth() + 1);
  } else {
    cursor.setDate(cursor.getDate() + (granularity === "daily" ? 1 : 7));
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
  pending_admins: number;
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

type RegistrationTrendCounts = {
  bucket_key: string;
  active_count: number;
  pending_count: number;
  disabled_count: number;
};

type RegistrationTrendRow = RowDataPacket & RegistrationTrendCounts;

type RegistrationTrendConfig = {
  granularity: "daily" | "weekly" | "monthly";
  fromDate: string;
  toDate: string;
  fromDateTime: string;
  toDateTime: string;
  bucketExpression: string;
  meta: SuperAdminRegistrationTrendMeta;
};
