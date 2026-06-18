import { Download, Search, Users } from "lucide-react";

import {
  AdminButton,
  AdminTable,
  DashboardCard,
  KpiCard,
  KpiGrid,
  SearchInput,
  StatusPill,
} from "../../_components/admin-ui";
import { parentKpis, parentRows } from "../../_data/admin-dashboard-data";

export default function ParentsPage() {
  return (
    <>
      <KpiGrid>
        {parentKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>
      <DashboardCard
        title="Parent and guardian contacts"
        icon={Users}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder="Search parent or student..." readOnly />
            <AdminButton><Search className="size-4" />Filter</AdminButton>
            <AdminButton tone="dark"><Download className="size-4" />Export</AdminButton>
          </div>
        }
        bodyClassName="p-0"
      >
        <AdminTable
          headers={[
            { label: "Parent name", className: "w-[18%]" },
            { label: "Student(s)", className: "w-[16%]" },
            { label: "Grade", className: "w-[9%]" },
            { label: "Contact number", className: "w-[16%]" },
            { label: "Email address", className: "w-[21%]" },
            { label: "Wallet total", className: "w-[11%]" },
            { label: "Status", className: "w-[9%]" },
          ]}
        >
          {parentRows.map(([parent, students, grade, contact, email, wallet, status]) => (
            <tr key={parent}>
              <td className="font-bold">{parent}</td>
              <td>{students}</td>
              <td>{grade}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{contact}</td>
              <td>{email}</td>
              <td className="font-bold text-[#e64a19]">{wallet}</td>
              <td><StatusPill tone={status === "Low" ? "low" : status === "No balance" ? "inactive" : "active"}>{status}</StatusPill></td>
            </tr>
          ))}
        </AdminTable>
      </DashboardCard>
    </>
  );
}

