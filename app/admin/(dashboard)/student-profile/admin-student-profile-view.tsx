"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreditCard, Edit, History, IdCard, Plus, Users, Wallet } from "lucide-react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  exportRowsToCsv,
  exportRowsToPdf,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
import type { AdminStudentProfileRealData, AdminStudentProfileSummary } from "@/lib/admin/real-data";

import {
  AdminButton,
  AdminTable,
  DashboardCard,
  EmptyState,
  KpiCard,
  StatusPill,
  SummaryRows,
} from "../../_components/admin-ui";

type StudentProfile = NonNullable<AdminStudentProfileRealData["student"]>;

export function AdminStudentProfileSelector({ students }: { students: AdminStudentProfileSummary[] }) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [enrollmentStatus, setEnrollmentStatus] = useState("all");
  const [guardianStatus, setGuardianStatus] = useState("all");
  const sectionOptions = useMemo(() => {
    const source = grade === "all" ? students : students.filter((student) => student.gradeName === grade);

    return toFilterOptions(source.map((student) => student.sectionName), "All sections");
  }, [grade, students]);
  const filteredStudents = useMemo(
    () => filterByQuery(
      students.filter((student) =>
        (grade === "all" || student.gradeName === grade)
        && (section === "all" || student.sectionName === section)
        && (enrollmentStatus === "all" || student.enrollmentStatus === enrollmentStatus)
        && (guardianStatus === "all" || student.guardianStatus === guardianStatus)
      ),
      query,
      (student) => [
        student.fullName,
        student.studentReference,
        student.gradeName,
        student.sectionName,
        student.gradeSection,
        student.guardians,
        student.guardianStatus,
        student.enrollmentStatus,
      ].join(" "),
    ),
    [enrollmentStatus, grade, guardianStatus, query, section, students],
  );
  const pagination = usePaginatedRows(
    filteredStudents,
    `${query}|${grade}|${section}|${enrollmentStatus}|${guardianStatus}`,
  );

  return (
    <DashboardCard title="Choose a student profile" icon={IdCard} bodyClassName="p-0">
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search name, reference, guardian..."
          filters={[
            {
              label: "Grade",
              value: grade,
              onChange: (value) => {
                setGrade(value);
                setSection("all");
              },
              options: toFilterOptions(students.map((student) => student.gradeName), "All grades"),
            },
            { label: "Section", value: section, onChange: setSection, options: sectionOptions },
            {
              label: "Enrollment status",
              value: enrollmentStatus,
              onChange: setEnrollmentStatus,
              options: toFilterOptions(students.map((student) => student.enrollmentStatus), "All enrollment"),
            },
            {
              label: "Guardian link",
              value: guardianStatus,
              onChange: setGuardianStatus,
              options: toFilterOptions(students.map((student) => student.guardianStatus), "All guardian links"),
            },
          ]}
          onClear={() => {
            setQuery("");
            setGrade("all");
            setSection("all");
            setEnrollmentStatus("all");
            setGuardianStatus("all");
          }}
          onExport={() => exportRowsToCsv("admin-student-profiles.csv", filteredStudents, [
            { label: "Reference", value: (student) => student.studentReference },
            { label: "Full name", value: (student) => student.fullName },
            { label: "Grade", value: (student) => student.gradeName },
            { label: "Section", value: (student) => student.sectionName },
            { label: "Parent or guardian", value: (student) => student.guardians },
            { label: "Guardian link", value: (student) => student.guardianStatus },
            { label: "Enrollment status", value: (student) => student.enrollmentStatus },
            { label: "Student status", value: (student) => student.studentStatus },
          ])}
          onExportPdf={() => exportRowsToPdf("admin-student-profiles.pdf", "Student profile selector", filteredStudents, [
            { label: "Reference", value: (student) => student.studentReference },
            { label: "Full name", value: (student) => student.fullName },
            { label: "Grade", value: (student) => student.gradeName },
            { label: "Section", value: (student) => student.sectionName },
            { label: "Parent or guardian", value: (student) => student.guardians },
            { label: "Guardian link", value: (student) => student.guardianStatus },
            { label: "Enrollment status", value: (student) => student.enrollmentStatus },
            { label: "Student status", value: (student) => student.studentStatus },
          ])}
          exportDisabled={filteredStudents.length === 0}
        />
      </div>
      <AdminTable
        headers={[
          { label: "Student", className: "w-[28%]" },
          { label: "Reference", className: "w-[16%]" },
          { label: "Grade / section", className: "w-[20%]" },
          { label: "Parent / guardian", className: "w-[22%]" },
          { label: "Status", className: "w-[14%]" },
        ]}
      >
        {filteredStudents.length > 0 ? (
          pagination.pageRows.map((student) => (
            <tr key={student.id}>
              <td>
                <Link href={student.profileHref} className="flex min-w-0 items-center gap-2.5 font-bold text-[#e64a19] hover:underline">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#fff3e0] text-[11px] font-bold text-[#e64a19]">
                    {student.initials}
                  </span>
                  <span className="min-w-0 truncate">{student.fullName}</span>
                </Link>
              </td>
              <td className="font-mono text-[11px] text-[#5a6070]">{student.studentReference}</td>
              <td>{student.gradeSection}</td>
              <td>
                <div className="font-semibold text-[#0f1117]">{student.guardians}</div>
                <div className="mt-0.5 text-[11px] text-[#5a6070]">{student.guardianStatus}</div>
              </td>
              <td>
                <StatusPill tone={student.enrollmentStatus === "Enrolled" ? "enrolled" : "pending"}>
                  {student.enrollmentStatus}
                </StatusPill>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={5} className="text-center text-[#5a6070]">
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
    </DashboardCard>
  );
}

export function AdminStudentProfileEmptyState() {
  return (
    <DashboardCard title="Student profile" icon={IdCard} className="max-w-3xl">
      <EmptyState>No student profile is available yet. Add a student from the enrolled students page.</EmptyState>
    </DashboardCard>
  );
}

export function AdminStudentProfileView({ student }: { student: StudentProfile }) {
  const transactionsPagination = usePaginatedRows(student.transactions, student.id.toString());

  return (
    <>
      <section className="relative mb-5 flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl bg-[#0f1117] px-6 py-5 text-white">
        <div className="absolute -right-8 -top-8 size-36 rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-7 right-16 size-24 rounded-full bg-[#e64a19]/15" />
        <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full border-[2.5px] border-white/25 bg-[#e64a19] text-xl font-bold">
          {student.initials}
        </span>
        <div className="relative min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-[-0.02em]">{student.fullName}</h2>
          <p className="mt-0.5 text-xs text-white/60">{student.subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {student.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90">{tag}</span>
            ))}
          </div>
        </div>
        <div className="relative ml-auto flex gap-6 text-right">
          <div>
            <div className="text-lg font-bold">{student.walletBalance}</div>
            <div className="mt-0.5 text-[10.5px] text-white/50">Wallet balance</div>
          </div>
          <div>
            <div className="text-lg font-bold">{student.openBalance}</div>
            <div className="mt-0.5 text-[10.5px] text-white/50">Open balance</div>
          </div>
        </div>
      </section>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-3">
        <DashboardCard title="Student details" icon={IdCard} action={<AdminButton disabled><Edit className="size-4" />Edit pending</AdminButton>}>
          <SummaryRows rows={student.details} />
        </DashboardCard>
        <DashboardCard title="Parent / guardian" icon={Users}>
          <SummaryRows rows={student.guardian} />
        </DashboardCard>
        <DashboardCard title="Allowance wallet" icon={Wallet}>
          <div className="grid gap-3">
            <KpiCard {...student.wallet.kpi} />
            <SummaryRows rows={student.wallet.rows} />
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <DashboardCard
          title="Fee and payment status"
          icon={CreditCard}
          action={<AdminButton disabled><Plus className="size-4" />Record payment pending</AdminButton>}
        >
          <SummaryRows rows={student.fees} />
        </DashboardCard>

        <DashboardCard title="Recent transactions" icon={History} bodyClassName="p-0">
          <AdminTable
            headers={[
              { label: "Date", className: "w-[16%]" },
              { label: "Description", className: "w-[30%]" },
              { label: "Amount", className: "w-[18%]" },
              { label: "Channel", className: "w-[16%]" },
              { label: "Status", className: "w-[20%]" },
            ]}
          >
            {student.transactions.length > 0 ? (
              transactionsPagination.pageRows.map(([date, description, amount, channel, status]) => (
                <tr key={`${date}-${description}`}>
                  <td className="font-mono text-[11px] text-[#5a6070]">{date}</td>
                  <td className="font-bold">{description}</td>
                  <td className="font-bold text-[#e64a19]">{amount}</td>
                  <td>{channel}</td>
                  <td className="font-semibold text-[#2e7d32]">{status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-[#5a6070]">
                  No student payment transactions yet.
                </td>
              </tr>
            )}
          </AdminTable>
          <DashboardTablePagination
            page={transactionsPagination.page}
            pageSize={transactionsPagination.pageSize}
            pageCount={transactionsPagination.pageCount}
            totalItems={transactionsPagination.totalItems}
            startItem={transactionsPagination.startItem}
            endItem={transactionsPagination.endItem}
            onPageChange={transactionsPagination.setPage}
            onPageSizeChange={transactionsPagination.setPageSize}
          />
        </DashboardCard>
      </div>
    </>
  );
}
