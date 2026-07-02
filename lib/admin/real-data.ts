import "server-only";

import {
  Activity,
  BarChart3,
  Calculator,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Receipt,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";

type Tone = "orange" | "green" | "red" | "blue" | "purple" | "teal";
type NoteTone = "default" | "up" | "warn" | "danger";

export type AdminRealKpi = {
  label: string;
  value: string;
  note: string;
  tone: Tone;
  noteTone?: NoteTone;
  icon?: LucideIcon;
};

export type SummaryRow = {
  label: string;
  value: string;
  tone?: "default" | "green" | "red" | "orange" | "blue";
};

export type BarRow = {
  label: string;
  value: string;
  percent: number;
  tone?: "orange" | "green" | "blue";
};

export type TimelineRow = {
  id: number;
  title: string;
  detail: string;
  time: string;
  tone: "orange" | "green" | "gray";
};

export type AdminDashboardRealData = {
  warning: string | null;
  alerts: Array<{ tone: "danger" | "warn"; message: string }>;
  kpis: AdminRealKpi[];
  tuitionByGrade: BarRow[];
  monthlySummary: SummaryRow[];
  recentFeeAssignments: Array<[string, string, string, string, string, string]>;
  recentPayments: Array<[string, string, string, string, string, string]>;
  activityFeed: TimelineRow[];
};

export type TuitionPageRealData = {
  warning: string | null;
  kpis: AdminRealKpi[];
  rows: TuitionRow[];
  outstandingByGrade: BarRow[];
  otherFeeSummary: Array<[string, string, string, string]>;
  reminderRows: Array<[number, string, string, string, string, string, string]>;
};

export type TuitionRow = {
  student: string;
  grade: string;
  section: string;
  due: number;
  paid: number;
  lastPayment: string;
  status: "paid" | "partial" | "unpaid";
};

export type CollectionsPageRealData = {
  warning: string | null;
  kpis: AdminRealKpi[];
  rows: Array<[string, string, string, string, string, string, string, string]>;
};

export type OtherFeesPageRealData = {
  warning: string | null;
  kpis: AdminRealKpi[];
  items: Array<{
    name: string;
    meta: string;
    amount: string;
    status: string;
    assignedCount: number;
    paidCount: number;
    paidLabel: string;
    totalBilled: string;
    collected: string;
    outstanding: string;
  }>;
};

export type AllowancePageRealData = {
  warning: string | null;
  kpis: AdminRealKpi[];
  rows: Array<[string, string, string, string, string, string, "Active" | "Low" | "No balance"]>;
};

export type StoreTransactionsPageRealData = {
  warning: string | null;
  kpis: AdminRealKpi[];
  spendByGrade: BarRow[];
  peakHours: BarRow[];
  rows: Array<[string, string, string, string, string, string, string]>;
};

export type ReportsPageRealData = {
  warning: string | null;
  kpis: AdminRealKpi[];
  monthlyRevenue: BarRow[];
  reports: Array<{ name: string; desc: string; csvHref: string; pdfHref: string; icon: LucideIcon }>;
};

export type AdminStudentProfileRealData = {
  warning: string | null;
  students: AdminStudentProfileSummary[];
  student: {
    id: number;
    initials: string;
    fullName: string;
    subtitle: string;
    tags: string[];
    walletBalance: string;
    openBalance: string;
    details: SummaryRow[];
    guardian: SummaryRow[];
    wallet: {
      kpi: AdminRealKpi;
      rows: SummaryRow[];
    };
    fees: SummaryRow[];
    transactions: Array<[string, string, string, string, string]>;
  } | null;
};

export type AdminStudentProfileSummary = {
  id: number;
  profileHref: string;
  initials: string;
  fullName: string;
  studentReference: string;
  gradeSection: string;
  guardians: string;
  enrollmentStatus: string;
  studentStatus: string;
};

type AdminStudentTransactionDisplay = NonNullable<AdminStudentProfileRealData["student"]>["transactions"][number];

type AdminSetup = {
  schoolId: number | null;
  schoolYearId: number | null;
  schoolYearName: string | null;
  warning: string | null;
};

export async function getAdminDashboardRealData(adminUserId: number): Promise<AdminDashboardRealData> {
  const setup = await getAdminSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return emptyDashboard(setup.warning);
  }

  try {
    const [studentSummary, feeSummary, paymentSummary, walletSummary, tuitionByGrade, recentFeeAssignments, recentPayments, activityFeed] =
      await Promise.all([
        getStudentSummary(setup.schoolId, setup.schoolYearId),
        getFeeSummary(setup.schoolId, setup.schoolYearId),
        getPaymentSummary(setup.schoolId),
        getWalletSummary(setup.schoolId, setup.schoolYearId),
        getTuitionByGrade(setup.schoolId, setup.schoolYearId),
        getRecentFeeAssignments(setup.schoolId, setup.schoolYearId),
        getRecentPayments(setup.schoolId),
        getActivityFeed(setup.schoolId),
      ]);

    const hasFees = feeSummary.assignmentCount > 0;
    const alerts = [
      hasFees && feeSummary.openBalance > 0
        ? { tone: "danger" as const, message: `${money(feeSummary.openBalance)} remains outstanding from real fee assignments.` }
        : null,
      walletSummary.lowWallets > 0
        ? { tone: "warn" as const, message: `${walletSummary.lowWallets} student wallet${walletSummary.lowWallets === 1 ? "" : "s"} are below P50.` }
        : null,
    ].filter(Boolean) as AdminDashboardRealData["alerts"];

    return {
      warning: null,
      alerts,
      kpis: [
        { label: "Total enrolled", value: String(studentSummary.enrolled), note: setup.schoolYearName ?? "Active school year", tone: "blue", icon: Users },
        {
          label: "Collected",
          value: paymentSummary.paidCount > 0 ? money(paymentSummary.paidAmount) : "Pending",
          note: paymentSummary.paidCount > 0 ? `${paymentSummary.paidCount} paid payment records` : "Payment records pending",
          tone: "orange",
          noteTone: paymentSummary.paidCount > 0 ? "up" : "warn",
          icon: CreditCard,
        },
        {
          label: "Outstanding",
          value: hasFees ? money(feeSummary.openBalance) : "Pending",
          note: hasFees ? `${feeSummary.openAssignments} open or partial fee records` : "Create fee assignments first",
          tone: "red",
          noteTone: hasFees && feeSummary.openBalance > 0 ? "danger" : "default",
          icon: Activity,
        },
        {
          label: "Wallets",
          value: walletSummary.walletCount > 0 ? money(walletSummary.totalBalance) : "Pending",
          note: walletSummary.walletCount > 0 ? `${walletSummary.walletCount} wallet records` : "No wallet records yet",
          tone: "green",
          icon: Wallet,
        },
      ],
      tuitionByGrade,
      monthlySummary: [
        { label: "Total fees billed", value: hasFees ? money(feeSummary.amountDue) : "Pending" },
        { label: "Collected from assignments", value: hasFees ? money(feeSummary.amountPaid) : "Pending", tone: hasFees ? "green" : "default" },
        { label: "Outstanding balance", value: hasFees ? money(feeSummary.openBalance) : "Pending", tone: hasFees && feeSummary.openBalance > 0 ? "red" : "default" },
        { label: "Collection rate", value: hasFees ? percent(feeSummary.amountPaid, feeSummary.amountDue) : "Pending" },
        { label: "Wallet balance total", value: walletSummary.walletCount > 0 ? money(walletSummary.totalBalance) : "Pending" },
        { label: "Store spend recorded", value: walletSummary.storeSpend > 0 ? money(walletSummary.storeSpend) : "Pending" },
      ],
      recentFeeAssignments,
      recentPayments,
      activityFeed,
    };
  } catch {
    return emptyDashboard("Admin dashboard data is unavailable. Confirm MySQL/XAMPP and the full schema are ready.");
  }
}

