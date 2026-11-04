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
          Submit your child’s official student details. The school must approve the connection before records appear here.
            </ParentAlert>
          </ParentCard>
        )}
      </section>

      <ParentCard title={hasLinkedStudents ? "Add another student" : "Add student reference"} icon={Plus} className="self-start">
        <p className="mb-4 text-[13px] leading-6 text-muted-foreground">
          Enter the exact reference and official name. We search only your assigned school and never display student search results.
        </p>
        <form action={linkParentStudentAction} className="grid gap-3">
          <input type="hidden" name="redirectTo" value="/parent/students" />
          <ParentField label="Student reference" required>
            <input name="studentReference" className={parentControlClass} placeholder="e.g. BWA-2025-0312" required />
          </ParentField>
          <ParentField label="Student first name" required>
            <input name="studentFirstName" className={parentControlClass} placeholder="Juan Miguel" required />
          </ParentField>
          <ParentField label="Student last name" required>
            <input name="studentLastName" className={parentControlClass} placeholder="Santos" required />
          </ParentField>
          <ParentButton type="submit" tone="primary" className="w-full">
            <Plus className="size-4" />
            {hasLinkedStudents ? "Request another connection" : "Request connection"}
          </ParentButton>
        </form>
      </ParentCard>
    </div>
  );
}
