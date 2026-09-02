"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { issueParentInvitation, ParentInvitationError, resendParentInvitation, revokeParentInvitation, setGuardianAccess } from "@/lib/parents/invitations";

export type ParentInvitationActionState = { ok: boolean; message: string };

export async function issueParentInvitationAction(studentId: number, _state: ParentInvitationActionState, formData: FormData): Promise<ParentInvitationActionState> {
  const session = await requireRole("admin");
  try {
    const result = await issueParentInvitation(session.userId, {
      studentId,
      guardianName: value(formData, "guardianName"),
      guardianEmail: value(formData, "guardianEmail"),
      relationship: value(formData, "relationship"),
    });
    revalidateStudent(studentId);
    return result;
  } catch (error) { return failure(error); }
}

export async function resendParentInvitationAction(studentId: number, invitationId: number) {
  const session = await requireRole("admin");
  try { await resendParentInvitation(session.userId, invitationId); revalidateStudent(studentId); }
  catch (error) { console.error("[parent-invitation:admin-resend]", safeError(error)); }
}

export async function revokeParentInvitationAction(studentId: number, invitationId: number) {
  const session = await requireRole("admin");
  try { await revokeParentInvitation(session.userId, invitationId); revalidateStudent(studentId); }
  catch (error) { console.error("[parent-invitation:admin-revoke]", safeError(error)); }
}

export async function setGuardianAccessAction(studentId: number, linkId: number, action: "revoke" | "restore", formData: FormData) {
  const session = await requireRole("admin");
  try { await setGuardianAccess(session.userId, linkId, action, value(formData, "reason")); revalidateStudent(studentId); }
  catch (error) { console.error("[parent-invitation:admin-access]", safeError(error)); }
}

function revalidateStudent(studentId: number) { revalidatePath(`/admin/students/${studentId}`); revalidatePath("/admin/parents"); }
function value(formData: FormData, key: string) { const item = formData.get(key); return typeof item === "string" ? item.trim() : ""; }
function failure(error: unknown) { return { ok: false, message: error instanceof ParentInvitationError ? error.message : "Parent invitation is temporarily unavailable." }; }
function safeError(error: unknown) { return error instanceof ParentInvitationError ? { code: error.code, message: error.message } : { message: String(error) }; }
