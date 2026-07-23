import "server-only";

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { labelForChannel } from "@/lib/payments/records";
import { getResolvedAdminSchoolSetup, getResolvedAdminSchoolViewSetup } from "@/lib/school/setup";
import { calculateAge, labelForSex, labelForStudentType } from "@/lib/students/demographics";

type Queryable = Pick<Pool | PoolConnection, "execute">;

export type AdminStudentPageData = {
  ready: boolean;
  warning: string | null;
  activeSchoolYearName: string | null;
  enrollmentSchoolYearName: string | null;
  gradeOptions: Array<{ id: number; name: string }>;
  sectionOptions: Array<{ id: number; gradeLevelId: number; label: string }>;
  enrollmentSectionOptions: Array<{ id: number; gradeLevelId: number; label: string }>;
  kpis: Array<{
    label: string;
    value: string;
    note: string;
    tone: "orange" | "green" | "red" | "blue" | "purple" | "teal";
    noteTone?: "default" | "up" | "warn" | "danger";
  }>;
  students: AdminStudentRow[];
  enrollmentCandidates: AdminStudentRow[];
};

export type AdminStudentRow = {
  id: number;
  studentReference: string;
  fullName: string;
  grade: string;
  section: string;
  guardians: string;
  guardianContact: string;
  enrollmentStatus: string;
  studentStatus: string;
  sex: string;
  studentType: string;
};

export type AdminParentsPageData = {
  kpis: AdminStudentPageData["kpis"];
  rows: AdminParentRow[];
};

export type AdminParentRow = {
  parentName: string;
  students: string;
  grade: string;
  contact: string;
  email: string;
  relationship: string;
  status: "Linked" | "Pending";
};

export type ParentDashboardData = {
  metrics: Array<{
    label: string;
    value: string;
    note: string;
    tone?: "orange" | "green" | "red" | "blue" | "amber" | "muted";
    accent?: boolean;
  }>;
  linkedStudents: ParentLinkedStudent[];
  recentPayments: ParentDashboardPayment[];
  walletActivity: ParentWalletActivity[];
  outstandingBalance: string;
};

export type ParentPortalContext = {
  parentName: string;
  parentFirstName: string;
  parentInitials: string;
  relationshipLabel: string;
  contactLine: string;
  schoolName: string | null;
  schoolYearName: string | null;
  primaryStudentName: string | null;
  primaryStudentReference: string | null;
  payableFeeCount: number;
};

export type ParentLinkedStudent = {
  id: number;
  profileHref: string;
  initials: string;
  fullName: string;
  meta: string;
  status: string;
};

export type ParentDashboardPayment = {
  referenceNumber: string;
  studentName: string;
  description: string;
  amount: string;
  status: string;
};

export type ParentWalletActivity = {
  id: number;
  date: string;
  studentName: string;
  description: string;
  amount: string;
  balanceAfter: string;
  channel: string;
  status: string;
  tone: "green" | "amber" | "red" | "muted";
};

export type ParentDashboardWalletActivity = ParentWalletActivity;

export type ParentStudentProfileData = {
  context: ParentPortalContext;
  student: {
    id: number;
    initials: string;
    fullName: string;
    schoolName: string;
    schoolYearName: string;
    tags: string[];
    stats: Array<{ label: string; value: string }>;
    studentDetails: Array<{ label: string; value: string }>;
    guardianDetails: Array<{ label: string; value: string }>;
    walletDetails: Array<{ label: string; value: string }>;
    walletActivity: ParentWalletActivity[];
  } | null;
};

export async function getAdminStudentPageData(adminUserId: number): Promise<AdminStudentPageData> {
  try {
    const setup = await getAdminSetup(adminUserId);
    const activeSetup = await getResolvedAdminSchoolSetup(adminUserId);

    if (!setup.schoolId || !setup.schoolYearId) {
      return emptyAdminStudentData(setup.warning ?? "Ask a school administrator to complete school setup first.");
    }

    const [gradeOptions, sectionOptions, enrollmentSectionOptions, students, enrollmentCandidates] = await Promise.all([
      getGradeOptions(setup.schoolId),
      getSectionOptions(setup.schoolId, setup.schoolYearId),
      activeSetup.schoolId && activeSetup.schoolYearId
        ? getSectionOptions(activeSetup.schoolId, activeSetup.schoolYearId)
        : Promise.resolve([]),
      getAdminStudentRows(setup.schoolId, setup.schoolYearId),
      activeSetup.schoolId && activeSetup.schoolYearId
        ? getAdminStudentRows(activeSetup.schoolId, activeSetup.schoolYearId)
        : Promise.resolve([]),
    ]);

    return {
      ready: true,
      warning: null,
      activeSchoolYearName: setup.schoolYearName,
      enrollmentSchoolYearName: activeSetup.schoolYearName,
      gradeOptions,
      sectionOptions,
      enrollmentSectionOptions,
      kpis: studentKpis(students, setup.schoolYearName),
      students,
      enrollmentCandidates,
    };
  } catch {
    return emptyAdminStudentData("Student records are unavailable. Confirm MySQL/XAMPP and the full schema are ready.");
  }
}

