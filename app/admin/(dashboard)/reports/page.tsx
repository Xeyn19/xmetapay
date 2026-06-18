import { BarChart3, Download, FileText } from "lucide-react";

import {
  AdminButton,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
} from "../../_components/admin-ui";
import { downloadableReports, monthlyRevenue, reportKpis } from "../../_data/admin-dashboard-data";

export default function ReportsPage() {
  return (
    <>
      <KpiGrid>
        {reportKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <DashboardCard
          title="Monthly revenue trend"
          icon={BarChart3}
          action={<AdminButton tone="dark"><Download className="size-4" />Export PDF</AdminButton>}
        >
          <BarList rows={monthlyRevenue} />
          <div className="mt-3 text-[11px] text-[#9ba3b8]">
            <span className="mr-1 inline-block size-2.5 rounded-sm bg-[#e64a19] align-[-1px]" />
            Collected
            <span className="ml-3 mr-1 inline-block size-2.5 rounded-sm bg-[#1565c0] align-[-1px]" />
            Partial / in progress
          </div>
        </DashboardCard>

        <DashboardCard title="Downloadable reports" icon={FileText} bodyClassName="p-0">
          <div className="divide-y divide-black/[0.07]">
            {downloadableReports.map((report) => {
              const Icon = report.icon;
              return (
                <div key={report.name} className="flex flex-wrap items-center justify-between gap-4 px-[18px] py-3 transition hover:bg-[#f7f8fa]">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-[#fbe9e7] text-[#e64a19]">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <div className="text-[13px] font-bold text-[#0f1117]">{report.name}</div>
                      <div className="mt-0.5 text-[11px] text-[#5a6070]">{report.desc}</div>
                    </div>
                  </div>
                  <AdminButton tone="dark"><Download className="size-4" />{report.format}</AdminButton>
                </div>
              );
            })}
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

