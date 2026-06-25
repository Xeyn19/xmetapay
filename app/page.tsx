import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { BrandMark, PortalCard } from "./_components/auth-ui";

export default async function Home() {
  const session = await getSession();

  if (session?.role === "admin") {
    redirect("/admin/dashboard");
  }

  if (session?.role === "parent") {
    redirect("/parent/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-4 text-[#11131a] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-32px)] w-full max-w-6xl flex-col sm:min-h-[calc(100svh-48px)]">
        <header className="flex min-h-12 items-center justify-between gap-3">
          <BrandMark />
          <span className="hidden min-h-8 items-center rounded-lg border border-[#e64a19]/20 bg-white px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#bf360c] shadow-sm sm:inline-flex">
            UI prototype
          </span>
        </header>

        <section className="flex flex-1 items-center py-10 sm:py-12 lg:py-16">
          <div className="w-full text-center">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[#e64a19] sm:text-xs sm:tracking-[0.18em]">
              Brentwood Academy of Las Pinas
            </p>
            <h1 className="mx-auto mt-4 max-w-3xl text-balance text-[2rem] font-bold leading-[1.08] tracking-tight text-[#11131a] sm:text-5xl lg:text-[3.5rem]">
              Choose where you want to continue.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-[0.95rem] leading-7 text-zinc-600 sm:text-base lg:text-lg lg:leading-8">
              XMETA Pay separates school operations from family payment tasks,
              so each user lands in a portal designed around their work.
            </p>

            <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 md:grid-cols-2 lg:gap-6">
              <PortalCard
                variant="admin"
                title="School Admin"
                description="Manage tuition reports, enrolled students, parent contacts, collections, and allowance ledgers."
                href="/admin/login"
                registerHref="/admin/register"
                tags={["Fees", "Enrollment", "Wallets"]}
              />
              <PortalCard
                variant="parent"
                title="Parent / Guardian"
                description="Review balances, register student details, pay school fees, and monitor allowance activity."
                href="/parent/login"
                registerHref="/parent/register"
                tags={["Balances", "Payments", "Allowance"]}
              />
            </div>

            <p className="mx-auto mt-6 max-w-sm text-center text-sm font-medium leading-6 text-zinc-600 sm:max-w-none">
              New to XMETA Pay? Register takes under 2 minutes.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
