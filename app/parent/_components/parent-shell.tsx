"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Receipt, Wallet, X } from "lucide-react";
import { useState } from "react";

import { logoutAction } from "@/app/auth/actions";
import type { ParentPortalContext } from "@/lib/students/records";
import { cn } from "@/lib/utils";
import { parentNavSections, parentPageMeta, settingsIcon } from "../_data/parent-portal-data";

export function ParentShell({
  children,
  context,
}: {
  children: React.ReactNode;
  context: ParentPortalContext;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const meta = getParentMeta(pathname, context);
  const Settings = settingsIcon;
  const logout = logoutAction.bind(null, "parent");
  const navSections = parentNavSections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      badge: item.href === "/parent/fees" && context.payableFeeCount > 0
        ? String(context.payableFeeCount)
        : item.badge,
    })),
  }));

  return (
    <div className="min-h-[100svh] overflow-x-hidden bg-[#f8f8f7] text-[#1a1a1a]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed left-3 top-3 z-[120] flex size-11 items-center justify-center rounded-[10px] bg-[#e64a19] text-white shadow-sm transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/30 lg:hidden"
          aria-label="Open parent menu"
          aria-controls="parent-sidebar"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
      ) : null}

      {open ? <button type="button" className="fixed inset-0 z-[90] bg-black/35 lg:hidden" onClick={() => setOpen(false)} aria-label="Close parent menu overlay" /> : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[100] flex w-60 max-w-[calc(100vw-24px)] flex-col border-r border-black/[0.08] bg-white transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        id="parent-sidebar"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Parent navigation"
      >
        <div className="border-b border-black/[0.08] px-[18px] pb-4 pt-5">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex size-[34px] items-center justify-center rounded-lg bg-[#e64a19] text-white">
              <Receipt className="size-[18px]" />
            </span>
            <span className="text-[15px] font-semibold">XMETA Pay</span>
          </div>
          <p className="text-[11px] leading-4 text-[#6b6b6b]">
            Parent portal
            <br />
            Student-linked access
          </p>
        </div>

        <div className="flex items-center gap-2.5 border-b border-black/[0.08] bg-[#fbe9e7] px-[18px] py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e64a19] text-[13px] font-semibold text-white">
            {context.parentInitials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{context.parentName}</div>
            <div className="truncate text-[11px] text-[#6b6b6b]">
              {context.relationshipLabel} - {context.contactLine}
            </div>
          </div>
          <button type="button" className="flex size-11 items-center justify-center rounded-md text-[#6b6b6b] transition hover:bg-white/60 focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20 lg:hidden" onClick={() => setOpen(false)} aria-label="Close parent menu" aria-controls="parent-sidebar">
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-2.5">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="px-2 py-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9e9e9e]">
                {section.label}
              </div>
              <div className="grid gap-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href
                    || pathname.startsWith(`${item.href}/`)
                    || (item.href === "/parent/student-profile" && pathname.startsWith("/parent/students/"))
                    || (pathname === "/parent" && item.href === "/parent/dashboard");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-medium text-[#6b6b6b] transition hover:bg-[#f2f1ef] hover:text-[#1a1a1a] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20",
                        active && "bg-[#fbe9e7] text-[#e64a19] hover:bg-[#fbe9e7] hover:text-[#e64a19]"
                      )}
                    >
                      <Icon className="size-[17px] shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge ? <span className="rounded-full bg-[#c62828] px-1.5 text-[10px] font-semibold leading-4 text-white">{item.badge}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="grid gap-2 border-t border-black/[0.08] px-[18px] py-3.5">
          <div className="flex items-center gap-2 text-xs text-[#6b6b6b]">
            <Settings className="size-[15px]" />
            Account settings
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-[#6b6b6b] transition hover:bg-[#f2f1ef] hover:text-[#1a1a1a] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/20"
            >
              <LogOut className="size-[17px]" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-h-[100svh] min-w-0 max-w-full lg:pl-60">
        <header className="sticky top-0 z-50 flex min-w-0 max-w-full flex-col gap-3 border-b border-black/[0.08] bg-white px-4 py-3 pl-16 sm:flex-row sm:items-center sm:justify-between lg:px-7 lg:pl-7">
          <div className="min-w-0 max-w-full">
            <h1 className="text-[17px] font-semibold leading-6 text-[#1a1a1a]">{meta.title}</h1>
            <p className="mt-0.5 text-xs leading-5 text-[#6b6b6b]">{meta.subtitle}</p>
          </div>
          <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:w-auto">
            <Link href="/parent/pay-tuition" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#e64a19] bg-[#e64a19] px-3.5 text-[13px] font-medium text-white transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/30">
              <Wallet className="size-4" />
              Pay fees
            </Link>
          </div>
        </header>
        <main className="min-w-0 max-w-full px-4 py-5 sm:py-6 lg:px-7 lg:py-7">{children}</main>
      </div>
    </div>
  );
}

function getParentMeta(pathname: string, context: ParentPortalContext) {
  const isSelectedStudentProfilePath = pathname.startsWith("/parent/students/");
  const isStudentProfilePath = pathname === "/parent/student-profile" || isSelectedStudentProfilePath;
  const page = isStudentProfilePath
    ? parentPageMeta["/parent/student-profile"]
    : parentPageMeta[pathname] ?? parentPageMeta["/parent/dashboard"];
  const studentLabel = context.primaryStudentName && context.primaryStudentReference
    ? `${context.primaryStudentName} - ${context.primaryStudentReference}`
    : "Link a student reference to show student details";

  if (pathname === "/parent/dashboard" || pathname === "/parent") {
    return {
      title: page.title,
      subtitle: `Welcome back, ${context.parentFirstName}`,
    };
  }

  if (isStudentProfilePath) {
    return {
      title: page.title,
      subtitle: isSelectedStudentProfilePath ? "Selected student details" : studentLabel,
    };
  }

  if (pathname === "/parent/fees") {
    return {
      title: page.title,
      subtitle: context.primaryStudentName ? `${context.primaryStudentName} - assigned school balances` : "Assigned school balances",
    };
  }

  if (pathname === "/parent/pay-tuition") {
    return {
      title: page.title,
      subtitle: context.primaryStudentName ? `${context.primaryStudentName} - assigned fee payment` : page.subtitle,
    };
  }

  return page;
}
