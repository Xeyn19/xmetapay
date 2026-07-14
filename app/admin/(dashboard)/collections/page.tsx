import { CreditCard } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminCollectionsPageRealData } from "@/lib/admin/real-data";

import {
  AlertBanner,
  DashboardCard,
  KpiCard,
  KpiGrid,
} from "../../_components/admin-ui";
import { CollectionsTable, type CollectionRow } from "./collections-table";

export default async function CollectionsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/collections");
  const data = await getAdminCollectionsPageRealData(session.userId);
  const rows: CollectionRow[] = data.rows.map(([ref, student, grade, fee, amount, date, channel, status]) => ({
    ref,
    student,
    grade,
    fee,
    amount,
    date,
    channel,
    status,
  }));

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
        <CollectionsTable rows={rows} />
      </DashboardCard>
    </>
  );
}

