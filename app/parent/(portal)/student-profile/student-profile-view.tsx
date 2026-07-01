"use client";

import Link from "next/link";
import { CreditCard, IdCard, Plus, Users, Wallet } from "lucide-react";

import { DashboardTablePagination, usePaginatedRows } from "@/app/_components/table-controls";
import { linkParentStudentAction } from "@/app/parent/student-link/actions";
import type { ParentLinkedStudent, ParentStudentProfileData } from "@/lib/students/records";

import {
  DetailRows,
  ParentAlert,
  ParentButton,
  ParentCard,
  ParentField,
  StatusPill,
  parentControlClass,
} from "../../_components/parent-ui";
import { ParentWalletActivityTable } from "../_components/parent-wallet-activity-table";

type StudentProfile = NonNullable<ParentStudentProfileData["student"]>;

export function StudentProfileEmptyState() {
  return (
    <ParentCard title="Student profile" icon={IdCard} className="max-w-3xl">
      <ParentAlert>
        Link your parent portal to a student reference before viewing student profile details.
      </ParentAlert>
      <form action={linkParentStudentAction} className="grid gap-3">
        <ParentField label="Student reference" required>
          <input name="studentReference" className={parentControlClass} placeholder="e.g. BWA-2025-0312" required />
        </ParentField>
        <ParentButton type="submit" tone="primary" className="w-full min-[420px]:w-auto">
          <Plus className="size-4" />
          Link student
        </ParentButton>
      </form>
    </ParentCard>
  );
}

export function StudentProfileSelector({ students }: { students: ParentLinkedStudent[] }) {
  const pagination = usePaginatedRows(students, "linked-students");

  return (
    <ParentCard title="Choose a student profile" icon={IdCard} bodyClassName="p-0">
      <div className="divide-y divide-black/[0.08]">
        {pagination.pageRows.map((student) => (
          <Link
            key={student.id}
            href={student.profileHref}
            className="flex flex-col gap-3 px-4 py-4 transition hover:bg-[#f8f8f7] focus:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[#e64a19]/20 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-[#fbe9e7] text-lg font-semibold text-[#e64a19]">
                {student.initials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium text-[#1a1a1a]">{student.fullName}</div>
                <div className="mt-0.5 truncate text-xs text-[#6b6b6b]">{student.meta}</div>
              </div>
            </div>
            <StatusPill tone={student.status === "active" ? "blue" : "muted"}>
              {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
            </StatusPill>
          </Link>
        ))}
      </div>
      <DashboardTablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        totalItems={pagination.totalItems}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        tone="parent"
      />
    </ParentCard>
  );
}

export function StudentProfileView({ student }: { student: StudentProfile }) {
  return (
    <>
      <section className="relative mb-5 flex flex-wrap items-center gap-5 overflow-hidden rounded-[20px] bg-[#e64a19] px-6 py-6 text-white">
        <div className="absolute -right-8 -top-8 size-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 right-24 size-28 rounded-full bg-black/10" />
        <span className="relative flex size-16 items-center justify-center rounded-full border-2 border-white/25 bg-white/15 text-xl font-semibold">
          {student.initials}
        </span>
        <div className="relative min-w-0 flex-1">
          <h2 className="text-[22px] font-bold">{student.fullName}</h2>
          <p className="mt-1 text-[13px] text-white/80">
            {student.schoolName} - SY {student.schoolYearName}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {student.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{tag}</span>
            ))}
          </div>
        </div>
        <div className="relative flex flex-wrap gap-5 text-center min-[520px]:gap-7">
          {student.stats.map((stat) => (
            <div key={stat.label}>
              <div className="text-xl font-bold">{stat.value}</div>
              <div className="mt-0.5 text-[11px] text-white/75">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <ParentCard title="Student details" icon={IdCard}><DetailRows rows={student.studentDetails} /></ParentCard>
        <ParentCard title="Parent / guardian" icon={Users}><DetailRows rows={student.guardianDetails} /></ParentCard>
        <ParentCard title="Allowance wallet" icon={Wallet} action={<Link href="/parent/wallet"><ParentButton tone="primary"><Plus className="size-4" />Top-up</ParentButton></Link>}>
          <DetailRows rows={student.walletDetails} />
        </ParentCard>
      </div>

      <ParentCard title="Fees and payments" icon={CreditCard}>
        <div className="flex flex-wrap gap-2">
          <Link href="/parent/fees"><ParentButton>View fee summary</ParentButton></Link>
          <Link href="/parent/pay-tuition"><ParentButton tone="primary">Pay outstanding fees</ParentButton></Link>
        </div>
      </ParentCard>

      <ParentCard
        title="Recent wallet activity"
        icon={Wallet}
        bodyClassName="p-0"
        className="mt-5"
        action={(
          <Link href="/parent/wallet">
            <ParentButton>View full history</ParentButton>
          </Link>
        )}
      >
        <ParentWalletActivityTable
          rows={student.walletActivity}
          csvFilename={`parent-${student.id}-wallet-activity.csv`}
          showStudent={false}
        />
      </ParentCard>
    </>
  );
}
