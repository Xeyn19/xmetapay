import type { PendingGuardianRow } from "@/lib/students/guardian-email-links";
import { changePendingGuardianEmailAction } from "@/app/admin/students/actions";

export function PendingGuardianEmails({ rows }: { rows: PendingGuardianRow[] | null }) {
  if (rows === null) return <p className="text-xs text-[#9a5b00]">Import the enrollment parent email migration before managing connections.</p>;
  if (!rows.length) return <p className="text-xs text-[#5a6070]">No parent email connections are waiting.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-[#5a6070]">Correct an email before approval or cancel an incorrect connection. Showing the most recent 100.</p>
      {rows.map((row) => (
        <form key={row.id} action={changePendingGuardianEmailAction} className="grid gap-3 rounded-lg border border-black/10 p-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1.5fr_1fr_auto] xl:items-end">
          <input type="hidden" name="assignmentId" value={row.id} />
          <div className="text-xs"><strong className="block text-[#0f1117]">{row.studentName}</strong><span className="break-all text-[#5a6070]">{row.studentReference}</span></div>
          <label className="grid gap-1 text-xs font-semibold">Guardian name<input name="guardianName" required maxLength={120} defaultValue={row.name} className="min-h-11 min-w-0 rounded-lg border border-black/15 px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold">Parent email<input name="guardianEmail" required type="email" maxLength={150} defaultValue={row.email} className="min-h-11 min-w-0 rounded-lg border border-black/15 px-3 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold">Relationship<select name="guardianRelationship" required defaultValue={row.relationship} className="min-h-11 rounded-lg border border-black/15 px-3 text-sm"><option value="mother">Mother</option><option value="father">Father</option><option value="guardian">Guardian</option></select></label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1"><button type="submit" name="intent" value="save" className="min-h-11 rounded-lg bg-[#e64a19] px-3 text-xs font-bold text-white focus-visible:ring-3 focus-visible:ring-[#e64a19]/30">Save</button><button type="submit" name="intent" value="cancel" formNoValidate className="min-h-11 rounded-lg border border-black/15 px-3 text-xs font-bold focus-visible:ring-3 focus-visible:ring-[#e64a19]/30">Cancel link</button></div>
        </form>
      ))}
    </div>
  );
}
