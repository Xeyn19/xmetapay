"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  exportRowsToCsv,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
import { reviewAdminRegistrationAction } from "@/app/super-admin/actions";
import type { SuperAdminAccountRow } from "@/lib/super-admin/records";

export function SuperAdminRegistrationsTable({ rows }: { rows: SuperAdminAccountRow[] }) {
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) => school === "all" || row.schoolName === school),
      query,
      (row) => `${row.name} ${row.email} ${row.phone} ${row.schoolName} ${row.staffRole} ${row.createdAt}`,
    ),
    [query, rows, school],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${school}`);

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search pending admin, school, email..."
          filters={[
            { label: "School", value: school, onChange: setSchool, options: toFilterOptions(rows.map((row) => row.schoolName), "All schools") },
          ]}
          onClear={() => {
            setQuery("");
            setSchool("all");
          }}
          onExport={() => exportRowsToCsv("super-admin-pending-registrations.csv", filteredRows, [
            { label: "Name", value: (row) => row.name },
            { label: "Email", value: (row) => row.email },
            { label: "Phone", value: (row) => row.phone },
            { label: "School", value: (row) => row.schoolName },
            { label: "Staff role", value: (row) => row.staffRole },
            { label: "Created", value: (row) => row.createdAt },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[980px] w-full table-fixed border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Admin", "School", "Role", "Phone", "Created", "Decision"].map((header) => (
                <th key={header} className="border-b border-black/[0.07] bg-[#f7f8fa] px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.04em] text-[#9ba3b8]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-black/[0.07] [&_td]:px-3.5 [&_td]:py-3 [&_td]:align-middle [&_td]:last:border-b-0 [&_td]:whitespace-nowrap [&_td]:overflow-hidden [&_td]:text-ellipsis [&_tr:hover_td]:bg-[#f7f8fa]">
            {filteredRows.length > 0 ? (
              pagination.pageRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="font-bold text-[#0f1117]">{row.name}</div>
                    <div className="font-mono text-[11px] text-[#5a6070]">{row.email}</div>
                  </td>
                  <td>{row.schoolName}</td>
                  <td>{row.staffRole}</td>
                  <td className="font-mono text-[11px] text-[#5a6070]">{row.phone}</td>
                  <td className="font-mono text-[11px] text-[#5a6070]">{row.createdAt}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <form action={reviewAdminRegistrationAction}>
                        <input type="hidden" name="userId" value={row.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button
                          type="submit"
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#2e7d32]/25 bg-[#e8f5e9] px-3 text-[12px] font-bold text-[#2e7d32] transition hover:bg-[#dff0e1] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#2e7d32]/20"
                        >
                          <Check className="size-3.5" />
                          Approve
                        </button>
                      </form>
                      <form action={reviewAdminRegistrationAction}>
                        <input type="hidden" name="userId" value={row.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <button
                          type="submit"
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#c62828]/20 bg-[#ffebee] px-3 text-[12px] font-bold text-[#c62828] transition hover:bg-[#ffe0e4] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#c62828]/15"
                        >
                          <X className="size-3.5" />
                          Reject
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center text-[#5a6070]">
                  {rows.length === 0 ? "No pending admin registrations." : "No pending registrations match the current filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
