import Link from "next/link";
import { redirect } from "next/navigation";

import { FlashToast } from "@/app/_components/flash-toast";
import { AuthCard, PublicPageShell } from "@/app/_components/auth-ui";
import { SuperAdminLoginForm } from "./super-admin-login-form";
import { consumeAuthFlashToast, getSession } from "@/lib/auth/session";

export default async function CompanyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ signedOut?: string }>;
}) {
  const { signedOut } = await searchParams;
  const session = await getSession();

  if (session?.role === "super_admin") {
    redirect("/super-admin/dashboard");
  }

  if (session?.role === "admin") {
    redirect("/admin/dashboard");
  }

  if (session?.role === "parent") {
    redirect("/parent/dashboard");
  }

  const toast = signedOut === "1"
    ? {
        role: "super_admin" as const,
        title: "Signed out",
        description: "You have signed out of company monitoring.",
      }
    : await consumeAuthFlashToast("super_admin");

  return (
    <PublicPageShell
      headerAction={
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-zinc-200 shadow-sm transition hover:border-[#ff7043]/50 hover:bg-[#e64a19]/10 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20 sm:px-4"
        >
          All portals
        </Link>
      }
    >
        <section className="flex flex-1 items-center justify-center py-8 sm:py-10">
          <AuthCard>
            <FlashToast toast={toast} />
            <div className="mb-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#e64a19]">
                Company access
              </p>
              <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-white">
                Company sign in
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Monitor schools and manage admin access.
              </p>
            </div>
            <SuperAdminLoginForm />
            <div className="mt-5 border-t border-white/10 pt-4 text-center text-sm text-zinc-400">
              School or parent user?{" "}
              <Link
                href="/"
                className="rounded-md font-bold text-[#ff8a65] hover:text-[#ffb09a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20"
              >
                View public portals
              </Link>
            </div>
          </AuthCard>
        </section>
    </PublicPageShell>
  );
}
