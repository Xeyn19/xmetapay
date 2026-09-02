"use client";

import { useActionState } from "react";
import { MailPlus, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";

import { issueParentInvitationAction, resendParentInvitationAction, revokeParentInvitationAction, setGuardianAccessAction, type ParentInvitationActionState } from "@/app/admin/parent-invitations/actions";
import type { AdminGuardianAccessData } from "@/lib/parents/invitations";

import { AdminButton, DashboardCard, StatusPill } from "../../_components/admin-ui";

const control = "min-h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm text-[#11131a] outline-none focus:border-[#e64a19] focus:ring-4 focus:ring-[#e64a19]/10";
const initialParentInvitationActionState: ParentInvitationActionState = { ok: false, message: "" };

export function GuardianAccessPanel({ studentId, data }: { studentId: number; data: AdminGuardianAccessData }) {
  const [state, action, pending] = useActionState(issueParentInvitationAction.bind(null, studentId), initialParentInvitationActionState);
  return (
    <DashboardCard title="Parent invitations and access" icon={ShieldCheck} className="mt-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form action={action} className="grid content-start gap-3 rounded-xl border border-black/10 bg-[#f7f8fa] p-4">
          <div><h3 className="text-sm font-bold text-[#11131a]">Invite a guardian</h3><p className="mt-1 text-xs leading-5 text-[#5f6673]">One invitation grants access to this student only. Identity details come from the school.</p></div>
          <label className="grid gap-1.5 text-xs font-bold text-[#343842]">Guardian name<input className={control} name="guardianName" maxLength={120} required /></label>
          <label className="grid gap-1.5 text-xs font-bold text-[#343842]">Guardian email<input className={control} name="guardianEmail" type="email" maxLength={150} required /></label>
          <label className="grid gap-1.5 text-xs font-bold text-[#343842]">Relationship<select className={control} name="relationship" required defaultValue=""><option value="" disabled>Select relationship</option><option value="mother">Mother</option><option value="father">Father</option><option value="guardian">Guardian</option></select></label>
          {state.message ? <p className={`text-xs font-semibold ${state.ok ? "text-emerald-700" : "text-red-700"}`} aria-live="polite">{state.message}</p> : null}
          <AdminButton type="submit" disabled={pending} className="min-h-11"><MailPlus className="size-4" />{pending ? "Sending..." : "Email invitation"}</AdminButton>
        </form>
        <div className="grid gap-4">
          <section><h3 className="mb-2 text-sm font-bold text-[#11131a]">Invitations</h3><div className="grid gap-2">
            {data.invitations.length ? data.invitations.map((item) => <div key={item.id} className="rounded-lg border border-black/10 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-bold">{item.guardianName}</div><div className="text-xs text-[#5f6673]">{item.emailHint} · {item.relationship}</div><div className="mt-1 text-[11px] leading-5 text-[#6b7280]">Delivery: {item.deliveryStatus} · Issued {item.createdAt} · Expires {item.expiresAt}{item.sentAt ? ` · Sent ${item.sentAt}` : ""}{item.claimedAt ? ` · Claimed ${item.claimedAt}` : ""}{item.revokedAt ? ` · Revoked ${item.revokedAt}` : ""}</div></div><StatusPill tone={item.status === "Claimed" ? "active" : item.status === "Pending" ? "pending" : "inactive"}>{item.status}</StatusPill></div>{item.status === "Pending" || item.status === "Email failed" ? <div className="mt-3 flex flex-wrap gap-2"><form action={resendParentInvitationAction.bind(null, studentId, item.id)}><AdminButton type="submit" tone="outline"><RefreshCw className="size-4" />Resend</AdminButton></form><form action={revokeParentInvitationAction.bind(null, studentId, item.id)}><AdminButton type="submit" tone="outline"><ShieldOff className="size-4" />Revoke</AdminButton></form></div> : null}</div>) : <p className="rounded-lg border border-dashed border-black/15 p-3 text-xs text-[#5f6673]">No invitations issued for this student.</p>}
          </div></section>
          <section><h3 className="mb-2 text-sm font-bold text-[#11131a]">Guardian access</h3><div className="grid gap-2">
            {data.guardians.length ? data.guardians.map((item) => <div key={item.linkId} className="rounded-lg border border-black/10 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-bold">{item.guardianName}</div><div className="text-xs text-[#5f6673]">{item.emailHint} · {item.relationship}</div></div><StatusPill tone={item.status === "active" ? "active" : "inactive"}>{item.status === "active" ? "Active" : "Revoked"}</StatusPill></div><form action={setGuardianAccessAction.bind(null, studentId, item.linkId, item.status === "active" ? "revoke" : "restore")} className="mt-3 flex flex-col gap-2 min-[520px]:flex-row"><input className={control} name="reason" minLength={3} maxLength={255} placeholder={item.status === "active" ? "Reason for revocation" : "Reason for restoration"} required /><AdminButton type="submit" tone="outline" className="min-h-11 shrink-0">{item.status === "active" ? "Revoke access" : "Restore access"}</AdminButton></form></div>) : <p className="rounded-lg border border-dashed border-black/15 p-3 text-xs text-[#5f6673]">No guardian access records yet.</p>}
          </div></section>
        </div>
      </div>
    </DashboardCard>
  );
}
