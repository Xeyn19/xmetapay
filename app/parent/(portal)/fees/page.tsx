import { CreditCard, Receipt } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { getParentFeePageData } from "@/lib/fees/records";

import { MetricCard, MetricGrid, ParentButton, ParentCard, ParentTable, StatusPill } from "../../_components/parent-ui";

export default async function FeesPage() {
  const session = await requireRole("parent");
  const data = await getParentFeePageData(session.userId);

  return (
    <>
      <MetricGrid>
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </MetricGrid>
      <ParentCard
        title="Fee summary"
        icon={Receipt}
        action={<ParentButton tone="primary" disabled><CreditCard className="size-4" />Payment pending</ParentButton>}
        bodyClassName="p-0"
      >
        <ParentTable
          headers={[
            { label: "Student", className: "w-[18%]" },
            { label: "Fee", className: "w-[18%]" },
            { label: "Billed", className: "w-[12%]" },
            { label: "Paid", className: "w-[12%]" },
            { label: "Balance", className: "w-[12%]" },
            { label: "Due date", className: "w-[16%]" },
            { label: "Status", className: "w-[12%]" },
          ]}
        >
          {data.rows.length > 0 ? (
            data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="font-semibold text-[#1a1a1a]">{row.studentName}</div>
                  <div className="font-mono text-[11px] text-[#6b6b6b]">{row.studentReference}</div>
                </td>
                <td>
                  <div className="font-semibold text-[#1a1a1a]">{row.feeName}</div>
                  <div className="text-[11px] text-[#6b6b6b]">{row.category === "tuition" ? "Tuition" : "Other fee"}</div>
                </td>
                <td>{row.amountDue}</td>
                <td className="font-semibold text-[#2e7d32]">{row.amountPaid}</td>
                <td className="font-semibold text-[#c62828]">{row.balance}</td>
                <td>{row.dueDate}</td>
                <td><StatusPill tone={row.tone}>{row.status}</StatusPill></td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center text-[#6b6b6b]">
                {data.warning ?? "No assigned fees yet."}
              </td>
            </tr>
          )}
        </ParentTable>
      </ParentCard>
    </>
  );
}

