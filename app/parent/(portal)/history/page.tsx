import { Download, History } from "lucide-react";

import { ParentButton, ParentCard, ParentTable, SearchBox, StatusPill } from "../../_components/parent-ui";
import { historyRows } from "../../_data/parent-portal-data";

export default function HistoryPage() {
  return (
    <ParentCard
      title="Payment history"
      icon={History}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox placeholder="Search transaction..." />
          <ParentButton><Download className="size-4" />Export</ParentButton>
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
        {historyRows.map(([ref, date, student, description, amount, channel, status]) => (
          <tr key={ref}>
            <td className="font-mono text-[11px] text-[#6b6b6b]">{ref}</td>
            <td>{date}</td>
            <td className="font-medium">{student}</td>
            <td>{description}</td>
            <td className="font-semibold">{amount}</td>
            <td>{channel}</td>
            <td><StatusPill tone={status === "Done" || status === "Paid" ? "green" : "red"}>{status}</StatusPill></td>
          </tr>
        ))}
      </ParentTable>
    </ParentCard>
  );
}