export async function getAdminTuitionPageRealData(adminUserId: number): Promise<TuitionPageRealData> {
  const setup = await getAdminSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return emptyTuition(setup.warning);
  }

  try {
    const [rows, feeSummary, outstandingByGrade, otherFeeSummary, reminderRows] = await Promise.all([
      getTuitionRows(setup.schoolId, setup.schoolYearId),
      getFeeSummary(setup.schoolId, setup.schoolYearId, "tuition"),
      getOutstandingByGrade(setup.schoolId, setup.schoolYearId),
      getOtherFeeSummary(setup.schoolId, setup.schoolYearId),
      getRecentReminderRows(setup.schoolId, setup.schoolYearId),
    ]);
    const hasRows = rows.length > 0;

    return {
      warning: null,
      kpis: [
        { label: "Tuition billed", value: hasRows ? money(feeSummary.amountDue) : "Pending", note: hasRows ? `${rows.length} tuition assignments` : "Create tuition fee assignments first", tone: "orange", icon: Calculator },
        { label: "Collected", value: hasRows ? money(feeSummary.amountPaid) : "Pending", note: hasRows ? percent(feeSummary.amountPaid, feeSummary.amountDue) : "Collection pending", tone: "green", noteTone: hasRows ? "up" : "default", icon: CreditCard },
        { label: "Outstanding", value: hasRows ? money(feeSummary.openBalance) : "Pending", note: hasRows ? `${feeSummary.openAssignments} open or partial` : "No balances yet", tone: "red", noteTone: feeSummary.openBalance > 0 ? "danger" : "default", icon: Activity },
        { label: "Due records", value: hasRows ? String(feeSummary.assignmentCount) : "0", note: setup.schoolYearName ?? "Active school year", tone: "blue", icon: Receipt },
      ],
      rows,
      outstandingByGrade,
      otherFeeSummary,
      reminderRows,
    };
  } catch {
    return emptyTuition("Tuition data is unavailable. Confirm MySQL/XAMPP and fee assignment tables are ready.");
  }
}

export async function getAdminCollectionsPageRealData(adminUserId: number): Promise<CollectionsPageRealData> {
  const setup = await getAdminSetup(adminUserId);

  if (!setup.schoolId) {
    return emptyCollections(setup.warning);
  }

  try {
    const [summary, rows] = await Promise.all([getPaymentSummary(setup.schoolId), getCollectionRows(setup.schoolId)]);

    return {
      warning: null,
      kpis: [
        { label: "Payments", value: String(summary.totalCount), note: summary.totalCount > 0 ? `${summary.paidCount} paid records` : "No payment records yet", tone: "orange", icon: CreditCard },
        { label: "Paid amount", value: summary.paidCount > 0 ? money(summary.paidAmount) : "Pending", note: "Real payments table", tone: "green", noteTone: summary.paidCount > 0 ? "up" : "default", icon: CreditCard },
        { label: "Pending review", value: String(summary.pendingCount), note: "Payment status pending", tone: "blue", icon: FileText },
        { label: "Failed / voided", value: String(summary.failedCount), note: "Needs admin review", tone: "red", noteTone: summary.failedCount > 0 ? "warn" : "default", icon: Activity },
      ],
      rows,
    };
  } catch {
    return emptyCollections("Collection data is unavailable. Confirm MySQL/XAMPP and payment tables are ready.");
  }
}

export async function getAdminOtherFeesPageRealData(adminUserId: number): Promise<OtherFeesPageRealData> {
  const setup = await getAdminSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return emptyOtherFees(setup.warning);
  }

  try {
    const [items, summary] = await Promise.all([
      getOtherFeeItems(setup.schoolId, setup.schoolYearId),
      getFeeSummary(setup.schoolId, setup.schoolYearId, "other"),
    ]);

    return {
      warning: null,
      kpis: [
        { label: "Total billed", value: items.length > 0 ? money(summary.amountDue) : "Pending", note: setup.schoolYearName ?? "Non-tuition fee items", tone: "orange", icon: Calculator },
        { label: "Collected", value: items.length > 0 ? money(summary.amountPaid) : "Pending", note: items.length > 0 ? percent(summary.amountPaid, summary.amountDue) : "Collection pending", tone: "green", noteTone: items.length > 0 ? "up" : "default", icon: CreditCard },
        { label: "Outstanding", value: items.length > 0 ? money(summary.openBalance) : "Pending", note: "Across active fee assignments", tone: "red", noteTone: summary.openBalance > 0 ? "danger" : "default", icon: Activity },
        { label: "Active fee types", value: String(items.filter((item) => item.status === "Active").length), note: setup.schoolYearName ?? "Active school year", tone: "blue", icon: ClipboardList },
      ],
      items,
    };
  } catch {
    return emptyOtherFees("Other fee data is unavailable. Confirm MySQL/XAMPP and fee tables are ready.");
  }
}

export async function getAdminAllowancePageRealData(adminUserId: number): Promise<AllowancePageRealData> {
  const setup = await getAdminSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return emptyAllowance(setup.warning);
  }

  try {
    const [summary, rows] = await Promise.all([
      getWalletSummary(setup.schoolId, setup.schoolYearId),
      getAllowanceRows(setup.schoolId, setup.schoolYearId),
    ]);

    return {
      warning: null,
      kpis: [
        { label: "Active wallets", value: String(summary.activeWallets), note: summary.walletCount > 0 ? `${summary.walletCount} student wallet${summary.walletCount === 1 ? "" : "s"}` : "Top up allowance to create wallets", tone: "blue", icon: Wallet },
        { label: "Total wallet balance", value: summary.walletCount > 0 ? money(summary.totalBalance) : "Pending", note: "Across all student wallets", tone: "orange", icon: Wallet },
        { label: "Top-ups this month", value: summary.monthlyTopUps > 0 ? money(summary.monthlyTopUps) : "Pending", note: summary.monthlyTopUpCount > 0 ? `${summary.monthlyTopUpCount} top-up transaction${summary.monthlyTopUpCount === 1 ? "" : "s"}` : "No top-ups this month", tone: "green", icon: Activity },
        { label: "Store spend this month", value: summary.monthlySpend > 0 ? money(summary.monthlySpend) : "Pending", note: "Purchase transactions", tone: "teal", icon: Store },
      ],
      rows,
    };
  } catch {
    return emptyAllowance("Allowance data is unavailable. Confirm MySQL/XAMPP and wallet tables are ready.");
  }
}

