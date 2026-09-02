import Link from "next/link";
import { KeyRound, Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/students/records";

import { ParentAlert, ParentCard } from "../../_components/parent-ui";
import { StudentProfileSelector } from "../student-profile/student-profile-view";

export default async function ParentStudentsPage() {
  const session = await requireRole("parent");
  const data = await getParentDashboardData(session.userId);
  const hasLinkedStudents = data.linkedStudents.length > 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        {hasLinkedStudents ? (
          <StudentProfileSelector students={data.linkedStudents} />
        ) : (
          <ParentCard title="My students" icon={Users}>
            <ParentAlert>
              Enter a school-issued invitation code to connect your first student.
            </ParentAlert>
          </ParentCard>
        )}
      </section>

      <ParentCard title={hasLinkedStudents ? "Add another student" : "Connect a student"} icon={KeyRound} className="self-start">
        <p className="mb-4 text-[13px] leading-6 text-[#6b6b6b]">
          Each child requires a separate single-use invitation from your school administrator.
        </p>
        <Link href="/parent/register" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#e64a19] px-3.5 text-[13px] font-medium text-white"><KeyRound className="size-4" />Enter invitation code</Link>
      </ParentCard>
    </div>
  );
}
