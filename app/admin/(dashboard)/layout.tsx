import { FlashToast } from "@/app/_components/flash-toast";
import { consumeAuthFlashToast, requireRole } from "@/lib/auth/session";
import { AdminShell } from "../_components/admin-shell";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("admin");
  const toast = await consumeAuthFlashToast("admin");

  return (
    <AdminShell>
      <FlashToast toast={toast} />
      {children}
    </AdminShell>
  );
}

