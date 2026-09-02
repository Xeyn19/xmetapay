"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole, setAuthFlashToast } from "@/lib/auth/session";
import type { WalletTopUpChannel } from "@/lib/wallets/records";
import {
  createWalletTopUpBatch,
  maxWalletTopUpAmount,
  maxWalletTopUpStudents,
  WalletTopUpValidationError,
} from "@/lib/wallets/top-up";
import { ParentSchoolScopeError } from "@/lib/parents/school-scope";

const walletTopUpChannels = new Set<WalletTopUpChannel>(["card", "online_banking", "gcash", "maya"]);

export async function createWalletTopUpAction(formData: FormData) {
  const session = await requireRole("parent");
  const studentIds = formData.getAll("studentIds").map(parsePositiveInteger);
  const channel = walletTopUpChannel(formData);
  const submissionToken = formData.get("submissionToken");

  if (
    studentIds.some((studentId) => studentId === null)
    || studentIds.length < 1
    || studentIds.length > maxWalletTopUpStudents
  ) {
    await toast("Top-up not recorded", `Select between 1 and ${maxWalletTopUpStudents} linked student wallets.`);
    redirect("/parent/wallet");
  }

  if (!channel) {
    await toast("Top-up not recorded", "Choose a supported local test payment method.");
    redirect("/parent/wallet");
  }

  if (typeof submissionToken !== "string" || !/^[a-zA-Z0-9-]{16,128}$/.test(submissionToken)) {
    await toast("Top-up not recorded", "This top-up request expired. Review the form and try again.");
    redirect("/parent/wallet");
  }

  const items = studentIds.map((studentId) => ({
    studentId: studentId as number,
    amount: parseTopUpAmount(formData.get(`amount_${studentId}`)),
  }));

  if (items.some((item) => item.amount === null)) {
    await toast(
      "Top-up not recorded",
      `Enter an amount from P1 to P${maxWalletTopUpAmount.toLocaleString()} for every selected student.`,
    );
    redirect("/parent/wallet");
  }

  let batchReference = "";

  try {
    const result = await createWalletTopUpBatch({
      parentUserId: session.userId,
      channel,
      submissionToken,
      items: items.map((item) => ({ studentId: item.studentId, amount: item.amount as number })),
    });

    revalidateWalletPaths();
    await toast(
      result.duplicate ? "Top-up already recorded" : "Wallets topped up",
      result.duplicate
        ? "This request was already completed. The original batch is shown."
        : `${items.length} student wallet${items.length === 1 ? "" : "s"} and ${items.length} receipt${items.length === 1 ? "" : "s"} were updated.`,
    );
    batchReference = result.batchReference;
  } catch (error) {
    await toast(
      "Top-up not recorded",
      error instanceof WalletTopUpValidationError || error instanceof ParentSchoolScopeError
        ? error.message
        : "Unable to record the wallet top-up. Confirm the batch migration and MySQL/XAMPP, then try again.",
    );
    redirect("/parent/wallet");
  }

  redirect(`/parent/wallet/top-up-result?batch=${encodeURIComponent(batchReference)}`);
}

function parsePositiveInteger(value: FormDataEntryValue) {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseTopUpAmount(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const parsed = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= maxWalletTopUpAmount ? parsed : null;
}

function walletTopUpChannel(formData: FormData) {
  const value = formData.get("channel");
  return typeof value === "string" && walletTopUpChannels.has(value as WalletTopUpChannel)
    ? (value as WalletTopUpChannel)
    : null;
}

async function toast(title: string, description: string) {
  await setAuthFlashToast({ role: "parent", title, description });
}

function revalidateWalletPaths() {
  revalidatePath("/parent/dashboard");
  revalidatePath("/parent/wallet");
  revalidatePath("/parent/wallet/top-up-result");
  revalidatePath("/parent/history");
  revalidatePath("/parent/receipt");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/allowance");
  revalidatePath("/admin/collections");
  revalidatePath("/admin/reports");
}
