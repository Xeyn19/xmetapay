import { PortalAuthLayout } from "../../_components/auth-ui";
import { getSession } from "@/lib/auth/session";
import { getParentClaimState } from "@/lib/parents/invitations";
import { ParentClaimFlow } from "./parent-claim-flow";

export default async function ParentRegisterPage() {
  const session = await getSession();
  const state = await getParentClaimState(session?.role === "parent" ? session.userId : undefined);

  return (
    <PortalAuthLayout portal="parent" mode="register">
      <ParentClaimFlow initialState={state} />
    </PortalAuthLayout>
  );
}
