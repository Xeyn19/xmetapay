import { Plus, Receipt } from "lucide-react";

import { assignStudentFeeAction, createFeeTypeAction } from "./actions";
import { FeeStudentChecklist } from "./fee-student-checklist";
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
  const createAction = createFeeTypeAction.bind(null, category, redirectPath);
  const assignAction = assignStudentFeeAction.bind(null, category, redirectPath);
  const label = category === "tuition" ? "tuition" : "other fee";

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <form action={createAction} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-4">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#0f1117]">
          <Plus className="size-4 text-[#e64a19]" />
          Create {label} type
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fee name" required>
            <input name="name" className={fieldControlClass} placeholder={category === "tuition" ? "Tuition" : "Activity fee"} required />
          </Field>
          <Field label="Default amount" required>
            <input name="defaultAmount" type="number" min="0.01" step="0.01" className={fieldControlClass} placeholder="0.00" required />
          </Field>
        </div>
        <AdminButton type="submit" tone="primary" className="mt-3 w-full sm:w-auto">
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
                  <span className="min-w-0 truncate font-semibold text-[#0f1117]">{feeType.name}</span>
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

      <form action={assignAction} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-4">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#0f1117]">
          <Receipt className="size-4 text-[#e64a19]" />
          Assign {label} to selected students
        </div>
        <div className="grid gap-3 xl:grid-cols-4">
          <Field label="Students" required className="xl:col-span-4">
            <FeeStudentChecklist students={data.students} disabled={!data.ready || data.students.length === 0} />
          </Field>
          <Field label="Fee type" required className="xl:col-span-2">
            <select name="feeTypeId" className={fieldControlClass} required disabled={!data.ready || data.feeTypes.length === 0}>
              <option value="">{data.feeTypes.length > 0 ? "Choose fee type" : "Create a fee type first"}</option>
              {data.feeTypes.map((feeType) => (
                <option key={feeType.id} value={feeType.id}>
                  {feeType.name} - {feeType.amount}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Custom amount" className="xl:col-span-1">
            <input name="amountDue" type="number" min="0.01" step="0.01" className={fieldControlClass} placeholder="Leave blank to use fee default" />
            <p className="mt-1.5 text-[11.5px] leading-5 text-[#5a6070]">
              Only enter this if the selected students should pay a different amount.
            </p>
          </Field>
          <Field label="Due date" className="xl:col-span-1">
            <input name="dueDate" type="date" className={fieldControlClass} />
            <p className="mt-1.5 text-[11.5px] leading-5 text-[#5a6070]">
              Optional payment deadline for this assigned fee.
            </p>
          </Field>
        </div>
        <AdminButton type="submit" tone="dark" className="mt-3 w-full sm:w-auto" disabled={!data.ready || data.students.length === 0 || data.feeTypes.length === 0}>
          <Receipt className="size-4" />
          Assign fee
        </AdminButton>
      </form>
    </div>
  );
}
