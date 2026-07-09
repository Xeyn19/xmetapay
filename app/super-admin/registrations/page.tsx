import Link from "next/link";
import { ArrowLeft, Clock3, LogOut } from "lucide-react";

import { FlashToast } from "@/app/_components/flash-toast";
import { superAdminLogoutAction } from "@/app/super-admin/actions";
import { consumeAuthFlashToast, requireSuperAdmin } from "@/lib/auth/session";
import { getSuperAdminDashboardData } from "@/lib/super-admin/records";
import { SuperAdminRegistrationsTable } from "./super-admin-registrations-table";

export default async function SuperAdminRegistrationsPage() {
  const session = await requireSuperAdmin();
  const [data, toast] = await Promise.all([
    getSuperAdminDashboardData(),
    consumeAuthFlashToast("super_admin"),
  ]);
  const pendingRows = data.adminRows.filter((row) => row.status === "pending");

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
            <h1 className="mt-4 flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <Clock3 className="size-5 text-[#e64a19]" />
              Admin registrations
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5a6070]">
              Review new school admin accounts before they can sign in or start school setup.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/super-admin/dashboard"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-white px-3.5 text-[12.5px] font-semibold text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
            >
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
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
        <section className="mb-5 rounded-xl border border-[#f6c6ba] bg-[#fff4f0] px-4 py-3 text-[12.5px] leading-5 text-[#8a321a]">
          Pending admin accounts cannot log in. Approving an account makes it active; rejecting it disables the account without deleting the registration record.
        </section>

        <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
          <div className="border-b border-black/[0.07] px-[18px] py-3.5">
            <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">Pending school admin registrations</h2>
            <p className="mt-0.5 text-[11.5px] leading-5 text-[#5a6070]">
              Review account owner details, school name, and contact information before approval.
            </p>
          </div>
          <SuperAdminRegistrationsTable rows={pendingRows} />
        </section>
      </div>
    </main>
  );
}
