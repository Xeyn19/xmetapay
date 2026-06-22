import { clearAuthFlashToast } from "@/lib/auth/session";

export async function DELETE() {
  await clearAuthFlashToast();

  return new Response(null, { status: 204 });
}
