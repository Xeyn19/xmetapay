import "server-only";

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

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
};

export type ParentLinkedStudent = {
  id: number;
  initials: string;
  fullName: string;
  meta: string;
  status: string;
};

export async function getAdminStudentPageData(adminUserId: number): Promise<AdminStudentPageData> {
  try {
    const setup = await getAdminSetup(adminUserId);

    if (!setup?.school_id || !setup.school_year_id) {
      return emptyAdminStudentData("Initialize school setup before adding students.");
    }

    const [gradeOptions, sectionOptions, students] = await Promise.all([
      getGradeOptions(setup.school_id),
      getSectionOptions(setup.school_id, setup.school_year_id),
      getAdminStudentRows(setup.school_id, setup.school_year_id),
    ]);

    return {
      ready: true,
      warning: null,
      activeSchoolYearName: setup.school_year_name,
      gradeOptions,
      sectionOptions,
      kpis: studentKpis(students, setup.school_year_name),
      students,
    };
  } catch {
    return emptyAdminStudentData("Student records are unavailable. Confirm MySQL/XAMPP and the full schema are ready.");
  }
}

export async function getAdminParentsPageData(adminUserId: number): Promise<AdminParentsPageData> {
  try {
    const setup = await getAdminSetup(adminUserId);

    if (!setup?.school_id) {
      return {
        kpis: parentKpis([]),
        rows: [],
      };
    }

    const rows = await getAdminParentRows(setup.school_id, setup.school_year_id);

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
    const linkedStudents = await getParentLinkedStudents(parentUserId);

    return {
      linkedStudents,
      metrics: parentMetrics(linkedStudents),
    };
  } catch {
    return {
      linkedStudents: [],
      metrics: parentMetrics([]),
    };
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
  const [rows] = await pool.execute<AdminSetupRow[]>(
    `SELECT ap.school_id, sy.id AS school_year_id, sy.name AS school_year_name
     FROM admin_profiles ap
     LEFT JOIN school_years sy ON sy.school_id = ap.school_id AND sy.status = 'active'
     WHERE ap.user_id = :adminUserId
     ORDER BY sy.starts_on DESC, sy.id DESC
     LIMIT 1`,
    { adminUserId },
  );

  return rows[0] ?? null;
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
      initials: initialsFor(name),
      fullName: name,
      meta: `${row.grade_name} - ${row.section_name} - ${row.student_reference}`,
      status: row.status,
    };
  });
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

function parentMetrics(linkedStudents: ParentLinkedStudent[]): ParentDashboardData["metrics"] {
  return [
    {
      label: "Linked students",
      value: String(linkedStudents.length),
      note: linkedStudents.length > 0 ? "Database-backed guardian links" : "Link a student reference",
      accent: true,
    },
    { label: "Fee records", value: "Next", note: "Phase 4 will add balances", tone: "blue" },
    { label: "Payments", value: "Next", note: "Phase 5 will add receipts", tone: "green" },
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

type AdminSetupRow = RowDataPacket & {
  school_id: number | null;
  school_year_id: number | null;
  school_year_name: string | null;
};

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

type ParentProfileRow = RowDataPacket & {
  relationship: string;
};

type StudentMatchRow = RowDataPacket & {
  id: number;
};

type CountRow = RowDataPacket & {
  total: number;
};
