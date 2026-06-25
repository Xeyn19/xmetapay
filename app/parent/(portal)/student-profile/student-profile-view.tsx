import Link from "next/link";
import { CreditCard, IdCard, Plus, Users, Wallet } from "lucide-react";

import { linkParentStudentAction } from "@/app/parent/student-link/actions";
import type { ParentStudentProfileData } from "@/lib/students/records";

import {
  DetailRows,
  ParentAlert,
  ParentButton,
  ParentCard,
  ParentField,
  parentControlClass,
} from "../../_components/parent-ui";

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
          <DetailRows rows={[
            { label: "Current balance", value: "Pending" },
            { label: "Monthly spend", value: "Pending" },
            { label: "Last top-up", value: "Pending" },
            { label: "Status", value: "Wallet backend pending" },
          ]} />
        </ParentCard>
      </div>

      <ParentCard title="Fees and payments" icon={CreditCard}>
        <div className="flex flex-wrap gap-2">
          <Link href="/parent/fees"><ParentButton>View fee summary</ParentButton></Link>
          <Link href="/parent/pay-tuition"><ParentButton tone="primary">Pay outstanding fees</ParentButton></Link>
        </div>
      </ParentCard>
    </>
  );
}
