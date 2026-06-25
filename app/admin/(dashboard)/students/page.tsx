import Link from "next/link";
import { AlertTriangle, UserPlus, Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminStudentPageData } from "@/lib/students/records";

import {
  AdminTable,
  AlertBanner,
  DashboardCard,
  KpiCard,
  KpiGrid,
  StatusPill,
} from "../../_components/admin-ui";
import { StudentEnrollmentForm } from "./student-enrollment-form";

export default async function StudentsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/students");
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

      <div id="add-student" className="scroll-mt-32">
        <DashboardCard title="Add student" icon={UserPlus} className="mb-5">
          <StudentEnrollmentForm
            ready={data.ready}
            gradeOptions={data.gradeOptions}
            sectionOptions={data.sectionOptions}
          />
        </DashboardCard>
      </div>

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
