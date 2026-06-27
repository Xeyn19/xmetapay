import Link from "next/link";
import { CreditCard, Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentPaymentPageData } from "@/lib/payments/records";

import { ParentAlert, ParentButton, ParentCard } from "../../_components/parent-ui";
import { ParentPaymentForm } from "./payment-form";

export default async function PayTuitionPage() {
  const session = await requireRole("parent");
  const data = await getParentPaymentPageData(session.userId);

  if (data.rows.length === 0) {
    return (
      <>
        {data.warning ? <ParentAlert>{data.warning}</ParentAlert> : null}
        <ParentCard title="No payable fees" icon={Receipt}>
          <div className="grid gap-4 text-[13px] leading-5 text-[#6b6b6b]">
            <p>No open or partial fee balances are available for your linked students.</p>
            <Link href="/parent/fees">
              <ParentButton tone="primary">
                <CreditCard className="size-4" />
                View fee summary
              </ParentButton>
            </Link>
          </div>
        </ParentCard>
      </>
    );
  }

  return (
    <>
      {data.warning ? <ParentAlert>{data.warning}</ParentAlert> : null}
      <ParentPaymentForm rows={data.rows} />
    </>
  );
}
