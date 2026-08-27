"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { Clock3, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X } from "lucide-react";

import { BrandLogo } from "@/app/_components/brand-logo";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { FlashToast } from "@/app/_components/flash-toast";
import { superAdminLogoutAction } from "@/app/super-admin/actions";
import type { AuthFlashToast } from "@/lib/auth/session";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type SuperAdminShellProps = {
  children: ReactNode;
  pendingApprovals: number;
  sessionName: string;
  toast: AuthFlashToast | null;
};

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/super-admin/dashboard": {
    title: "Super admin dashboard",
    subtitle: "Monitor schools and manage school admin access.",
  },
  "/super-admin/admin-accounts": {
    title: "School admin accounts",
    subtitle: "Enable, disable, and review school admin access.",
  },
  "/super-admin/registrations": {
    title: "Admin registrations",
    subtitle: "Approve or reject pending school admin accounts.",
  },
};

const schoolProfileMeta = {
  title: "School profile",
  subtitle: "Review aggregate school population and enrollment context.",
};

export function SuperAdminShell({
  children,
  pendingApprovals,
  sessionName,
  toast,
}: SuperAdminShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isSchoolProfile = pathname.startsWith("/super-admin/schools/");
  const meta = isSchoolProfile
    ? schoolProfileMeta
    : pageMeta[pathname] ?? pageMeta["/super-admin/dashboard"];
  const initials = initialsFor(sessionName);
  const navItems = [
    {
      href: "/super-admin/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/super-admin/admin-accounts",
      label: "School admin accounts",
      icon: Users,
    },
    {
      href: "/super-admin/registrations",
      label: "Admin registrations",
      icon: Clock3,
      badge: pendingApprovals > 0 ? pendingApprovals.toLocaleString() : undefined,
    },
  ];

  return (
    <div className="dashboard-theme min-h-[100svh] overflow-x-hidden">
      <FlashToast toast={toast} />

      {!sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-3 top-3 z-[120] flex size-11 items-center justify-center rounded-lg bg-[#e64a19] text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/30 lg:hidden"
          aria-label="Open company menu"
          aria-controls="super-admin-sidebar"
          aria-expanded={sidebarOpen}
        >
          <Menu className="size-4.5" />
        </button>
      ) : null}

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[90] bg-[#0f1117]/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close company menu overlay"
        />
      ) : null}

      <aside
        className={cn(
          "dashboard-sidebar fixed inset-y-0 left-0 z-[100] flex w-60 max-w-[calc(100vw-24px)] flex-col overflow-y-auto overscroll-contain border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        id="super-admin-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Company navigation"
      >
        <div className="shrink-0 border-b border-sidebar-border px-4 pb-3 pt-4">
          <div className="mb-1.5 flex items-center gap-2.5">
            <BrandLogo size="compact" />
            <span className="min-w-0 truncate text-sm font-bold tracking-[-0.02em]">{PRODUCT_NAME}</span>
          </div>
          <div className="space-y-0.5 text-[10.5px] leading-4 text-sidebar-foreground/55">
            <div className="truncate">Company monitoring</div>
            <div className="truncate">Super admin workspace</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 border-b border-sidebar-border bg-sidebar-accent px-4 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e64a19] text-[11px] font-bold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-sidebar-foreground">{sessionName}</div>
            <div className="truncate text-[10px] text-sidebar-foreground/55">Company super admin</div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/65 transition hover:bg-sidebar-primary hover:text-sidebar-primary-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/30 lg:hidden"
            aria-label="Close company menu"
            aria-controls="super-admin-sidebar"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 px-2.5 py-2">
          <div className="px-2 pb-1 pt-2.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/45">
            Company
          </div>
          <div className="grid gap-0.5">
            {navItems.map((item) => {
              const active = pathname === item.href
                || (pathname === "/super-admin" && item.href === "/super-admin/dashboard")
                || (isSchoolProfile && item.href === "/super-admin/admin-accounts");
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/30",
                    active && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="shrink-0 rounded-full bg-[#c62828] px-1.5 text-[9.5px] font-bold leading-4 text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="mt-auto grid shrink-0 gap-2 border-t border-sidebar-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[11.5px] text-sidebar-foreground/50">
            <ShieldCheck className="size-[15px] shrink-0" />
            <span className="truncate">Company access</span>
          </div>
          <form action={superAdminLogoutAction}>
            <button
              type="submit"
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/30"
            >
              <LogOut className="size-4 shrink-0" />
              <span className="truncate">Log out</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="min-h-[100svh] min-w-0 max-w-full lg:pl-60">
        <header className="sticky top-0 z-50 flex min-w-0 max-w-full flex-col gap-3 border-b border-black/[0.07] bg-white px-4 py-3 pl-16 md:flex-row md:items-center md:justify-between lg:px-6 lg:pl-6">
          <div className="min-w-0 max-w-full">
            <h1 className="text-base font-bold leading-6 text-[#0f1117]">{meta.title}</h1>
            <p className="mt-0.5 text-[11.5px] leading-5 text-[#5a6070]">{meta.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] px-3 py-2 text-[12px] font-semibold text-[#5a6070]">
              Signed in as <span className="text-[#0f1117]">{sessionName}</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="min-w-0 max-w-full px-4 py-5 sm:py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "SA";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
