import { History } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentPaymentHistoryData } from "@/lib/payments/records";

import { ParentAlert, ParentCard } from "../../_components/parent-ui";
import { ParentPaymentHistoryTable } from "./history-table";

export default async function HistoryPage() {
  const session = await requireRole("parent");
  const data = await getParentPaymentHistoryData(session.userId);

  return (
    <>
      {data.warning ? <ParentAlert>{data.warning}</ParentAlert> : null}
      <ParentCard
        title="Payment history"
        icon={History}
        bodyClassName="p-0"
      >
        <ParentPaymentHistoryTable
          key={`${data.activeRows.map((row) => row.paymentId).join("-")}|${data.archivedRows.map((row) => row.paymentId).join("-")}`}
          activeRows={data.activeRows}
          archivedRows={data.archivedRows}
          removedRows={data.removedRows}
        />
      </ParentCard>
    </>
  );
}
