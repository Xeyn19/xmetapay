import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DASHBOARD_FILE = "xmeta-admin-dashboard_1.html";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  if (file !== DASHBOARD_FILE) {
    return new Response("Not found", { status: 404 });
  }

  const html = await readFile(join(process.cwd(), "app", "admin", DASHBOARD_FILE), "utf8");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ file: string }> },
) {
  return GET(request, context);
}
