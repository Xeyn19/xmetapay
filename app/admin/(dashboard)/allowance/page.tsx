"use client";

import { Download, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import {
  AdminButton,
  AdminTable,
  DashboardCard,
  KpiCard,
  KpiGrid,
  SegmentedTabs,
  StatusPill,
} from "../../_components/admin-ui";
import { allowanceKpis, allowanceRows } from "../../_data/admin-dashboard-data";

type WalletFilter = "all" | "low" | "zero";

export default function AllowancePage() {
  const [filter, setFilter] = useState<WalletFilter>("all");
  const rows = useMemo(() => {
    return allowanceRows.filter((row) => {
      if (filter === "all") return true;
      if (filter === "low") return row[6] === "Low";
      return row[6] === "No balance";
    });
  }, [filter]);

  return (
    <>
      <KpiGrid>
        {allowanceKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>
      <DashboardCard
        title="Student allowance wallet ledger"
        icon={Wallet}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedTabs
              active={filter}
              onChange={setFilter}
              tabs={[
                { label: "All students", value: "all" },
                { label: "Low balance", value: "low" },
                { label: "Zero balance", value: "zero" },
              ]}
            />
            <AdminButton tone="dark"><Download className="size-4" />Export</AdminButton>
          </div>
        }
        bodyClassName="p-0"
      >
        <AdminTable
          headers={[
            { label: "Student", className: "w-[22%]" },
            { label: "Grade", className: "w-[11%]" },
            { label: "Current balance", className: "w-[16%]" },
            { label: "Last top-up", className: "w-[14%]" },
            { label: "Month spend", className: "w-[13%]" },
            { label: "Total top-ups", className: "w-[14%]" },
            { label: "Status", className: "w-[10%]" },
          ]}
        >
          {rows.map(([student, grade, balance, lastTopUp, spend, topUps, status]) => (
            <tr key={student}>
              <td className="font-bold">{student}</td>
              <td>{grade}</td>
              <td className={status === "No balance" ? "font-bold text-[#9ba3b8]" : status === "Low" ? "font-bold text-[#f57c00]" : "font-bold text-[#e64a19]"}>
                {balance}
              </td>
              <td>{lastTopUp}</td>
              <td>{spend}</td>
              <td>{topUps}</td>
              <td><StatusPill tone={status === "Low" ? "low" : status === "No balance" ? "inactive" : "active"}>{status}</StatusPill></td>
            </tr>
          ))}
        </AdminTable>
      </DashboardCard>
    </>
  );
}

