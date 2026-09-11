import { Plus, Users } from "lucide-react";

import { linkParentStudentAction } from "@/app/parent/student-link/actions";
import { requireRole } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/students/records";

import { ParentAlert, ParentButton, ParentCard, ParentField, parentControlClass } from "../../_components/parent-ui";
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
              Add your first student reference from the school to connect this parent account.
            </ParentAlert>
          </ParentCard>
        )}
      </section>

      <ParentCard title={hasLinkedStudents ? "Add another student" : "Add student reference"} icon={Plus} className="self-start">
        <p className="mb-4 text-[13px] leading-6 text-[#6b6b6b]">
          Use the student reference from the school. You can add more than one child to this parent account.
        </p>
        <form action={linkParentStudentAction} className="grid gap-3">
          <input type="hidden" name="redirectTo" value="/parent/students" />
          <ParentField label="Student reference" required>
            <input name="studentReference" className={parentControlClass} placeholder="e.g. BWA-2025-0312" required />
          </ParentField>
          <ParentButton type="submit" tone="primary" className="w-full">
            <Plus className="size-4" />
            {hasLinkedStudents ? "Add another student" : "Link student"}
          </ParentButton>
        </form>
      </ParentCard>
    </div>
  );
}