export async function getAdminStoreTransactionsPageRealData(adminUserId: number): Promise<StoreTransactionsPageRealData> {
  const setup = await getAdminSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return emptyStore(setup.warning);
  }

  try {
    const [summary, rows, spendByGrade, peakHours] = await Promise.all([
      getStoreSummary(setup.schoolId),
      getStoreRows(setup.schoolId, setup.schoolYearId),
      getStoreSpendByGrade(setup.schoolId, setup.schoolYearId),
      getStorePeakHours(setup.schoolId),
    ]);

    return {
      warning: null,
      kpis: [
        { label: "Transactions", value: String(summary.transactionCount), note: summary.transactionCount > 0 ? "Store transaction rows" : "No store transactions yet", tone: "orange", icon: Store },
        { label: "Gross spend", value: summary.transactionCount > 0 ? money(summary.amount) : "Pending", note: "Canteen and store purchases", tone: "green", icon: CreditCard },
        { label: "Txn fees", value: summary.transactionCount > 0 ? money(summary.feeAmount) : "Pending", note: "Recorded fee amount", tone: "blue", icon: Calculator },
        { label: "Merchants", value: String(summary.merchantCount), note: summary.merchantCount > 0 ? "Store merchant records" : "Merchant setup pending", tone: "teal", icon: Store },
      ],
      spendByGrade,
      peakHours,
      rows,
    };
  } catch {
    return emptyStore("Store transaction data is unavailable. Confirm MySQL/XAMPP and store tables are ready.");
  }
}

export async function getAdminReportsPageRealData(adminUserId: number): Promise<ReportsPageRealData> {
  const setup = await getAdminSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return emptyReports(setup.warning);
  }

  try {
    const [students, fees, payments, store, monthlyRevenue] = await Promise.all([
      getStudentSummary(setup.schoolId, setup.schoolYearId),
      getFeeSummary(setup.schoolId, setup.schoolYearId),
      getPaymentSummary(setup.schoolId),
      getStoreSummary(setup.schoolId),
      getMonthlyRevenue(setup.schoolId),
    ]);

    return {
      warning: null,
      kpis: [
        { label: "Enrolled students", value: String(students.enrolled), note: setup.schoolYearName ?? "Active school year", tone: "orange", icon: Users },
        { label: "Collected", value: payments.paidCount > 0 ? money(payments.paidAmount) : "Pending", note: "Payments table", tone: "green", icon: CreditCard },
        { label: "Outstanding", value: fees.assignmentCount > 0 ? money(fees.openBalance) : "Pending", note: "Fee assignments", tone: "red", noteTone: fees.openBalance > 0 ? "danger" : "default", icon: Activity },
        { label: "Store spend", value: store.transactionCount > 0 ? money(store.amount) : "Pending", note: "Store transactions", tone: "blue", icon: Store },
      ],
      monthlyRevenue,
      reports: reportDownloads(),
    };
  } catch {
    return emptyReports("Report data is unavailable. Confirm MySQL/XAMPP and reporting tables are ready.");
  }
}

export async function getAdminStudentProfileRealData(
  adminUserId: number,
  studentId?: number,
): Promise<AdminStudentProfileRealData> {
  const setup = await getAdminSetup(adminUserId);

  if (!setup.schoolId || !setup.schoolYearId) {
    return { warning: setup.warning, students: [], student: null };
  }

  try {
    const students = await getAdminStudentProfileSummaries(setup.schoolId, setup.schoolYearId);
    const selectedStudentClause = typeof studentId === "number" ? "AND st.id = :studentId" : "";
    const [rows] = await pool.execute<StudentProfileRow[]>(
      `SELECT st.id, st.student_reference, st.first_name, st.middle_name, st.last_name,
         st.birthdate, st.status AS student_status,
         COALESCE(gl.name, 'Not enrolled') AS grade_name,
         COALESCE(sec.name, '-') AS section_name,
         COALESCE(e.status, 'pending') AS enrollment_status,
         COALESCE(w.balance, 0) AS wallet_balance,
         COALESCE(w.status, 'closed') AS wallet_status,
         COALESCE(GROUP_CONCAT(DISTINCT u.name ORDER BY sg.is_primary DESC, u.name SEPARATOR ', '), 'Not linked') AS guardian_names,
         COALESCE(GROUP_CONCAT(DISTINCT pp.relationship ORDER BY sg.is_primary DESC, u.name SEPARATOR ', '), 'guardian') AS relationships,
         COALESCE(GROUP_CONCAT(DISTINCT COALESCE(u.phone, u.email) ORDER BY sg.is_primary DESC, u.name SEPARATOR ', '), 'Not on file') AS guardian_contacts
       FROM students st
       LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
       LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
       LEFT JOIN sections sec ON sec.id = e.section_id
       LEFT JOIN wallets w ON w.student_id = st.id
       LEFT JOIN student_guardians sg ON sg.student_id = st.id
       LEFT JOIN users u ON u.id = sg.parent_user_id
       LEFT JOIN parent_profiles pp ON pp.user_id = u.id
       WHERE st.school_id = :schoolId
       ${selectedStudentClause}
       GROUP BY st.id, st.student_reference, st.first_name, st.middle_name, st.last_name, st.birthdate, st.status,
         gl.name, sec.name, e.status, w.balance, w.status
       ORDER BY st.created_at DESC, st.id DESC
       LIMIT 1`,
      typeof studentId === "number"
        ? { schoolId: setup.schoolId, schoolYearId: setup.schoolYearId, studentId }
        : { schoolId: setup.schoolId, schoolYearId: setup.schoolYearId },
    );
    const row = rows[0];

    if (!row) {
      return {
        warning: students.length > 0
          ? "Choose a student from the profile list to view accurate details."
          : "No student records yet. Add a student before viewing a profile.",
        students,
        student: null,
      };
    }

    const [feeSummary, transactionRows, walletSummary] = await Promise.all([
      getStudentFeeSummary(row.id, setup.schoolYearId),
      getStudentTransactions(row.id),
      getStudentWalletSummary(row.id),
    ]);
    const fullStudentName = fullName(row.first_name, row.middle_name, row.last_name);
    const walletBalance = money(row.wallet_balance);
    const openBalance = money(feeSummary.openBalance);

    return {
      warning: null,
      students,
      student: {
        id: row.id,
        initials: initialsFor(fullStudentName),
        fullName: fullStudentName,
        subtitle: `${row.student_reference} - ${row.grade_name} - ${row.section_name}`,
        tags: [labelForStatus(row.enrollment_status), row.wallet_status === "closed" ? "Wallet pending" : `Wallet ${labelForStatus(row.wallet_status)}`, feeSummary.assignmentCount > 0 ? "Fees assigned" : "Fees pending"],
        walletBalance,
        openBalance,
        details: [
          { label: "Full name", value: fullStudentName },
          { label: "Student reference", value: row.student_reference },
          { label: "Grade / section", value: `${row.grade_name} - ${row.section_name}` },
          { label: "Date of birth", value: formatDate(row.birthdate) },
          { label: "Enrollment status", value: labelForStatus(row.enrollment_status) },
          { label: "Student status", value: labelForStatus(row.student_status) },
        ],
        guardian: [
          { label: "Parent / guardian", value: row.guardian_names },
          { label: "Relationship", value: labelForStatus(row.relationships) },
          { label: "Contact", value: row.guardian_contacts },
          { label: "Portal", value: row.guardian_names === "Not linked" ? "Pending" : "Linked", tone: row.guardian_names === "Not linked" ? "default" : "green" },
        ],
        wallet: {
          kpi: { label: "Current balance", value: walletBalance, note: walletSummary.lastTopUp, tone: row.wallet_status === "closed" ? "blue" : "orange" },
          rows: [
            { label: "Monthly spend", value: walletSummary.monthlySpend > 0 ? money(walletSummary.monthlySpend) : "Pending" },
            { label: "Total top-ups", value: walletSummary.totalTopUps > 0 ? money(walletSummary.totalTopUps) : "Pending" },
            { label: "Status", value: row.wallet_status === "closed" ? "Wallet pending" : labelForStatus(row.wallet_status), tone: row.wallet_status === "active" ? "green" : "default" },
          ],
        },
        fees: [
          { label: "Assigned fees", value: feeSummary.assignmentCount > 0 ? String(feeSummary.assignmentCount) : "Pending" },
          { label: "Total due", value: feeSummary.assignmentCount > 0 ? money(feeSummary.amountDue) : "Pending" },
          { label: "Total paid", value: feeSummary.assignmentCount > 0 ? money(feeSummary.amountPaid) : "Pending", tone: feeSummary.amountPaid > 0 ? "green" : "default" },
          { label: "Open balance", value: feeSummary.assignmentCount > 0 ? openBalance : "Pending", tone: feeSummary.openBalance > 0 ? "red" : "default" },
        ],
        transactions: transactionRows,
      },
    };
  } catch {
    return { warning: "Student profile data is unavailable. Confirm MySQL/XAMPP and the full schema are ready.", students: [], student: null };
  }
}

