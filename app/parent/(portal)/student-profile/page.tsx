import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/students/records";

import { StudentProfileEmptyState, StudentProfileSelector } from "./student-profile-view";

export default async function StudentProfilePage() {
  const session = await requireRole("parent");
  const data = await getParentDashboardData(session.userId);

  if (data.linkedStudents.length === 0) {
    return <StudentProfileEmptyState />;
  }

  if (data.linkedStudents.length === 1) {
    redirect(data.linkedStudents[0].profileHref);
  }

  return <StudentProfileSelector students={data.linkedStudents} />;
}