export async function getAdminParentsPageData(adminUserId: number): Promise<AdminParentsPageData> {
  try {
    const setup = await getAdminSetup(adminUserId);

    if (!setup.schoolId) {
      return {
        kpis: parentKpis([]),
        rows: [],
      };
    }

    const rows = await getAdminParentRows(setup.schoolId, setup.schoolYearId);

    return {
      kpis: parentKpis(rows),
      rows,
    };
  } catch {
    return {
      kpis: parentKpis([]),
      rows: [],
    };
  }
}

export async function getParentDashboardData(parentUserId: number): Promise<ParentDashboardData> {
  const emptySummary = {
    paidThisMonth: 0,
    outstanding: 0,
    paymentCount: 0,
    walletBalance: 0,
    walletCount: 0,
  };
  const [studentsResult, summaryResult, paymentsResult, walletResult] = await Promise.allSettled([
    getParentLinkedStudents(parentUserId),
    getParentPaymentSummary(parentUserId),
    getParentRecentPayments(parentUserId),
    getParentRecentWalletActivity(parentUserId, { limit: 5 }),
  ]);
  const linkedStudents = studentsResult.status === "fulfilled" ? studentsResult.value : [];
  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : emptySummary;

  return {
    linkedStudents,
    recentPayments: paymentsResult.status === "fulfilled" ? paymentsResult.value : [],
    walletActivity: walletResult.status === "fulfilled" ? walletResult.value : [],
    outstandingBalance: summaryResult.status === "fulfilled" ? money(summary.outstanding) : "Pending",
    metrics: parentMetrics(linkedStudents, summary),
  };
}

export async function getParentPortalContext(parentUserId: number, fallbackName = "Parent"): Promise<ParentPortalContext> {
  try {
    const [rows] = await pool.execute<ParentPortalContextRow[]>(
      `SELECT u.name AS parent_name, u.email, u.phone, pp.relationship,
         sc.name AS school_name, sy.name AS school_year_name,
         st.first_name, st.middle_name, st.last_name, st.student_reference,
         (
           SELECT COUNT(DISTINCT sfa_count.id)
           FROM student_guardians sg_count
           JOIN students st_count ON st_count.id = sg_count.student_id
           JOIN student_fee_assignments sfa_count ON sfa_count.student_id = st_count.id
           JOIN school_years sy_count ON sy_count.id = sfa_count.school_year_id AND sy_count.status = 'active'
           WHERE sg_count.parent_user_id = u.id
             AND sfa_count.status IN ('open', 'partial')
             AND sfa_count.amount_due > sfa_count.amount_paid
         ) AS payable_fee_count
       FROM users u
       LEFT JOIN parent_profiles pp ON pp.user_id = u.id
       LEFT JOIN student_guardians sg ON sg.parent_user_id = u.id
       LEFT JOIN students st ON st.id = sg.student_id
       LEFT JOIN schools sc ON sc.id = st.school_id
       LEFT JOIN enrollments e ON e.student_id = st.id
       LEFT JOIN school_years sy ON sy.id = e.school_year_id
       WHERE u.id = :parentUserId AND u.role = 'parent'
       ORDER BY sg.is_primary DESC, st.last_name ASC, st.first_name ASC,
         (sy.status = 'active') DESC, sy.starts_on DESC, e.id DESC
       LIMIT 1`,
      { parentUserId },
    );

    return parentContextFromRow(rows[0], fallbackName);
  } catch {
    return parentContextFromRow(null, fallbackName);
  }
}

