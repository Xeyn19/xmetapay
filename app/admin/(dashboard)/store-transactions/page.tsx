import { Clock, Download, Store } from "lucide-react";

import {
  AdminButton,
  AdminTable,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
} from "../../_components/admin-ui";
import { peakHours, spendByGrade, storeKpis, storeRows } from "../../_data/admin-dashboard-data";

export default function StoreTransactionsPage() {
  return (
    <>
      <KpiGrid>
        {storeKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-2">
        <DashboardCard title="Spend by grade - May" icon={Store}>
          <BarList rows={spendByGrade} />
        </DashboardCard>
        <DashboardCard title="Peak hours today" icon={Clock}>
          <BarList rows={peakHours} tone="green" />
        </DashboardCard>
      </div>

      <DashboardCard
        title="Store transaction log - today"
        icon={Store}
        action={<AdminButton tone="dark"><Download className="size-4" />Export</AdminButton>}
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
          {storeRows.map(([ref, student, grade, store, amount, fee, time]) => (
            <tr key={ref}>
              <td className="font-mono text-[11px] text-[#5a6070]">{ref}</td>
              <td className="font-bold">{student}</td>
              <td>{grade}</td>
              <td>{store}</td>
              <td className="font-bold">{amount}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{fee}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{time}</td>
            </tr>
          ))}
        </AdminTable>
      </DashboardCard>
    </>
  );
}

