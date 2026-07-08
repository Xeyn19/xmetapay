import { CheckCircle2, LogOut, ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";

import { FlashToast } from "@/app/_components/flash-toast";
import { logoutAction } from "@/app/auth/actions";
import { ManualSchoolSetupForm } from "@/app/admin/_components/manual-school-setup-form";
import { getAdminStaffRole } from "@/lib/admin/access";
import { canManageSchoolSetup } from "@/lib/admin/permissions";
import { consumeAuthFlashToast, requireRole } from "@/lib/auth/session";
import { getAdminSchoolContext, getAdminSchoolSetupFormData } from "@/lib/school/setup";

export default async function AdminSchoolSetupOnboardingPage() {
  const session = await requireRole("admin");
  const [staffRole, schoolContext, initialData, toast] = await Promise.all([
    getAdminStaffRole(session.userId),
    getAdminSchoolContext(session.userId),
    getAdminSchoolSetupFormData(session.userId),
    consumeAuthFlashToast("admin"),
  ]);

  if (!canManageSchoolSetup(staffRole)) {
    redirect("/admin/dashboard");
  }

  if (schoolContext.databaseReady) {
    redirect("/admin/dashboard");
  }

  const logout = logoutAction.bind(null, "admin");

  return (
    <main className="min-h-[100svh] overflow-x-hidden bg-[#f7f8fa] px-4 py-5 text-[#0f1117] sm:px-6 lg:px-8">
      <FlashToast toast={toast} />
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <header className="flex flex-col gap-4 rounded-xl border border-black/[0.07] bg-white px-4 py-4 shadow-sm min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-[#e64a19] text-white">
              <ReceiptText className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-[-0.02em]">XMETA Pay</p>
              <p className="truncate text-[12px] leading-5 text-[#5a6070]">
                School setup onboarding
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
            <div className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e64a19]/20 bg-[#fff7ed] px-3 text-[12px] font-semibold text-[#bf360c]">
              <CheckCircle2 className="size-4" />
              Step 1 of 1
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-[12px] font-semibold text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </header>

        <section className="rounded-xl border border-black/[0.07] bg-white shadow-sm">
          <div className="border-b border-black/[0.07] px-4 py-5 sm:px-5">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#0f1117] sm:text-3xl">
              Set up school
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5a6070]">
              Add school years, choose the active year, then add grades and sections before opening the dashboard.
            </p>
          </div>

          <div className="grid gap-4 bg-[#f7f8fa] px-4 py-5 sm:px-5">
            <ManualSchoolSetupForm
              initialData={initialData}
              redirectTo="/admin/onboarding/school-setup"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
