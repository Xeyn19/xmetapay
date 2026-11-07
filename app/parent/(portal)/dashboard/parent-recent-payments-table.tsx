"use client";

import type { ParentDashboardPayment } from "@/lib/students/records";

import { ParentTable, StatusPill } from "../../_components/parent-ui";

export function ParentRecentPaymentsTable({ rows }: { rows: ParentDashboardPayment[] }) {
  return (
    <>
      <ParentTable
        headers={[
          { label: "Ref #", className: "w-[20%]" },
          { label: "Student", className: "w-[22%]" },
          { label: "Description", className: "w-[26%]" },
          { label: "Amount", className: "w-[16%]" },
          { label: "Status", className: "w-[16%]" },
        ]}
      >
        {rows.length > 0 ? (
          rows.map((payment) => (
            <tr key={payment.referenceNumber}>
              <td className="font-mono text-[11px] text-muted-foreground">{payment.referenceNumber}</td>
              <td className="font-medium">{payment.studentName}</td>
              <td>{payment.description}</td>
              <td className="font-semibold">{payment.amount}</td>
              <td><StatusPill tone={payment.status === "Paid" ? "green" : "amber"}>{payment.status}</StatusPill></td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={5} className="text-center text-muted-foreground">
              No payment records yet.
            </td>
          </tr>
        )}
      </ParentTable>
    </>
  );
}
