import { getSuperAdminDashboardData } from "@/lib/super-admin/records";
import { SuperAdminRegistrationsTable } from "./super-admin-registrations-table";

export default async function SuperAdminRegistrationsPage() {
  const data = await getSuperAdminDashboardData();
  const pendingRows = data.adminRows.filter((row) => row.status === "pending");

  return (
    <div className="mx-auto max-w-7xl">
        <section className="mb-5 rounded-xl border border-[#f6c6ba] bg-[#fff4f0] px-4 py-3 text-[12.5px] leading-5 text-[#8a321a]">
          Pending admin accounts cannot log in. Approving an account makes it active; rejecting it disables the account without deleting the registration record.
        </section>

        <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
          <div className="border-b border-black/[0.07] px-[18px] py-3.5">
            <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">Pending school admin registrations</h2>
            <p className="mt-0.5 text-[11.5px] leading-5 text-[#5a6070]">
              Review account owner details, school name, and contact information before approval.
            </p>
          </div>
          <SuperAdminRegistrationsTable rows={pendingRows} />
        </section>
    </div>
  );
}