async function getAdminStudentProfileSummaries(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<StudentProfileSummaryRow[]>(
    `SELECT st.id, st.student_reference, st.first_name, st.middle_name, st.last_name,
       st.status AS student_status,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(sec.name, '-') AS section_name,
       COALESCE(e.status, 'pending') AS enrollment_status,
       COALESCE(GROUP_CONCAT(DISTINCT u.name ORDER BY sg.is_primary DESC, u.name SEPARATOR ', '), 'Not linked') AS guardian_names
     FROM students st
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN student_guardians sg ON sg.student_id = st.id
     LEFT JOIN users u ON u.id = sg.parent_user_id
     WHERE st.school_id = :schoolId
     GROUP BY st.id, st.student_reference, st.first_name, st.middle_name, st.last_name, st.status,
       gl.name, sec.name, e.status
     ORDER BY st.last_name ASC, st.first_name ASC, st.id ASC`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => {
    const name = fullName(row.first_name, row.middle_name, row.last_name);
    const gradeSection = `${row.grade_name} - ${row.section_name}`;

    return {
      id: row.id,
      profileHref: `/admin/students/${row.id}`,
      initials: initialsFor(name),
      fullName: name,
      studentReference: row.student_reference,
      gradeSection,
      guardians: row.guardian_names,
      enrollmentStatus: labelForStatus(row.enrollment_status),
      studentStatus: labelForStatus(row.student_status),
    };
  });
}

async function getAdminSetup(adminUserId: number): Promise<AdminSetup> {
  const setup = await getResolvedAdminSchoolSetup(adminUserId);

  return {
    schoolId: setup.schoolId,
    schoolYearId: setup.schoolYearId,
    schoolYearName: setup.schoolYearName,
    warning: setup.warning,
  };
}

async function getStudentSummary(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<CountRow[]>(
    `SELECT
       COUNT(DISTINCT st.id) AS total,
       COUNT(DISTINCT CASE WHEN e.status = 'enrolled' THEN st.id END) AS enrolled
     FROM students st
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     WHERE st.school_id = :schoolId`,
    { schoolId, schoolYearId },
  );

  return {
    total: numberValue(rows[0]?.total),
    enrolled: numberValue(rows[0]?.enrolled),
  };
}

async function getFeeSummary(schoolId: number, schoolYearId: number, category?: "tuition" | "other") {
  const categoryClause = category ? "AND ft.category = :category" : "";
  const [rows] = await pool.execute<FeeSummaryRow[]>(
    `SELECT COUNT(sfa.id) AS assignment_count,
       COALESCE(SUM(sfa.amount_due), 0) AS amount_due,
       COALESCE(SUM(sfa.amount_paid), 0) AS amount_paid,
       COUNT(CASE WHEN sfa.status IN ('open', 'partial') THEN 1 END) AS open_assignments
     FROM student_fee_assignments sfa
     JOIN fee_types ft ON ft.id = sfa.fee_type_id
     WHERE ft.school_id = :schoolId AND sfa.school_year_id = :schoolYearId ${categoryClause}`,
    category ? { schoolId, schoolYearId, category } : { schoolId, schoolYearId },
  );
  const row = rows[0];
  const amountDue = decimalValue(row?.amount_due);
  const amountPaid = decimalValue(row?.amount_paid);

  return {
    assignmentCount: numberValue(row?.assignment_count),
    amountDue,
    amountPaid,
    openBalance: Math.max(amountDue - amountPaid, 0),
    openAssignments: numberValue(row?.open_assignments),
  };
}

async function getPaymentSummary(schoolId: number) {
  const [rows] = await pool.execute<PaymentSummaryRow[]>(
    `SELECT COUNT(*) AS total_count,
       COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
       COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
       COUNT(CASE WHEN status IN ('failed', 'voided', 'refunded') THEN 1 END) AS failed_count,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount
     FROM payments
     WHERE school_id = :schoolId`,
    { schoolId },
  );
  const row = rows[0];

  return {
    totalCount: numberValue(row?.total_count),
    paidCount: numberValue(row?.paid_count),
    pendingCount: numberValue(row?.pending_count),
    failedCount: numberValue(row?.failed_count),
    paidAmount: decimalValue(row?.paid_amount),
  };
}

async function getWalletSummary(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<WalletSummaryRow[]>(
    `SELECT COUNT(wallet_id) AS wallet_count,
       COUNT(CASE WHEN wallet_status = 'active' THEN 1 END) AS active_wallets,
       COALESCE(SUM(balance), 0) AS total_balance,
       COUNT(CASE WHEN balance > 0 AND balance < 50 THEN 1 END) AS low_wallets,
       COALESCE(SUM(monthly_spend), 0) AS monthly_spend,
       COALESCE(SUM(store_spend), 0) AS store_spend,
       COALESCE(SUM(monthly_top_ups), 0) AS monthly_top_ups,
       COALESCE(SUM(monthly_top_up_count), 0) AS monthly_top_up_count
     FROM (
       SELECT w.id AS wallet_id,
         w.balance,
         COALESCE(w.status, 'closed') AS wallet_status,
         COALESCE(SUM(CASE WHEN wt.type = 'purchase' THEN ABS(wt.amount) ELSE 0 END), 0) AS monthly_spend,
         COALESCE(SUM(CASE WHEN wt.type = 'purchase' THEN ABS(wt.amount) ELSE 0 END), 0) AS store_spend,
         COALESCE(SUM(CASE WHEN wt.type = 'top_up' THEN wt.amount ELSE 0 END), 0) AS monthly_top_ups,
         COUNT(CASE WHEN wt.type = 'top_up' THEN 1 END) AS monthly_top_up_count
       FROM students st
       LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
       LEFT JOIN wallets w ON w.student_id = st.id
       LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id AND wt.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
       WHERE st.school_id = :schoolId
       GROUP BY w.id, w.balance, w.status
     ) wallet_rows`,
    { schoolId, schoolYearId },
  );
  const row = rows[0];

  return {
    walletCount: numberValue(row?.wallet_count),
    activeWallets: numberValue(row?.active_wallets),
    totalBalance: decimalValue(row?.total_balance),
    lowWallets: numberValue(row?.low_wallets),
    monthlySpend: decimalValue(row?.monthly_spend),
    storeSpend: decimalValue(row?.store_spend),
    monthlyTopUps: decimalValue(row?.monthly_top_ups),
    monthlyTopUpCount: numberValue(row?.monthly_top_up_count),
  };
}

