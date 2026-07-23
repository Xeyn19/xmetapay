import Link from "next/link";
import { BrandMark } from "./auth-ui";
import { BrandLogo } from "./brand-logo";

type Stat = {
  label: string;
  value: string;
  note: string;
  tone?: "orange" | "green" | "red" | "blue";
};

const toneClass = {
  orange: "border-t-[#e64a19]",
  green: "border-t-[#2e7d32]",
  red: "border-t-[#c62828]",
  blue: "border-t-[#1565c0]",
};

export function StatCard({ label, value, note, tone = "orange" }: Stat) {
  return (
    <div className={`rounded-xl border border-zinc-200 border-t-4 ${toneClass[tone]} bg-white p-5 shadow-sm`}>
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-[#11131a]">
        {value}
      </div>
      <div className="mt-2 text-sm text-zinc-600">{note}</div>
    </div>
  );
}

export function AdminDashboardShell() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#11131a] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="bg-[#11131a] px-5 py-6 text-white lg:min-h-screen">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div>
            <div className="font-bold">XMETA Pay</div>
            <div className="text-xs text-zinc-400">Admin dashboard</div>
          </div>
        </div>

        <nav className="mt-8 grid gap-2 text-sm">
          {["Dashboard", "Tuition report", "Collections", "Students", "Parent contacts"].map((item, index) => (
            <span
              key={item}
              className={`rounded-lg px-3 py-2 font-semibold ${
                index === 0 ? "bg-[#e64a19] text-white" : "text-zinc-400"
              }`}
            >
              {item}
            </span>
          ))}
        </nav>
      </aside>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e64a19]">
              Brentwood Academy
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              School Admin Portal
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              UI-only overview for SY 2025-2026 operations.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/login"
              className="rounded-lg border border-button-outline bg-white px-4 py-2 text-sm font-bold text-[#bf360c] transition hover:bg-[#fbe9e7] hover:text-[#e64a19]"
            >
              Login UI
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-[#11131a] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#2d3348] focus:outline-none focus:ring-4 focus:ring-[#11131a]/15"
            >
              Switch portal
            </Link>
          </div>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Collected this month" value="P842k" note="94% online via XMETA" />
          <StatCard label="Unpaid tuition" value="41" note="Students due this month" tone="red" />
          <StatCard label="Active students" value="238" note="97.5% active" tone="green" />
          <StatCard label="Wallets linked" value="218" note="Parents with active wallet" tone="blue" />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 p-5">
              <h2 className="text-base font-bold">Recent payment activity</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {[
                ["TXN-4921", "Maria Santos", "June tuition", "P3,500", "Paid"],
                ["TXN-4919", "Rosa Cruz", "Allowance top-up", "P500", "Done"],
                ["TXN-4906", "Carla Mendoza", "PTA contribution", "P200", "Manual"],
              ].map(([id, name, fee, amount, status]) => (
                <div key={id} className="grid gap-2 p-5 text-sm sm:grid-cols-[0.8fr_1fr_1fr_0.7fr_0.6fr]">
                  <span className="font-mono text-xs text-zinc-500">{id}</span>
                  <span className="font-bold">{name}</span>
                  <span className="text-zinc-600">{fee}</span>
                  <span className="font-bold text-[#bf360c]">{amount}</span>
                  <span className="font-semibold text-[#2e7d32]">{status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold">Operations queue</h2>
            <div className="mt-4 grid gap-3">
              {[
                "Send reminders to 41 parents",
                "Review 13 unlinked parent accounts",
                "Check 7 low allowance wallets",
                "Export May collections report",
              ].map((item) => (
                <div key={item} className="rounded-lg bg-[#f7f8fa] px-4 py-3 text-sm font-semibold text-zinc-700">
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export function ParentDashboardShell() {
  return (
    <main className="min-h-screen bg-[#f8f8f7] px-4 py-6 text-[#1a1a1a] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandMark />
          <div className="flex gap-3">
            <Link
              href="/parent/login"
              className="rounded-lg border border-button-outline bg-white px-4 py-2 text-sm font-bold text-[#bf360c] transition hover:bg-[#fbe9e7] hover:text-[#e64a19]"
            >
              Login UI
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-[#e64a19] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus:ring-4 focus:ring-[#e64a19]/20"
            >
              Switch portal
            </Link>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e64a19]">
            Parent / Guardian Portal
          </p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back, Maria Santos.
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-zinc-600">
                Review outstanding balances, continue enrollment, and monitor
                allowance wallets for Juan and Maria Jr.
              </p>
            </div>
            <div className="rounded-xl bg-[#fbe9e7] p-5">
              <div className="text-sm font-semibold text-[#bf360c]">
                Outstanding this month
              </div>
              <div className="mt-2 text-4xl font-bold text-[#11131a]">P1,100</div>
              <div className="mt-2 text-sm text-zinc-600">Due across 4 school fees</div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard label="Students linked" value="2" note="Juan and Maria Jr." tone="blue" />
          <StatCard label="Wallet balance" value="P470" note="Across active wallets" tone="green" />
          <StatCard label="Pending fees" value="4" note="Ready for payment" tone="orange" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold">Students</h2>
            <div className="mt-4 grid gap-3">
              {[
                ["Juan Miguel Santos", "Grade 7 - Section A", "P320 wallet"],
                ["Maria Santos Jr.", "Grade 4 - Section B", "P150 wallet"],
              ].map(([name, grade, wallet]) => (
                <div key={name} className="rounded-lg border border-zinc-100 p-4">
                  <div className="font-bold">{name}</div>
                  <div className="mt-1 text-sm text-zinc-600">{grade}</div>
                  <div className="mt-3 inline-flex rounded-full bg-[#e8f5e9] px-3 py-1 text-xs font-bold text-[#2e7d32]">
                    {wallet}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 p-5">
              <h2 className="text-base font-bold">Fee summary</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {[
                ["July 2025 tuition", "Due July 5", "P3,500", "Ready"],
                ["School supplies balance", "Due this month", "P350", "Pending"],
                ["PTA contribution", "Optional", "P200", "Open"],
              ].map(([fee, due, amount, status]) => (
                <div key={fee} className="grid gap-2 p-5 text-sm sm:grid-cols-[1fr_0.8fr_0.5fr_0.5fr]">
                  <span className="font-bold">{fee}</span>
                  <span className="text-zinc-600">{due}</span>
                  <span className="font-bold text-[#bf360c]">{amount}</span>
                  <span className="font-semibold text-[#1565c0]">{status}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
