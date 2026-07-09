import { Building2, LogOut, ShieldCheck, Users, UserX } from "lucide-react";
import type { ReactNode } from "react";

import { FlashToast } from "@/app/_components/flash-toast";
import { superAdminLogoutAction } from "@/app/super-admin/actions";
import { consumeAuthFlashToast, requireSuperAdmin } from "@/lib/auth/session";
import { getSuperAdminDashboardData } from "@/lib/super-admin/records";
import { SuperAdminAdminsTable } from "./super-admin-admins-table";

export default async function SuperAdminDashboardPage() {
  const session = await requireSuperAdmin();
  const [data, toast] = await Promise.all([
    getSuperAdminDashboardData(),
    consumeAuthFlashToast("super_admin"),
  ]);

  return (
    <main className="min-h-[100svh] overflow-x-hidden bg-[#f7f8fa] text-[#0f1117]">
      <FlashToast toast={toast} />
      <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e64a19] text-sm font-bold text-white">
                XP
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#0f1117]">XMETA Pay</p>
                <p className="truncate text-[11.5px] font-medium text-[#5a6070]">Company monitoring</p>
              </div>
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">Super admin dashboard</h1>
            <p className="mt-1 text-sm leading-6 text-[#5a6070]">
              Monitor schools and manage school admin access.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] px-3 py-2 text-[12px] font-semibold text-[#5a6070]">
              Signed in as <span className="text-[#0f1117]">{session.name}</span>
            </div>
            <form action={superAdminLogoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-white px-3.5 text-[12.5px] font-semibold text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 sm:w-auto"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SuperAdminKpiCard
            label="Schools"
            value={data.stats.schools}
            note="Configured school records"
            icon={<Building2 className="size-[22px] text-[#0f1117]/10" />}
            tone="blue"
          />
          <SuperAdminKpiCard
            label="School admins"
            value={data.stats.adminAccounts}
            note="Across all schools"
            icon={<Users className="size-[22px] text-[#0f1117]/10" />}
            tone="orange"
          />
          <SuperAdminKpiCard
            label="Active admins"
            value={data.stats.activeAdmins}
            note="Can sign in"
            icon={<ShieldCheck className="size-[22px] text-[#0f1117]/10" />}
            tone="green"
          />
          <SuperAdminKpiCard
            label="Disabled admins"
            value={data.stats.disabledAdmins}
            note="Access currently blocked"
            icon={<UserX className="size-[22px] text-[#0f1117]/10" />}
            tone="red"
          />
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
            <div className="border-b border-black/[0.07] px-[18px] py-3.5">
              <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">School admin accounts</h2>
              <p className="mt-0.5 text-[11.5px] leading-5 text-[#5a6070]">
                Disable or enable school admin access without changing school data.
              </p>
            </div>
            <SuperAdminAdminsTable rows={data.adminRows} />
          </section>

          <div className="grid gap-5">
            <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
              <div className="border-b border-black/[0.07] px-[18px] py-3.5">
                <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">Schools overview</h2>
              </div>
              <div className="divide-y divide-black/[0.07]">
                {data.schoolRows.length > 0 ? data.schoolRows.slice(0, 8).map((school) => (
                  <div key={school.id} className="px-[18px] py-3 text-[12.5px] leading-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#0f1117]">{school.name}</p>
                        <p className="truncate text-[11.5px] text-[#5a6070]">{school.code} - {school.activeYear}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-[10.5px] font-bold leading-5 text-[#2e7d32]">
                        {school.status}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px] text-[#5a6070]">
                      <span>{school.adminCount} admins</span>
                      <span>{school.studentCount} students</span>
                      <span>{school.parentCount} parents</span>
                    </div>
                  </div>
                )) : (
                  <div className="px-[18px] py-8 text-center text-[12.5px] text-[#5a6070]">
                    No school records yet.
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
              <div className="border-b border-black/[0.07] px-[18px] py-3.5">
                <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">Recent school admins</h2>
              </div>
              <div className="divide-y divide-black/[0.07]">
                {data.recentAdmins.length > 0 ? data.recentAdmins.map((admin) => (
                  <div key={admin.id} className="px-[18px] py-3 text-[12.5px] leading-5">
                    <p className="font-bold text-[#0f1117]">{admin.name}</p>
                    <p className="text-[11.5px] text-[#5a6070]">{admin.schoolName}</p>
                    <p className="mt-1 font-mono text-[10.5px] text-[#9ba3b8]">{admin.createdAt}</p>
                  </div>
                )) : (
                  <div className="px-[18px] py-8 text-center text-[12.5px] text-[#5a6070]">
                    No school admin accounts yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function SuperAdminKpiCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactNode;
  tone: "orange" | "green" | "red" | "blue";
}) {
  const toneClass = {
    orange: "before:bg-[#e64a19]",
    green: "before:bg-[#43a047]",
    red: "before:bg-[#c62828]",
    blue: "before:bg-[#1565c0]",
  };

  return (
    <section className={`relative overflow-hidden rounded-xl border border-black/[0.07] bg-white px-4 py-4 before:absolute before:inset-x-0 before:top-0 before:h-[3px] sm:px-[18px] ${toneClass[tone]}`}>
      <div className="absolute right-3.5 top-3.5">{icon}</div>
      <div className="mb-1.5 pr-8 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#9ba3b8]">
        {label}
      </div>
      <div className="mb-1 text-2xl font-bold leading-tight text-[#0f1117]">
        {value.toLocaleString()}
      </div>
      <div className="text-[11.5px] leading-5 text-[#5a6070]">{note}</div>
    </section>
  );
}
