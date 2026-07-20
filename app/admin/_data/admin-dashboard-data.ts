import {
  Activity,
  BarChart3,
  Building2,
  Calculator,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  IdCard,
  LayoutDashboard,
  Receipt,
  Send,
  Store,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Tone = "orange" | "green" | "red" | "blue" | "purple" | "teal";
export type StatusTone =
  | "paid"
  | "partial"
  | "unpaid"
  | "enrolled"
  | "active"
  | "inactive"
  | "pending"
  | "low"
  | "online";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export type PageMeta = {
  title: string;
  subtitle: string;
};

export type Kpi = {
  label: string;
  value: string;
  note: string;
  tone: Tone;
  noteTone?: "default" | "up" | "warn" | "danger";
  icon?: LucideIcon;
};

export const pageMeta: Record<string, PageMeta> = {
  "/admin/dashboard": {
    title: "Dashboard",
    subtitle: "School dashboard - SY 2025-2026",
  },
  "/admin/school-setup": {
    title: "School setup",
    subtitle: "School identity, years, and setup health",
  },
  "/admin/school-setup/rollover": {
    title: "Prepare next year",
    subtitle: "Review and place students in an upcoming school year",
  },
  "/admin/school-setup/year-structure": {
    title: "Year structure",
    subtitle: "Grade levels and sections for one school year",
  },
  "/admin/tuition": {
    title: "Tuition report",
    subtitle: "June 2025 - collection status and outstanding balances",
  },
  "/admin/collections": {
    title: "Collections log",
    subtitle: "All incoming payments - SY 2025-2026",
  },
  "/admin/other-fees": {
    title: "Other school fees",
    subtitle: "Non-tuition fee items - SY 2025-2026",
  },
  "/admin/students": {
    title: "Enrolled students",
    subtitle: "Student registry - SY 2025-2026",
  },
  "/admin/student-profile": {
    title: "Student profile",
    subtitle: "Choose or view a real student record",
  },
  "/admin/parents": {
    title: "Parent contacts",
    subtitle: "Registered parents and contact directory",
  },
  "/admin/allowance": {
    title: "Allowance ledger",
    subtitle: "Student wallet balances and top-up history",
  },
  "/admin/store-transactions": {
    title: "Store transactions",
    subtitle: "Canteen and school store spending log",
  },
  "/admin/reports": {
    title: "Financial reports",
    subtitle: "Downloadable reports and monthly revenue trends",
  },
};

export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "School setup", href: "/admin/school-setup", icon: Building2 },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Tuition report", href: "/admin/tuition", icon: Receipt },
      { label: "Collections log", href: "/admin/collections", icon: CreditCard },
      { label: "Other fees", href: "/admin/other-fees", icon: ClipboardList },
    ],
  },
  {
    label: "Students",
    items: [
      { label: "Enrolled students", href: "/admin/students", icon: UserCheck },
      { label: "Student profile", href: "/admin/student-profile", icon: IdCard },
      { label: "Parent contacts", href: "/admin/parents", icon: Users },
    ],
  },
  {
    label: "Allowance",
    items: [
      { label: "Allowance ledger", href: "/admin/allowance", icon: Wallet },
      { label: "Store transactions", href: "/admin/store-transactions", icon: Store },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Financial reports", href: "/admin/reports", icon: BarChart3 }],
  },
];

export const dashboardKpis: Kpi[] = [
  { label: "Total enrolled", value: "244", note: "+12 from last SY", tone: "blue", noteTone: "up", icon: Users },
  { label: "Collected - June", value: "P682,500", note: "87% collection rate", tone: "orange", noteTone: "up", icon: CreditCard },
  { label: "Outstanding - June", value: "P143,500", note: "41 students unpaid", tone: "red", noteTone: "danger", icon: Activity },
  { label: "Top-ups today", value: "P4,200", note: "21 transactions", tone: "green", noteTone: "up", icon: Wallet },
];

