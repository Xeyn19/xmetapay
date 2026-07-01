export const adminStaffRoles = ["school_administrator", "registrar", "finance_officer"] as const;

export type AdminStaffRole = (typeof adminStaffRoles)[number];

export type AdminRoleDetail = {
  label: string;
  summary: string;
  allowedAreas: string[];
  blockedAreas: string[];
};

const studentAdminPaths = ["/admin/students", "/admin/student-profile", "/admin/parents"] as const;
const financeAdminPaths = [
  "/admin/tuition",
  "/admin/collections",
  "/admin/other-fees",
  "/admin/allowance",
  "/admin/store-transactions",
  "/admin/reports",
] as const;

export const adminRoleDetails: Record<AdminStaffRole, AdminRoleDetail> = {
  school_administrator: {
    label: "School administrator",
    summary: "Owns school setup and can access all admin dashboard areas.",
    allowedAreas: [
      "Set up school records",
      "Manage students and parent contacts",
      "View and manage finance pages",
      "View reports",
    ],
    blockedAreas: [],
  },
  registrar: {
    label: "Registrar",
    summary: "Maintains official student enrollment and guardian records.",
    allowedAreas: [
      "Dashboard",
      "Enrolled students",
      "Student profile",
      "Parent contacts",
      "Add and enroll students",
    ],
    blockedAreas: ["School setup", "Finance pages", "Reports"],
  },
  finance_officer: {
    label: "Finance officer",
    summary: "Works with fees, payments, allowance, store transactions, and reports.",
    allowedAreas: [
      "Dashboard",
      "Tuition report",
      "Collections log",
      "Other fees",
      "Allowance ledger",
      "Store transactions",
      "Financial reports",
    ],
    blockedAreas: ["School setup", "Student enrollment", "Parent contact management"],
  },
};

export function normalizeAdminStaffRole(value: unknown): AdminStaffRole | null {
  return adminStaffRoles.includes(value as AdminStaffRole) ? (value as AdminStaffRole) : null;
}

export function labelForAdminStaffRole(role: AdminStaffRole | string) {
  return adminRoleDetails[normalizeAdminStaffRole(role) ?? "school_administrator"].label;
}

export function canManageSchoolSetup(role: AdminStaffRole | string | null | undefined) {
  return normalizeAdminStaffRole(role) === "school_administrator";
}

export function canManageStudents(role: AdminStaffRole | string | null | undefined) {
  const normalizedRole = normalizeAdminStaffRole(role);

  return normalizedRole === "school_administrator" || normalizedRole === "registrar";
}

export function canAccessFinance(role: AdminStaffRole | string | null | undefined) {
  const normalizedRole = normalizeAdminStaffRole(role);

  return normalizedRole === "school_administrator" || normalizedRole === "finance_officer";
}

export function canAccessAdminPath(role: AdminStaffRole | string | null | undefined, pathname: string) {
  const normalizedRole = normalizeAdminStaffRole(role);

  if (!normalizedRole) {
    return false;
  }

  if (pathname === "/admin" || pathname === "/admin/dashboard") {
    return true;
  }

  if (pathname === "/admin/school-setup") {
    return canManageSchoolSetup(normalizedRole);
  }

  if (studentAdminPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return canManageStudents(normalizedRole);
  }

  if (financeAdminPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return canAccessFinance(normalizedRole);
  }

  return normalizedRole === "school_administrator";
}

export function canUseAdminHeaderAction(
  role: AdminStaffRole | string | null | undefined,
  action: "add_student" | "record_payment" | "send_reminder",
) {
  if (action === "add_student") {
    return canManageStudents(role);
  }

  if (action === "record_payment") {
    return canAccessFinance(role);
  }

  return canAccessFinance(role);
}

export function filterAdminNavSectionsForStaffRole<
  TItem extends { href: string },
  TSection extends { items: TItem[] },
>(sections: TSection[], role: AdminStaffRole | string | null | undefined) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessAdminPath(role, item.href)),
    }))
    .filter((section) => section.items.length > 0);
}