async function getTuitionByGrade(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<GradeAmountRow[]>(
    `SELECT gl.name AS label, COALESCE(SUM(sfa.amount_paid), 0) AS amount
     FROM student_fee_assignments sfa
     JOIN fee_types ft ON ft.id = sfa.fee_type_id AND ft.category = 'tuition'
     JOIN students st ON st.id = sfa.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = sfa.school_year_id
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     WHERE st.school_id = :schoolId AND sfa.school_year_id = :schoolYearId
     GROUP BY gl.name, gl.sort_order
     ORDER BY gl.sort_order ASC, gl.name ASC`,
    { schoolId, schoolYearId },
  );

  return barRows(rows);
}

async function getOutstandingByGrade(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<GradeAmountRow[]>(
    `SELECT gl.name AS label, COALESCE(SUM(GREATEST(sfa.amount_due - sfa.amount_paid, 0)), 0) AS amount
     FROM student_fee_assignments sfa
     JOIN fee_types ft ON ft.id = sfa.fee_type_id AND ft.category = 'tuition'
     JOIN students st ON st.id = sfa.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = sfa.school_year_id
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     WHERE st.school_id = :schoolId AND sfa.school_year_id = :schoolYearId
     GROUP BY gl.name, gl.sort_order
     ORDER BY gl.sort_order ASC, gl.name ASC`,
    { schoolId, schoolYearId },
  );

  return barRows(rows);
}

async function getRecentFeeAssignments(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<RecentFeeAssignmentRow[]>(
    `SELECT sfa.created_at, sfa.amount_due, sfa.amount_paid, sfa.status,
       ft.name AS fee_name, ft.category,
       st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name
     FROM student_fee_assignments sfa
     JOIN fee_types ft ON ft.id = sfa.fee_type_id
     JOIN students st ON st.id = sfa.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = sfa.school_year_id
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     WHERE st.school_id = :schoolId AND sfa.school_year_id = :schoolYearId
     ORDER BY sfa.created_at DESC, sfa.id DESC
     LIMIT 6`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => [
    formatDateTime(row.created_at),
    fullName(row.first_name, row.middle_name, row.last_name),
    row.grade_name,
    row.fee_name,
    money(Math.max(decimalValue(row.amount_due) - decimalValue(row.amount_paid), 0)),
    labelForStatus(row.status),
  ] as AdminDashboardRealData["recentFeeAssignments"][number]);
}

async function getRecentPayments(schoolId: number) {
  const [rows] = await pool.execute<PaymentRow[]>(
    `SELECT p.reference_number, p.amount, p.channel, p.status, p.paid_at, p.created_at,
       st.first_name, st.middle_name, st.last_name,
       COALESCE(
         GROUP_CONCAT(DISTINCT ft.name ORDER BY ft.name SEPARATOR ', '),
         MAX(CASE WHEN wt.type = 'top_up' THEN 'Wallet top-up' END),
         'Payment'
       ) AS fee_name
     FROM payments p
     JOIN students st ON st.id = p.student_id
     LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
     LEFT JOIN student_fee_assignments sfa ON sfa.id = pa.student_fee_assignment_id
     LEFT JOIN fee_types ft ON ft.id = sfa.fee_type_id
     LEFT JOIN wallet_transactions wt ON wt.payment_id = p.id
     WHERE p.school_id = :schoolId
     GROUP BY p.id, p.reference_number, p.amount, p.channel, p.status, p.paid_at, p.created_at,
       st.first_name, st.middle_name, st.last_name
     ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC
     LIMIT 6`,
    { schoolId },
  );

  return rows.map((row) => [
    formatDateTime(row.paid_at ?? row.created_at),
    fullName(row.first_name, row.middle_name, row.last_name),
    row.fee_name,
    money(row.amount),
    labelForStatus(row.channel),
    labelForStatus(row.status),
  ] as [string, string, string, string, string, string]);
}

async function getActivityFeed(schoolId: number) {
  const [rows] = await pool.execute<NotificationRow[]>(
    `SELECT id, type, channel, status, created_at, sent_at
     FROM notification_logs
     WHERE school_id = :schoolId
     ORDER BY created_at DESC, id DESC
     LIMIT 5`,
    { schoolId },
  );

  return rows.map((row) => {
    const tone: TimelineRow["tone"] = row.status === "failed" ? "orange" : row.status === "sent" ? "green" : "gray";

    return {
      id: row.id,
      title: labelForStatus(row.type),
      detail: `${labelForStatus(row.channel)} - ${labelForStatus(row.status)}`,
      time: formatDateTime(row.sent_at ?? row.created_at),
      tone,
    };
  });
}

async function getRecentReminderRows(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<ReminderHistoryRow[]>(
    `SELECT nl.id AS notification_id, nl.created_at, nl.channel, nl.status,
       COALESCE(u.name, 'Parent pending') AS parent_name,
       COALESCE(st.first_name, '') AS first_name,
       st.middle_name,
       COALESCE(st.last_name, '') AS last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name
     FROM notification_logs nl
     LEFT JOIN users u ON u.id = nl.recipient_user_id
     LEFT JOIN students st ON st.id = nl.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     WHERE nl.school_id = :schoolId
       AND nl.type = 'payment_reminder'
     ORDER BY nl.created_at DESC, nl.id DESC
     LIMIT 8`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => {
    const notificationId = row.notification_id;

    return [
      notificationId,
      formatDateTime(row.created_at),
      fullName(row.first_name, row.middle_name, row.last_name) || "Student pending",
      row.parent_name,
      row.grade_name,
      labelForStatus(row.channel),
      labelForStatus(row.status),
    ] as TuitionPageRealData["reminderRows"][number];
  });
}

async function getTuitionRows(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<TuitionSqlRow[]>(
    `SELECT st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(sec.name, '-') AS section_name,
       sfa.amount_due, sfa.amount_paid, sfa.status,
       MAX(p.paid_at) AS last_payment_at
     FROM student_fee_assignments sfa
     JOIN fee_types ft ON ft.id = sfa.fee_type_id AND ft.category = 'tuition'
     JOIN students st ON st.id = sfa.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = sfa.school_year_id
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN payment_allocations pa ON pa.student_fee_assignment_id = sfa.id
     LEFT JOIN payments p ON p.id = pa.payment_id AND p.status = 'paid'
     WHERE st.school_id = :schoolId AND sfa.school_year_id = :schoolYearId
     GROUP BY sfa.id, st.first_name, st.middle_name, st.last_name, gl.name, sec.name, sfa.amount_due, sfa.amount_paid, sfa.status
     ORDER BY gl.sort_order ASC, st.last_name ASC, st.first_name ASC`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => ({
    student: fullName(row.first_name, row.middle_name, row.last_name),
    grade: row.grade_name,
    section: row.section_name,
    due: decimalValue(row.amount_due),
    paid: decimalValue(row.amount_paid),
    lastPayment: row.last_payment_at ? formatDateTime(row.last_payment_at) : "Pending",
    status: feeStatusTone(row.status, row.amount_due, row.amount_paid),
  }));
}