export const tuitionCollectedByGrade = [
  { label: "Grade 7", value: "P94,500", percent: 94 },
  { label: "Grade 8", value: "P88,000", percent: 88 },
  { label: "Grade 9", value: "P82,000", percent: 82 },
  { label: "Grade 4", value: "P76,000", percent: 76 },
  { label: "Grade 5", value: "P70,000", percent: 70 },
  { label: "Grade 6", value: "P65,000", percent: 65 },
];

export const monthlySummary = [
  { label: "Total tuition billed - Jun", value: "P826,000" },
  { label: "Collected to date", value: "P682,500", tone: "green" as const },
  { label: "Outstanding balance", value: "P143,500", tone: "red" as const },
  { label: "Collection rate", value: "82.6%" },
  { label: "Allowance top-ups - May", value: "P38,400" },
  { label: "Store transactions - May", value: "P22,180" },
  { label: "Transaction fees earned", value: "P1,173", tone: "green" as const },
];

export const recentPayments = [
  ["Today 7:42 AM", "Maria Cruz", "Tuition", "P3,500", "XMETA wallet", "Paid"],
  ["Today 7:31 AM", "Rosa Cruz", "Allowance", "P500", "GCash", "Done"],
  ["Yesterday", "Ben Torres", "Tuition", "P1,500", "Cash", "Partial"],
  ["May 17", "Lea Flores", "Other fee", "P350", "Maya", "Paid"],
];

export const activityFeed = [
  { title: "41 payment reminders sent", detail: "Automated SMS + email via XMETA", time: "Today 7:00 AM", tone: "orange" as const },
  { title: "7 allowance wallets below P50", detail: "Parents notified automatically", time: "Today 6:45 AM", tone: "green" as const },
  { title: "May collection report exported", detail: "Finance office downloaded CSV", time: "Yesterday 4:12 PM", tone: "gray" as const },
];

export const tuitionKpis: Kpi[] = [
  { label: "Billed - June", value: "P826,000", note: "244 enrolled students", tone: "orange", icon: Calculator },
  { label: "Collected", value: "P682,500", note: "82.6% collection rate", tone: "green", noteTone: "up", icon: CreditCard },
  { label: "Outstanding", value: "P143,500", note: "41 unpaid or partial", tone: "red", noteTone: "danger", icon: Activity },
  { label: "Due this week", value: "P54,000", note: "15 students", tone: "blue", icon: Clock },
];

export const tuitionRows = [
  { name: "Juan Santos", grade: "Grade 7", section: "Section A", due: 3500, paid: 3500, last: "May 15", status: "paid" },
  { name: "Maria Cruz", grade: "Grade 4", section: "Section B", due: 3500, paid: 3500, last: "May 15", status: "paid" },
  { name: "Carlo Reyes", grade: "Grade 8", section: "Section A", due: 3500, paid: 3500, last: "May 19", status: "paid" },
  { name: "Ana Gonzalez", grade: "Grade 6", section: "Section C", due: 3500, paid: 3500, last: "May 18", status: "paid" },
  { name: "Lea Flores", grade: "Grade 5", section: "Section A", due: 3500, paid: 3500, last: "May 17", status: "paid" },
  { name: "Ben Torres", grade: "Grade 9", section: "Section B", due: 3500, paid: 1500, last: "May 18", status: "partial" },
  { name: "Rosa Mendoza", grade: "Grade 7", section: "Section A", due: 3500, paid: 2000, last: "May 16", status: "partial" },
  { name: "Linda Garcia", grade: "Grade 5", section: "Section C", due: 3500, paid: 1000, last: "May 14", status: "partial" },
  { name: "Miguel Tan", grade: "Grade 7", section: "Section B", due: 3500, paid: 0, last: "None", status: "unpaid" },
  { name: "Jose Bautista", grade: "Grade 8", section: "Section A", due: 3500, paid: 0, last: "None", status: "unpaid" },
  { name: "Clara Lim", grade: "Grade 9", section: "Section B", due: 3500, paid: 0, last: "None", status: "unpaid" },
  { name: "Pedro Santos", grade: "Grade 4", section: "Section A", due: 3500, paid: 0, last: "None", status: "unpaid" },
];

