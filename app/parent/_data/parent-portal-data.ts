import {
  CreditCard,
  History,
  Home,
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
  activePaths?: Array<{
    path: string;
    match?: "exact" | "prefix" | "descendant";
  }>;
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
    title: "School fees & statements",
    subtitle: "Review tuition statements, due dates, payments, and other assigned fees",
  },
  "/parent/pay-tuition": {
    title: "Make a payment",
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
    title: "Allowance wallet",
    subtitle: "Manage student allowance balances",
  },
};

export const parentNavSections: ParentNavSection[] = [
  {
    label: "Overview",
    items: [{
      label: "Dashboard",
      href: "/parent/dashboard",
      icon: Home,
      activePaths: [
        { path: "/parent" },
        { path: "/parent/dashboard" },
      ],
    }],
  },
  {
    label: "Enrollment",
    items: [
      {
        label: "My students",
        href: "/parent/students",
        icon: Users,
        activePaths: [
          { path: "/parent/students", match: "prefix" },
          { path: "/parent/student-profile", match: "prefix" },
        ],
      },
    ],
  },
  {
    label: "Payments",
    items: [
      { label: "School fees", href: "/parent/fees", icon: Receipt },
      { label: "Make a payment", href: "/parent/pay-tuition", icon: CreditCard },
      {
        label: "Payment history",
        href: "/parent/history",
        icon: History,
        activePaths: [
          { path: "/parent/history" },
          { path: "/parent/receipt" },
        ],
      },
    ],
  },
  {
    label: "Allowance",
    items: [{
      label: "Allowance wallet",
      href: "/parent/wallet",
      icon: Wallet,
      activePaths: [{ path: "/parent/wallet", match: "prefix" }],
    }],
  },
];

export const settingsIcon = Settings;

export function isParentNavItemActive(pathname: string, item: ParentNavItem) {
  const activePaths = item.activePaths ?? [{ path: item.href, match: "exact" as const }];

  return activePaths.some(({ path, match = "exact" }) => (
    match === "prefix"
      ? pathname === path || pathname.startsWith(`${path}/`)
      : match === "descendant"
        ? pathname.startsWith(`${path}/`)
        : pathname === path
  ));
}
