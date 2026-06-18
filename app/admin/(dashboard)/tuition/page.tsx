"use client";

import { Calculator, ClipboardList, Download, Receipt, Send } from "lucide-react";
import { useMemo, useState } from "react";

import {
  AdminButton,
  AdminTable,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
  SegmentedTabs,
  StatusPill,
} from "../../_components/admin-ui";
import {
  otherFeeSummary,
  outstandingByGrade,
  tuitionKpis,
  tuitionRows,
} from "../../_data/admin-dashboard-data";

type TuitionFilter = "all" | "paid" | "partial" | "unpaid";

export default function TuitionPage() {
  const [filter, setFilter] = useState<TuitionFilter>("all");
  const rows = useMemo(
    () => tuitionRows.filter((row) => filter === "all" || row.status === filter),
    [filter]
  );

  return (
    <>
      <KpiGrid>
        {tuitionKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard
        title="Tuition report - June 2025"
        icon={Receipt}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedTabs
              active={filter}
              onChange={setFilter}
              tabs={[
                { label: "All", value: "all" },
                { label: "Paid", value: "paid" },
                { label: "Partial", value: "partial" },
                { label: "Unpaid", value: "unpaid" },
              ]}
            />
            <AdminButton>
              <Send className="size-4" />
              Remind unpaid
            </AdminButton>
            <AdminButton tone="dark">
              <Download className="size-4" />
              Export
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
          {rows.map((row) => {
            const balance = row.due - row.paid;
            const statusLabel = row.status.charAt(0).toUpperCase() + row.status.slice(1);
            return (
              <tr key={`${row.name}-${row.grade}`}>
                <td className="font-bold">{row.name}</td>
                <td>{row.grade}</td>
                <td>{row.section}</td>
                <td>P{row.due.toLocaleString()}</td>
                <td className="font-semibold text-[#2e7d32]">P{row.paid.toLocaleString()}</td>
                <td className={balance > 0 ? "font-semibold text-[#c62828]" : "text-[#9ba3b8]"}>
                  P{balance.toLocaleString()}
                </td>
                <td className="font-mono text-[11px] text-[#5a6070]">{row.last}</td>
                <td>
                  <StatusPill tone={row.status as "paid" | "partial" | "unpaid"}>{statusLabel}</StatusPill>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </DashboardCard>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <DashboardCard title="Outstanding by grade" icon={Calculator}>
          <BarList rows={outstandingByGrade} />
        </DashboardCard>
        <DashboardCard title="Other fee items - Jun" icon={ClipboardList} bodyClassName="p-0">
          <AdminTable
            headers={[
              { label: "Fee type", className: "w-[40%]" },
              { label: "Billed", className: "w-[20%]" },
              { label: "Collected", className: "w-[20%]" },
              { label: "Rate", className: "w-[20%]" },
            ]}
          >
            {otherFeeSummary.map(([fee, billed, collected, rate]) => (
              <tr key={fee}>
                <td className="font-bold">{fee}</td>
                <td>{billed}</td>
                <td className="font-semibold text-[#2e7d32]">{collected}</td>
                <td className="font-bold">{rate}</td>
              </tr>
            ))}
          </AdminTable>
        </DashboardCard>
      </div>
    </>
  );
}

