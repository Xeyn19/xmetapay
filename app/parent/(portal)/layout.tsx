import { ParentShell } from "../_components/parent-shell";
import { requireRole } from "@/lib/auth/session";

export default async function ParentPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("parent");

  return <ParentShell>{children}</ParentShell>;
}

