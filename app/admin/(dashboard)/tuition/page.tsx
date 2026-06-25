import { Calculator, ClipboardList, Download, Receipt, Send } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getAdminTuitionPageRealData } from "@/lib/admin/real-data";

import {
  AdminButton,
  AdminTable,
  AlertBanner,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
  StatusPill,
} from "../../_components/admin-ui";

export default async function TuitionPage() {
  const session = await requireRole("admin");
  const data = await getAdminTuitionPageRealData(session.userId);

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={Receipt}>{data.warning}</AlertBanner> : null}
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard
        title="Tuition report - June 2025"
        icon={Receipt}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton disabled>
              <Send className="size-4" />
              Reminders pending
            </AdminButton>
            <AdminButton tone="dark" disabled>
              <Download className="size-4" />
              Export pending
            </AdminButton>
          </div>
        }
        bodyClassName="p-0"
        className="mb-[18px]"
      >
        <AdminTable
          headers={[
            { label: "Student name", className: "w-[20%]" },
            { label: "Grade", className: "w-[10%]" },
            { label: "Section", className: "w-[10%]" },
            { label: "Fee due", className: "w-[12%]" },
            { label: "Paid", className: "w-[11%]" },
            { label: "Balance", className: "w-[11%]" },
            { label: "Last payment", className: "w-[13%]" },
            { label: "Status", className: "w-[13%]" },
          ]}
        >
          {data.rows.length > 0 ? (
            data.rows.map((row) => {
            const balance = row.due - row.paid;
            const statusLabel = row.status.charAt(0).toUpperCase() + row.status.slice(1);
            return (
              <tr key={`${row.student}-${row.grade}`}>
                <td className="font-bold">{row.student}</td>
                <td>{row.grade}</td>
                <td>{row.section}</td>
                <td>P{row.due.toLocaleString()}</td>
                <td className="font-semibold text-[#2e7d32]">P{row.paid.toLocaleString()}</td>
                <td className={balance > 0 ? "font-semibold text-[#c62828]" : "text-[#9ba3b8]"}>
                  P{balance.toLocaleString()}
                </td>
                <td className="font-mono text-[11px] text-[#5a6070]">{row.lastPayment}</td>
                <td>
                  <StatusPill tone={row.status as "paid" | "partial" | "unpaid"}>{statusLabel}</StatusPill>
                </td>
              </tr>
            );
            })
          ) : (
            <tr>
              <td colSpan={8} className="text-center text-[#5a6070]">
                No tuition fee assignments yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </DashboardCard>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <DashboardCard title="Outstanding by grade" icon={Calculator}>
          {data.outstandingByGrade.length > 0 ? (
            <BarList rows={data.outstandingByGrade} />
          ) : (
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Outstanding balances are pending.</div>
          )}
        </DashboardCard>
        <DashboardCard title="Other fee items" icon={ClipboardList} bodyClassName="p-0">
          <AdminTable
            headers={[
              { label: "Fee type", className: "w-[40%]" },
              { label: "Billed", className: "w-[20%]" },
              { label: "Collected", className: "w-[20%]" },
              { label: "Rate", className: "w-[20%]" },
            ]}
          >
            {data.otherFeeSummary.length > 0 ? (
              data.otherFeeSummary.map(([fee, billed, collected, rate]) => (
                <tr key={fee}>
                  <td className="font-bold">{fee}</td>
                  <td>{billed}</td>
                  <td className="font-semibold text-[#2e7d32]">{collected}</td>
                  <td className="font-bold">{rate}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center text-[#5a6070]">
                  No other fee records yet.
                </td>
              </tr>
            )}
          </AdminTable>
        </DashboardCard>
      </div>
    </>
  );
}

