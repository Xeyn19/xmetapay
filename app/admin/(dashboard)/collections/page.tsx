import { CreditCard, Download, Search } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminCollectionsPageRealData } from "@/lib/admin/real-data";

import {
  AdminButton,
  AdminTable,
  AlertBanner,
  DashboardCard,
  KpiCard,
  KpiGrid,
  SearchInput,
  StatusPill,
} from "../../_components/admin-ui";

export default async function CollectionsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/collections");
  const data = await getAdminCollectionsPageRealData(session.userId);

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={CreditCard}>{data.warning}</AlertBanner> : null}
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard
        title="Payment collection log"
        icon={CreditCard}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder="Search student, ref..." readOnly />
            <AdminButton disabled>
              <Search className="size-4" />
              Filter pending
            </AdminButton>
            <AdminButton tone="dark" disabled>
              <Download className="size-4" />
              Export pending
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
          {data.rows.length > 0 ? (
            data.rows.map(([ref, student, grade, fee, amount, date, channel, status]) => (
              <tr key={ref}>
                <td className="font-mono text-[11px] text-[#5a6070]">{ref}</td>
                <td className="font-bold">{student}</td>
                <td>{grade}</td>
                <td>{fee}</td>
                <td className="font-bold text-[#e64a19]">{amount}</td>
                <td className="font-mono text-[11px] text-[#5a6070]">{date}</td>
                <td>{channel}</td>
                <td><StatusPill tone={status === "Partial" ? "partial" : status === "Paid" || status === "Done" ? "paid" : "pending"}>{status}</StatusPill></td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="text-center text-[#5a6070]">
                No payment records yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </DashboardCard>
    </>
  );
}

