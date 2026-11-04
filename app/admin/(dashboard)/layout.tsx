import { redirect } from "next/navigation";

import { FlashToast } from "@/app/_components/flash-toast";
import { consumeAuthFlashToast, requireRole } from "@/lib/auth/session";
import { canManageSchoolSetup } from "@/lib/admin/permissions";
import { getAdminSchoolContext } from "@/lib/school/setup";
import { AdminShell } from "../_components/admin-shell";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireRole("admin");
  const schoolContext = await getAdminSchoolContext(session.userId);
  const setupIncomplete = !schoolContext.databaseReady;

  if (setupIncomplete && canManageSchoolSetup(schoolContext.staffRole)) {
    redirect("/admin/onboarding/school-setup");
  }

  const toast = await consumeAuthFlashToast("admin");

  return (
    <AdminShell schoolContext={schoolContext}>
      <FlashToast toast={toast} />
      {children}
    </AdminShell>
  );
}

