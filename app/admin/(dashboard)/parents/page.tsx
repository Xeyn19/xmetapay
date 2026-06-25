import { Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { requireAdminPageAccess } from "@/lib/admin/access";
import { getAdminParentsPageData } from "@/lib/students/records";

import {
  AdminTable,
  DashboardCard,
  KpiCard,
  KpiGrid,
  StatusPill,
} from "../../_components/admin-ui";

export default async function ParentsPage() {
  const session = await requireRole("admin");
  await requireAdminPageAccess(session.userId, "/admin/parents");
  const data = await getAdminParentsPageData(session.userId);

  return (
    <>
      <KpiGrid>
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>
      <DashboardCard title="Parent and guardian contacts" icon={Users} bodyClassName="p-0">
        <AdminTable
          headers={[
            { label: "Parent name", className: "w-[18%]" },
            { label: "Student(s)", className: "w-[18%]" },
            { label: "Grade", className: "w-[12%]" },
            { label: "Contact number", className: "w-[15%]" },
            { label: "Email address", className: "w-[20%]" },
            { label: "Relationship", className: "w-[9%]" },
            { label: "Status", className: "w-[8%]" },
          ]}
        >
          {data.rows.length > 0 ? (
            data.rows.map((row) => (
              <tr key={`${row.parentName}-${row.email}-${row.students}`}>
                <td className="font-bold">{row.parentName}</td>
                <td>{row.students}</td>
                <td>{row.grade}</td>
                <td className="font-mono text-[11px] text-[#5a6070]">{row.contact}</td>
                <td>{row.email}</td>
                <td>{row.relationship}</td>
                <td>
                  <StatusPill tone={row.status === "Linked" ? "active" : "pending"}>{row.status}</StatusPill>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center text-[#5a6070]">
                No linked parent records yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </DashboardCard>
    </>
  );
}
