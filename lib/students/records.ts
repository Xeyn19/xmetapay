import "server-only";

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";
import { getResolvedAdminSchoolSetup } from "@/lib/school/setup";

type Queryable = Pick<Pool | PoolConnection, "execute">;

export type AdminStudentPageData = {
  ready: boolean;
  warning: string | null;
  activeSchoolYearName: string | null;
  gradeOptions: Array<{ id: number; name: string }>;
  sectionOptions: Array<{ id: number; gradeLevelId: number; label: string }>;
  kpis: Array<{
    label: string;
    value: string;
    note: string;
    tone: "orange" | "green" | "red" | "blue" | "purple" | "teal";
    noteTone?: "default" | "up" | "warn" | "danger";
  }>;
  students: AdminStudentRow[];
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
  } | null;
};

export async function getAdminStudentPageData(adminUserId: number): Promise<AdminStudentPageData> {
  try {
    const setup = await getAdminSetup(adminUserId);

    if (!setup.schoolId || !setup.schoolYearId) {
      return emptyAdminStudentData(setup.warning ?? "Ask a school administrator to complete school setup first.");
    }

    const [gradeOptions, sectionOptions, students] = await Promise.all([
      getGradeOptions(setup.schoolId),
      getSectionOptions(setup.schoolId, setup.schoolYearId),
      getAdminStudentRows(setup.schoolId, setup.schoolYearId),
    ]);

    return {
      ready: true,
      warning: null,
      activeSchoolYearName: setup.schoolYearName,
      gradeOptions,
      sectionOptions,
      kpis: studentKpis(students, setup.schoolYearName),
      students,
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
  try {
    const [linkedStudents, summary, recentPayments] = await Promise.all([
      getParentLinkedStudents(parentUserId),
      getParentPaymentSummary(parentUserId),
      getParentRecentPayments(parentUserId),
    ]);

    return {
      linkedStudents,
      recentPayments,
      outstandingBalance: money(summary.outstanding),
      metrics: parentMetrics(linkedStudents, summary),
    };
  } catch {
    return {
      linkedStudents: [],
      recentPayments: [],
      outstandingBalance: "Pending",
      metrics: parentMetrics([], { paidThisMonth: 0, outstanding: 0, paymentCount: 0 }),
    };
  }
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
         st.birthdate, st.status AS student_status,
         sc.name AS school_name,
         COALESCE(sy.name, 'School year pending') AS school_year_name,
         COALESCE(gl.name, 'Not enrolled') AS grade_name,
         COALESCE(sec.name, '-') AS section_name,
         COALESCE(e.status, 'pending') AS enrollment_status,
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
      },
    };
  } catch {
    return { context, student: null };
  }
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
  const [guardianCountRows] = await executor.execute<CountRow[]>(
    "SELECT COUNT(*) AS total FROM student_guardians WHERE student_id = :studentId",
    { studentId },
  );
  const isPrimary = Number(guardianCountRows[0]?.total ?? 0) === 0;

  await executor.execute(
    `INSERT INTO student_guardians (student_id, parent_user_id, relationship, is_primary)
     VALUES (:studentId, :parentUserId, :relationship, :isPrimary)
     ON DUPLICATE KEY UPDATE
       relationship = VALUES(relationship)`,
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
  return getResolvedAdminSchoolSetup(adminUserId);
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
    `SELECT st.id, st.student_reference, st.first_name, st.middle_name, st.last_name, st.status AS student_status,
       COALESCE(gl.name, 'Not enrolled') AS grade_name,
       COALESCE(sec.name, '-') AS section_name,
       COALESCE(e.status, 'pending') AS enrollment_status,
       COALESCE(GROUP_CONCAT(DISTINCT u.name ORDER BY sg.is_primary DESC, u.name SEPARATOR ', '), 'Not linked') AS guardians,
       COALESCE(GROUP_CONCAT(DISTINCT COALESCE(u.phone, u.email) ORDER BY sg.is_primary DESC, u.name SEPARATOR ', '), 'Not on file') AS guardian_contact
     FROM students st
     LEFT JOIN enrollments e ON e.student_id = st.id AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN student_guardians sg ON sg.student_id = st.id
     LEFT JOIN users u ON u.id = sg.parent_user_id
     WHERE st.school_id = :schoolId
     GROUP BY st.id, st.student_reference, st.first_name, st.middle_name, st.last_name, st.status, gl.name, sec.name, e.status
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
     LEFT JOIN enrollments e ON e.student_id = st.id
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
       ), 0) AS payment_count
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
  };
}

async function getParentRecentPayments(parentUserId: number) {
  const [rows] = await pool.execute<ParentRecentPaymentRow[]>(
    `SELECT p.reference_number, p.amount, p.status,
       st.first_name, st.middle_name, st.last_name,
       COALESCE(GROUP_CONCAT(DISTINCT ft.name ORDER BY ft.name SEPARATOR ', '), 'School fee payment') AS description
     FROM payments p
     JOIN students st ON st.id = p.student_id
     JOIN student_guardians sg ON sg.student_id = st.id AND sg.parent_user_id = :parentUserId
     LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
     LEFT JOIN student_fee_assignments sfa ON sfa.id = pa.student_fee_assignment_id
     LEFT JOIN fee_types ft ON ft.id = sfa.fee_type_id
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

function emptyAdminStudentData(warning: string): AdminStudentPageData {
  return {
    ready: false,
    warning,
    activeSchoolYearName: null,
    gradeOptions: [],
    sectionOptions: [],
    students: [],
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
  summary: { paidThisMonth: number; outstanding: number; paymentCount: number },
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
    { label: "Wallets", value: "Next", note: "Phase 6 will add allowance", tone: "orange" },
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
  student_status: string;
  school_name: string;
  school_year_name: string;
  grade_name: string;
  section_name: string;
  enrollment_status: string;
  parent_name: string;
  email: string;
  phone: string | null;
  parent_status: string;
  relationship: string | null;
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