export const outstandingByGrade = [
  { label: "Grade 7", value: "P38,500", percent: 88 },
  { label: "Grade 8", value: "P31,500", percent: 72 },
  { label: "Grade 9", value: "P28,000", percent: 64 },
  { label: "Grade 5", value: "P21,000", percent: 48 },
  { label: "Grade 4", value: "P14,000", percent: 32 },
  { label: "Grade 6", value: "P10,500", percent: 24 },
];

export const otherFeeSummary = [
  ["Books", "P82,000", "P74,200", "90.5%"],
  ["Uniform", "P48,000", "P41,000", "85.4%"],
  ["PTA contribution", "P24,400", "P18,700", "76.6%"],
  ["ID replacement", "P3,200", "P2,800", "87.5%"],
];

export const collectionsKpis: Kpi[] = [
  { label: "Payments today", value: "32", note: "P64,250 collected", tone: "orange", icon: CreditCard },
  { label: "Online channels", value: "94%", note: "GCash, Maya, card", tone: "green", icon: Send },
  { label: "Manual records", value: "5", note: "Cash encoded by admin", tone: "blue", icon: FileText },
  { label: "Pending review", value: "2", note: "Need receipt matching", tone: "red", noteTone: "warn", icon: Activity },
];

export const collectionsRows = [
  ["TXN-4921", "Maria Santos", "Grade 7", "June tuition", "P3,500", "Today 7:42 AM", "XMETA wallet", "Paid"],
  ["TXN-4919", "Rosa Cruz", "Grade 4", "Allowance top-up", "P500", "Today 7:31 AM", "GCash", "Done"],
  ["TXN-4906", "Ben Torres", "Grade 9", "June tuition", "P1,500", "Yesterday", "Cash", "Partial"],
  ["TXN-4898", "Lea Flores", "Grade 5", "Books", "P350", "May 17", "Maya", "Paid"],
  ["TXN-4885", "Ana Gonzalez", "Grade 6", "Uniform", "P950", "May 17", "Card", "Paid"],
];

export const otherFeesKpis: Kpi[] = [
  { label: "Active fee types", value: "8", note: "SY 2025-2026", tone: "orange", icon: ClipboardList },
  { label: "Billed total", value: "P157,600", note: "Non-tuition items", tone: "blue", icon: Calculator },
  { label: "Collected", value: "P136,700", note: "86.7% collection rate", tone: "green", noteTone: "up", icon: CreditCard },
  { label: "Open balance", value: "P20,900", note: "For follow-up", tone: "red", noteTone: "danger", icon: Activity },
];

export const feeItems = [
  { name: "Books and modules", desc: "Required learning materials", amount: "P1,200", status: "Active", collected: "P74,200", icon: FileText },
  { name: "Uniform set", desc: "PE and daily uniform", amount: "P950", status: "Active", collected: "P41,000", icon: UserCheck },
  { name: "PTA contribution", desc: "Annual family contribution", amount: "P200", status: "Active", collected: "P18,700", icon: Users },
  { name: "ID replacement", desc: "Lost or damaged school ID", amount: "P150", status: "Open", collected: "P2,800", icon: IdCard },
];

export const studentsKpis: Kpi[] = [
  { label: "Total enrolled", value: "244", note: "+12 from last SY", tone: "orange", noteTone: "up", icon: Users },
  { label: "Active accounts", value: "238", note: "97.5% active", tone: "green", noteTone: "up", icon: UserCheck },
  { label: "Linked parents", value: "218", note: "26 need invites", tone: "blue", icon: Users },
  { label: "Unpaid tuition", value: "41", note: "Require follow-up", tone: "red", noteTone: "danger", icon: Receipt },
];

