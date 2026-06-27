import Link from "next/link";
import { Download, History } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentPaymentHistoryData } from "@/lib/payments/records";

import { ParentAlert, ParentButton, ParentCard, ParentTable, SearchBox, StatusPill } from "../../_components/parent-ui";

export default async function HistoryPage() {
  const session = await requireRole("parent");
  const data = await getParentPaymentHistoryData(session.userId);

  return (
    <>
      {data.warning ? <ParentAlert>{data.warning}</ParentAlert> : null}
      <ParentCard
        title="Payment history"
        icon={History}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox placeholder="Search transaction..." />
            <ParentButton disabled><Download className="size-4" />Export pending</ParentButton>
          </div>
        }
        bodyClassName="p-0"
      >
        <ParentTable
          headers={[
            { label: "Ref #", className: "w-[18%]" },
            { label: "Date", className: "w-[12%]" },
            { label: "Student", className: "w-[18%]" },
            { label: "Description", className: "w-[22%]" },
            { label: "Amount", className: "w-[10%]" },
            { label: "Channel", className: "w-[10%]" },
            { label: "Status", className: "w-[10%]" },
          ]}
        >
          {data.rows.length > 0 ? (
            data.rows.map((row) => {
              const refContent = row.receiptId ? (
                <Link href={`/parent/receipt?receiptId=${row.receiptId}`} className="text-[#e64a19] hover:underline">
                  {row.referenceNumber}
                </Link>
              ) : (
                row.referenceNumber
              );

              return (
                <tr key={row.referenceNumber}>
                  <td className="font-mono text-[11px] text-[#6b6b6b]">{refContent}</td>
                  <td>{row.paidAt}</td>
                  <td className="font-medium">{row.studentName}</td>
                  <td>{row.description}</td>
                  <td className="font-semibold">{row.amount}</td>
                  <td>{row.channel}</td>
                  <td><StatusPill tone={row.status === "Paid" ? "green" : row.status === "Pending" ? "amber" : "red"}>{row.status}</StatusPill></td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="text-center text-[#6b6b6b]">
                No payment records yet.
              </td>
            </tr>
          )}
        </ParentTable>
      </ParentCard>
    </>
  );
}
