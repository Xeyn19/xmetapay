import type { ReactNode } from "react";

import { consumeAuthFlashToast, requireSuperAdmin } from "@/lib/auth/session";
import { getSuperAdminDashboardData } from "@/lib/super-admin/records";
import { SuperAdminShell } from "./_components/super-admin-shell";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const session = await requireSuperAdmin();
  const [data, toast] = await Promise.all([
    getSuperAdminDashboardData(),
    consumeAuthFlashToast("super_admin"),
  ]);

  return (
    <SuperAdminShell
      pendingApprovals={data.stats.pendingAdmins}
      sessionName={session.name}
      toast={toast}
    >
      {children}
    </SuperAdminShell>
  );
}
