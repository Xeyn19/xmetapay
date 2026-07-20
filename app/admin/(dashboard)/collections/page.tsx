import { CreditCard } from "lucide-react";

import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminCollectionsPageRealData } from "@/lib/admin/real-data";
import { requireRole } from "@/lib/auth/session";

import {
  AlertBanner,
  DashboardCard,
  KpiCard,
  KpiGrid,
} from "../../_components/admin-ui";
import { CollectionsTable } from "./collections-table";

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
        title="Tuition collection log"
        icon={CreditCard}
        bodyClassName="p-0"
      >
        <CollectionsTable
          key={`${data.activeRows.map((row) => row.paymentId).join("-")}|${data.archivedRows.map((row) => row.paymentId).join("-")}`}
          activeRows={data.activeRows}
          archivedRows={data.archivedRows}
        />
      </DashboardCard>
    </>
  );
}
