import { CheckCircle2, LogOut } from "lucide-react";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/app/_components/brand-logo";
import { FlashToast } from "@/app/_components/flash-toast";
import { logoutAction } from "@/app/auth/actions";
import { GuidedSchoolSetupWizard } from "@/app/admin/_components/guided-school-setup-wizard";
import { getAdminStaffRole } from "@/lib/admin/access";
import { canManageSchoolSetup } from "@/lib/admin/permissions";
import { consumeAuthFlashToast, requireRole } from "@/lib/auth/session";
import { PRODUCT_NAME } from "@/lib/brand";
import { getSchoolOnboardingState } from "@/lib/school/onboarding";

export default async function AdminSchoolSetupOnboardingPage() {
  const session = await requireRole("admin");
  const [staffRole, onboardingState, toast] = await Promise.all([
    getAdminStaffRole(session.userId),
    getSchoolOnboardingState(session.userId),
    consumeAuthFlashToast("admin"),
  ]);

  if (!canManageSchoolSetup(staffRole)) {
    redirect("/admin/dashboard");
  }

  const logout = logoutAction.bind(null, "admin");

  return (
    <main className="dashboard-theme min-h-[100svh] overflow-x-hidden bg-background px-3 py-4 text-foreground sm:px-6 sm:py-5 lg:px-8">
      <FlashToast toast={toast} />
      <div className="mx-auto grid w-full max-w-[1480px] gap-5">
        <header className="flex flex-col gap-4 rounded-xl border border-border bg-card px-4 py-4 shadow-sm min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo />
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-[-0.02em] text-foreground">{PRODUCT_NAME}</p>
              <p className="truncate text-[12px] leading-5 text-muted-foreground">
                School setup onboarding
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
            <div className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/20 bg-accent px-3 text-[12px] font-semibold text-accent-foreground">
              <CheckCircle2 className="size-4" />
              Guided setup · Step {onboardingState.currentStep} of 5
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </header>

        {onboardingState.warning ? (
          <div role="alert" className="rounded-lg border border-status-warning-foreground/25 bg-status-warning-bg px-4 py-3 text-sm text-status-warning-foreground">
            {onboardingState.warning}
          </div>
        ) : null}

        <GuidedSchoolSetupWizard initialState={onboardingState} />
      </div>
    </main>
  );
}
