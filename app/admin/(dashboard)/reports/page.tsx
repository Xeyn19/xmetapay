import { BarChart3, Download, FileText } from "lucide-react";

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
        <DashboardCard
          title="Monthly revenue trend"
          icon={BarChart3}
          action={<ReportDownloadLink href="/admin/reports/export?type=monthly-revenue">Export CSV</ReportDownloadLink>}
        >
          {data.monthlyRevenue.length > 0 ? (
            <BarList rows={data.monthlyRevenue} />
          ) : (
            <div className="text-[12.5px] leading-5 text-[#5a6070]">Revenue trend is pending until paid payment records exist.</div>
          )}
          <div className="mt-3 text-[11px] text-[#9ba3b8]">
            <span className="mr-1 inline-block size-2.5 rounded-sm bg-[#e64a19] align-[-1px]" />
            Collected
            <span className="ml-3 mr-1 inline-block size-2.5 rounded-sm bg-[#1565c0] align-[-1px]" />
            Partial / in progress
          </div>
        </DashboardCard>

        <DashboardCard title="Downloadable reports" icon={FileText} bodyClassName="p-0">
          <div className="divide-y divide-black/[0.07]">
            {data.reports.map((report) => {
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
                  <ReportDownloadLink href={report.href}>{report.format}</ReportDownloadLink>
                </div>
              );
            })}
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

function ReportDownloadLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#0f1117] bg-[#0f1117] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#2d3348] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
    >
      <Download className="size-4" />
      {children}
    </a>
  );
}

