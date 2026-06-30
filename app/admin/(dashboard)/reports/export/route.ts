import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminReportExport, isReportExportType } from "@/lib/admin/report-exports";
import { requireRole } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/reports");

  const type = new URL(request.url).searchParams.get("type");

  if (!isReportExportType(type)) {
    return new Response("Invalid report export type.", { status: 400 });
  }

  const report = await getAdminReportExport(session.userId, type);

  return new Response(report.csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
