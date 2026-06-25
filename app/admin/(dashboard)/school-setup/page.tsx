import { Building2, Info } from "lucide-react";

import { AlertBanner, DashboardCard } from "@/app/admin/_components/admin-ui";
import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminSchoolSetupFormData } from "@/lib/school/setup";

import { ManualSchoolSetupForm } from "./manual-school-setup-form";

export default async function AdminSchoolSetupPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/school-setup");
  const initialData = await getAdminSchoolSetupFormData(session.userId);

  return (
    <div className="grid gap-5">
      <AlertBanner tone="info" icon={Info}>
        Complete this once after admin registration. These records control student enrollment, tuition setup,
        parent linking context, and future reports.
      </AlertBanner>

      <DashboardCard title="Set up school records" icon={Building2} bodyClassName="bg-[#f7f8fa]">
        <ManualSchoolSetupForm initialData={initialData} />
      </DashboardCard>
    </div>
  );
}
