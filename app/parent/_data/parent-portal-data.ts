import {
  CreditCard,
  History,
  Home,
  IdCard,
  Receipt,
  Settings,
  Users,
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
  "/parent/students": {
    title: "My students",
    subtitle: "Manage linked student records",
  },
  "/parent/fees": {
    title: "Fee summary",
    subtitle: "Assigned balances from school records",
  },
  "/parent/pay-tuition": {
    title: "Pay tuition & fees",
    subtitle: "Pay assigned balances for one student at a time",
  },
  "/parent/receipt": {
    title: "Payment complete",
    subtitle: "Database-backed payment receipt",
  },
  "/parent/history": {
    title: "Payment history",
    subtitle: "Recorded school fee payments",
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
    items: [
      { label: "My students", href: "/parent/students", icon: Users },
      { label: "Student profile", href: "/parent/student-profile", icon: IdCard },
    ],
  },
  {
    label: "Payments",
    items: [
      { label: "Fee summary", href: "/parent/fees", icon: Receipt },
      { label: "Pay tuition", href: "/parent/pay-tuition", icon: CreditCard },
      { label: "Payment history", href: "/parent/history", icon: History },
    ],
  },
  {
    label: "Allowance",
    items: [{ label: "Wallet & top-up", href: "/parent/wallet", icon: Wallet }],
  },
];

export const settingsIcon = Settings;
