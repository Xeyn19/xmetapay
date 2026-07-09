import { getSuperAdminDashboardData } from "@/lib/super-admin/records";
import { SuperAdminAdminsTable } from "../_components/super-admin-admins-table";

export default async function SuperAdminAdminAccountsPage() {
  const data = await getSuperAdminDashboardData();

  return (
    <div className="mx-auto max-w-7xl">
      <section className="overflow-hidden rounded-xl border border-black/[0.07] bg-white">
        <div className="border-b border-black/[0.07] px-[18px] py-3.5">
          <h2 className="text-[13px] font-bold leading-5 text-[#0f1117]">School admin accounts</h2>
          <p className="mt-0.5 text-[11.5px] leading-5 text-[#5a6070]">
            Disable or enable school admin access without changing school data.
          </p>
        </div>
        <SuperAdminAdminsTable rows={data.adminRows} />
      </section>
    </div>
  );
}
