import { CreditCard, Edit, History, IdCard, Plus, Users, Wallet } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminStudentProfileRealData } from "@/lib/admin/real-data";

import {
  AdminButton,
  AdminTable,
  AlertBanner,
  DashboardCard,
  EmptyState,
  KpiCard,
  SummaryRows,
} from "../../_components/admin-ui";

export default async function StudentProfilePage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/student-profile");
  const data = await getAdminStudentProfileRealData(session.userId);

  if (!data.student) {
    return (
      <>
        {data.warning ? <AlertBanner tone="warn" icon={IdCard}>{data.warning}</AlertBanner> : null}
        <DashboardCard title="Student profile" icon={IdCard} className="max-w-3xl">
          <EmptyState>No student profile is available yet. Add a student from the enrolled students page.</EmptyState>
        </DashboardCard>
      </>
    );
  }

  const student = data.student;

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={IdCard}>{data.warning}</AlertBanner> : null}
      <section className="relative mb-5 flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl bg-[#0f1117] px-6 py-5 text-white">
        <div className="absolute -right-8 -top-8 size-36 rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-7 right-16 size-24 rounded-full bg-[#e64a19]/15" />
        <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full border-[2.5px] border-white/25 bg-[#e64a19] text-xl font-bold">
          {student.initials}
        </span>
        <div className="relative min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-[-0.02em]">{student.fullName}</h2>
          <p className="mt-0.5 text-xs text-white/60">{student.subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {student.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90">{tag}</span>
            ))}
          </div>
        </div>
        <div className="relative ml-auto flex gap-6 text-right">
          <div>
            <div className="text-lg font-bold">{student.walletBalance}</div>
            <div className="mt-0.5 text-[10.5px] text-white/50">Wallet balance</div>
          </div>
          <div>
            <div className="text-lg font-bold">{student.openBalance}</div>
            <div className="mt-0.5 text-[10.5px] text-white/50">Open balance</div>
          </div>
        </div>
      </section>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-3">
        <DashboardCard title="Student details" icon={IdCard} action={<AdminButton disabled><Edit className="size-4" />Edit pending</AdminButton>}>
          <SummaryRows rows={student.details} />
        </DashboardCard>
        <DashboardCard title="Parent / guardian" icon={Users}>
          <SummaryRows rows={student.guardian} />
        </DashboardCard>
        <DashboardCard title="Allowance wallet" icon={Wallet}>
          <div className="grid gap-3">
            <KpiCard {...student.wallet.kpi} />
            <SummaryRows rows={student.wallet.rows} />
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <DashboardCard
          title="Fee and payment status"
          icon={CreditCard}
          action={<AdminButton disabled><Plus className="size-4" />Record payment pending</AdminButton>}
        >
          <SummaryRows rows={student.fees} />
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
            {student.transactions.length > 0 ? (
              student.transactions.map(([date, description, amount, channel, status]) => (
                <tr key={`${date}-${description}`}>
                  <td className="font-mono text-[11px] text-[#5a6070]">{date}</td>
                  <td className="font-bold">{description}</td>
                  <td className="font-bold text-[#e64a19]">{amount}</td>
                  <td>{channel}</td>
                  <td className="font-semibold text-[#2e7d32]">{status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-[#5a6070]">
                  No student payment transactions yet.
                </td>
              </tr>
            )}
          </AdminTable>
        </DashboardCard>
      </div>
    </>
  );
}

