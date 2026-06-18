import Link from "next/link";
import { UserPlus } from "lucide-react";

import { ParentButton, ParentCard, ParentField, parentControlClass } from "../../_components/parent-ui";

export default function EnrollStudentPage() {
  return (
    <ParentCard
      title="Student information"
      icon={UserPlus}
      action={<StepPill step="1" />}
      className="max-w-5xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ParentField label="Last name" required><input className={parentControlClass} placeholder="Santos" /></ParentField>
        <ParentField label="First name" required><input className={parentControlClass} placeholder="Juan Miguel" /></ParentField>
        <ParentField label="Middle name"><input className={parentControlClass} placeholder="Optional" /></ParentField>
        <ParentField label="Sex" required><select className={parentControlClass}><option>Male</option><option>Female</option></select></ParentField>
        <ParentField label="Date of birth" required><input className={parentControlClass} type="date" defaultValue="2012-03-12" /></ParentField>
        <ParentField label="Grade level" required><select className={parentControlClass} defaultValue="Grade 7"><option>Grade 4</option><option>Grade 5</option><option>Grade 6</option><option>Grade 7</option><option>Grade 8</option></select></ParentField>
        <ParentField label="Student type"><select className={parentControlClass}><option>New</option><option>Transferee</option><option>Returnee</option></select></ParentField>
        <ParentField label="School year" required><select className={parentControlClass}><option>2025-2026</option><option>2024-2025</option></select></ParentField>
        <ParentField label="LRN" className="sm:col-span-2"><input className={parentControlClass} placeholder="12-digit learner reference number" /></ParentField>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Link href="/parent/dashboard"><ParentButton>Cancel</ParentButton></Link>
        <Link href="/parent/enroll/family"><ParentButton tone="primary">Continue</ParentButton></Link>
      </div>
    </ParentCard>
  );
}

function StepPill({ step }: { step: string }) {
  return <span className="rounded-full bg-[#fbe9e7] px-3 py-1 text-xs font-semibold text-[#e64a19]">Step {step} of 3</span>;
}

