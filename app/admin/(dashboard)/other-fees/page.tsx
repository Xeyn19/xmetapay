import { ClipboardList, Download, Plus } from "lucide-react";

import { AdminButton, DashboardCard, KpiCard, KpiGrid, StatusPill } from "../../_components/admin-ui";
import { feeItems, otherFeesKpis } from "../../_data/admin-dashboard-data";

export default function OtherFeesPage() {
  return (
    <>
      <KpiGrid>
        {otherFeesKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard
        title="Other school fees - SY 2025-2026"
        icon={ClipboardList}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton tone="dark"><Plus className="size-4" />Add fee type</AdminButton>
            <AdminButton><Download className="size-4" />Export</AdminButton>
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="divide-y divide-black/[0.07]">
          {feeItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.name} className="flex flex-wrap items-center justify-between gap-4 px-[18px] py-3 transition hover:bg-[#f7f8fa]">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-[#fbe9e7] text-[#e64a19]">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <div className="text-[13px] font-bold text-[#0f1117]">{item.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#5a6070]">{item.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <div className="text-sm font-bold">{item.amount}</div>
                    <div className="text-[11px] text-[#5a6070]">Collected {item.collected}</div>
                  </div>
                  <StatusPill tone="active">{item.status}</StatusPill>
                </div>
              </div>
            );
          })}
        </div>
      </DashboardCard>
    </>
  );
}

