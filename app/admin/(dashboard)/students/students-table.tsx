"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  exportRowsToCsv,
  exportRowsToPdf,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
import type { AdminStudentRow } from "@/lib/students/records";

import { AdminTable, StatusPill } from "../../_components/admin-ui";

export function StudentsTable({ students }: { students: AdminStudentRow[] }) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [status, setStatus] = useState("all");
  const filteredStudents = useMemo(
    () => filterByQuery(
      students.filter((student) =>
        (grade === "all" || student.grade === grade)
        && (status === "all" || student.enrollmentStatus === status)
      ),
      query,
      (student) => Object.values(student).join(" "),
    ),
    [grade, query, status, students],
  );
  const pagination = usePaginatedRows(filteredStudents, `${query}|${grade}|${status}`);

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search students..."
          filters={[
            { label: "Grade", value: grade, onChange: setGrade, options: toFilterOptions(students.map((student) => student.grade), "All grades") },
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(students.map((student) => student.enrollmentStatus), "All statuses") },
          ]}
          onClear={() => {
            setQuery("");
            setGrade("all");
            setStatus("all");
          }}
          onExport={() => exportRowsToCsv("admin-students.csv", filteredStudents, [
            { label: "Reference", value: (student) => student.studentReference },
            { label: "Full name", value: (student) => student.fullName },
            { label: "Grade", value: (student) => student.grade },
            { label: "Section", value: (student) => student.section },
            { label: "Parent or guardian", value: (student) => student.guardians },
            { label: "Contact", value: (student) => student.guardianContact },
            { label: "Enrollment status", value: (student) => student.enrollmentStatus },
            { label: "Student status", value: (student) => student.studentStatus },
          ])}
          onExportPdf={() => exportRowsToPdf("admin-students.pdf", "Enrolled students", filteredStudents, [
            { label: "Reference", value: (student) => student.studentReference },
            { label: "Full name", value: (student) => student.fullName },
            { label: "Grade", value: (student) => student.grade },
            { label: "Section", value: (student) => student.section },
            { label: "Parent or guardian", value: (student) => student.guardians },
            { label: "Contact", value: (student) => student.guardianContact },
            { label: "Enrollment status", value: (student) => student.enrollmentStatus },
            { label: "Student status", value: (student) => student.studentStatus },
          ])}
          exportDisabled={filteredStudents.length === 0}
        />
      </div>
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
        {filteredStudents.length > 0 ? (
          pagination.pageRows.map((row) => (
            <tr key={row.id}>
              <td className="font-mono text-[11px] text-[#5a6070]">{row.studentReference}</td>
              <td>
                <Link href={`/admin/students/${row.id}`} className="font-bold text-[#e64a19] hover:underline">
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
              {students.length === 0 ? "No student records yet." : "No students match the current filters."}
            </td>
          </tr>
        )}
      </AdminTable>
      <DashboardTablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        totalItems={pagination.totalItems}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </>
  );
}
