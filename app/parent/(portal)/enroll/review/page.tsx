"use client";

import Link from "next/link";
import { FileCheck } from "lucide-react";
import { useState } from "react";

import { ParentButton, ParentCard, DetailRows, VisualCheckbox } from "../../../_components/parent-ui";
import { enrollmentReview } from "../../../_data/parent-portal-data";

export default function EnrollReviewPage() {
  const [agreed, setAgreed] = useState(false);
  return (
    <ParentCard title="Review and submit enrollment" icon={FileCheck} action={<span className="rounded-full bg-[#fbe9e7] px-3 py-1 text-xs font-semibold text-[#e64a19]">Step 3 of 3</span>} className="max-w-4xl">
      <DetailRows rows={enrollmentReview} />
      <button type="button" onClick={() => setAgreed((value) => !value)} className="mt-5 flex w-full items-start gap-3 rounded-[12px] border border-black/[0.08] bg-[#f8f8f7] p-4 text-left text-[13px]">
        <VisualCheckbox checked={agreed} />
        <span>I agree to Brentwood Academy enrollment terms and school policies for SY 2025-2026.</span>
      </button>
      <div className="mt-6 flex justify-end gap-2">
        <Link href="/parent/enroll/family"><ParentButton>Back</ParentButton></Link>
        <Link href="/parent/student-profile"><ParentButton tone="primary" disabled={!agreed}>Submit enrollment</ParentButton></Link>
      </div>
    </ParentCard>
  );
}

