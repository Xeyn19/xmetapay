import { CreditCard, Download, Search } from "lucide-react";

import {
  AdminButton,
  AdminTable,
  DashboardCard,
  KpiCard,
  KpiGrid,
  SearchInput,
  StatusPill,
} from "../../_components/admin-ui";
import { collectionsKpis, collectionsRows } from "../../_data/admin-dashboard-data";

export default function CollectionsPage() {
  return (
    <>
      <KpiGrid>
        {collectionsKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard
        title="Payment collection log"
        icon={CreditCard}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder="Search student, ref..." readOnly />
            <AdminButton>
              <Search className="size-4" />
              Filter
            </AdminButton>
            <AdminButton tone="dark">
              <Download className="size-4" />
              Export
            </AdminButton>
          </div>
        }
        bodyClassName="p-0"
      >
        <AdminTable
          headers={[
            { label: "Ref #", className: "w-[9%]" },
            { label: "Student", className: "w-[18%]" },
            { label: "Grade", className: "w-[10%]" },
            { label: "Fee type", className: "w-[17%]" },
            { label: "Amount", className: "w-[11%]" },
            { label: "Date & time", className: "w-[16%]" },
            { label: "Channel", className: "w-[11%]" },
            { label: "Status", className: "w-[8%]" },
          ]}
        >
          {collectionsRows.map(([ref, student, grade, fee, amount, date, channel, status]) => (
            <tr key={ref}>
              <td className="font-mono text-[11px] text-[#5a6070]">{ref}</td>
              <td className="font-bold">{student}</td>
              <td>{grade}</td>
              <td>{fee}</td>
              <td className="font-bold text-[#e64a19]">{amount}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{date}</td>
              <td>{channel}</td>
              <td><StatusPill tone={status === "Partial" ? "partial" : "paid"}>{status}</StatusPill></td>
            </tr>
          ))}
        </AdminTable>
      </DashboardCard>
    </>
  );
}

