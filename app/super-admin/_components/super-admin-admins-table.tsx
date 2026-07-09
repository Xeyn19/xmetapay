"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  DashboardTableControls,
  DashboardTablePagination,
  exportRowsToCsv,
  filterByQuery,
  toFilterOptions,
  usePaginatedRows,
} from "@/app/_components/table-controls";
import { updateSchoolAdminStatusAction } from "@/app/super-admin/actions";
import type { SuperAdminAccountRow } from "@/lib/super-admin/records";

function statusClass(status: SuperAdminAccountRow["status"]) {
  if (status === "active") {
    return "bg-[#e8f5e9] text-[#2e7d32]";
  }

  if (status === "disabled") {
    return "bg-[#ffebee] text-[#c62828]";
  }

  return "bg-[#f3e5f5] text-[#6a1b9a]";
}

export function SuperAdminAdminsTable({ rows }: { rows: SuperAdminAccountRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [school, setSchool] = useState("all");
  const filteredRows = useMemo(
    () => filterByQuery(
      rows.filter((row) =>
        (status === "all" || row.status === status)
        && (school === "all" || row.schoolName === school)
      ),
      query,
      (row) => Object.values(row).join(" "),
    ),
    [query, rows, school, status],
  );
  const pagination = usePaginatedRows(filteredRows, `${query}|${status}|${school}`);

  return (
    <>
      <div className="border-b border-black/[0.07] px-[18px] py-3">
        <DashboardTableControls
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search admin, school, email..."
          filters={[
            { label: "Status", value: status, onChange: setStatus, options: toFilterOptions(rows.map((row) => row.status), "All statuses") },
            { label: "School", value: school, onChange: setSchool, options: toFilterOptions(rows.map((row) => row.schoolName), "All schools") },
          ]}
          onClear={() => {
            setQuery("");
            setStatus("all");
            setSchool("all");
          }}
          onExport={() => exportRowsToCsv("super-admin-school-admins.csv", filteredRows, [
            { label: "Name", value: (row) => row.name },
            { label: "Email", value: (row) => row.email },
            { label: "Phone", value: (row) => row.phone },
            { label: "School", value: (row) => row.schoolName },
            { label: "Staff role", value: (row) => row.staffRole },
            { label: "Status", value: (row) => row.status },
            { label: "Last login", value: (row) => row.lastLogin },
            { label: "Created", value: (row) => row.createdAt },
          ])}
          exportDisabled={filteredRows.length === 0}
        />
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[980px] w-full table-fixed border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Admin", "School", "Role", "Status", "Last login", "Created", "Action"].map((header) => (
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
                  <td>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10.5px] font-bold leading-5 ${statusClass(row.status)}`}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                  <td className="font-mono text-[11px] text-[#5a6070]">{row.lastLogin}</td>
                  <td className="font-mono text-[11px] text-[#5a6070]">{row.createdAt}</td>
                  <td>
                    {row.status === "pending" ? (
                      <Link
                        href="/super-admin/registrations"
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#e64a19]/35 bg-[#fff4f0] px-3 text-[12px] font-bold text-[#bf360c] transition hover:bg-[#fbe9e7] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                      >
                        Review
                      </Link>
                    ) : (
                      <form action={updateSchoolAdminStatusAction}>
                        <input type="hidden" name="userId" value={row.id} />
                        <input type="hidden" name="status" value={row.status === "disabled" ? "active" : "disabled"} />
                        <button
                          type="submit"
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-black/15 bg-white px-3 text-[12px] font-semibold text-[#5a6070] transition hover:bg-[#eff1f5] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25"
                        >
                          {row.status === "disabled" ? "Enable" : "Disable"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center text-[#5a6070]">
                  {rows.length === 0 ? "No school admin accounts yet." : "No school admins match the current filters."}
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
