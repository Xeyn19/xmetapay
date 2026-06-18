import Link from "next/link";
import { CreditCard, IdCard, Plus, Users, Wallet } from "lucide-react";

import { DetailRows, ParentButton, ParentCard } from "../../_components/parent-ui";
import { parentDetails, profileDetails, profileStats } from "../../_data/parent-portal-data";

export default function StudentProfilePage() {
  return (
    <>
      <section className="relative mb-5 flex flex-wrap items-center gap-5 overflow-hidden rounded-[20px] bg-[#e64a19] px-6 py-6 text-white">
        <div className="absolute -right-8 -top-8 size-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 right-24 size-28 rounded-full bg-black/10" />
        <span className="relative flex size-16 items-center justify-center rounded-full border-2 border-white/25 bg-white/15 text-xl font-semibold">JS</span>
        <div className="relative min-w-0 flex-1">
          <h2 className="text-[22px] font-bold">Juan Miguel Santos</h2>
          <p className="mt-1 text-[13px] text-white/80">Brentwood Academy of Las Pinas - SY 2025-2026</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["BWA-2025-0312", "Grade 7", "New student"].map((tag) => (
              <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{tag}</span>
            ))}
          </div>
        </div>
        <div className="relative flex gap-7 text-center">
          {profileStats.map((stat) => (
            <div key={stat.label}>
              <div className="text-xl font-bold">{stat.value}</div>
              <div className="mt-0.5 text-[11px] text-white/75">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <ParentCard title="Student details" icon={IdCard}><DetailRows rows={profileDetails} /></ParentCard>
        <ParentCard title="Parent / guardian" icon={Users}><DetailRows rows={parentDetails} /></ParentCard>
        <ParentCard title="Allowance wallet" icon={Wallet} action={<Link href="/parent/wallet"><ParentButton tone="primary"><Plus className="size-4" />Top-up</ParentButton></Link>}>
          <DetailRows rows={[{ label: "Current balance", value: "P320", tone: "orange" }, { label: "Monthly spend", value: "P680" }, { label: "Last top-up", value: "Today" }, { label: "Status", value: "Active", tone: "green" }]} />
        </ParentCard>
      </div>

      <ParentCard title="Fees and payments" icon={CreditCard}>
        <div className="flex flex-wrap gap-2">
          <Link href="/parent/fees"><ParentButton>View fee summary</ParentButton></Link>
          <Link href="/parent/pay-tuition"><ParentButton tone="primary">Pay outstanding fees</ParentButton></Link>
        </div>
      </ParentCard>
    </>
  );
}

