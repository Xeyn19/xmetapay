import Link from "next/link";
import { AlertTriangle, UserPlus, Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getAdminStudentPageData } from "@/lib/students/records";

import { createStudentAction } from "@/app/admin/students/actions";
import {
  AdminButton,
  AdminTable,
  AlertBanner,
  DashboardCard,
  Field,
  KpiCard,
  KpiGrid,
  StatusPill,
  fieldControlClass,
} from "../../_components/admin-ui";

export default async function StudentsPage() {
  const session = await requireRole("admin");
  const data = await getAdminStudentPageData(session.userId);

  return (
    <>
      {data.warning ? (
        <AlertBanner tone="warn" icon={AlertTriangle}>
          {data.warning}
        </AlertBanner>
      ) : null}

      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard title="Add student" icon={UserPlus} className="mb-5">
        <form action={createStudentAction} className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Student reference" required>
            <input name="studentReference" className={fieldControlClass} placeholder="e.g. BWA-2025-0312" required />
          </Field>
          <Field label="First name" required>
            <input name="firstName" className={fieldControlClass} placeholder="Juan Miguel" required />
          </Field>
          <Field label="Middle name">
            <input name="middleName" className={fieldControlClass} placeholder="Optional" />
          </Field>
          <Field label="Last name" required>
            <input name="lastName" className={fieldControlClass} placeholder="Santos" required />
          </Field>
          <Field label="Birthdate">
            <input name="birthdate" className={fieldControlClass} type="date" />
          </Field>
          <Field label="Grade level" required>
            <select name="gradeLevelId" className={fieldControlClass} required disabled={!data.ready}>
              <option value="">Choose grade</option>
              {data.gradeOptions.map((grade) => (
                <option key={grade.id} value={grade.id}>{grade.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Section" required>
            <select name="sectionId" className={fieldControlClass} required disabled={!data.ready}>
              <option value="">Choose section</option>
              {data.sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>{section.label}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <AdminButton type="submit" tone="primary" className="w-full" disabled={!data.ready}>
              <UserPlus className="size-4" />
              Enroll student
            </AdminButton>
          </div>
        </form>
      </DashboardCard>

      <DashboardCard
        title={`Student registry - ${data.activeSchoolYearName ?? "School year pending"}`}
        icon={Users}
        bodyClassName="p-0"
      >
        <AdminTable
          headers={[
            { label: "Reference", className: "w-[13%]" },
            { label: "Full name", className: "w-[20%]" },
            { label: "Grade", className: "w-[11%]" },
            { label: "Section", className: "w-[10%]" },
            { label: "Parent/guardian", className: "w-[18%]" },
            { label: "Contact", className: "w-[16%]" },
            { label: "Status", className: "w-[12%]" },
          ]}
        >
          {data.students.length > 0 ? (
            data.students.map((row) => (
              <tr key={row.id}>
                <td className="font-mono text-[11px] text-[#5a6070]">{row.studentReference}</td>
                <td>
                  <Link href="/admin/student-profile" className="font-bold text-[#e64a19] hover:underline">
                    {row.fullName}
                  </Link>
                </td>
                <td>{row.grade}</td>
                <td>{row.section}</td>
                <td>{row.guardians}</td>
                <td className="font-mono text-[11px] text-[#5a6070]">{row.guardianContact}</td>
                <td>
                  <StatusPill tone={row.enrollmentStatus === "enrolled" ? "enrolled" : "pending"}>
                    {row.enrollmentStatus.charAt(0).toUpperCase() + row.enrollmentStatus.slice(1)}
                  </StatusPill>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center text-[#5a6070]">
                No student records yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </DashboardCard>
    </>
  );
}
