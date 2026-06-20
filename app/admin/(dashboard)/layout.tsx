import { AdminShell } from "../_components/admin-shell";
import { requireRole } from "@/lib/auth/session";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("admin");

  return <AdminShell>{children}</AdminShell>;
}

