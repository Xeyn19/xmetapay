import { BrandMark, PortalCard } from "./_components/auth-ui";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-5 text-[#11131a] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <BrandMark />
          <span className="hidden rounded-full border border-[#e64a19]/20 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#bf360c] shadow-sm sm:inline-flex">
            UI prototype
          </span>
        </header>

        <section className="flex flex-1 items-center justify-center py-8">
          <div className="w-full text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e64a19]">
              Brentwood Academy of Las Piñas
            </p>
            <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight text-[#11131a] sm:text-4xl lg:text-5xl">
              Choose where you want to continue.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-600">
              XMETA Pay separates school operations from family payment tasks,
              so each user lands in a portal designed around their work.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
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

            <p className="mt-5 text-center text-sm font-medium text-zinc-600">
              New to XMETA Pay? Register takes under 2 minutes.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
