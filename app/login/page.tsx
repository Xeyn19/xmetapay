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
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-button-outline bg-white px-3 py-2 text-sm font-semibold text-[#bf360c] shadow-sm transition hover:bg-[#fbe9e7] hover:text-[#e64a19] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/10 sm:px-4"
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
              <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-[#11131a]">
                Company sign in
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Monitor schools and manage admin access.
              </p>
            </div>
            <SuperAdminLoginForm />
            <div className="mt-5 border-t border-zinc-100 pt-4 text-center text-sm text-zinc-600">
              School or parent user?{" "}
              <Link
                href="/"
                className="rounded-md font-bold text-[#bf360c] hover:text-[#e64a19] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/10"
              >
                View public portals
              </Link>
            </div>
          </AuthCard>
        </section>
    </PublicPageShell>
  );
}
