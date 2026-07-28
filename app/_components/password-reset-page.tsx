import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard, PublicPageShell } from "./auth-ui";
import { PasswordResetFlow } from "./password-reset-flow";
import { getPasswordResetStage } from "@/lib/auth/password-reset";
import { getSession, type AuthRole } from "@/lib/auth/session";

export async function PasswordResetPage({
  role,
  portalLabel,
  loginHref,
}: {
  role: AuthRole;
  portalLabel: string;
  loginHref: string;
}) {
  const session = await getSession();

  if (session?.role === "admin") redirect("/admin/dashboard");
  if (session?.role === "parent") redirect("/parent/dashboard");
  if (session?.role === "super_admin") redirect("/super-admin/dashboard");

  const initialStage = await getPasswordResetStage(role);

  return (
    <PublicPageShell
      headerAction={
        <Link
          href={loginHref}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-zinc-200 shadow-sm transition hover:border-[#ff7043]/50 hover:bg-[#e64a19]/10 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20 sm:px-4"
        >
          Back to sign in
        </Link>
      }
    >
      <section className="flex flex-1 items-center justify-center py-8 sm:py-10">
        <AuthCard>
          <PasswordResetFlow
            initialStage={initialStage}
            loginHref={loginHref}
            portalLabel={portalLabel}
            role={role}
          />
        </AuthCard>
      </section>
    </PublicPageShell>
  );
}
