"use client";

import Link from "next/link";
import { Download, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import {
  AdminButton,
  AdminTable,
  DashboardCard,
  KpiCard,
  KpiGrid,
  SearchInput,
  StatusPill,
  fieldControlClass,
} from "../../_components/admin-ui";
import { studentRows, studentsKpis } from "../../_data/admin-dashboard-data";

export default function StudentsPage() {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const rows = useMemo(() => {
    return studentRows.filter((row) => {
      const matchesQuery = !query || row.name.toLowerCase().includes(query.toLowerCase());
      const matchesGrade = !grade || row.grade === grade;
      return matchesQuery && matchesGrade;
    });
  }, [grade, query]);

  return (
    <>
      <KpiGrid>
        {studentsKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <DashboardCard
        title="Student registry - SY 2025-2026"
        icon={Users}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search student..." />
            <select className={fieldControlClass} value={grade} onChange={(event) => setGrade(event.target.value)}>
              <option value="">All grades</option>
              {["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <AdminButton tone="dark">
              <Download className="size-4" />
              Export
            </AdminButton>
            <AdminButton tone="primary">
              <UserPlus className="size-4" />
              Enroll student
            </AdminButton>
          </div>
        }
        bodyClassName="p-0"
      >
        <AdminTable
          headers={[
            { label: "ID", className: "w-[8%]" },
            { label: "Full name", className: "w-[19%]" },
            { label: "Grade", className: "w-[9%]" },
            { label: "Sec.", className: "w-[7%]" },
            { label: "Parent", className: "w-[15%]" },
            { label: "Contact", className: "w-[14%]" },
            { label: "Wallet", className: "w-[10%]" },
            { label: "Tuition", className: "w-[9%]" },
            { label: "Status", className: "w-[9%]" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.id}</td>
              <td>
                <Link href="/admin/student-profile" className="font-bold text-[#e64a19] hover:underline">
                  {row.name}
                </Link>
              </td>
              <td>{row.grade}</td>
              <td>{row.section}</td>
              <td>{row.parent}</td>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.contact}</td>
              <td className="font-bold text-[#e64a19]">{row.wallet}</td>
              <td>
                <StatusPill tone={row.tuition as "paid" | "partial" | "unpaid"}>
                  {row.tuition.charAt(0).toUpperCase() + row.tuition.slice(1)}
                </StatusPill>
              </td>
              <td>
                <StatusPill tone={row.status === "enrolled" ? "enrolled" : "inactive"}>
                  {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                </StatusPill>
              </td>
            </tr>
          ))}
        </AdminTable>
      </DashboardCard>
    </>
  );
}

