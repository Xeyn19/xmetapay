import { notFound } from "next/navigation";
import { IdCard } from "lucide-react";

import { requireAdminPageAccess } from "@/lib/admin/access";
import { requireRole } from "@/lib/auth/session";
import { getAdminStudentProfileRealData } from "@/lib/admin/real-data";

import { AlertBanner } from "../../../_components/admin-ui";
import { AdminStudentProfileEmptyState, AdminStudentProfileView } from "../../student-profile/admin-student-profile-view";

export default async function SelectedAdminStudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/student-profile");
  const { studentId } = await params;
  const selectedStudentId = Number(studentId);

  if (!Number.isInteger(selectedStudentId) || selectedStudentId <= 0) {
    notFound();
  }

  const data = await getAdminStudentProfileRealData(session.userId, selectedStudentId);

  if (!data.student && data.students.length > 0) {
    notFound();
  }

  return (
    <>
      {data.warning ? <AlertBanner tone="warn" icon={IdCard}>{data.warning}</AlertBanner> : null}
      {data.student ? <AdminStudentProfileView student={data.student} /> : <AdminStudentProfileEmptyState />}
    </>
  );
}
