import { IdCard } from "lucide-react";

import { requireAdminPageAccess } from "@/lib/admin/access";
import { requireRole } from "@/lib/auth/session";
import { getAdminStudentProfileRealData } from "@/lib/admin/real-data";

import { AlertBanner } from "../../_components/admin-ui";
import { AdminStudentProfileEmptyState, AdminStudentProfileSelector } from "./admin-student-profile-view";

export default async function StudentProfilePage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/student-profile");
  const data = await getAdminStudentProfileRealData(session.userId);

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={IdCard}>{data.warning}</AlertBanner> : null}
      {data.students.length > 0 ? (
        <AdminStudentProfileSelector students={data.students} schoolYearName={data.schoolYearName} />
      ) : (
        <AdminStudentProfileEmptyState />
      )}
    </>
  );
}
