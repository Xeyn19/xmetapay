export const MIN_INSTALLMENT_TERMS = 2;
export const MAX_INSTALLMENT_TERMS = 12;

export type InstallmentPreset = "full" | "two" | "four" | "monthly" | "custom";

export type InstallmentTermInput = {
  name: string;
  percentage: number;
  date: string;
};

export type BillingWindow = {
  startsOn: string;
  endsOn: string;
};

export type InstallmentValidationError = {
  field: "dueDate" | "planName" | "installmentPlan" | "termNames" | "termPercentages" | "termDates";
  message: string;
};

export function equalInstallmentPercentages(count: number) {
  const safeCount = Math.min(MAX_INSTALLMENT_TERMS, Math.max(MIN_INSTALLMENT_TERMS, Math.trunc(count)));
  const baseCents = Math.floor(10_000 / safeCount);
  const values = Array.from({ length: safeCount }, () => baseCents / 100);
  values[values.length - 1] = (10_000 - baseCents * (safeCount - 1)) / 100;
  return values;
}

export function buildInstallmentPreset(preset: Exclude<InstallmentPreset, "full">, monthlyCount = 10) {
  const count = preset === "two" ? 2 : preset === "four" ? 4 : preset === "monthly"
    ? Math.min(MAX_INSTALLMENT_TERMS, Math.max(MIN_INSTALLMENT_TERMS, Math.trunc(monthlyCount)))
    : 2;
  const percentages = equalInstallmentPercentages(count);
  const names = preset === "two"
    ? ["Upon enrollment", "Final payment"]
    : preset === "four"
      ? ["Upon enrollment", "Second payment", "Third payment", "Final payment"]
      : preset === "monthly"
        ? Array.from({ length: count }, (_, index) => `Monthly payment ${index + 1}`)
        : Array.from({ length: count }, (_, index) => `Payment ${index + 1}`);
  const planName = preset === "two" ? "Two-payment plan" : preset === "four" ? "Four-payment plan" : preset === "monthly" ? `${count} monthly payments` : "Custom payment plan";

  return {
    planName,
    terms: names.map((name, index) => ({ name, percentage: percentages[index], date: "" })),
  };
}

export function validateFinalDeadline(dueDate: string, bounds: BillingWindow | null): InstallmentValidationError | null {
  if (!dueDate) return { field: "dueDate", message: "Choose the final payment deadline." };
  if (!bounds || dueDate < bounds.startsOn || dueDate > bounds.endsOn) {
    return { field: "dueDate", message: "The final payment deadline must stay inside the selected billing period." };
  }
  return null;
}

export function validateInstallmentPlan(input: {
  enabled: boolean;
  planName: string;
  terms: InstallmentTermInput[];
  bounds: BillingWindow | null;
  finalDeadline: string;
}): InstallmentValidationError | null {
  if (!input.enabled) return null;
  if (!input.planName.trim()) return { field: "planName", message: "Enter a name for the installment plan." };
  if (input.terms.length < MIN_INSTALLMENT_TERMS || input.terms.length > MAX_INSTALLMENT_TERMS) {
    return { field: "installmentPlan", message: `Use ${MIN_INSTALLMENT_TERMS} to ${MAX_INSTALLMENT_TERMS} payments for an installment plan.` };
  }
  if (input.terms.some((term) => !term.name.trim())) {
    return { field: "termNames", message: "Name every payment in the installment plan." };
  }
  if (input.terms.some((term) => !Number.isFinite(term.percentage) || term.percentage <= 0)) {
    return { field: "termPercentages", message: "Every payment percentage must be greater than 0%." };
  }
  const percentageTotal = Math.round(input.terms.reduce((sum, term) => sum + term.percentage, 0) * 100);
  if (percentageTotal !== 10_000) {
    return { field: "termPercentages", message: "Payment percentages must total exactly 100%." };
  }
  if (!input.bounds || input.terms.some((term) => !term.date || term.date < input.bounds!.startsOn || term.date > input.bounds!.endsOn || term.date > input.finalDeadline)) {
    return { field: "termDates", message: "Every payment date must stay inside the billing period and on or before the final payment deadline." };
  }
  if (input.terms.some((term, index) => index > 0 && term.date < input.terms[index - 1].date)) {
    return { field: "termDates", message: "Payment dates must be in chronological order." };
  }
  return null;
}
