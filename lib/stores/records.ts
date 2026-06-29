import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";

export type StoreMerchantType = "canteen" | "school_store" | "other";

export type AdminStoreSetupData = {
  warning: string | null;
  ready: boolean;
  merchants: AdminStoreMerchant[];
  wallets: AdminStoreWalletStudent[];
};

export type AdminStoreMerchant = {
  id: number;
  name: string;
  type: StoreMerchantType;
  typeLabel: string;
  status: string;
};

export type AdminStoreWalletStudent = {
  studentId: number;
  walletId: number;
  name: string;
  meta: string;
  balance: string;
  balanceValue: number;
};

export async function getAdminStoreSetupData(adminUserId: number): Promise<AdminStoreSetupData> {
  const setup = await getResolvedAdminSchoolSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return emptyStoreSetup(setup.warning);
  }

  try {
    const [merchants, wallets] = await Promise.all([
      getStoreMerchants(setup.schoolId),
      getStudentWallets(setup.schoolId, setup.schoolYearId),
    ]);

    return {
      warning: null,
      ready: merchants.length > 0 && wallets.length > 0,
      merchants,
      wallets,
    };
  } catch {
    return emptyStoreSetup("Store setup records are unavailable. Confirm MySQL/XAMPP and store tables are ready.");
  }
}

async function getStoreMerchants(schoolId: number) {
  const [rows] = await pool.execute<StoreMerchantRow[]>(
    `SELECT id, name, type, status
     FROM store_merchants
     WHERE school_id = :schoolId
     ORDER BY status ASC, name ASC`,
    { schoolId },
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    typeLabel: labelForMerchantType(row.type),
    status: labelForStatus(row.status),
  }) satisfies AdminStoreMerchant);
}

async function getStudentWallets(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<StudentWalletRow[]>(
    `SELECT st.id AS student_id, st.student_reference, st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(sec.name, '-') AS section_name,
       w.id AS wallet_id,
       w.balance
     FROM students st
     JOIN wallets w ON w.student_id = st.id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE st.school_id = :schoolId
       AND st.status = 'active'
       AND w.status = 'active'
       AND w.balance > 0
     ORDER BY st.last_name ASC, st.first_name ASC`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => {
    const name = fullName(row.first_name, row.middle_name, row.last_name);

    return {
      studentId: row.student_id,
      walletId: row.wallet_id,
      name,
      meta: [row.grade_name, row.section_name !== "-" ? row.section_name : null, row.student_reference].filter(Boolean).join(" - "),
      balance: money(row.balance),
      balanceValue: decimalValue(row.balance),
    } satisfies AdminStoreWalletStudent;
  });
}

function emptyStoreSetup(warning: string | null): AdminStoreSetupData {
  return {
    warning,
    ready: false,
    merchants: [],
    wallets: [],
  };
}

function labelForMerchantType(value: string) {
  const labels: Record<string, string> = {
    canteen: "Canteen",
    school_store: "School store",
    other: "Other",
  };

  return labels[value] ?? labelForStatus(value);
}

function labelForStatus(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fullName(firstName: string, middleName: string | null, lastName: string) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ");
}

function decimalValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function money(value: number | string | null | undefined) {
  const amount = decimalValue(value);

  return `P${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

type StoreMerchantRow = RowDataPacket & {
  id: number;
  name: string;
  type: StoreMerchantType;
  status: string;
};

type StudentWalletRow = RowDataPacket & {
  student_id: number;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  section_name: string;
  wallet_id: number;
  balance: number | string;
};
