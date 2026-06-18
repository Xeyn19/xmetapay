import { CreditCard, Edit, History, IdCard, Plus, Users, Wallet } from "lucide-react";

import {
  AdminButton,
  AdminTable,
  DashboardCard,
  KpiCard,
  SummaryRows,
} from "../../_components/admin-ui";
import { profileFeeStatus, profileTransactions } from "../../_data/admin-dashboard-data";

export default function StudentProfilePage() {
  return (
    <>
      <section className="relative mb-5 flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl bg-[#0f1117] px-6 py-5 text-white">
        <div className="absolute -right-8 -top-8 size-36 rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-7 right-16 size-24 rounded-full bg-[#e64a19]/15" />
        <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full border-[2.5px] border-white/25 bg-[#e64a19] text-xl font-bold">
          JS
        </span>
        <div className="relative min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Juan Miguel Santos</h2>
          <p className="mt-0.5 text-xs text-white/60">BWA-2025-0312 - Grade 7 - Section A</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90">Enrolled</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90">Wallet active</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90">Tuition paid</span>
          </div>
        </div>
        <div className="relative ml-auto flex gap-6 text-right">
          <div>
            <div className="text-lg font-bold">P320</div>
            <div className="mt-0.5 text-[10.5px] text-white/50">Wallet balance</div>
          </div>
          <div>
            <div className="text-lg font-bold">0</div>
            <div className="mt-0.5 text-[10.5px] text-white/50">Open balance</div>
          </div>
        </div>
      </section>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-3">
        <DashboardCard title="Student details" icon={IdCard} action={<AdminButton><Edit className="size-4" />Edit</AdminButton>}>
          <SummaryRows
            rows={[
              { label: "Full name", value: "Juan Miguel Santos" },
              { label: "Grade / section", value: "Grade 7 - A" },
              { label: "LRN", value: "123456789012" },
              { label: "Date of birth", value: "March 12, 2012" },
              { label: "Student type", value: "New" },
            ]}
          />
        </DashboardCard>
        <DashboardCard title="Parent / guardian" icon={Users}>
          <SummaryRows
            rows={[
              { label: "Parent", value: "Maria Santos" },
              { label: "Relationship", value: "Mother" },
              { label: "Contact", value: "0917-234-5678" },
              { label: "Email", value: "maria@email.com" },
              { label: "Portal", value: "Linked", tone: "green" },
            ]}
          />
        </DashboardCard>
        <DashboardCard title="Allowance wallet" icon={Wallet}>
          <div className="grid gap-3">
            <KpiCard label="Current balance" value="P320" note="Last top-up today" tone="orange" noteTone="up" />
            <SummaryRows
              rows={[
                { label: "Monthly spend", value: "P680" },
                { label: "Top-up limit", value: "P1,000" },
                { label: "Status", value: "Active", tone: "green" },
              ]}
            />
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <DashboardCard
          title="Fee and payment status"
          icon={CreditCard}
          action={<AdminButton><Plus className="size-4" />Record payment</AdminButton>}
        >
          <SummaryRows rows={profileFeeStatus} />
        </DashboardCard>

        <DashboardCard title="Recent transactions" icon={History} bodyClassName="p-0">
          <AdminTable
            headers={[
              { label: "Date", className: "w-[16%]" },
              { label: "Description", className: "w-[30%]" },
              { label: "Amount", className: "w-[18%]" },
              { label: "Channel", className: "w-[16%]" },
              { label: "Status", className: "w-[20%]" },
            ]}
          >
            {profileTransactions.map(([date, description, amount, channel, status]) => (
              <tr key={`${date}-${description}`}>
                <td className="font-mono text-[11px] text-[#5a6070]">{date}</td>
                <td className="font-bold">{description}</td>
                <td className="font-bold text-[#e64a19]">{amount}</td>
                <td>{channel}</td>
                <td className="font-semibold text-[#2e7d32]">{status}</td>
              </tr>
            ))}
          </AdminTable>
        </DashboardCard>
      </div>
    </>
  );
}

