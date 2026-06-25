import { requireRole } from "@/lib/auth/session";
import { getParentStudentProfileData } from "@/lib/students/records";

import { StudentProfileEmptyState, StudentProfileView } from "./student-profile-view";

export default async function StudentProfilePage() {
  const session = await requireRole("parent");
  const data = await getParentStudentProfileData(session.userId, session.name);

  if (!data.student) {
    return <StudentProfileEmptyState />;
  }

  return <StudentProfileView student={data.student} />;
}
