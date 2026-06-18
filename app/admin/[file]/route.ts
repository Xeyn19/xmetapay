const DASHBOARD_FILE = "xmeta-admin-dashboard_1.html";
const DASHBOARD_ROUTE = "/admin/dashboard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  if (file !== DASHBOARD_FILE) {
    return new Response("Not found", { status: 404 });
  }

  return Response.redirect(new URL(DASHBOARD_ROUTE, request.url), 308);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;

  if (file !== DASHBOARD_FILE) {
    return new Response("Not found", { status: 404 });
  }

  return Response.redirect(new URL(DASHBOARD_ROUTE, request.url), 303);
}
