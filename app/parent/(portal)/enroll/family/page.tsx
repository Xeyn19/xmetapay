import Link from "next/link";
import { Camera, FileText, Users } from "lucide-react";

import { ParentButton, ParentCard, ParentField, VisualCheckbox, parentControlClass } from "../../../_components/parent-ui";

export default function EnrollFamilyPage() {
  return (
    <div className="grid max-w-6xl gap-5 xl:grid-cols-2">
      <ParentCard title="Parent / guardian information" icon={Users} action={<span className="rounded-full bg-[#fbe9e7] px-3 py-1 text-xs font-semibold text-[#e64a19]">Step 2 of 3</span>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ParentField label="Guardian name" required><input className={parentControlClass} defaultValue="Maria Santos" /></ParentField>
          <ParentField label="Relationship"><select className={parentControlClass}><option>Mother</option><option>Father</option><option>Guardian</option></select></ParentField>
          <ParentField label="Mobile number" required><input className={parentControlClass} defaultValue="0917-234-5678" /></ParentField>
          <ParentField label="Email"><input className={parentControlClass} defaultValue="maria@email.com" /></ParentField>
          <ParentField label="Address" className="sm:col-span-2"><textarea className={`${parentControlClass} h-20 py-2`} defaultValue="Las Pinas City" /></ParentField>
        </div>
      </ParentCard>

      <div className="grid gap-5">
        <ParentCard title="Student photo" icon={Camera}>
          <div className="flex h-36 items-center justify-center rounded-[14px] border border-dashed border-black/15 bg-[#f8f8f7] text-sm text-[#6b6b6b]">
            Upload photo placeholder
          </div>
        </ParentCard>
        <ParentCard title="Required documents" icon={FileText}>
          <div className="grid gap-3">
            {["Birth certificate", "Previous report card", "Good moral certificate"].map((item, index) => (
              <div key={item} className="flex items-center gap-3 text-[13px]">
                <VisualCheckbox checked={index < 2} />
                {item}
              </div>
            ))}
          </div>
        </ParentCard>
        <div className="flex justify-end gap-2">
          <Link href="/parent/enroll"><ParentButton>Back</ParentButton></Link>
          <Link href="/parent/enroll/review"><ParentButton tone="primary">Review enrollment</ParentButton></Link>
        </div>
      </div>
    </div>
  );
}