export async function getParentStudentProfileData(
  parentUserId: number,
  fallbackName = "Parent",
  studentId?: number,
): Promise<ParentStudentProfileData> {
  const context = await getParentPortalContext(parentUserId, fallbackName);
  const selectedStudentClause = typeof studentId === "number" ? "AND st.id = :studentId" : "";

  try {
    const [rows] = await pool.execute<ParentStudentProfileRow[]>(
      `SELECT st.id, st.student_reference, st.first_name, st.middle_name, st.last_name,
         st.birthdate, st.sex, st.status AS student_status,
         sc.name AS school_name,
         COALESCE(sy.name, 'School year pending') AS school_year_name,
         COALESCE(gl.name, 'Not enrolled') AS grade_name,
         COALESCE(sec.name, '-') AS section_name,
         COALESCE(e.status, 'pending') AS enrollment_status,
         e.student_type,
         u.name AS parent_name, u.email, u.phone, u.status AS parent_status,
         pp.relationship
       FROM student_guardians sg
       JOIN users u ON u.id = sg.parent_user_id
       LEFT JOIN parent_profiles pp ON pp.user_id = u.id
       JOIN students st ON st.id = sg.student_id
       JOIN schools sc ON sc.id = st.school_id
       LEFT JOIN enrollments e ON e.student_id = st.id
       LEFT JOIN school_years sy ON sy.id = e.school_year_id
       LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
       LEFT JOIN sections sec ON sec.id = e.section_id
       WHERE sg.parent_user_id = :parentUserId
       ${selectedStudentClause}
       ORDER BY sg.is_primary DESC, st.last_name ASC, st.first_name ASC,
         (sy.status = 'active') DESC, sy.starts_on DESC, e.id DESC
       LIMIT 1`,
      typeof studentId === "number" ? { parentUserId, studentId } : { parentUserId },
    );

    const row = rows[0];

    if (!row) {
      return { context, student: null };
    }

    const [walletSummaryResult, walletActivityResult] = await Promise.allSettled([
      getParentStudentWalletSummary(parentUserId, row.id),
      getParentRecentWalletActivity(parentUserId, { studentId: row.id, limit: 10 }),
    ]);
    const walletSummary =
      walletSummaryResult.status === "fulfilled" ? walletSummaryResult.value : null;
    const walletActivity =
      walletActivityResult.status === "fulfilled" ? walletActivityResult.value : [];
    const fullStudentName = fullName(row.first_name, row.middle_name, row.last_name);
    const gradeSection = [row.grade_name, row.section_name !== "-" ? row.section_name : null].filter(Boolean).join(" - ");
    const enrollmentLabel = labelForStatus(row.enrollment_status);
    const studentStatusLabel = labelForStatus(row.student_status);
    const relationshipLabel = labelForRelationship(row.relationship ?? "guardian");

    return {
      context,
      student: {
        id: row.id,
        initials: initialsFor(fullStudentName),
        fullName: fullStudentName,
        schoolName: row.school_name,
        schoolYearName: row.school_year_name,
        tags: [row.student_reference, gradeSection, enrollmentLabel].filter(Boolean),
        stats: [
          { label: "Enrollment", value: enrollmentLabel },
          { label: "Grade", value: row.grade_name },
          { label: "Status", value: studentStatusLabel },
        ],
        studentDetails: [
          { label: "Student reference", value: row.student_reference },
          { label: "School", value: row.school_name },
          { label: "Grade level", value: row.grade_name },
          { label: "Section", value: row.section_name },
          { label: "School year", value: row.school_year_name },
          { label: "Date of birth", value: formatDate(row.birthdate) },
          { label: "Age", value: calculateAge(row.birthdate) },
          { label: "Sex", value: labelForSex(row.sex) },
          { label: "Student type", value: labelForStudentType(row.student_type) },
          { label: "Enrollment status", value: enrollmentLabel },
          { label: "Student status", value: studentStatusLabel },
        ],
        guardianDetails: [
          { label: "Guardian", value: row.parent_name },
          { label: "Relationship", value: relationshipLabel },
          { label: "Mobile", value: row.phone ?? "Not on file" },
          { label: "Email", value: row.email },
          { label: "Portal access", value: labelForStatus(row.parent_status) },
        ],
        walletDetails: [
          { label: "Current balance", value: money(walletSummary?.wallet_balance) },
          { label: "Monthly spend", value: money(walletSummary?.monthly_spend) },
          { label: "Last top-up", value: walletSummary?.last_top_up_at ? formatDateTime(walletSummary.last_top_up_at) : "No top-up yet" },
          { label: "Status", value: !walletSummary || walletSummary.wallet_status === "not_started" ? "Ready for top-up" : labelForStatus(walletSummary.wallet_status) },
        ],
        walletActivity,
      },
    };
  } catch (error) {
    throw error;
  }
}

