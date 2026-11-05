"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Database,
  Menu,
  LogOut,
  Send,
  Settings,
  X,
} from "lucide-react";

import { logoutAction } from "@/app/auth/actions";
import { BrandLogo } from "@/app/_components/brand-logo";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { selectAdminSchoolYearAction } from "@/app/admin/school-year/actions";
import { navSections, pageMeta } from "../_data/admin-dashboard-data";
import {
  canManageSchoolSetup,
  canUseAdminHeaderAction,
  filterAdminNavSectionsForStaffRole,
} from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/brand";
import type { AdminSchoolContext } from "@/lib/school/setup";

export function AdminShell({
  children,
  schoolContext,
}: {
  children: React.ReactNode;
  schoolContext: AdminSchoolContext;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const selectedStudentProfilePath = /^\/admin\/students\/\d+$/.test(pathname);
  const meta = resolveAdminPageMeta(pathname);
  const subtitle = dashboardSubtitle(meta.subtitle, schoolContext);
  const schoolYear = schoolContext.selectedSchoolYear?.name
    ?? schoolContext.activeSchoolYear?.name
    ?? "School year pending";
  const redirectTo = `${pathname}${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`;
  const setupIncomplete = !schoolContext.schoolId
    || !schoolContext.databaseReady
    || !schoolContext.activeSchoolYear;
  const visibleNavSections = filterAdminNavSectionsForStaffRole(navSections, schoolContext.staffRole);
  const canManageSetup = canManageSchoolSetup(schoolContext.staffRole);
  const canSendReminders = canUseAdminHeaderAction(schoolContext.staffRole, "send_reminder");
  const logout = logoutAction.bind(null, "admin");
  const duplicateYearNames = duplicateSchoolYearNames(schoolContext.schoolYears);

  useEffect(() => {
    if (!sidebarOpen || window.matchMedia("(min-width: 1024px)").matches) return;

    const sidebar = sidebarRef.current;
    const previousOverflow = document.body.style.overflow;
    const focusable = sidebar?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    document.body.style.overflow = "hidden";
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('[aria-label="Open admin menu"]')?.focus();
      });
    };
  }, [sidebarOpen]);

  return (
    <div className="dashboard-theme min-h-[100svh] overflow-x-hidden">
      {!sidebarOpen ? (
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-3 top-3 z-[120] flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
          aria-label="Open admin menu"
          aria-controls="admin-sidebar"
          aria-expanded={sidebarOpen}
        >
          <Menu className="size-4.5" />
        </button>
      ) : null}

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[90] bg-foreground/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close admin menu overlay"
        />
      ) : null}

      <aside
        ref={sidebarRef}
        className={cn(
          "dashboard-sidebar fixed inset-y-0 left-0 z-[100] flex w-60 max-w-[calc(100vw-24px)] flex-col overflow-y-auto overscroll-contain border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        id="admin-sidebar"
        role={sidebarOpen ? "dialog" : undefined}
        aria-modal={sidebarOpen ? true : undefined}
        aria-label="Admin navigation"
      >
        <div className="shrink-0 border-b border-sidebar-border px-4 pb-3 pt-4">
          <div className="mb-1.5 flex items-center gap-2.5">
            <BrandLogo size="compact" />
            <span className="min-w-0 truncate text-sm font-bold tracking-[-0.02em]">{PRODUCT_NAME}</span>
          </div>
          <div className="space-y-0.5 text-[10.5px] leading-4 text-sidebar-foreground/55">
            <div className="truncate">{schoolContext.schoolName}</div>
            <div className="truncate">Admin dashboard - {schoolYear}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 border-b border-sidebar-border bg-sidebar-accent px-4 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e64a19] text-[11px] font-bold">
            {schoolContext.adminInitials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-sidebar-foreground">{schoolContext.adminName}</div>
            <div className="truncate text-[10px] text-sidebar-foreground/55">{schoolContext.staffRoleLabel}</div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/65 transition hover:bg-sidebar-primary hover:text-sidebar-primary-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/30 lg:hidden"
            aria-label="Close admin menu"
            aria-controls="admin-sidebar"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 px-2.5 py-2">
          {visibleNavSections.map((section) => (
            <div key={section.label}>
              <div className="px-2 pb-1 pt-2.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/45">
                {section.label}
              </div>
              <div className="grid gap-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href
                    || (pathname === "/admin" && item.href === "/admin/dashboard")
                    || (selectedStudentProfilePath && item.href === "/admin/student-profile")
                    || (item.href === "/admin/school-setup" && pathname.startsWith("/admin/school-setup/"));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/30",
                        active && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
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
            </div>
          ))}
        </nav>

        <div className="mt-auto grid shrink-0 gap-2 border-t border-sidebar-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[11.5px] text-sidebar-foreground/50">
            <Settings className="size-[15px] shrink-0" />
            <span className="truncate">Settings & configuration</span>
          </div>
          <form action={logout}>
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
        <header className="sticky top-0 z-50 min-w-0 max-w-full border-b border-border bg-card px-4 py-3 pl-16 text-card-foreground sm:py-3.5 lg:px-6 lg:pl-6">
          <div className="flex min-w-0 max-w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 max-w-full">
              <h1 className="text-base font-bold leading-6 text-foreground">{meta.title}</h1>
              <p className="mt-0.5 text-[11.5px] leading-5 text-muted-foreground">{subtitle}</p>
              {!schoolContext.databaseReady && schoolContext.warning ? (
                <p className="mt-0.5 text-[11px] leading-4 text-status-warning-foreground">{schoolContext.warning}</p>
              ) : null}
              {setupIncomplete ? (
                <div className="mt-2 flex flex-col gap-2 rounded-lg border border-status-warning-foreground/20 bg-status-warning-bg px-3 py-2 min-[520px]:flex-row min-[520px]:items-center">
                  <p className="min-w-0 flex-1 text-[11.5px] leading-5 text-status-warning-foreground">
                    {canManageSetup
                      ? (schoolContext.warning ?? "Set up real school records before using database-backed admin pages.")
                      : "Ask a school administrator to complete school setup first."}
                  </p>
                  {canManageSetup ? (
                    <Link
                      href="/admin/school-setup"
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <Database className="size-4" />
                      Set up school records
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex w-full min-w-0 max-w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end xl:w-auto xl:flex-nowrap xl:justify-end">
              {schoolContext.schoolYears.length > 0 ? (
                <div className="w-full min-w-0 sm:w-[260px]">
                  <form action={selectAdminSchoolYearAction}>
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <label
                      className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground"
                      htmlFor="admin-school-year-selector"
                    >
                      <CalendarDays className="size-3.5 text-primary" />
                      Viewing school year
                    </label>
                    <select
                      id="admin-school-year-selector"
                      name="schoolYearId"
                      defaultValue={schoolContext.selectedSchoolYear?.id ?? schoolContext.activeSchoolYear?.id ?? ""}
                      onChange={(event) => event.currentTarget.form?.requestSubmit()}
                      className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-ring/40"
                      title="Choose school year to view"
                    >
                      {schoolContext.schoolYears.map((year) => (
                        <option key={year.id} value={year.id}>
                          {schoolYearOptionLabel(year, duplicateYearNames)}
                        </option>
                      ))}
                    </select>
                  </form>
                </div>
              ) : null}
              <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end xl:flex-nowrap">
                <ThemeToggle />
                {canSendReminders ? (
                  <Link
                    href="/admin/tuition#payment-reminders"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[12.5px] font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto"
                  >
                    <Send className="size-4" />
                    Reminders
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
          {!schoolContext.selectedSchoolYearIsActive && schoolContext.selectedSchoolYear ? (
            <p className="mt-3 border-t border-status-warning-foreground/15 pt-2 text-[10.5px] leading-4 text-status-warning-foreground">
              Viewing {schoolContext.selectedSchoolYear.status} year. New records stay in the active year.
            </p>
          ) : null}
        </header>

        <main className="min-w-0 max-w-full px-4 py-5 sm:py-6 lg:px-6">{children}</main>
      </div>

    </div>
  );
}

function dashboardSubtitle(subtitle: string, schoolContext: AdminSchoolContext) {
  const schoolYear = schoolContext.selectedSchoolYear?.name
    ?? schoolContext.activeSchoolYear?.name
    ?? "School year pending";

  if (subtitle === "School operations overview") {
    return `${schoolContext.schoolName} - ${schoolYear}`;
  }

  return subtitle.replaceAll("SY 2025-2026", schoolYear);
}

function resolveAdminPageMeta(pathname: string) {
  if (/^\/admin\/students\/\d+$/.test(pathname)) return pageMeta["/admin/student-profile"];
  if (/^\/admin\/school-setup\/years\/\d+$/.test(pathname)) return pageMeta["/admin/school-setup/year-structure"];
  if (/^\/admin\/tuition\/assessments\/[^/]+$/.test(pathname) && pathname !== "/admin/tuition/assessments/new") {
    return pageMeta["/admin/tuition/assessments/result"];
  }
  return pageMeta[pathname] ?? pageMeta["/admin/dashboard"];
}

function schoolYearStatusLabel(status: "upcoming" | "active" | "closed") {
  return status[0].toUpperCase() + status.slice(1);
}

function duplicateSchoolYearNames(years: AdminSchoolContext["schoolYears"]) {
  const counts = new Map<string, number>();

  years.forEach((year) => {
    const key = year.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

function schoolYearOptionLabel(
  year: AdminSchoolContext["schoolYears"][number],
  duplicateNames: Set<string>,
) {
  const status = schoolYearStatusLabel(year.status);
  const label = duplicateNames.has(year.name.toLowerCase())
    ? `${year.name} - ${year.startsOn} to ${year.endsOn}`
    : year.name;

  return `${label} (${status})`;
}
