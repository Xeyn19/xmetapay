"use client";

import Link from "next/link";
import { CreditCard, Receipt } from "lucide-react";
import { useMemo, useState } from "react";

import { MethodCard, ParentButton, ParentCard, VisualCheckbox } from "../../_components/parent-ui";
import { payableFees, paymentMethods } from "../../_data/parent-portal-data";

export default function PayTuitionPage() {
  const [selected, setSelected] = useState(() => new Set(payableFees.filter((fee) => fee.defaultSelected).map((fee) => fee.id)));
  const [method, setMethod] = useState("wallet");
  const subtotal = useMemo(
    () => payableFees.reduce((sum, fee) => (selected.has(fee.id) ? sum + fee.amount : sum), 0),
    [selected]
  );
  const serviceFee = subtotal > 0 ? 15 : 0;
  const total = subtotal + serviceFee;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-5">
        <ParentCard title="Select fees to pay" icon={Receipt} bodyClassName="p-0">
          {payableFees.map((fee) => (
            <button key={fee.id} type="button" onClick={() => toggle(fee.id)} className="flex w-full items-center justify-between gap-4 border-b border-black/[0.08] px-5 py-4 text-left last:border-b-0 hover:bg-[#f8f8f7]">
              <span className="flex min-w-0 items-center gap-3">
                <VisualCheckbox checked={selected.has(fee.id)} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{fee.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-[#6b6b6b]">{fee.desc}</span>
                </span>
              </span>
              <span className="font-semibold">P{fee.amount.toLocaleString()}</span>
            </button>
          ))}
        </ParentCard>

        <ParentCard title="Payment method" icon={CreditCard}>
          <div className="grid gap-3">
            {paymentMethods.map((item) => (
              <MethodCard key={item.id} selected={method === item.id} onClick={() => setMethod(item.id)} icon={item.icon} title={item.title} desc={item.desc} />
            ))}
          </div>
        </ParentCard>
      </div>

      <ParentCard title="Payment summary" icon={Receipt} className="self-start">
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between"><span className="text-[#6b6b6b]">Selected fees</span><span className="font-semibold">P{subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-[#6b6b6b]">Service fee</span><span className="font-semibold">P{serviceFee}</span></div>
          <div className="border-t border-black/[0.08] pt-3">
            <div className="flex justify-between text-base font-bold"><span>Total</span><span>P{total.toLocaleString()}</span></div>
          </div>
          <Link href="/parent/receipt" className="mt-4 flex h-11 w-full items-center justify-center rounded-[12px] bg-[#e64a19] text-sm font-semibold text-white hover:bg-[#bf360c]">
            Pay P{total.toLocaleString()}
          </Link>
          <Link href="/parent/fees"><ParentButton className="w-full">Back to fee summary</ParentButton></Link>
        </div>
      </ParentCard>
    </div>
  );
}