async function getParentStudentWalletSummary(
  parentUserId: number,
  studentId: number,
) {
  const [rows] = await pool.execute<ParentStudentWalletSummaryRow[]>(
    `SELECT
       COALESCE(w.balance, 0) AS wallet_balance,
       COALESCE(w.status, 'not_started') AS wallet_status,
       COALESCE((
         SELECT SUM(
           CASE
             WHEN wt_spend.type = 'purchase'
               AND wt_spend.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
             THEN ABS(wt_spend.amount)
             ELSE 0
           END
         )
         FROM wallet_transactions wt_spend
         WHERE wt_spend.wallet_id = w.id
       ), 0) AS monthly_spend,
       (
         SELECT MAX(wt_topup.created_at)
         FROM wallet_transactions wt_topup
         WHERE wt_topup.wallet_id = w.id
           AND wt_topup.type = 'top_up'
       ) AS last_top_up_at
     FROM student_guardians sg
     JOIN students st ON st.id = sg.student_id
     LEFT JOIN wallets w ON w.student_id = st.id
     WHERE sg.parent_user_id = :parentUserId
       AND st.id = :studentId
     LIMIT 1`,
    { parentUserId, studentId },
  );

  return rows[0] ?? null;
}

export async function linkParentToStudentByReference(
  executor: Queryable,
  parentUserId: number,
  studentReference: string,
) {
  const normalizedReference = studentReference.trim();

  if (!normalizedReference) {
    return "not_found" as const;
  }

  const [profileRows] = await executor.execute<ParentProfileRow[]>(
    `SELECT relationship
     FROM parent_profiles
     WHERE user_id = :parentUserId
     LIMIT 1`,
    { parentUserId },
  );
  const profile = profileRows[0];

  if (!profile) {
    return "missing_profile" as const;
  }

  const [studentRows] = await executor.execute<StudentMatchRow[]>(
    `SELECT id
     FROM students
     WHERE student_reference = :studentReference
     LIMIT 2`,
    { studentReference: normalizedReference },
  );

  if (studentRows.length === 0) {
    return "not_found" as const;
  }

  if (studentRows.length > 1) {
    return "ambiguous" as const;
  }

  const studentId = studentRows[0].id;
  const [existingLinkRows] = await executor.execute<CountRow[]>(
    "SELECT COUNT(*) AS total FROM student_guardians WHERE student_id = :studentId AND parent_user_id = :parentUserId",
    { studentId, parentUserId },
  );

  if (Number(existingLinkRows[0]?.total ?? 0) > 0) {
    return "already_linked" as const;
  }

  const [guardianCountRows] = await executor.execute<CountRow[]>(
    "SELECT COUNT(*) AS total FROM student_guardians WHERE student_id = :studentId",
    { studentId },
  );
  const isPrimary = Number(guardianCountRows[0]?.total ?? 0) === 0;

  await executor.execute(
    `INSERT INTO student_guardians (student_id, parent_user_id, relationship, is_primary)
     VALUES (:studentId, :parentUserId, :relationship, :isPrimary)`,
    {
      studentId,
      parentUserId,
      relationship: profile.relationship,
      isPrimary,
    },
  );

  return "linked" as const;
}

async function getAdminSetup(adminUserId: number) {
  return getResolvedAdminSchoolViewSetup(adminUserId);
}

