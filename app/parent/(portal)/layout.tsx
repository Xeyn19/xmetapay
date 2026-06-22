import { FlashToast } from "@/app/_components/flash-toast";
import { consumeAuthFlashToast, requireRole } from "@/lib/auth/session";
import { ParentShell } from "../_components/parent-shell";

export default async function ParentPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("parent");
  const toast = await consumeAuthFlashToast("parent");

  return (
    <ParentShell>
      <FlashToast toast={toast} />
      {children}
    </ParentShell>
  );
}