export const studentRows = [
  { id: "BWA-001", name: "Juan Santos", grade: "Grade 7", section: "A", parent: "Maria Santos", contact: "0917-234-5678", wallet: "P320", tuition: "paid", status: "enrolled" },
  { id: "BWA-002", name: "Maria Cruz", grade: "Grade 4", section: "B", parent: "Rosa Cruz", contact: "0918-345-6789", wallet: "P640", tuition: "paid", status: "enrolled" },
  { id: "BWA-003", name: "Carlo Reyes", grade: "Grade 8", section: "A", parent: "Pedro Reyes", contact: "0919-456-7890", wallet: "P0", tuition: "paid", status: "enrolled" },
  { id: "BWA-004", name: "Miguel Tan", grade: "Grade 7", section: "B", parent: "Linda Tan", contact: "0920-567-8901", wallet: "P45", tuition: "unpaid", status: "enrolled" },
  { id: "BWA-005", name: "Lea Flores", grade: "Grade 5", section: "A", parent: "Nena Flores", contact: "0922-789-0123", wallet: "P280", tuition: "paid", status: "enrolled" },
  { id: "BWA-006", name: "Ben Torres", grade: "Grade 9", section: "B", parent: "Jun Torres", contact: "0921-678-9012", wallet: "P30", tuition: "partial", status: "enrolled" },
  { id: "BWA-007", name: "Rosa Mendoza", grade: "Grade 7", section: "A", parent: "Carla Mendoza", contact: "0923-890-1234", wallet: "P0", tuition: "partial", status: "inactive" },
  { id: "BWA-008", name: "Ana Gonzalez", grade: "Grade 6", section: "C", parent: "Not linked", contact: "Not on file", wallet: "P180", tuition: "paid", status: "enrolled" },
];

export const parentKpis: Kpi[] = [
  { label: "Registered parents", value: "218", note: "Linked to students", tone: "orange", icon: Users },
  { label: "Active wallets", value: "204", note: "93.5% active", tone: "green", noteTone: "up", icon: Wallet },
  { label: "Pending invites", value: "26", note: "Need follow-up", tone: "blue", icon: Send },
  { label: "Missing contact", value: "8", note: "Registrar queue", tone: "red", noteTone: "warn", icon: Activity },
];

export const parentRows = [
  ["Maria Santos", "Juan Santos, Maria Jr.", "Grade 7 / 4", "0917-234-5678", "maria@email.com", "P470", "Active"],
  ["Rosa Cruz", "Maria Cruz", "Grade 4", "0918-345-6789", "rosa@email.com", "P640", "Active"],
  ["Pedro Reyes", "Carlo Reyes", "Grade 8", "0919-456-7890", "pedro@email.com", "P0", "No balance"],
  ["Linda Tan", "Miguel Tan", "Grade 7", "0920-567-8901", "linda@email.com", "P45", "Low"],
  ["Jun Torres", "Ben Torres", "Grade 9", "0921-678-9012", "jun@email.com", "P30", "Low"],
];

export const allowanceKpis: Kpi[] = [
  { label: "Wallet balance total", value: "P78,420", note: "Across active students", tone: "orange", icon: Wallet },
  { label: "Top-ups today", value: "P4,200", note: "21 transactions", tone: "green", icon: CreditCard },
  { label: "Low balances", value: "7", note: "Below P50", tone: "red", noteTone: "warn", icon: Activity },
  { label: "Monthly spend", value: "P22,180", note: "Canteen and store", tone: "blue", icon: Store },
];

export const allowanceRows = [
  ["Juan Santos", "Grade 7", "P320.00", "Today", "P680", "P1,000", "Active"],
  ["Maria Santos Jr.", "Grade 4", "P150.00", "Yesterday", "P420", "P800", "Active"],
  ["Rosa Cruz", "Grade 4", "P640.00", "Today", "P860", "P1,500", "Active"],
  ["Carlo Reyes", "Grade 8", "P0.00", "May 17", "P220", "P500", "No balance"],
  ["Miguel Tan", "Grade 7", "P45.00", "May 16", "P540", "P1,200", "Low"],
  ["Lea Flores", "Grade 5", "P280.00", "May 18", "P390", "P900", "Active"],
  ["Ben Torres", "Grade 9", "P30.00", "May 15", "P710", "P1,800", "Low"],
];

export const storeKpis: Kpi[] = [
  { label: "Transactions today", value: "47", note: "P1,840 total", tone: "orange", noteTone: "up", icon: Store },
  { label: "This month", value: "P22,180", note: "924 transactions", tone: "green", icon: CreditCard },
  { label: "Avg spend per visit", value: "P91", note: "per student", tone: "blue", icon: Calculator },
  { label: "Transaction fees", value: "P333", note: "1.5% per transaction", tone: "teal", noteTone: "up", icon: ChartNoAxesColumnIncreasing },
];