async function getGradeOptions(schoolId: number) {
  const [rows] = await pool.execute<GradeOptionRow[]>(
    `SELECT id, name
     FROM grade_levels
     WHERE school_id = :schoolId
     ORDER BY sort_order ASC, name ASC`,
    { schoolId },
  );

  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function getSectionOptions(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<SectionOptionRow[]>(
    `SELECT s.id, s.grade_level_id, gl.name AS grade_name, s.name AS section_name
     FROM sections s
     JOIN grade_levels gl ON gl.id = s.grade_level_id
     WHERE s.school_id = :schoolId AND s.school_year_id = :schoolYearId
     ORDER BY gl.sort_order ASC, gl.name ASC, s.name ASC`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => ({
    id: row.id,
    gradeLevelId: row.grade_level_id,
    label: `${row.grade_name} - ${row.section_name}`,
  }));
}

async function getAdminStudentRows(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<AdminStudentSqlRow[]>(
    `SELECT st.id, st.student_reference, st.first_name, st.middle_name, st.last_name, st.sex, st.status AS student_status,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(sec.name, '-') AS section_name,
       COALESCE(e.status, 'pending') AS enrollment_status,
       e.student_type,
       COALESCE(GROUP_CONCAT(DISTINCT u.name ORDER BY sg.is_primary DESC, u.name SEPARATOR ', '), 'Not linked') AS guardians,
       COALESCE(GROUP_CONCAT(DISTINCT COALESCE(u.phone, u.email) ORDER BY sg.is_primary DESC, u.name SEPARATOR ', '), 'Not on file') AS guardian_contact
     FROM students st
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN student_guardians sg ON sg.student_id = st.id
     LEFT JOIN users u ON u.id = sg.parent_user_id
     WHERE st.school_id = :schoolId
     GROUP BY st.id, st.student_reference, st.first_name, st.middle_name, st.last_name, st.sex, st.status, gl.name, sec.name, e.status, e.student_type
     ORDER BY st.created_at DESC, st.id DESC`,
    { schoolId, schoolYearId },
  );

  return rows.map((row) => ({
    id: row.id,
    studentReference: row.student_reference,
    fullName: fullName(row.first_name, row.middle_name, row.last_name),
    grade: row.grade_name,
    section: row.section_name,
    guardians: row.guardians,
    guardianContact: row.guardian_contact,
    enrollmentStatus: row.enrollment_status,
    studentStatus: row.student_status,
    sex: labelForSex(row.sex),
    studentType: labelForStudentType(row.student_type),
  }));
}

async function getAdminParentRows(schoolId: number, schoolYearId: number | null) {
  const [linkedRows] = await pool.execute<AdminParentSqlRow[]>(
    `SELECT u.name AS parent_name, u.email, u.phone, pp.relationship,
       COALESCE(GROUP_CONCAT(DISTINCT CONCAT(st.first_name, ' ', st.last_name) ORDER BY st.last_name SEPARATOR ', '), pp.student_name) AS students,
       COALESCE(GROUP_CONCAT(DISTINCT gl.name ORDER BY gl.sort_order SEPARATOR ' / '), 'Not enrolled') AS grade,
       'Linked' AS link_status
     FROM student_guardians sg
     JOIN users u ON u.id = sg.parent_user_id
     JOIN parent_profiles pp ON pp.user_id = u.id
     JOIN students st ON st.id = sg.student_id
     LEFT JOIN enrollments e ON e.student_id = st.id AND (:schoolYearId IS NULL OR e.school_year_id = :schoolYearId)
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     WHERE st.school_id = :schoolId
     GROUP BY u.id, u.name, u.email, u.phone, pp.relationship, pp.student_name
     ORDER BY u.name ASC`,
    { schoolId, schoolYearId },
  );

  const [pendingRows] = await pool.execute<AdminParentSqlRow[]>(
    `SELECT u.name AS parent_name, u.email, u.phone, pp.relationship,
       pp.student_name AS students,
       'Reference pending' AS grade,
       'Pending' AS link_status
     FROM users u
     JOIN parent_profiles pp ON pp.user_id = u.id
     LEFT JOIN student_guardians sg ON sg.parent_user_id = u.id
     JOIN students st ON st.school_id = :schoolId AND st.student_reference = pp.student_reference
     WHERE u.role = 'parent' AND sg.id IS NULL
     ORDER BY u.name ASC`,
    { schoolId },
  );

  return [...linkedRows, ...pendingRows].map((row) => ({
    parentName: row.parent_name,
    students: row.students,
    grade: row.grade,
    contact: row.phone ?? "Not on file",
    email: row.email,
    relationship: labelForRelationship(row.relationship),
    status: row.link_status,
  }));
}

async function getParentLinkedStudents(parentUserId: number) {
  const [rows] = await pool.execute<ParentStudentSqlRow[]>(
    `SELECT st.id, st.student_reference, st.first_name, st.middle_name, st.last_name, st.status,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(sec.name, '-') AS section_name
     FROM student_guardians sg
     JOIN students st ON st.id = sg.student_id
     LEFT JOIN enrollments e ON e.id = (
       SELECT e_selected.id
       FROM enrollments e_selected
       JOIN school_years sy_selected ON sy_selected.id = e_selected.school_year_id
       WHERE e_selected.student_id = st.id
       ORDER BY (sy_selected.status = 'active') DESC,
         sy_selected.starts_on DESC,
         e_selected.id DESC
       LIMIT 1
     )
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE sg.parent_user_id = :parentUserId
     ORDER BY sg.is_primary DESC, st.last_name ASC, st.first_name ASC`,
    { parentUserId },
  );

  return rows.map((row) => {
    const name = fullName(row.first_name, row.middle_name, row.last_name);

    return {
      id: row.id,
      profileHref: `/parent/students/${row.id}`,
      initials: initialsFor(name),
      fullName: name,
      meta: `${row.grade_name} - ${row.section_name} - ${row.student_reference}`,
      status: row.status,
    };
  });
}

async function getParentPaymentSummary(parentUserId: number) {
  const [rows] = await pool.execute<ParentPaymentSummaryRow[]>(
    `SELECT
       COALESCE(SUM(GREATEST(sfa.amount_due - sfa.amount_paid, 0)), 0) AS outstanding,
       COALESCE((
         SELECT SUM(p.amount)
         FROM payments p
         JOIN students pst ON pst.id = p.student_id
         JOIN student_guardians psg ON psg.student_id = pst.id AND psg.parent_user_id = :parentUserId
         WHERE p.payer_user_id = :parentUserId
           AND p.status = 'paid'
           AND DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')
       ), 0) AS paid_this_month,
       COALESCE((
         SELECT COUNT(*)
         FROM payments p
         JOIN students pst ON pst.id = p.student_id
         JOIN student_guardians psg ON psg.student_id = pst.id AND psg.parent_user_id = :parentUserId
         WHERE p.payer_user_id = :parentUserId
       ), 0) AS payment_count,
       COALESCE((
         SELECT SUM(w.balance)
         FROM wallets w
         JOIN students wst ON wst.id = w.student_id
         JOIN student_guardians wsg ON wsg.student_id = wst.id AND wsg.parent_user_id = :parentUserId
       ), 0) AS wallet_balance,
       COALESCE((
         SELECT COUNT(*)
         FROM wallets w
         JOIN students wst ON wst.id = w.student_id
         JOIN student_guardians wsg ON wsg.student_id = wst.id AND wsg.parent_user_id = :parentUserId
       ), 0) AS wallet_count
     FROM student_guardians sg
     JOIN students st ON st.id = sg.student_id
     LEFT JOIN student_fee_assignments sfa ON sfa.student_id = st.id AND sfa.status <> 'cancelled'
     WHERE sg.parent_user_id = :parentUserId`,
    { parentUserId },
  );
  const row = rows[0];

  return {
    outstanding: decimalValue(row?.outstanding),
    paidThisMonth: decimalValue(row?.paid_this_month),
    paymentCount: Number(row?.payment_count ?? 0),
    walletBalance: decimalValue(row?.wallet_balance),
    walletCount: Number(row?.wallet_count ?? 0),
  };
}

async function getParentRecentPayments(parentUserId: number) {
  const [rows] = await pool.execute<ParentRecentPaymentRow[]>(
    `SELECT p.reference_number, p.amount, p.status,
       st.first_name, st.middle_name, st.last_name,
       COALESCE(
         GROUP_CONCAT(DISTINCT ft.name ORDER BY ft.name SEPARATOR ', '),
         MAX(CASE WHEN wt.type = 'top_up' THEN 'Wallet top-up' END),
         'School fee payment'
       ) AS description
     FROM payments p
     JOIN students st ON st.id = p.student_id
     JOIN student_guardians sg ON sg.student_id = st.id AND sg.parent_user_id = :parentUserId
     LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
     LEFT JOIN student_fee_assignments sfa ON sfa.id = pa.student_fee_assignment_id
     LEFT JOIN fee_types ft ON ft.id = sfa.fee_type_id
     LEFT JOIN wallet_transactions wt ON wt.payment_id = p.id
     WHERE p.payer_user_id = :parentUserId
     GROUP BY p.id, p.reference_number, p.amount, p.status, st.first_name, st.middle_name, st.last_name
     ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC
     LIMIT 5`,
    { parentUserId },
  );

  return rows.map((row) => ({
    referenceNumber: row.reference_number,
    studentName: fullName(row.first_name, row.middle_name, row.last_name),
    description: row.description,
    amount: money(row.amount),
    status: labelForStatus(row.status),
  }));
}

async function getParentRecentWalletActivity(
  parentUserId: number,
  { studentId, limit }: { studentId?: number; limit: number },
) {
  const selectedStudentClause = typeof studentId === "number" ? "AND st.id = :studentId" : "";
  const [rows] = await pool.execute<ParentRecentWalletActivityRow[]>(
    `SELECT wt.id, wt.type, wt.amount, wt.balance_after, wt.description, wt.created_at,
       sy.name AS school_year_name,
       p.channel, p.status,
       st.first_name, st.middle_name, st.last_name
     FROM wallet_transactions wt
     JOIN wallets w ON w.id = wt.wallet_id
     JOIN students st ON st.id = w.student_id
     JOIN student_guardians sg ON sg.student_id = st.id AND sg.parent_user_id = :parentUserId
     LEFT JOIN school_years sy ON sy.id = wt.school_year_id
     LEFT JOIN payments p ON p.id = wt.payment_id
     WHERE 1 = 1
       ${selectedStudentClause}
     ORDER BY wt.created_at DESC, wt.id DESC
     LIMIT :limit`,
    typeof studentId === "number" ? { parentUserId, studentId, limit } : { parentUserId, limit },
  );

  return rows.map((row) => {
    const rawAmount = decimalValue(row.amount);
    const isCredit = rawAmount > 0;
    const isPurchase = row.type === "purchase";
    const status = row.status ? labelForStatus(row.status) : "Recorded";

    return {
      id: row.id,
      date: formatDateTime(row.created_at),
      studentName: fullName(row.first_name, row.middle_name, row.last_name),
      description: [row.description ?? labelForWalletType(row.type), row.school_year_name].filter(Boolean).join(" - "),
      amount: `${isCredit ? "+" : "-"}${money(Math.abs(rawAmount))}`,
      balanceAfter: money(row.balance_after),
      channel: isPurchase ? "Store wallet" : row.channel ? labelForChannel(row.channel) : "Wallet",
      status,
      tone: walletActivityTone(row.type, status),
    };
  });
}

function emptyAdminStudentData(warning: string): AdminStudentPageData {
  return {
    ready: false,
    warning,
    activeSchoolYearName: null,
    enrollmentSchoolYearName: null,
    gradeOptions: [],
    sectionOptions: [],
    enrollmentSectionOptions: [],
    students: [],
    enrollmentCandidates: [],
    kpis: studentKpis([], null),
  };
}

function studentKpis(students: AdminStudentRow[], schoolYearName: string | null): AdminStudentPageData["kpis"] {
  const linked = students.filter((student) => student.guardians !== "Not linked").length;
  const enrolled = students.filter((student) => student.enrollmentStatus === "enrolled").length;

  return [
    { label: "Total students", value: String(students.length), note: schoolYearName ?? "School year pending", tone: "orange" },
    { label: "Enrolled", value: String(enrolled), note: "Active enrollment records", tone: "green", noteTone: "up" },
    { label: "Linked parents", value: String(linked), note: `${students.length - linked} without guardian links`, tone: "blue" },
    { label: "Pending setup", value: String(students.length - enrolled), note: "Need enrollment review", tone: "red", noteTone: "warn" },
  ];
}

function parentKpis(rows: AdminParentRow[]): AdminParentsPageData["kpis"] {
  const linked = rows.filter((row) => row.status === "Linked").length;
  const pending = rows.length - linked;

  return [
    { label: "Parent records", value: String(rows.length), note: "Visible for this school", tone: "orange" },
    { label: "Linked guardians", value: String(linked), note: "Connected to students", tone: "green", noteTone: "up" },
    { label: "Pending links", value: String(pending), note: "Reference needs review", tone: "blue" },
    { label: "Access scope", value: "School-only", note: "Parents see linked students only", tone: "teal" },
  ];
}

function parentMetrics(
  linkedStudents: ParentLinkedStudent[],
  summary: { paidThisMonth: number; outstanding: number; paymentCount: number; walletBalance: number; walletCount: number },
): ParentDashboardData["metrics"] {
  return [
    {
      label: "Linked students",
      value: String(linkedStudents.length),
      note: linkedStudents.length > 0 ? "Database-backed guardian links" : "Link a student reference",
      accent: true,
    },
    { label: "Paid this month", value: summary.paymentCount > 0 ? money(summary.paidThisMonth) : "Pending", note: "Recorded school fee payments", tone: "green" },
    { label: "Outstanding", value: linkedStudents.length > 0 ? money(summary.outstanding) : "Pending", note: "Open and partial assigned fees", tone: "red" },
    {
      label: "Wallets",
      value: linkedStudents.length > 0 ? money(summary.walletBalance) : "Pending",
      note: summary.walletCount > 0 ? `${summary.walletCount} allowance wallet${summary.walletCount === 1 ? "" : "s"}` : "Top up allowance to create a wallet",
      tone: "orange",
    },
  ];
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

function labelForRelationship(relationship: string) {
  return relationship.charAt(0).toUpperCase() + relationship.slice(1);
}

function labelForStatus(status: string) {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForWalletType(type: string) {
  const labels: Record<string, string> = {
    adjustment: "Wallet adjustment",
    purchase: "Store purchase",
    reversal: "Wallet reversal",
    top_up: "Wallet top-up",
  };

  return labels[type] ?? labelForStatus(type);
}

function walletActivityTone(type: string, status: string): ParentWalletActivity["tone"] {
  if (type === "purchase") {
    return "red";
  }

  if (status === "Pending") {
    return "amber";
  }

  if (status === "Failed" || status === "Cancelled") {
    return "red";
  }

  return type === "top_up" ? "green" : "muted";
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

function firstNameFor(name: string) {
  return name.split(/\s+/).filter(Boolean)[0] ?? name;
}

function parentContextFromRow(row: ParentPortalContextRow | null | undefined, fallbackName: string): ParentPortalContext {
  const parentName = row?.parent_name || fallbackName || "Parent";
  const studentName = row?.first_name ? fullName(row.first_name, row.middle_name, row.last_name ?? "") : null;
  const relationshipLabel = labelForRelationship(row?.relationship ?? "guardian");
  const contactLine = row?.phone ?? row?.email ?? "No contact on file";

  return {
    parentName,
    parentFirstName: firstNameFor(parentName),
    parentInitials: initialsFor(parentName),
    relationshipLabel,
    contactLine,
    schoolName: row?.school_name ?? null,
    schoolYearName: row?.school_year_name ?? null,
    primaryStudentName: studentName,
    primaryStudentReference: row?.student_reference ?? null,
    payableFeeCount: Number(row?.payable_fee_count ?? 0),
  };
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "Not on file";
  }

  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return value;
}

function formatDateTime(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type GradeOptionRow = RowDataPacket & {
  id: number;
  name: string;
};

type SectionOptionRow = RowDataPacket & {
  id: number;
  grade_level_id: number;
  grade_name: string;
  section_name: string;
};

type AdminStudentSqlRow = RowDataPacket & {
  id: number;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  section_name: string;
  guardians: string;
  guardian_contact: string;
  enrollment_status: string;
  student_status: string;
  sex: string | null;
  student_type: string | null;
};

type AdminParentSqlRow = RowDataPacket & {
  parent_name: string;
  students: string;
  grade: string;
  phone: string | null;
  email: string;
  relationship: string;
  link_status: "Linked" | "Pending";
};

type ParentStudentSqlRow = RowDataPacket & {
  id: number;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string;
  section_name: string;
  status: string;
};

type ParentPaymentSummaryRow = RowDataPacket & {
  outstanding: number | string;
  paid_this_month: number | string;
  payment_count: number;
  wallet_balance: number | string;
  wallet_count: number;
};

type ParentRecentPaymentRow = RowDataPacket & {
  reference_number: string;
  amount: number | string;
  status: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  description: string;
};

type ParentRecentWalletActivityRow = RowDataPacket & {
  id: number;
  type: string;
  amount: number | string;
  balance_after: number | string;
  description: string | null;
  created_at: Date | string;
  school_year_name: string | null;
  channel: string | null;
  status: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type ParentPortalContextRow = RowDataPacket & {
  parent_name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  school_name: string | null;
  school_year_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  student_reference: string | null;
  payable_fee_count: number | string | null;
};

type ParentStudentProfileRow = RowDataPacket & {
  id: number;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  birthdate: Date | string | null;
  sex: string | null;
  student_status: string;
  school_name: string;
  school_year_name: string;
  grade_name: string;
  section_name: string;
  enrollment_status: string;
  student_type: string | null;
  parent_name: string;
  email: string;
  phone: string | null;
  parent_status: string;
  relationship: string | null;
};

type ParentStudentWalletSummaryRow = RowDataPacket & {
  wallet_balance: number | string;
  wallet_status: string;
  monthly_spend: number | string;
  last_top_up_at: Date | string | null;
};

type ParentProfileRow = RowDataPacket & {
  relationship: string;
};

type StudentMatchRow = RowDataPacket & {
  id: number;
};

type CountRow = RowDataPacket & {
  total: number;
};