async function getOtherFeeSummary(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<OtherFeeSummaryRow[]>(
    `SELECT ft.name, COALESCE(SUM(sfa.amount_due), 0) AS billed, COALESCE(SUM(sfa.amount_paid), 0) AS collected
     FROM fee_types ft
     LEFT JOIN student_fee_assignments sfa ON sfa.fee_type_id = ft.id AND sfa.school_year_id = :schoolYearId
     WHERE ft.school_id = :schoolId AND ft.school_year_id = :schoolYearId AND ft.category = 'other'
     GROUP BY ft.id, ft.name
     ORDER BY ft.name ASC`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => [
    row.name,
    money(row.billed),
    money(row.collected),
    percent(row.collected, row.billed),
  ] as [string, string, string, string]);
}

async function getCollectionRows(schoolId: number) {
  const [rows] = await pool.execute<PaymentRow[]>(
    `SELECT p.reference_number, p.amount, p.channel, p.status, p.paid_at, p.created_at,
       st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(
         GROUP_CONCAT(DISTINCT ft.name ORDER BY ft.name SEPARATOR ', '),
         MAX(CASE WHEN wt.type = 'top_up' THEN 'Wallet top-up' END),
         'Payment'
       ) AS fee_name
     FROM payments p
     JOIN students st ON st.id = p.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
     LEFT JOIN student_fee_assignments sfa ON sfa.id = pa.student_fee_assignment_id
     LEFT JOIN fee_types ft ON ft.id = sfa.fee_type_id
     LEFT JOIN wallet_transactions wt ON wt.payment_id = p.id
     WHERE p.school_id = :schoolId
     GROUP BY p.id, p.reference_number, p.amount, p.channel, p.status, p.paid_at, p.created_at,
       st.first_name, st.middle_name, st.last_name, gl.name
     ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC
     LIMIT 50`,
    { schoolId },
  );

  return rows.map((row) => [
    row.reference_number,
    fullName(row.first_name, row.middle_name, row.last_name),
    row.grade_name ?? "Not enrolled",
    row.fee_name,
    money(row.amount),
    formatDateTime(row.paid_at ?? row.created_at),
    labelForStatus(row.channel),
    labelForStatus(row.status),
  ] as [string, string, string, string, string, string, string, string]);
}

async function getOtherFeeItems(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<OtherFeeItemRow[]>(
    `SELECT ft.name, ft.category, ft.default_amount, ft.status,
       COUNT(sfa.id) AS assigned_count,
       COALESCE(SUM(CASE WHEN sfa.status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
       COALESCE(SUM(sfa.amount_due), 0) AS billed,
       COALESCE(SUM(sfa.amount_paid), 0) AS collected,
       COALESCE(SUM(GREATEST(sfa.amount_due - sfa.amount_paid, 0)), 0) AS outstanding
     FROM fee_types ft
     LEFT JOIN student_fee_assignments sfa ON sfa.fee_type_id = ft.id AND sfa.school_year_id = :schoolYearId
     WHERE ft.school_id = :schoolId AND ft.school_year_id = :schoolYearId AND ft.category = 'other'
     GROUP BY ft.id, ft.name, ft.category, ft.default_amount, ft.status
     ORDER BY ft.name ASC`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => ({
    name: row.name,
    meta: `Default ${money(row.default_amount)} per student`,
    amount: money(row.default_amount),
    status: labelForStatus(row.status),
    assignedCount: Number(row.assigned_count ?? 0),
    paidCount: Number(row.paid_count ?? 0),
    paidLabel: Number(row.assigned_count ?? 0) > 0
      ? `${Number(row.paid_count ?? 0)} / ${Number(row.assigned_count ?? 0)} paid`
      : "No assignments yet",
    totalBilled: money(row.billed),
    collected: money(row.collected),
    outstanding: money(row.outstanding),
  }));
}

async function getAllowanceRows(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<AllowanceSqlRow[]>(
    `SELECT st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(w.balance, 0) AS balance,
       MAX(CASE WHEN wt.type = 'top_up' THEN wt.created_at END) AS last_top_up_at,
       COALESCE(SUM(CASE WHEN wt.type = 'purchase' AND wt.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') THEN ABS(wt.amount) ELSE 0 END), 0) AS monthly_spend,
       COALESCE(SUM(CASE WHEN wt.type = 'top_up' THEN wt.amount ELSE 0 END), 0) AS total_top_ups
     FROM wallets w
     JOIN students st ON st.id = w.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
     WHERE st.school_id = :schoolId
     GROUP BY w.id, st.first_name, st.middle_name, st.last_name, gl.name, w.balance
     ORDER BY st.last_name ASC, st.first_name ASC`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => {
    const balance = decimalValue(row.balance);
    const status = balance === 0 ? "No balance" : balance < 50 ? "Low" : "Active";

    return [
      fullName(row.first_name, row.middle_name, row.last_name),
      row.grade_name,
      money(balance),
      row.last_top_up_at ? formatDateTime(row.last_top_up_at) : "Pending",
      decimalValue(row.monthly_spend) > 0 ? money(row.monthly_spend) : "Pending",
      decimalValue(row.total_top_ups) > 0 ? money(row.total_top_ups) : "Pending",
      status,
    ] as AllowancePageRealData["rows"][number];
  });
}

async function getStoreSummary(schoolId: number) {
  const [rows] = await pool.execute<StoreSummaryRow[]>(
    `SELECT COUNT(DISTINCT stx.id) AS transaction_count,
       COUNT(DISTINCT sm.id) AS merchant_count,
       COALESCE(SUM(stx.amount), 0) AS amount,
       COALESCE(SUM(stx.fee_amount), 0) AS fee_amount
     FROM store_merchants sm
     LEFT JOIN store_transactions stx ON stx.merchant_id = sm.id
     WHERE sm.school_id = :schoolId`,
    { schoolId },
  );
  const row = rows[0];

  return {
    transactionCount: numberValue(row?.transaction_count),
    merchantCount: numberValue(row?.merchant_count),
    amount: decimalValue(row?.amount),
    feeAmount: decimalValue(row?.fee_amount),
  };
}

async function getStoreRows(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<StoreRow[]>(
    `SELECT stx.reference_number, stx.amount, stx.fee_amount, stx.purchased_at,
       sm.name AS merchant_name,
       st.first_name, st.middle_name, st.last_name,
       COALESCE(gl.name, 'Not enrolled') AS grade_name
     FROM store_transactions stx
     JOIN store_merchants sm ON sm.id = stx.merchant_id
     JOIN students st ON st.id = stx.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     WHERE sm.school_id = :schoolId
     ORDER BY stx.purchased_at DESC, stx.id DESC
     LIMIT 50`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => [
    row.reference_number,
    fullName(row.first_name, row.middle_name, row.last_name),
    row.grade_name,
    row.merchant_name,
    money(row.amount),
    money(row.fee_amount),
    formatDateTime(row.purchased_at),
  ] as StoreTransactionsPageRealData["rows"][number]);
}

