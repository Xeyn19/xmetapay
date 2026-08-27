import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { PRODUCT_NAME } from "@/lib/brand";
import { PortalCard, PublicPageShell } from "./_components/auth-ui";

export default async function Home() {
  const session = await getSession();

  if (session?.role === "admin") {
    redirect("/admin/dashboard");
  }

  if (session?.role === "parent") {
    redirect("/parent/dashboard");
  }

  if (session?.role === "super_admin") {
    redirect("/super-admin/dashboard");
  }

  return (
    <PublicPageShell>
        <section className="flex flex-1 items-center py-8 sm:py-10 lg:py-12">
          <div className="mx-auto w-full max-w-4xl text-center">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#e64a19]">
              Welcome to {PRODUCT_NAME}
            </p>
            <h1 className="mx-auto mt-3 max-w-2xl text-balance text-[2rem] font-bold leading-[1.08] tracking-tight text-[var(--public-text)] sm:text-[2.75rem] lg:text-5xl">
              School payments, made simple.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-6 text-[var(--public-muted)] sm:text-base">
              Choose your portal to continue.
            </p>

            <div className="mt-7 grid gap-4 sm:mt-8 md:grid-cols-2 md:gap-5">
              <PortalCard
                variant="admin"
                title="School Admin"
                description="Manage school records, students, fees, and reports."
                href="/admin/login"
                registerHref="/admin/register"
              />
              <PortalCard
                variant="parent"
                title="Parent / Guardian"
                description="View student balances, payments, and allowance activity."
                href="/parent/login"
                registerHref="/parent/register"
              />
            </div>
          </div>
        </section>
    </PublicPageShell>
  );
}
