import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/session";
import { getParentStudentProfileData } from "@/lib/students/records";

import { StudentProfileView } from "../../student-profile/student-profile-view";

export default async function SelectedStudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const session = await requireRole("parent");
  const { studentId } = await params;
  const selectedStudentId = Number(studentId);

  if (!Number.isSafeInteger(selectedStudentId) || selectedStudentId <= 0) {
    notFound();
  }

  const data = await getParentStudentProfileData(session.userId, session.name, selectedStudentId);

  if (!data.student) {
    notFound();
  }

  return <StudentProfileView student={data.student} />;
}
