import { Download, Wallet } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminAllowancePageRealData } from "@/lib/admin/real-data";

import {
  AdminButton,
  AdminTable,
  AlertBanner,
  DashboardCard,
  KpiCard,
  KpiGrid,
  StatusPill,
} from "../../_components/admin-ui";

export default async function AllowancePage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/allowance");
  const data = await getAdminAllowancePageRealData(session.userId);

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={Wallet}>{data.warning}</AlertBanner> : null}
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>
      <DashboardCard
        title="Student allowance wallet ledger"
        icon={Wallet}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton tone="dark" disabled><Download className="size-4" />Export pending</AdminButton>
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
          {data.rows.length > 0 ? (
            data.rows.map(([student, grade, balance, lastTopUp, spend, topUps, status]) => (
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
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center text-[#5a6070]">
                No wallet records yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </DashboardCard>
    </>
  );
}