async function getStoreSpendByGrade(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<GradeAmountRow[]>(
    `SELECT COALESCE(gl.name, 'Not enrolled') AS label, COALESCE(SUM(stx.amount), 0) AS amount
     FROM store_transactions stx
     JOIN store_merchants sm ON sm.id = stx.merchant_id
     JOIN students st ON st.id = stx.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     WHERE sm.school_id = :schoolId
     GROUP BY gl.name, gl.sort_order
     ORDER BY gl.sort_order ASC, gl.name ASC`,
    { schoolId, schoolYearId },
  );

  return barRows(rows);
}

async function getStorePeakHours(schoolId: number) {
  const [rows] = await pool.execute<GradeAmountRow[]>(
    `SELECT CONCAT(LPAD(HOUR(stx.purchased_at), 2, '0'), ':00') AS label, COUNT(*) AS amount
     FROM store_transactions stx
     JOIN store_merchants sm ON sm.id = stx.merchant_id
     WHERE sm.school_id = :schoolId
     GROUP BY HOUR(stx.purchased_at)
     ORDER BY amount DESC, label ASC
     LIMIT 6`,
    { schoolId },
  );

  return barRows(rows, false);
}

async function getMonthlyRevenue(schoolId: number) {
  const [rows] = await pool.execute<GradeAmountRow[]>(
    `SELECT DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m') AS label,
       COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) AS amount
     FROM payments p
     WHERE p.school_id = :schoolId
     GROUP BY DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m')
     ORDER BY label ASC
     LIMIT 12`,
    { schoolId },
  );

  return barRows(rows);
}

async function getStudentFeeSummary(studentId: number, schoolYearId: number) {
  const [rows] = await pool.execute<FeeSummaryRow[]>(
    `SELECT COUNT(*) AS assignment_count,
       COALESCE(SUM(amount_due), 0) AS amount_due,
       COALESCE(SUM(amount_paid), 0) AS amount_paid,
       COUNT(CASE WHEN status IN ('open', 'partial') THEN 1 END) AS open_assignments
     FROM student_fee_assignments
     WHERE student_id = :studentId AND school_year_id = :schoolYearId`,
    { studentId, schoolYearId },
  );
  const row = rows[0];
  const amountDue = decimalValue(row?.amount_due);
  const amountPaid = decimalValue(row?.amount_paid);

  return {
    assignmentCount: numberValue(row?.assignment_count),
    amountDue,
    amountPaid,
    openBalance: Math.max(amountDue - amountPaid, 0),
    openAssignments: numberValue(row?.open_assignments),
  };
}

async function getStudentWalletSummary(studentId: number) {
  const [rows] = await pool.execute<StudentWalletSummaryRow[]>(
    `SELECT COALESCE(SUM(CASE WHEN wt.type = 'purchase' AND wt.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') THEN ABS(wt.amount) ELSE 0 END), 0) AS monthly_spend,
       COALESCE(SUM(CASE WHEN wt.type = 'top_up' THEN wt.amount ELSE 0 END), 0) AS total_top_ups,
       MAX(CASE WHEN wt.type = 'top_up' THEN wt.created_at END) AS last_top_up_at
     FROM wallets w
     LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
     WHERE w.student_id = :studentId`,
    { studentId },
  );
  const row = rows[0];

  return {
    monthlySpend: decimalValue(row?.monthly_spend),
    totalTopUps: decimalValue(row?.total_top_ups),
    lastTopUp: row?.last_top_up_at ? `Last top-up ${formatDateTime(row.last_top_up_at)}` : "Top-up pending",
  };
}

async function getStudentTransactions(studentId: number) {
  const [rows] = await pool.execute<StudentTransactionRow[]>(
    `SELECT reference_number AS ref, amount, channel, status, COALESCE(paid_at, created_at) AS happened_at, 'Payment' AS description
     FROM payments
     WHERE student_id = :studentId
     ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
     LIMIT 8`,
    { studentId },
  );

  return rows.map((row) => [
    formatDateTime(row.happened_at),
    `${row.description} - ${row.ref}`,
    money(row.amount),
    labelForStatus(row.channel),
    labelForStatus(row.status),
  ] as AdminStudentTransactionDisplay);
}

function emptyDashboard(warning: string | null): AdminDashboardRealData {
  return {
    warning,
    alerts: [],
    kpis: [
      { label: "Total enrolled", value: "0", note: "School setup pending", tone: "blue", icon: Users },
      { label: "Collected", value: "Pending", note: "Payment records pending", tone: "orange", icon: CreditCard },
      { label: "Outstanding", value: "Pending", note: "Fee assignments pending", tone: "red", icon: Activity },
      { label: "Wallets", value: "Pending", note: "No wallet records yet", tone: "green", icon: Wallet },
    ],
    tuitionByGrade: [],
    monthlySummary: pendingSummary(),
    recentFeeAssignments: [],
    recentPayments: [],
    activityFeed: [],
  };
}

function emptyTuition(warning: string | null): TuitionPageRealData {
  return {
    warning,
    kpis: [
      { label: "Tuition billed", value: "Pending", note: "Create tuition fee assignments first", tone: "orange", icon: Calculator },
      { label: "Collected", value: "Pending", note: "Collection pending", tone: "green", icon: CreditCard },
      { label: "Outstanding", value: "Pending", note: "No balances yet", tone: "red", icon: Activity },
      { label: "Due records", value: "0", note: "No tuition assignments", tone: "blue", icon: Receipt },
    ],
    rows: [],
    outstandingByGrade: [],
    otherFeeSummary: [],
    reminderRows: [],
  };
}

function emptyCollections(warning: string | null): CollectionsPageRealData {
  return {
    warning,
    kpis: [
      { label: "Payments", value: "0", note: "No payment records yet", tone: "orange", icon: CreditCard },
      { label: "Paid amount", value: "Pending", note: "Payments table", tone: "green", icon: CreditCard },
      { label: "Pending review", value: "0", note: "Payment status pending", tone: "blue", icon: FileText },
      { label: "Failed / voided", value: "0", note: "Needs admin review", tone: "red", icon: Activity },
    ],
    rows: [],
  };
}

function emptyOtherFees(warning: string | null): OtherFeesPageRealData {
  return {
    warning,
    kpis: [
      { label: "Total billed", value: "Pending", note: "Non-tuition fee assignments", tone: "orange", icon: Calculator },
      { label: "Collected", value: "Pending", note: "Collection pending", tone: "green", icon: CreditCard },
      { label: "Outstanding", value: "Pending", note: "For follow-up", tone: "red", icon: Activity },
      { label: "Active fee types", value: "0", note: "Fee setup pending", tone: "blue", icon: ClipboardList },
    ],
    items: [],
  };
}

function emptyAllowance(warning: string | null): AllowancePageRealData {
  return {
    warning,
    kpis: [
      { label: "Wallet records", value: "0", note: "Top up allowance to create wallets", tone: "orange", icon: Wallet },
      { label: "Total balance", value: "Pending", note: "Available student balances", tone: "green", icon: Wallet },
      { label: "Low balance", value: "0", note: "Below P50", tone: "red", icon: Activity },
      { label: "Monthly spend", value: "Pending", note: "Purchase transactions", tone: "blue", icon: Store },
    ],
    rows: [],
  };
}

