"use server";

import { redirect } from "next/navigation";

import { createSession, getSession, setAuthFlashToast } from "@/lib/auth/session";
import { clearParentClaim, completeExistingParentClaim, completeNewParentClaim, getParentClaimState, requestParentClaimOtp, resendParentClaimOtp, type ParentClaimState, verifyParentClaimOtp } from "@/lib/parents/invitations";

export async function parentClaimAction(_previous: ParentClaimState, formData: FormData): Promise<ParentClaimState> {
  const intent = value(formData, "intent");
  if (intent === "start") return requestParentClaimOtp(value(formData, "claimCode"));
  if (intent === "resend") return resendParentClaimOtp();
  if (intent === "verify") return verifyParentClaimOtp(value(formData, "otp"));
  if (intent === "reset") { await clearParentClaim(); return { stage: "code", message: "Enter the single-use invitation code sent by your school." }; }
  if (intent === "refresh") return getParentClaimState((await getSession())?.userId);

  const session = await getSession();
  const result = intent === "complete_new"
    ? await completeNewParentClaim({ phone: value(formData, "phone"), password: rawValue(formData, "password"), confirmPassword: rawValue(formData, "confirmPassword") })
    : await completeExistingParentClaim(session?.role === "parent" ? session.userId : undefined, rawValue(formData, "password"));
  if (!("user" in result) || !result.user) return result.state;
  if (!session || session.userId !== result.user.userId || session.role !== "parent") {
    await createSession({ userId: result.user.userId, role: "parent", name: result.user.name });
  }
  await setAuthFlashToast({ role: "parent", title: "Parent access verified", description: "Your school-issued invitation has been claimed." });
  redirect("/parent/dashboard");
}

function value(formData: FormData, key: string) { return rawValue(formData, key).trim(); }
function rawValue(formData: FormData, key: string) { const item = formData.get(key); return typeof item === "string" ? item : ""; }
