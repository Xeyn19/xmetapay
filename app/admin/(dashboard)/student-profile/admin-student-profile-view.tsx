"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreditCard, History, IdCard, Plus, Users, Wallet } from "lucide-react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  type ExportColumn,
  exportRowsToExcel,
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
import { StudentProfileEditModal } from "./student-profile-edit-modal";

type StudentProfile = NonNullable<AdminStudentProfileRealData["student"]>;

export function AdminStudentProfileSelector({ students, schoolName, schoolYearName }: { students: AdminStudentProfileSummary[]; schoolName: string; schoolYearName: string | null }) {
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
        student.sex,
        student.studentType,
      ].join(" "),
    ),
    [enrollmentStatus, grade, guardianStatus, query, section, students],
  );
  const pagination = usePaginatedRows(
    filteredStudents,
    `${query}|${grade}|${section}|${enrollmentStatus}|${guardianStatus}`,
  );
  const hasActiveFilters = query.trim() !== "" || grade !== "all" || section !== "all" || enrollmentStatus !== "all" || guardianStatus !== "all";
  const resetFilters = () => {
    setQuery("");
    setGrade("all");
    setSection("all");
    setEnrollmentStatus("all");
    setGuardianStatus("all");
  };
  const exportColumns: ExportColumn<AdminStudentProfileSummary>[] = [
    { label: "Reference", value: (student) => student.studentReference },
    { label: "Full name", value: (student) => student.fullName },
    { label: "Grade", value: (student) => student.gradeName },
    { label: "Section", value: (student) => student.sectionName },
    { label: "Parent or guardian", value: (student) => student.guardians },
    { label: "Guardian link", value: (student) => student.guardianStatus },
    { label: "Enrollment status", value: (student) => student.enrollmentStatus },
    { label: "Student status", value: (student) => student.studentStatus },
    { label: "Sex", value: (student) => student.sex },
    { label: "Student type", value: (student) => student.studentType },
  ];
  const exportOptions = {
    context: [
      { label: "School", value: schoolName },
      { label: "School year", value: schoolYearName ?? "School year pending" },
    ],
    filters: [
      { label: "Search", value: query.trim() || "All students" },
      { label: "Grade", value: filterLabel(grade) },
      { label: "Section", value: filterLabel(section) },
      { label: "Enrollment", value: filterLabel(enrollmentStatus) },
      { label: "Guardian link", value: filterLabel(guardianStatus) },
    ],
    summary: [{ label: "Students", value: filteredStudents.length }],
  };

  return (
    <DashboardCard title={`Choose a student profile${schoolYearName ? ` - ${schoolYearName}` : ""}`} icon={IdCard} bodyClassName="p-0">
      <div className="border-b border-border bg-muted px-[18px] py-2.5 text-[11px] leading-4 text-muted-foreground">
        Showing all students in this school. Grade and section show their placement for {schoolYearName ?? "the selected school year"}; <span className="font-semibold">Pending</span> means no enrollment exists in that year yet.
      </div>
      <div className="border-b border-border px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search name, reference, guardian..."
          searchLabel="Search student profiles by name, reference, or guardian"
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
          onClear={resetFilters}
          clearLabel="Reset filters"
          clearDisabled={!hasActiveFilters}
          onExport={() => exportRowsToExcel("admin-student-profiles.xlsx", "Student profile selector", filteredStudents, exportColumns, { worksheetName: "Student profiles", ...exportOptions })}
          onExportPdf={() => exportRowsToPdf("admin-student-profiles.pdf", "Student profile selector", filteredStudents, exportColumns, exportOptions)}
          exportLabel="Export Excel"
          exportingLabel="Generating Excel..."
          exportDisabled={filteredStudents.length === 0}
        />
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite"><strong className="text-foreground">{filteredStudents.length}</strong> {filteredStudents.length === 1 ? "student" : "students"} shown</p>
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
                <Link href={student.profileHref} className="flex min-w-0 items-center gap-2.5 font-bold text-primary hover:underline">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-button-soft text-[11px] font-bold text-primary">
                    {student.initials}
                  </span>
                  <span className="min-w-0 truncate">{student.fullName}</span>
                </Link>
              </td>
              <td className="font-mono text-[11px] text-muted-foreground">{student.studentReference}</td>
              <td>{student.gradeSection}</td>
              <td>
                <div className="font-semibold text-foreground">{student.guardians}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{student.guardianStatus}</div>
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
            <td colSpan={5} className="py-8 text-center text-muted-foreground">
              {students.length === 0 ? "No student records yet." : <span>No students match the current filters. <button type="button" onClick={resetFilters} className="ml-1 min-h-11 font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Reset filters</button></span>}
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

function filterLabel(value: string) {
  return value === "all" ? "All" : value;
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
      <section className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-button-secondary px-5 py-5 text-button-secondary-foreground">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full border-[2.5px] border-current/20 bg-primary text-xl font-bold text-primary-foreground">
          {student.initials}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-[-0.02em]">{student.fullName}</h2>
          <p className="mt-0.5 text-xs opacity-70">{student.subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {student.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-current/15 px-2.5 py-1 text-[11px] font-bold">{tag}</span>
            ))}
          </div>
        </div>
        <div className="ml-auto flex gap-6 text-right">
          <div>
            <div className="text-lg font-bold">{student.walletBalance}</div>
            <div className="mt-0.5 text-[10.5px] opacity-60">Wallet balance</div>
          </div>
          <div>
            <div className="text-lg font-bold">{student.openBalance}</div>
            <div className="mt-0.5 text-[10.5px] opacity-60">Open balance</div>
          </div>
        </div>
      </section>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-3">
        <DashboardCard
          title="Student details"
          icon={IdCard}
          action={<StudentProfileEditModal studentId={student.id} fullName={student.fullName} editable={student.editable} />}
        >
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
                  <td className="font-mono text-[11px] text-muted-foreground">{date}</td>
                  <td className="font-bold">{description}</td>
                  <td className="font-bold text-primary">{amount}</td>
                  <td>{channel}</td>
                  <td className="font-semibold text-status-success-foreground">{status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground">
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
