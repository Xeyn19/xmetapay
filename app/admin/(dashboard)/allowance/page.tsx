import { Wallet } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminAllowancePageRealData } from "@/lib/admin/real-data";

import {
  AlertBanner,
  DashboardCard,
  KpiCard,
  KpiGrid,
} from "../../_components/admin-ui";
import { AllowanceTable, type AllowanceRow } from "./allowance-table";

export default async function AllowancePage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/allowance");
  const data = await getAdminAllowancePageRealData(session.userId);
  const rows: AllowanceRow[] = data.rows.map(([student, grade, balance, lastTopUp, monthSpend, totalTopUps, status]) => ({
    student,
    grade,
    balance,
    lastTopUp,
    monthSpend,
    totalTopUps,
    status,
  }));

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={Wallet}>{data.warning}</AlertBanner> : null}
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>
      <DashboardCard
        title="Student wallet balances"
        icon={Wallet}
        bodyClassName="p-0"
      >
        <AllowanceTable rows={rows} />
      </DashboardCard>
    </>
  );
}

