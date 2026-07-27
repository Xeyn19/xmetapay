import { requireAdminPageAccess } from "@/lib/admin/access";
import {
  getAdminReportExport,
  getAdminReportExportData,
  getAdminReportExcel,
  getAdminReportPdf,
  isReportExportFormat,
  isReportExportType,
} from "@/lib/admin/report-exports";
import { requireRole } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/reports");

  const searchParams = new URL(request.url).searchParams;
  const type = searchParams.get("type");
  const format = searchParams.get("format") ?? "csv";

  if (!isReportExportType(type)) {
    return new Response("Invalid report export type.", { status: 400 });
  }

  if (!isReportExportFormat(format)) {
    return new Response("Invalid report export format.", { status: 400 });
  }

  if (format === "pdf") {
    const report = await getAdminReportExportData(session.userId, type);
    const pdf = await getAdminReportPdf(report);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Disposition": `attachment; filename="${report.filenameBase}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  }

  if (format === "xlsx") {
    const report = await getAdminReportExportData(session.userId, type);
    const workbook = await getAdminReportExcel(report);

    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Disposition": `attachment; filename="${report.filenameBase}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  }

  const report = await getAdminReportExport(session.userId, type);

  return new Response(report.csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
