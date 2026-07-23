"use server";

import { redirect } from "next/navigation";

import {
  clearPasswordReset,
  completePasswordReset,
  passwordResetLoginPath,
  requestPasswordReset,
  resendPasswordReset,
  verifyPasswordResetOtp,
  type PasswordResetResult,
} from "@/lib/auth/password-reset";
import { setAuthFlashToast, type AuthRole } from "@/lib/auth/session";

export type PasswordResetFormState = PasswordResetResult;

export async function requestPasswordResetAction(
  role: AuthRole,
  _state: PasswordResetFormState,
  formData: FormData,
) {
  void _state;

  return requestPasswordReset(role, value(formData, "email"));
}

export async function resendPasswordResetAction(
  role: AuthRole,
  _state: PasswordResetFormState,
  _formData: FormData,
) {
  void _state;
  void _formData;

  return resendPasswordReset(role);
}

export async function verifyPasswordResetOtpAction(
  role: AuthRole,
  _state: PasswordResetFormState,
  formData: FormData,
) {
  void _state;

  return verifyPasswordResetOtp(role, value(formData, "otp"));
}

export async function completePasswordResetAction(
  role: AuthRole,
  _state: PasswordResetFormState,
  formData: FormData,
) {
  void _state;
  const result = await completePasswordReset(
    role,
    value(formData, "password"),
    value(formData, "confirmPassword"),
  );

  if (!result.completed) {
    return result;
  }

  await setAuthFlashToast({
    role,
    title: "Password reset",
    description: "Sign in with your new password.",
  });

  redirect(`${passwordResetLoginPath(role)}?reset=1`);
}

export async function restartPasswordResetAction(
  role: AuthRole,
  _state: PasswordResetFormState,
  _formData: FormData,
) {
  void role;
  void _state;
  void _formData;
  await clearPasswordReset();

  return {
    stage: "request" as const,
    message: "Enter your account email to request a new code.",
  };
}

function value(formData: FormData, name: string) {
  const field = formData.get(name);
  return typeof field === "string" ? field.trim() : "";
}
