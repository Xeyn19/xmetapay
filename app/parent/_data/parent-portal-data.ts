import {
  BookOpen,
  Bus,
  CreditCard,
  FileText,
  GraduationCap,
  History,
  Home,
  IdCard,
  Receipt,
  Settings,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ParentTone = "orange" | "green" | "red" | "blue" | "amber" | "muted";

export type ParentNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export type ParentNavSection = {
  label: string;
  items: ParentNavItem[];
};

export type ParentPageMeta = {
  title: string;
  subtitle: string;
};

export type ParentMetric = {
  label: string;
  value: string;
  note: string;
  tone?: ParentTone;
  accent?: boolean;
};

export const parentPageMeta: Record<string, ParentPageMeta> = {
  "/parent/dashboard": {
    title: "Dashboard",
    subtitle: "Welcome back",
  },
  "/parent/student-profile": {
    title: "Student profile",
    subtitle: "Choose a linked student profile",
  },
  "/parent/fees": {
    title: "Fee summary",
    subtitle: "Fee backend pending",
  },
  "/parent/pay-tuition": {
    title: "Pay tuition & fees",
    subtitle: "Local payment flow pending",
  },
  "/parent/receipt": {
    title: "Payment complete",
    subtitle: "Receipt records will appear after payments are connected",
  },
  "/parent/history": {
    title: "Payment history",
    subtitle: "All transactions - SY 2025-2026",
  },
  "/parent/wallet": {
    title: "Wallet & allowance top-up",
    subtitle: "Manage student allowance balances",
  },
};

export const parentNavSections: ParentNavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/parent/dashboard", icon: Home }],
  },
  {
    label: "Enrollment",
    items: [{ label: "Student profile", href: "/parent/student-profile", icon: IdCard }],
  },
  {
    label: "Payments",
    items: [
      { label: "Fee summary", href: "/parent/fees", icon: Receipt, badge: "2" },
      { label: "Pay tuition", href: "/parent/pay-tuition", icon: CreditCard },
      { label: "Payment history", href: "/parent/history", icon: History },
    ],
  },
  {
    label: "Allowance",
    items: [{ label: "Wallet & top-up", href: "/parent/wallet", icon: Wallet }],
  },
];

export const dashboardMetrics: ParentMetric[] = [
  { label: "Students enrolled", value: "0", note: "Use linked student records", accent: true },
  { label: "Paid this month", value: "Pending", note: "Payment backend pending", tone: "green" },
  { label: "Outstanding balance", value: "Pending", note: "Fee backend pending", tone: "red" },
  { label: "Wallet balances", value: "Pending", note: "Wallet backend pending" },
];

export const children = [
  {
    initials: "ST",
    tone: "orange" as const,
    name: "Linked student",
    meta: "Database-backed student details appear on the dashboard",
  },
  {
    initials: "ST",
    tone: "blue" as const,
    name: "Additional student",
    meta: "Link another student reference to show more records",
  },
];

export const outstandingFees = [
  { icon: Receipt, title: "Fee backend pending", desc: "Student fee assignments will appear after Phase 4", amount: "Pending", status: "Pending", tone: "amber" as const },
  { icon: Bus, title: "Other fees pending", desc: "Transportation or activity fees will appear after Phase 4", amount: "Pending", status: "Pending", tone: "amber" as const },
  { icon: GraduationCap, title: "Tuition balance pending", desc: "Tuition balances will appear after Phase 4", amount: "Pending", status: "Pending", tone: "amber" as const },
];

export const recentActivity = [
  ["Pending", "Linked student", "Payment and wallet activity pending", "-", "Backend", "Pending"],
];

export const feeSummary = [
  { title: "Tuition fees", desc: "Student fee assignments will appear after Phase 4", amount: "Pending", status: "Pending", tone: "amber" as const, icon: Receipt },
  { title: "Other school fees", desc: "Activity, supply, and other fees will appear after Phase 4", amount: "Pending", status: "Pending", tone: "amber" as const, icon: FileText },
  { title: "Transportation or trips", desc: "Optional fees will appear after Phase 4", amount: "Pending", status: "Pending", tone: "amber" as const, icon: Bus },
  { title: "Books and supplies", desc: "Assigned balances will appear after Phase 4", amount: "Pending", status: "Pending", tone: "amber" as const, icon: BookOpen },
  { title: "Uniforms", desc: "Paid records will appear after Phase 5", amount: "Pending", status: "Pending", tone: "amber" as const, icon: GraduationCap },
];

export const payableFees = [
  { id: "tuition", title: "Tuition payment", desc: "Fee balances will load from MySQL after Phase 4", amount: 0, defaultSelected: false },
  { id: "other-fees", title: "Other school fees", desc: "Assigned fees will load from MySQL after Phase 4", amount: 0, defaultSelected: false },
];

export const paymentMethods = [
  { id: "wallet", title: "XMETA wallet", desc: "Use linked family wallet", icon: Wallet },
  { id: "card", title: "Debit / credit card", desc: "Visa, Mastercard, or local card", icon: CreditCard },
  { id: "online", title: "Online banking", desc: "Bank transfer and e-wallet channels", icon: Receipt },
];

export const historyRows = [
  ["Pending", "Pending", "Linked student", "Payment history will appear after Phase 5", "-", "Backend", "Pending"],
];

export const walletTransactions = [
  ["Pending", "Linked student", "Wallet history will appear after Phase 6", "-", "Backend", "Pending"],
];

export const profileStats = [
  { label: "Wallet balance", value: "Pending" },
  { label: "Fees paid", value: "Pending" },
  { label: "Outstanding", value: "Pending" },
];

export const profileDetails = [
  { label: "Student reference", value: "Linked student required" },
  { label: "Grade level", value: "Pending" },
  { label: "Student type", value: "Pending" },
  { label: "Date of birth", value: "Pending" },
  { label: "Status", value: "Pending" },
];

export const parentDetails = [
  { label: "Guardian", value: "Signed-in parent" },
  { label: "Relationship", value: "Parent / guardian" },
  { label: "Mobile", value: "From account profile" },
  { label: "Email", value: "From account profile" },
  { label: "Portal access", value: "Active" },
];

export const walletQuickAmounts = [100, 200, 500, 1000];
export const settingsIcon = Settings;
