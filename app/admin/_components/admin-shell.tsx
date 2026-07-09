"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Database,
  Menu,
  LogOut,
  Plus,
  ReceiptText,
  Send,
  Settings,
  UserPlus,
  X,
} from "lucide-react";

import { logoutAction } from "@/app/auth/actions";
import { selectAdminSchoolYearAction } from "@/app/admin/school-year/actions";
import { AdminButton } from "./admin-ui";
import { navSections, pageMeta } from "../_data/admin-dashboard-data";
import {
  canManageSchoolSetup,
  canUseAdminHeaderAction,
  filterAdminNavSectionsForStaffRole,
} from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";
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
  const selectedStudentProfilePath = /^\/admin\/students\/\d+$/.test(pathname);
  const meta = selectedStudentProfilePath
    ? pageMeta["/admin/student-profile"]
    : pageMeta[pathname] ?? pageMeta["/admin/dashboard"];
  const subtitle = dashboardSubtitle(meta.subtitle, schoolContext);
  const schoolYear = schoolContext.selectedSchoolYear?.name
    ?? schoolContext.activeSchoolYear?.name
    ?? "School year pending";
  const redirectTo = `${pathname}${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`;
  const setupIncomplete = !schoolContext.schoolId
    || !schoolContext.databaseReady
    || !schoolContext.activeSchoolYear
    || schoolContext.gradeLevelCount === 0
    || schoolContext.sectionCount === 0;
  const visibleNavSections = filterAdminNavSectionsForStaffRole(navSections, schoolContext.staffRole);
  const canManageSetup = canManageSchoolSetup(schoolContext.staffRole);
  const canAddStudents = canUseAdminHeaderAction(schoolContext.staffRole, "add_student");
  const canRecordPayments = canUseAdminHeaderAction(schoolContext.staffRole, "record_payment");
  const canSendReminders = canUseAdminHeaderAction(schoolContext.staffRole, "send_reminder");
  const logout = logoutAction.bind(null, "admin");
  const duplicateYearNames = duplicateSchoolYearNames(schoolContext.schoolYears);

  return (
    <div className="min-h-[100svh] overflow-x-hidden bg-[#f7f8fa] text-[#0f1117]">
      {!sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-3 top-3 z-[120] flex size-11 items-center justify-center rounded-lg bg-[#e64a19] text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/30 lg:hidden"
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
          className="fixed inset-0 z-[90] bg-[#0f1117]/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close admin menu overlay"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[100] flex w-60 max-w-[calc(100vw-24px)] flex-col overflow-y-auto overscroll-contain bg-[#0f1117] text-white transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        id="admin-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
      >
        <div className="shrink-0 border-b border-white/[0.07] px-4 pb-3 pt-4">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-[#e64a19]">
              <ReceiptText className="size-[17px]" />
            </span>
            <span className="min-w-0 truncate text-sm font-bold tracking-[-0.02em]">XMETA Pay</span>
          </div>
          <div className="space-y-0.5 text-[10.5px] leading-4 text-white/40">
            <div className="truncate">{schoolContext.schoolName}</div>
            <div className="truncate">Admin dashboard - {schoolYear}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.07] bg-white/[0.04] px-4 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e64a19] text-[11px] font-bold">
            {schoolContext.adminInitials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-white/90">{schoolContext.adminName}</div>
            <div className="truncate text-[10px] text-white/40">{schoolContext.staffRoleLabel}</div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-white/55 transition hover:bg-white/10 focus:outline-none focus-visible:ring-3 focus-visible:ring-white/20 lg:hidden"
            aria-label="Close admin menu"
            aria-controls="admin-sidebar"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 px-2.5 py-2">
          {visibleNavSections.map((section) => (
            <div key={section.label}>
              <div className="px-2 pb-1 pt-2.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white/25">
                {section.label}
              </div>
              <div className="grid gap-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href
                    || (pathname === "/admin" && item.href === "/admin/dashboard")
                    || (selectedStudentProfilePath && item.href === "/admin/student-profile");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-white/55 transition hover:bg-white/[0.07] hover:text-white/90 focus:outline-none focus-visible:ring-3 focus-visible:ring-white/20",
                        active && "bg-[#e64a19] text-white hover:bg-[#e64a19] hover:text-white"
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

        <div className="mt-auto grid shrink-0 gap-2 border-t border-white/[0.07] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[11.5px] text-white/35">
            <Settings className="size-[15px] shrink-0" />
            <span className="truncate">Settings & configuration</span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-white/55 transition hover:bg-white/[0.07] hover:text-white/90 focus:outline-none focus-visible:ring-3 focus-visible:ring-white/20"
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
            <p className="mt-0.5 text-[11.5px] leading-5 text-[#5a6070]">{subtitle}</p>
            {!schoolContext.databaseReady && schoolContext.warning ? (
              <p className="mt-0.5 text-[11px] leading-4 text-[#f57c00]">{schoolContext.warning}</p>
            ) : null}
            {setupIncomplete ? (
              <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[#f57c00]/20 bg-[#fff7ed] px-3 py-2 min-[520px]:flex-row min-[520px]:items-center">
                <p className="min-w-0 flex-1 text-[11.5px] leading-5 text-[#8a4b00]">
                  {canManageSetup
                    ? (schoolContext.warning ?? "Set up real school records before using database-backed admin pages.")
                    : "Ask a school administrator to complete school setup first."}
                </p>
                {canManageSetup ? (
                  <Link
                    href="/admin/school-setup"
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#e64a19] bg-[#e64a19] px-3 text-[12px] font-semibold text-white transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                  >
                    <Database className="size-4" />
                    Set up school records
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex w-full min-w-0 max-w-full flex-col gap-2 md:w-auto md:items-end">
            {schoolContext.schoolYears.length > 0 ? (
              <form action={selectAdminSchoolYearAction} className="w-full md:w-[260px]">
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <label className="sr-only" htmlFor="admin-school-year-selector">School year</label>
                <select
                  id="admin-school-year-selector"
                  name="schoolYearId"
                  defaultValue={schoolContext.selectedSchoolYear?.id ?? schoolContext.activeSchoolYear?.id ?? ""}
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                  className="min-h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-[12.5px] font-semibold text-[#303443] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/15"
                  title="Choose school year to view"
                >
                  {schoolContext.schoolYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {schoolYearOptionLabel(year, duplicateYearNames)}
                    </option>
                  ))}
                </select>
              </form>
            ) : null}
            {!schoolContext.selectedSchoolYearIsActive && schoolContext.selectedSchoolYear ? (
              <p className="max-w-[260px] text-[10.5px] leading-4 text-[#8a4b00]">
                Viewing {schoolContext.selectedSchoolYear.status} year. New records stay in the active year.
              </p>
            ) : null}
            <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-2 min-[460px]:grid-cols-3 md:w-auto">
            {canSendReminders ? (
              <Link
                href="/admin/tuition#payment-reminders"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-white px-3.5 text-[12.5px] font-semibold text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
              >
                <Send className="size-4" />
                Reminders
              </Link>
            ) : null}
            {canRecordPayments ? (
              <AdminButton disabled><Plus className="size-4" />Manual payment future</AdminButton>
            ) : null}
            {canAddStudents ? (
              <Link
                href="/admin/students#add-student"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#e64a19] bg-[#e64a19] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
              >
                <UserPlus className="size-4" />
                Add student
              </Link>
            ) : null}
            </div>
          </div>
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

  if (subtitle === "School dashboard - SY 2025-2026") {
    return `${schoolContext.schoolName} - ${schoolYear}`;
  }

  return subtitle.replaceAll("SY 2025-2026", schoolYear);
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