export const spendByGrade = [
  { label: "Grade 7", value: "P5,460", percent: 88 },
  { label: "Grade 8", value: "P4,610", percent: 74 },
  { label: "Grade 9", value: "P3,840", percent: 62 },
  { label: "Grade 4", value: "P3,220", percent: 52 },
  { label: "Grade 5", value: "P2,610", percent: 42 },
  { label: "Grade 6", value: "P2,200", percent: 36 },
];

export const peakHours = [
  { label: "7-8 AM", value: "5 txns", percent: 28 },
  { label: "8-9 AM", value: "9 txns", percent: 50 },
  { label: "10-11 AM", value: "18 txns", percent: 100 },
  { label: "12-1 PM", value: "14 txns", percent: 78 },
  { label: "2-3 PM", value: "1 txn", percent: 6 },
];

export const storeRows = [
  ["STR-4821", "Juan Santos", "Grade 7", "Canteen", "P85.00", "P1.28", "10:24 AM"],
  ["STR-4820", "Ana Gonzalez", "Grade 6", "Canteen", "P120.00", "P1.80", "10:12 AM"],
  ["STR-4819", "Rosa Cruz", "Grade 4", "School store", "P65.00", "P0.98", "9:48 AM"],
  ["STR-4818", "Lea Flores", "Grade 5", "Canteen", "P95.00", "P1.43", "9:30 AM"],
  ["STR-4817", "Carlo Reyes", "Grade 8", "Canteen", "P150.00", "P2.25", "8:55 AM"],
];

export const reportKpis: Kpi[] = [
  { label: "Total revenue - May", value: "P743,253", note: "vs P698K April", tone: "orange", noteTone: "up", icon: Calculator },
  { label: "Collection efficiency", value: "87.2%", note: "+3.1% vs last month", tone: "green", noteTone: "up", icon: BarChart3 },
  { label: "Total txn fees earned", value: "P1,173", note: "from XMETA system", tone: "blue", icon: CreditCard },
  { label: "Digital payment rate", value: "94%", note: "vs 68% last SY", tone: "teal", noteTone: "up", icon: Send },
];

export const monthlyRevenue = [
  { label: "January", value: "P594K", percent: 72 },
  { label: "February", value: "P561K", percent: 68 },
  { label: "March", value: "P660K", percent: 80 },
  { label: "April", value: "P700K", percent: 85 },
  { label: "May", value: "P743K", percent: 90 },
  { label: "June", value: "P453K", percent: 55, tone: "blue" as const },
];

export const downloadableReports = [
  { name: "Monthly collection report - May 2025", desc: "All payments by student and fee type", format: "CSV", icon: FileSpreadsheet },
  { name: "Unpaid accounts - Jun 2025", desc: "41 students with outstanding tuition", format: "PDF", icon: FileText },
  { name: "Allowance ledger - May 2025", desc: "All top-ups and student spending", format: "CSV", icon: Wallet },
  { name: "Canteen and store report - May 2025", desc: "Store transactions and peak hours", format: "CSV", icon: Building2 },
  { name: "Student and parent directory", desc: "Full registry with contact details", format: "CSV", icon: Users },
  { name: "Annual financial summary SY 2025-26", desc: "Year-to-date collection vs billing", format: "PDF", icon: BarChart3 },
];

export const profileTransactions = [
  ["May 19", "June tuition", "P3,500", "XMETA wallet", "Paid"],
  ["May 18", "Allowance top-up", "P500", "GCash", "Done"],
  ["May 16", "Canteen purchase", "P85", "Wallet", "Complete"],
  ["May 14", "Books and modules", "P350", "Maya", "Paid"],
];

export const profileFeeStatus = [
  { label: "June tuition", value: "Paid", tone: "green" as const },
  { label: "Books and modules", value: "Paid", tone: "green" as const },
  { label: "PTA contribution", value: "Open", tone: "orange" as const },
  { label: "Outstanding balance", value: "P0", tone: "default" as const },
];
