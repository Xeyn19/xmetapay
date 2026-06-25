import { Clock, Download, Store } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminStoreTransactionsPageRealData } from "@/lib/admin/real-data";

import {
  AdminButton,
  AdminTable,
  AlertBanner,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
} from "../../_components/admin-ui";

export default async function StoreTransactionsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/store-transactions");
  const data = await getAdminStoreTransactionsPageRealData(session.userId);

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={Store}>{data.warning}</AlertBanner> : null}
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-2">
        <DashboardCard title="Spend by grade" icon={Store}>
          {data.spendByGrade.length > 0 ? <BarList rows={data.spendByGrade} /> : <div className="text-[12.5px] leading-5 text-[#5a6070]">Store spend is pending.</div>}
        </DashboardCard>
        <DashboardCard title="Peak hours" icon={Clock}>
          {data.peakHours.length > 0 ? <BarList rows={data.peakHours} tone="green" /> : <div className="text-[12.5px] leading-5 text-[#5a6070]">Store transaction timing is pending.</div>}
        </DashboardCard>
      </div>

      <DashboardCard
        title="Store transaction log"
        icon={Store}
        action={<AdminButton tone="dark" disabled><Download className="size-4" />Export pending</AdminButton>}
        bodyClassName="p-0"
      >
        <AdminTable
          headers={[
            { label: "Ref #", className: "w-[10%]" },
            { label: "Student", className: "w-[20%]" },
            { label: "Grade", className: "w-[10%]" },
            { label: "Store", className: "w-[16%]" },
            { label: "Amount", className: "w-[14%]" },
            { label: "Txn fee", className: "w-[12%]" },
            { label: "Time", className: "w-[18%]" },
          ]}
        >
          {data.rows.length > 0 ? (
            data.rows.map(([ref, student, grade, store, amount, fee, time]) => (
              <tr key={ref}>
                <td className="font-mono text-[11px] text-[#5a6070]">{ref}</td>
                <td className="font-bold">{student}</td>
                <td>{grade}</td>
                <td>{store}</td>
                <td className="font-bold">{amount}</td>
                <td className="font-mono text-[11px] text-[#5a6070]">{fee}</td>
                <td className="font-mono text-[11px] text-[#5a6070]">{time}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center text-[#5a6070]">
                No store transactions yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </DashboardCard>
    </>
  );
}

