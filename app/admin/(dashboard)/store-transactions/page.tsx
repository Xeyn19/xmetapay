import { Clock, Store } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminStoreTransactionsPageRealData } from "@/lib/admin/real-data";
import { getAdminStoreSetupData } from "@/lib/stores/records";

import {
  AlertBanner,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
} from "../../_components/admin-ui";
import { StoreManagementForms } from "./store-forms";
import { StoreTransactionsTable, type StoreTransactionRow } from "./store-transactions-table";

export default async function StoreTransactionsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/store-transactions");
  const [data, storeSetup] = await Promise.all([
    getAdminStoreTransactionsPageRealData(session.userId),
    getAdminStoreSetupData(session.userId),
  ]);
  const rows: StoreTransactionRow[] = data.rows.map(([ref, student, grade, merchant, amount, fee, time]) => ({
    ref,
    student,
    grade,
    merchant,
    amount,
    fee,
    time,
  }));

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={Store}>{data.warning}</AlertBanner> : null}
      {storeSetup.warning ? <AlertBanner tone="warn" icon={Store}>{storeSetup.warning}</AlertBanner> : null}
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
        bodyClassName="p-0"
        className="mb-[18px]"
      >
        <StoreTransactionsTable rows={rows} />
      </DashboardCard>

      <StoreManagementForms data={storeSetup} />
    </>
  );
}