function emptyStore(warning: string | null): StoreTransactionsPageRealData {
  return {
    warning,
    kpis: [
      { label: "Transactions", value: "0", note: "No store transactions yet", tone: "orange", icon: Store },
      { label: "Gross spend", value: "Pending", note: "Canteen and store purchases", tone: "green", icon: CreditCard },
      { label: "Txn fees", value: "Pending", note: "Recorded fee amount", tone: "blue", icon: Calculator },
      { label: "Merchants", value: "0", note: "Merchant setup pending", tone: "teal", icon: Store },
    ],
    spendByGrade: [],
    peakHours: [],
    rows: [],
  };
}

function emptyReports(warning: string | null): ReportsPageRealData {
  return {
    warning,
    kpis: [
      { label: "Enrolled students", value: "0", note: "School setup pending", tone: "orange", icon: Users },
      { label: "Collected", value: "Pending", note: "Payments table", tone: "green", icon: CreditCard },
      { label: "Outstanding", value: "Pending", note: "Fee assignments", tone: "red", icon: Activity },
      { label: "Store spend", value: "Pending", note: "Store transactions", tone: "blue", icon: Store },
    ],
    monthlyRevenue: [],
    reports: reportDownloads(),
  };
}

function pendingSummary(): SummaryRow[] {
  return [
    { label: "Total fees billed", value: "Pending" },
    { label: "Collected from assignments", value: "Pending" },
    { label: "Outstanding balance", value: "Pending" },
    { label: "Collection rate", value: "Pending" },
    { label: "Wallet balance total", value: "Pending" },
    { label: "Store spend recorded", value: "Pending" },
  ];
}

function reportDownloads() {
  return [
    {
      name: "Monthly revenue",
      desc: "Paid payment totals grouped by month",
      csvHref: "/admin/reports/export?type=monthly-revenue",
      pdfHref: "/admin/reports/export?type=monthly-revenue&format=pdf",
      icon: BarChart3,
    },
    {
      name: "Collections report",
      desc: "Payment references, channels, statuses, and dates",
      csvHref: "/admin/reports/export?type=collections",
      pdfHref: "/admin/reports/export?type=collections&format=pdf",
      icon: FileSpreadsheet,
    },
    {
      name: "Outstanding balances",
      desc: "Assigned fees, paid amounts, balances, and due dates",
      csvHref: "/admin/reports/export?type=outstanding-balances",
      pdfHref: "/admin/reports/export?type=outstanding-balances&format=pdf",
      icon: Receipt,
    },
    {
      name: "Wallet and store report",
      desc: "Wallet top-ups, store purchases, and balances after",
      csvHref: "/admin/reports/export?type=wallet-store",
      pdfHref: "/admin/reports/export?type=wallet-store&format=pdf",
      icon: Store,
    },
  ];
}

function barRows(rows: GradeAmountRow[], moneyValue = true): BarRow[] {
  const max = Math.max(...rows.map((row) => decimalValue(row.amount)), 0);

  return rows
    .filter((row) => decimalValue(row.amount) > 0)
    .map((row) => {
      const amount = decimalValue(row.amount);

      return {
        label: row.label ?? "Not enrolled",
        value: moneyValue ? money(amount) : String(amount),
        percent: max > 0 ? Math.max(8, Math.round((amount / max) * 100)) : 0,
      };
    });
}

function feeStatusTone(status: string, due: number | string, paid: number | string): TuitionRow["status"] {
  if (status === "paid" || decimalValue(paid) >= decimalValue(due)) {
    return "paid";
  }

  if (status === "partial" || decimalValue(paid) > 0) {
    return "partial";
  }

  return "unpaid";
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
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

function percent(part: number | string | null | undefined, total: number | string | null | undefined) {
  const totalValue = decimalValue(total);

  if (totalValue <= 0) {
    return "Pending";
  }

  return `${Math.round((decimalValue(part) / totalValue) * 1000) / 10}%`;
}

function fullName(firstName: string, middleName: string | null, lastName: string) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ");
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ST";
}

function labelForStatus(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "Not on file";
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "Pending";
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type CountRow = RowDataPacket & {
  total: number;
  enrolled: number;
};

type FeeSummaryRow = RowDataPacket & {
  assignment_count: number;
  amount_due: number | string;
  amount_paid: number | string;
  open_assignments: number;
};

type PaymentSummaryRow = RowDataPacket & {
  total_count: number;
  paid_count: number;
  pending_count: number;
  failed_count: number;
  paid_amount: number | string;
};

type WalletSummaryRow = RowDataPacket & {
  wallet_count: number;
  active_wallets: number;
  total_balance: number | string;
  low_wallets: number;
  monthly_spend: number | string;
  store_spend: number | string;
  monthly_top_ups: number | string;
  monthly_top_up_count: number;
};

type GradeAmountRow = RowDataPacket & {
  label: string | null;
  amount: number | string;
};

type RecentFeeAssignmentRow = RowDataPacket & {
  created_at: Date | string;
  amount_due: number | string;
  amount_paid: number | string;
  status: string;
  fee_name: string;
  category: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
};

type PaymentRow = RowDataPacket & {
  reference_number: string;
  amount: number | string;
  channel: string;
  status: string;
  paid_at: Date | string | null;
  created_at: Date | string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name?: string;
  fee_name: string;
};

type NotificationRow = RowDataPacket & {
  id: number;
  type: string;
  channel: string;
  status: "queued" | "sent" | "failed";
  created_at: Date | string;
  sent_at: Date | string | null;
};

type ReminderHistoryRow = RowDataPacket & {
  notification_id: number;
  created_at: Date | string;
  channel: string;
  status: string;
  parent_name: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
};

type TuitionSqlRow = RowDataPacket & {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  section_name: string;
  amount_due: number | string;
  amount_paid: number | string;
  status: string;
  last_payment_at: Date | string | null;
};

type OtherFeeSummaryRow = RowDataPacket & {
  name: string;
  billed: number | string;
  collected: number | string;
};

type OtherFeeItemRow = RowDataPacket & {
  name: string;
  category: string;
  default_amount: number | string;
  status: string;
  assigned_count: number | string;
  paid_count: number | string;
  billed: number | string;
  collected: number | string;
  outstanding: number | string;
};

type AllowanceSqlRow = RowDataPacket & {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  balance: number | string;
  last_top_up_at: Date | string | null;
  monthly_spend: number | string;
  total_top_ups: number | string;
};

type StoreSummaryRow = RowDataPacket & {
  transaction_count: number;
  merchant_count: number;
  amount: number | string;
  fee_amount: number | string;
};

type StoreRow = RowDataPacket & {
  reference_number: string;
  amount: number | string;
  fee_amount: number | string;
  purchased_at: Date | string;
  merchant_name: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
};

type StudentProfileRow = RowDataPacket & {
  id: number;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  birthdate: Date | string | null;
  student_status: string;
  grade_name: string;
  section_name: string;
  enrollment_status: string;
  wallet_balance: number | string;
  wallet_status: string;
  guardian_names: string;
  relationships: string;
  guardian_contacts: string;
};

type StudentProfileSummaryRow = RowDataPacket & {
  id: number;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  student_status: string;
  grade_name: string;
  section_name: string;
  enrollment_status: string;
  guardian_names: string;
};

type StudentWalletSummaryRow = RowDataPacket & {
  monthly_spend: number | string;
  total_top_ups: number | string;
  last_top_up_at: Date | string | null;
};

type StudentTransactionRow = RowDataPacket & {
  ref: string;
  description: string;
  amount: number | string;
  channel: string;
  status: string;
  happened_at: Date | string;
};
