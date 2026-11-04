"use client";

import type { ParentStudentLinkRequest } from "@/lib/parents/student-claims";

import { AdminTable, StatusPill } from "../../_components/admin-ui";
import { reviewParentStudentLinkRequestAction } from "./actions";

export function StudentLinkRequestsTable({ rows, returnTo = "/admin/parents" }: { rows: ParentStudentLinkRequest[]; returnTo?: "/admin/parents" | "/admin/students" }) {
  return <AdminTable headers={[
    { label: "Parent" },
    { label: "Student" },
    { label: "Submitted" },
    { label: "Status" },
    { label: "Actions" },
  ]}>
    {rows.length ? rows.map((row) => <tr key={row.id}>
      <td className="!whitespace-normal"><strong>{row.parentName}</strong><div className="break-all text-[11px] text-muted-foreground">{row.parentEmail} · {row.relationship}</div></td>
      <td className="!whitespace-normal"><strong>{row.studentName}</strong><div className="font-mono text-[11px] text-muted-foreground">{row.studentReference}</div></td>
      <td>{row.submittedAt}</td>
      <td><StatusPill tone={row.status === "Approved" ? "active" : row.status === "Pending" ? "pending" : "inactive"}>{row.status}</StatusPill></td>
      <td className="!whitespace-normal !overflow-visible">
        {row.status === "Pending" ? <form action={reviewParentStudentLinkRequestAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="requestId" value={row.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" name="decision" value="approve" onClick={(event) => { if (!window.confirm(`Approve ${row.parentName}'s connection to ${row.studentName}?`)) event.preventDefault(); }} className="min-h-11 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25">Approve</button>
          <button type="submit" name="decision" value="reject" onClick={(event) => { if (!window.confirm(`Reject this connection request?`)) event.preventDefault(); }} className="min-h-11 rounded-lg border border-destructive/40 px-3 text-xs font-bold text-destructive focus:outline-none focus-visible:ring-3 focus-visible:ring-destructive/25">Reject</button>
        </form> : <span className="text-xs text-muted-foreground">Reviewed</span>}
      </td>
    </tr>) : <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No student connection requests yet.</td></tr>}
  </AdminTable>;
}
