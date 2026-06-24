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
    subtitle: "Welcome back, Maria - May 19, 2025",
  },
  "/parent/student-profile": {
    title: "Student profile",
    subtitle: "Juan Miguel Santos - BWA-2025-0312",
  },
  "/parent/fees": {
    title: "Fee summary",
    subtitle: "Juan Miguel Santos - SY 2025-2026",
  },
  "/parent/pay-tuition": {
    title: "Pay tuition & fees",
    subtitle: "Juan Miguel Santos - Select and pay outstanding fees",
  },
  "/parent/receipt": {
    title: "Payment complete",
    subtitle: "Transaction confirmed - TXN-20250519-5891",
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
  { label: "Students enrolled", value: "2", note: "Juan & Maria Jr.", accent: true },
  { label: "Paid this month", value: "P3,500", note: "July tuition - paid", tone: "green" },
  { label: "Outstanding balance", value: "P1,100", note: "2 items due", tone: "red" },
  { label: "Wallet balances", value: "P470", note: "Juan P320 - Maria P150" },
];

export const children = [
  {
    initials: "JS",
    tone: "orange" as const,
    name: "Juan Miguel Santos",
    meta: "Grade 7 - BWA-2025-0312 - Wallet: P320",
  },
  {
    initials: "MJ",
    tone: "blue" as const,
    name: "Maria Santos Jr.",
    meta: "Grade 4 - BWA-2025-0145 - Wallet: P150",
  },
];

export const outstandingFees = [
  { icon: Receipt, title: "PTA contribution", desc: "Juan - Due June 15", amount: "P200", status: "Due", tone: "red" as const },
  { icon: Bus, title: "Field trip - June", desc: "Juan - Due June 20", amount: "P350", status: "Due", tone: "red" as const },
  { icon: GraduationCap, title: "Supply fee balance", desc: "Juan - Partial - P350 remaining", amount: "P350", status: "Partial", tone: "amber" as const },
];

export const recentActivity = [
  ["May 19", "Juan Santos", "Allowance top-up", "+P200", "Online", "Done"],
  ["May 18", "Juan Santos", "Canteen purchase", "-P85", "Wallet", "Done"],
  ["May 15", "Juan Santos", "PTA contribution", "P200", "Pending", "Due"],
  ["May 10", "Maria Santos Jr.", "Allowance top-up", "+P150", "Online", "Done"],
];

export const feeSummary = [
  { title: "July 2025 tuition", desc: "Juan Miguel Santos - Due July 5", amount: "P3,500", status: "Paid", tone: "green" as const, icon: Receipt },
  { title: "PTA contribution", desc: "Juan Miguel Santos - Due June 15", amount: "P200", status: "Due", tone: "red" as const, icon: FileText },
  { title: "Field trip - June", desc: "Juan Miguel Santos - Due June 20", amount: "P350", status: "Due", tone: "red" as const, icon: Bus },
  { title: "Supply fee balance", desc: "Juan Miguel Santos - Partial - P350 remaining", amount: "P350", status: "Partial", tone: "amber" as const, icon: BookOpen },
  { title: "Maria July tuition", desc: "Maria Santos Jr. - Due July 5", amount: "P3,500", status: "Open", tone: "blue" as const, icon: Receipt },
  { title: "Uniform set", desc: "Maria Santos Jr. - Paid May 6", amount: "P950", status: "Paid", tone: "green" as const, icon: GraduationCap },
];

export const payableFees = [
  { id: "tuition", title: "July 2025 tuition", desc: "Juan Miguel Santos - Due July 5", amount: 3500, defaultSelected: true },
  { id: "supply", title: "School supplies balance", desc: "Juan Miguel Santos - P350 remaining", amount: 350, defaultSelected: true },
  { id: "pta", title: "PTA contribution", desc: "Juan Miguel Santos - Due June 15", amount: 200, defaultSelected: false },
  { id: "field-trip", title: "Field trip - June", desc: "Juan Miguel Santos - Due June 20", amount: 350, defaultSelected: false },
];

export const paymentMethods = [
  { id: "wallet", title: "XMETA wallet", desc: "Use linked family wallet", icon: Wallet },
  { id: "card", title: "Debit / credit card", desc: "Visa, Mastercard, or local card", icon: CreditCard },
  { id: "online", title: "Online banking", desc: "Bank transfer and e-wallet channels", icon: Receipt },
];

export const historyRows = [
  ["TXN-20250519-5891", "May 19", "Juan Santos", "Allowance top-up", "P200", "Online", "Done"],
  ["TXN-20250515-1208", "May 15", "Juan Santos", "July tuition", "P3,500", "Card", "Paid"],
  ["TXN-20250510-7781", "May 10", "Maria Santos Jr.", "Allowance top-up", "P150", "Online", "Done"],
  ["TXN-20250506-6210", "May 6", "Maria Santos Jr.", "Uniform set", "P950", "Maya", "Paid"],
  ["TXN-20250429-4421", "Apr 29", "Juan Santos", "Books and modules", "P1,200", "GCash", "Paid"],
];

export const walletTransactions = [
  ["May 19", "Juan Santos", "Allowance top-up", "+P200", "Online", "Done"],
  ["May 18", "Juan Santos", "Canteen purchase", "-P85", "Wallet", "Done"],
  ["May 17", "Maria Santos Jr.", "School store", "-P45", "Wallet", "Done"],
  ["May 10", "Maria Santos Jr.", "Allowance top-up", "+P150", "Online", "Done"],
];

export const profileStats = [
  { label: "Wallet balance", value: "P320" },
  { label: "Fees paid", value: "82%" },
  { label: "Outstanding", value: "P1,100" },
];

export const profileDetails = [
  { label: "Student ID", value: "BWA-2025-0312" },
  { label: "Grade level", value: "Grade 7" },
  { label: "Student type", value: "New student" },
  { label: "Date of birth", value: "March 12, 2012" },
  { label: "Status", value: "Enrolled" },
];

export const parentDetails = [
  { label: "Guardian", value: "Maria Santos" },
  { label: "Relationship", value: "Mother" },
  { label: "Mobile", value: "0917-234-5678" },
  { label: "Email", value: "maria@email.com" },
  { label: "Portal access", value: "Active" },
];

export const walletQuickAmounts = [100, 200, 500, 1000];
export const settingsIcon = Settings;
