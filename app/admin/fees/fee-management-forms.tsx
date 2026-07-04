"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Plus, Receipt } from "lucide-react";

import { assignStudentFeeAction, createFeeTypeAction } from "./actions";
import { FeeStudentChecklist } from "./fee-student-checklist";
import { TuitionTermScheduleFields } from "./tuition-term-schedule-fields";
import type { AdminFeeSetupData, FeeCategory } from "@/lib/fees/records";

import { AdminButton, Field, fieldControlClass } from "../_components/admin-ui";

export function FeeManagementForms({
  category,
  redirectPath,
  data,
}: {
  category: FeeCategory;
  redirectPath: "/admin/tuition" | "/admin/other-fees";
  data: AdminFeeSetupData;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <FeeCreateTypeForm category={category} redirectPath={redirectPath} data={data} />
      <FeeAssignStudentsForm category={category} redirectPath={redirectPath} data={data} />
    </div>
  );
}

export function FeeCreateTypeForm({
  category,
  redirectPath,
  data,
}: {
  category: FeeCategory;
  redirectPath: "/admin/tuition" | "/admin/other-fees";
  data: AdminFeeSetupData;
}) {
  const createAction = createFeeTypeAction.bind(null, category, redirectPath);
  const label = feeLabel(category);
  const [defaultAmount, setDefaultAmount] = useState("");
  const defaultAmountValue = Number(defaultAmount || 0);

  return (
    <form action={createAction} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#0f1117]">
        <Plus className="size-4 text-[#e64a19]" />
        Create {label} type
      </div>
      <p className="mb-4 max-w-xl text-[12px] leading-5 text-[#5a6070]">
        Add the fee name and its usual amount. You can still override the amount when assigning it.
      </p>
      <div className="grid gap-3 min-[560px]:grid-cols-2">
        <Field label="Fee name" required>
          <input name="name" className={fieldControlClass} placeholder={category === "tuition" ? "Tuition" : "Activity fee"} required />
        </Field>
        <Field label="Default amount" required>
          <input
            name="defaultAmount"
            type="number"
            min="0.01"
            step="0.01"
            value={defaultAmount}
            onChange={(event) => setDefaultAmount(event.target.value)}
            className={fieldControlClass}
            placeholder="0.00"
            required
          />
        </Field>
      </div>
      {category === "tuition" ? (
        <div className="mt-4">
          <TuitionTermScheduleFields
            totalAmount={Number.isFinite(defaultAmountValue) ? defaultAmountValue : 0}
            optional
            title="Payment terms template"
            emptyText="No template yet. Add terms if this tuition type should create installments automatically."
            addLabel="Add payment term"
          />
        </div>
      ) : null}
      <AdminButton type="submit" tone="primary" className="mt-4 w-full min-[420px]:w-auto">
        <Plus className="size-4" />
        Create fee type
      </AdminButton>
      <div className="mt-4 rounded-lg border border-black/[0.07] bg-white">
        <div className="border-b border-black/[0.07] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">
          Current {label} types
        </div>
        <div className="divide-y divide-black/[0.07]">
          {data.feeTypes.length > 0 ? (
            data.feeTypes.map((feeType) => (
              <div key={feeType.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#0f1117]">{feeType.name}</span>
                  {category === "tuition" && feeType.termCount > 0 ? (
                    <span className="mt-0.5 block text-[11px] font-medium text-[#5a6070]">
                      {feeType.termCount} payment term{feeType.termCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-bold text-[#e64a19]">{feeType.amount}</span>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-[12.5px] text-[#5a6070]">
              No {label} types yet.
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

export function FeeAssignStudentsForm({
  category,
  redirectPath,
  data,
}: {
  category: FeeCategory;
  redirectPath: "/admin/tuition" | "/admin/other-fees";
  data: AdminFeeSetupData;
}) {
  const assignAction = assignStudentFeeAction.bind(null, category, redirectPath);
  const label = feeLabel(category);
  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState("");
  const selectedFeeType = data.feeTypes.find((feeType) => String(feeType.id) === selectedFeeTypeId);
  const selectedTuitionHasTerms = category === "tuition" && Boolean(selectedFeeType?.termCount);
  const dueDateLabel = selectedTuitionHasTerms ? "Overall due date" : "Fee due date";
  const dueDateHelp = selectedTuitionHasTerms
    ? "Optional for reports only. Parents pay by the term due dates from the template."
    : category === "tuition"
      ? "Used as the parent payment deadline when this tuition has no terms."
      : "Used as the parent payment deadline for this fee.";

  return (
    <form action={assignAction} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#0f1117]">
        <Receipt className="size-4 text-[#e64a19]" />
        Assign {label} to selected students
      </div>
      <div className="space-y-4">
        <FeeFormStep number="1" title="Choose fee">
          <Field label="Fee type" required>
            <select
              name="feeTypeId"
              className={fieldControlClass}
              value={selectedFeeTypeId}
              onChange={(event) => setSelectedFeeTypeId(event.target.value)}
              required
              disabled={!data.ready || data.feeTypes.length === 0}
            >
              <option value="">{data.feeTypes.length > 0 ? "Choose fee type" : "Create a fee type first"}</option>
              {data.feeTypes.map((feeType) => (
                <option key={feeType.id} value={feeType.id}>
                  {feeType.name} - {feeType.amount}{category === "tuition" && feeType.termCount > 0 ? ` - ${feeType.termCount} terms` : ""}
                </option>
              ))}
            </select>
          </Field>
        </FeeFormStep>

        <FeeFormStep number="2" title="Select students">
          <Field label="Students" required>
            <FeeStudentChecklist students={data.students} disabled={!data.ready || data.students.length === 0} />
          </Field>
        </FeeFormStep>

        <FeeFormStep number="3" title="Amount override and deadline">
          <div className="grid gap-3 min-[560px]:grid-cols-2">
            <Field label="Custom amount">
              <input name="amountDue" type="number" min="0.01" step="0.01" className={fieldControlClass} placeholder="Leave blank to use fee default" />
              <p className="mt-1.5 text-[11.5px] leading-5 text-[#5a6070]">
                Use for discounts, scholarships, or special charges.
              </p>
            </Field>
            <Field label={dueDateLabel}>
              <input name="dueDate" type="date" className={fieldControlClass} />
              <p className="mt-1.5 text-[11.5px] leading-5 text-[#5a6070]">
                {dueDateHelp}
              </p>
            </Field>
          </div>
        </FeeFormStep>
      </div>
      <AdminButton type="submit" tone="dark" className="mt-4 w-full min-[420px]:w-auto" disabled={!data.ready || data.students.length === 0 || data.feeTypes.length === 0}>
        <Receipt className="size-4" />
        Assign fee
      </AdminButton>
    </form>
  );
}

function feeLabel(category: FeeCategory) {
  return category === "tuition" ? "tuition" : "other fee";
}

function FeeFormStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-black/[0.07] bg-white p-3.5">
      <div className="mb-3 flex items-center gap-2 text-[12.5px] font-bold text-[#0f1117]">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#fbe9e7] text-[11px] text-[#e64a19]">
          {number}
        </span>
        {title}
      </div>
      {children}
    </section>
  );
}
