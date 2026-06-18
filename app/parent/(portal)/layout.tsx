import { ParentShell } from "../_components/parent-shell";

export default function ParentPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ParentShell>{children}</ParentShell>;
}

