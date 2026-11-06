import { BarChart3, FileText } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminReportsPageRealData } from "@/lib/admin/real-data";

import {
  AlertBanner,
  BarList,
  DashboardCard,
  KpiCard,
  KpiGrid,
} from "../../_components/admin-ui";
import { ReportDownloadMenu } from "./report-download-menu";

export default async function ReportsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/reports");
  const data = await getAdminReportsPageRealData(session.userId);

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={BarChart3}>{data.warning}</AlertBanner> : null}
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <DashboardCard title="Downloadable reports" icon={FileText} bodyClassName="p-0">
          <div className="divide-y divide-border">
            {data.reports.map((report) => {
              const Icon = report.icon;
              return (
                <div
                  key={report.name}
                  data-report-row={report.name}
                  className="flex flex-wrap items-center justify-between gap-4 px-[18px] py-3 text-foreground transition hover:bg-muted"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-button-soft text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-foreground">{report.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{report.desc}</div>
                    </div>
                  </div>
                  <ReportDownloadMenu excelHref={report.excelHref} pdfHref={report.pdfHref} reportName={report.name} />
                </div>
              );
            })}
          </div>
        </DashboardCard>

        <DashboardCard
          title="Monthly revenue trend"
          icon={BarChart3}
          action={<ReportDownloadMenu excelHref="/admin/reports/export?type=monthly-revenue&format=xlsx" pdfHref="/admin/reports/export?type=monthly-revenue&format=pdf" reportName="Monthly revenue" />}
        >
          {data.monthlyRevenue.length > 0 ? (
            <BarList rows={data.monthlyRevenue} />
          ) : (
            <div className="text-[12.5px] leading-5 text-muted-foreground">Revenue trend is pending until paid payment records exist.</div>
          )}
          <div className="mt-3 text-[11px] text-muted-foreground">
            <span className="mr-1 inline-block size-2.5 rounded-sm bg-primary align-[-1px]" />
            Collected
            <span className="ml-3 mr-1 inline-block size-2.5 rounded-sm bg-status-info-foreground align-[-1px]" />
            Partial / in progress
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

