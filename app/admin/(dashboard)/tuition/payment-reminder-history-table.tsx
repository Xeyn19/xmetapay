"use client";

import { DashboardTablePagination, usePaginatedRows } from "@/app/_components/table-controls";

import { AdminTable } from "../../_components/admin-ui";

type PaymentReminderRow = [number, string, string, string, string, string, string];

export function PaymentReminderHistoryTable({ rows }: { rows: PaymentReminderRow[] }) {
  const pagination = usePaginatedRows(rows, "payment-reminders");

  return (
    <>
      <AdminTable
        headers={[
          { label: "Created", className: "w-[16%]" },
          { label: "Student", className: "w-[21%]" },
          { label: "Parent", className: "w-[21%]" },
          { label: "Grade", className: "w-[14%]" },
          { label: "Channel", className: "w-[14%]" },
          { label: "Status", className: "w-[14%]" },
        ]}
      >
        {rows.length > 0 ? (
          pagination.pageRows.map(([notificationId, created, student, parent, grade, channel, status]) => (
            <tr key={notificationId}>
              <td className="font-mono text-[11px] text-[#5a6070]">{created}</td>
              <td className="font-bold">{student}</td>
              <td>{parent}</td>
              <td>{grade}</td>
              <td>{channel}</td>
              <td className="font-semibold text-[#e64a19]">{status}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={6} className="text-center text-[#5a6070]">
              No payment reminder history yet.
            </td>
          </tr>
        )}
      </AdminTable>
      <DashboardTablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        totalItems={pagination.totalItems}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </>
  );
}
