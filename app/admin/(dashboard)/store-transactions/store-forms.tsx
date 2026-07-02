import { Plus, Store } from "lucide-react";

import { createStoreMerchantAction, recordStorePurchaseAction } from "@/app/admin/store/actions";
import type { AdminStoreSetupData } from "@/lib/stores/records";

import { AdminButton, Field, fieldControlClass } from "../../_components/admin-ui";

export function StoreManagementForms({ data }: { data: AdminStoreSetupData }) {
  return (
    <div className="mb-[18px] grid gap-[18px] lg:grid-cols-[0.85fr_1.15fr]">
      <CreateStoreMerchantForm data={data} />
      <RecordStorePurchaseForm data={data} />
    </div>
  );
}

export function CreateStoreMerchantForm({ data }: { data: AdminStoreSetupData }) {
  const hasMerchants = data.merchants.length > 0;

  return (
    <form action={createStoreMerchantAction} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#0f1117]">
        <Plus className="size-4 text-[#e64a19]" />
        Create store merchant
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Merchant name" required>
          <input name="name" className={fieldControlClass} placeholder="Canteen" required />
        </Field>
        <Field label="Merchant type" required>
          <select name="type" className={fieldControlClass} required defaultValue="canteen">
            <option value="canteen">Canteen</option>
            <option value="school_store">School store</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <AdminButton type="submit" tone="primary" className="mt-3 w-full sm:w-auto">
        <Plus className="size-4" />
        Create merchant
      </AdminButton>
      <div className="mt-4 rounded-lg border border-black/[0.07] bg-white">
        <div className="border-b border-black/[0.07] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">
          Current merchants
        </div>
        <div className="divide-y divide-black/[0.07]">
          {hasMerchants ? (
            data.merchants.map((merchant) => (
              <div key={merchant.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                <span className="min-w-0 truncate font-semibold text-[#0f1117]">{merchant.name}</span>
                <span className="shrink-0 text-[#5a6070]">{merchant.typeLabel}</span>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-[12.5px] text-[#5a6070]">
              No store merchants yet.
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

export function RecordStorePurchaseForm({ data }: { data: AdminStoreSetupData }) {
  const hasMerchants = data.merchants.length > 0;
  const hasWallets = data.wallets.length > 0;

  return (
    <form action={recordStorePurchaseAction} className="rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#0f1117]">
        <Store className="size-4 text-[#e64a19]" />
        Record wallet purchase
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Student wallet" required>
          <select name="studentId" className={fieldControlClass} required disabled={!data.ready || !hasWallets}>
            <option value="">{hasWallets ? "Choose student wallet" : "No funded wallets"}</option>
            {data.wallets.map((wallet) => (
              <option key={wallet.studentId} value={wallet.studentId}>
                {wallet.name} - {wallet.meta} - {wallet.balance}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Merchant" required>
          <select name="merchantId" className={fieldControlClass} required disabled={!data.ready || !hasMerchants}>
            <option value="">{hasMerchants ? "Choose merchant" : "Create a merchant first"}</option>
            {data.merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name} - {merchant.typeLabel}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Purchase amount" required>
          <input name="amount" type="number" min="0.01" max="10000" step="0.01" className={fieldControlClass} placeholder="0.00" required />
        </Field>
        <Field label="Txn fee">
          <input name="feeAmount" type="number" min="0" max="10000" step="0.01" className={fieldControlClass} placeholder="0.00" />
        </Field>
      </div>
      <AdminButton type="submit" tone="dark" className="mt-3 w-full sm:w-auto" disabled={!data.ready || !hasMerchants || !hasWallets}>
        <Store className="size-4" />
        Record purchase
      </AdminButton>
      {!data.ready ? (
        <p className="mt-3 text-[12.5px] leading-5 text-[#5a6070]">
          Create a merchant and make sure a student has a funded active wallet before recording store purchases.
        </p>
      ) : null}
    </form>
  );
}
