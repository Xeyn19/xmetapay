import { FlashToast } from "@/app/_components/flash-toast";
import { BrandLogo } from "@/app/_components/brand-logo";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { logoutAction } from "@/app/auth/actions";
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

  if (!parentContext.schoolScopeReady) {
    const logout = logoutAction.bind(null, "parent");

    return (
      <main className="dashboard-theme flex min-h-[100svh] items-center justify-center bg-background px-4 py-8">
        <section className="w-full max-w-xl rounded-xl border border-border bg-card p-5 text-center shadow-sm sm:p-8">
          <div className="flex items-center justify-center gap-3">
            <BrandLogo />
            <span className="text-lg font-bold text-foreground">Parent portal</span>
          </div>
          <h1 className="mt-6 text-pretty text-2xl font-bold text-foreground">School assignment required</h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-6 text-muted-foreground">
            This existing parent account could not be safely assigned to one school. No records were deleted. Contact support before continuing.
          </p>
          <div className="mt-6 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:justify-center">
            <form action={logout}>
              <button type="submit" className="min-h-11 w-full rounded-lg bg-[#e64a19] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e64a19]/25 min-[420px]:w-auto">
                Log out
              </button>
            </form>
            <ThemeToggle className="min-h-11 justify-center" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <ParentShell context={parentContext}>
      <FlashToast toast={toast} />
      {children}
    </ParentShell>
  );
}

