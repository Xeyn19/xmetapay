import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PORTAL_FILE = "xmeta-parent-portal.html";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  if (file !== PORTAL_FILE) {
    return new Response("Not found", { status: 404 });
  }

  const html = await readFile(join(process.cwd(), "app", "parent", PORTAL_FILE), "utf8");

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
