import { FlashToast } from "@/app/_components/flash-toast";
import { consumeAuthFlashToast, requireRole } from "@/lib/auth/session";
import { getParentPortalContext } from "@/lib/students/records";
import { ParentShell } from "../_components/parent-shell";

export default async function ParentPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireRole("parent");
  const parentContext = await getParentPortalContext(session.userId, session.name);
  const toast = await consumeAuthFlashToast("parent");

  return (
    <ParentShell context={parentContext}>
      <FlashToast toast={toast} />
      {children}
    </ParentShell>
  );
}

