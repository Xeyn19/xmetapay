"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, MailCheck, ShieldCheck } from "lucide-react";

import { parentClaimAction } from "@/app/parent/claim/actions";
import type { ParentClaimState } from "@/lib/parents/invitations";

const fieldClass = "public-field min-h-12 w-full rounded-lg border px-3 py-2 text-sm uppercase tracking-[0.12em] outline-none transition focus:border-[#ff7043] focus:ring-4 focus:ring-[#ff7043]/10";
const normalFieldClass = fieldClass.replace(" uppercase tracking-[0.12em]", "");

export function ParentClaimFlow({ initialState }: { initialState: ParentClaimState }) {
  const [state, action, pending] = useActionState(parentClaimAction, initialState);
  const details = state.guardianName ? <div className="public-panel grid gap-2 rounded-lg border p-3 text-sm"><Detail label="Guardian" value={state.guardianName} /><Detail label="School" value={state.schoolName ?? "School"} /><Detail label="Student" value={state.studentName ?? "Student"} /><Detail label="Relationship" value={state.relationship ?? "Guardian"} /><Detail label="Email" value={state.emailHint ?? "School-recorded email"} /></div> : null;
  return (
    <div className="w-full">
      <div className="mb-5 text-center"><p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#e64a19]">Verified family access</p><h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-[var(--public-text)]">Claim parent invitation</h1><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--public-muted)]">Use the single-use code emailed by your school. Student references cannot create portal access.</p></div>
      <div className="mb-4 flex items-center justify-center gap-2" aria-label="Claim progress"><Step active={state.stage === "code"} done={state.stage !== "code" && state.stage !== "blocked"} icon={<KeyRound className="size-4" />} label="Invitation" /><span className="h-px w-5 bg-[var(--public-border)]" /><Step active={state.stage === "otp"} done={["account","login_required","ready","completed"].includes(state.stage)} icon={<MailCheck className="size-4" />} label="Email code" /><span className="h-px w-5 bg-[var(--public-border)]" /><Step active={["account","login_required","ready"].includes(state.stage)} done={state.stage === "completed"} icon={<ShieldCheck className="size-4" />} label="Account" /></div>
      <form action={action} className="grid gap-4">
        {state.stage === "code" ? <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--public-muted)]">Invitation code<input name="claimCode" className={fieldClass} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="one-time-code" maxLength={19} required aria-invalid={Boolean(state.errors?.claimCode)} /><FieldError text={state.errors?.claimCode} /><input type="hidden" name="intent" value="start" /></label> : null}
        {state.stage === "otp" ? <><div className="public-panel rounded-lg border p-3 text-sm leading-6 text-[var(--public-muted)]">Verification was sent to <strong className="text-[var(--public-text)]">{state.emailHint ?? "the school-recorded email"}</strong>.</div><label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--public-muted)]">Six-digit code<input name="otp" className={fieldClass} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required aria-invalid={Boolean(state.errors?.otp)} /><FieldError text={state.errors?.otp} /></label><input type="hidden" name="intent" value="verify" /></> : null}
        {state.stage === "account" ? <>{details}<div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--public-muted)] sm:col-span-2">Phone number<input name="phone" type="tel" className={normalFieldClass} required /><FieldError text={state.errors?.phone} /></label><label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--public-muted)]">Password<input name="password" type="password" className={normalFieldClass} minLength={8} required /><FieldError text={state.errors?.password} /></label><label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--public-muted)]">Confirm password<input name="confirmPassword" type="password" className={normalFieldClass} minLength={8} required /><FieldError text={state.errors?.confirmPassword} /></label></div><input type="hidden" name="intent" value="complete_new" /></> : null}
        {state.stage === "login_required" ? <>{details}<label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--public-muted)]">Existing parent password<input name="password" type="password" className={normalFieldClass} required /></label><input type="hidden" name="intent" value="complete_existing" /></> : null}
        {state.stage === "ready" ? <>{details}<input type="hidden" name="intent" value="complete_existing" /></> : null}
        {state.stage === "completed" ? <div className="public-panel rounded-lg border p-4 text-center"><CheckCircle2 className="mx-auto size-8 text-emerald-600" /><p className="mt-2 font-bold">Invitation claimed</p></div> : null}
        {state.stage === "blocked" ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-[var(--public-error-text)]">{state.message}</div> : state.message ? <p className="text-center text-sm leading-6 text-[var(--public-muted)]" aria-live="polite">{state.message}</p> : null}
        {["code","otp","account","login_required","ready"].includes(state.stage) ? <button disabled={pending} className="public-primary-action min-h-12 rounded-lg px-4 text-sm font-bold text-white transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff7043]/20">{pending ? "Please wait..." : buttonLabel(state.stage)}</button> : null}
      </form>
      <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:justify-between">
        {state.stage === "otp" ? <form action={action}><input type="hidden" name="intent" value="resend" /><button disabled={pending} className="public-secondary-action min-h-11 w-full rounded-lg px-3 text-sm font-bold min-[420px]:w-auto">Resend code</button></form> : <span />}
        {state.stage !== "code" ? <form action={action}><input type="hidden" name="intent" value="reset" /><button disabled={pending} className="public-secondary-action min-h-11 w-full rounded-lg px-3 text-sm font-bold min-[420px]:w-auto">Start again</button></form> : <Link href="/parent/login" className="inline-flex min-h-11 items-center justify-center text-sm font-bold text-[var(--public-link)]">Already registered? Sign in</Link>}
      </div>
    </div>
  );
}

function buttonLabel(stage: ParentClaimState["stage"]) { if (stage === "code") return "Send verification code"; if (stage === "otp") return "Verify email"; if (stage === "account") return "Create parent account"; if (stage === "login_required") return "Verify account and link"; return "Finish linking student"; }
function FieldError({ text }: { text?: string }) { return text ? <span className="text-xs font-semibold normal-case tracking-normal text-[var(--public-error-text)]">{text}</span> : null; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="flex flex-col gap-0.5 min-[420px]:flex-row min-[420px]:justify-between"><span className="text-[var(--public-muted)]">{label}</span><strong className="text-[var(--public-text)]">{value}</strong></div>; }
function Step({ active, done, icon, label }: { active: boolean; done: boolean; icon: React.ReactNode; label: string }) { return <span className={`flex min-h-10 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold ${active ? "border-[#e64a19] bg-[#e64a19]/10 text-[var(--public-link)]" : done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-[var(--public-border)] text-[var(--public-muted)]"}`}>{icon}<span className="hidden min-[520px]:inline">{label}</span></span>; }
