"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Receipt, UserPlus, Wallet, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { parentNavSections, parentPageMeta, settingsIcon } from "../_data/parent-portal-data";

export function ParentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const meta = parentPageMeta[pathname] ?? parentPageMeta["/parent/dashboard"];
  const Settings = settingsIcon;

  return (
    <div className="min-h-screen bg-[#f8f8f7] text-[#1a1a1a]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-[120] flex size-9 items-center justify-center rounded-[10px] bg-[#e64a19] text-white shadow-sm lg:hidden"
        aria-label="Open parent menu"
      >
        <Menu className="size-5" />
      </button>

      {open ? <button type="button" className="fixed inset-0 z-[90] bg-black/35 lg:hidden" onClick={() => setOpen(false)} aria-label="Close parent menu overlay" /> : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[100] flex w-60 flex-col border-r border-black/[0.08] bg-white transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="border-b border-black/[0.08] px-[18px] pb-4 pt-5">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex size-[34px] items-center justify-center rounded-lg bg-[#e64a19] text-white">
              <Receipt className="size-[18px]" />
            </span>
            <span className="text-[15px] font-semibold">XMETA Pay</span>
          </div>
          <p className="text-[11px] leading-4 text-[#6b6b6b]">
            Brentwood Academy of Las Pinas
            <br />
            Parent portal - SY 2025-2026
          </p>
        </div>

        <div className="flex items-center gap-2.5 border-b border-black/[0.08] bg-[#fbe9e7] px-[18px] py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e64a19] text-[13px] font-semibold text-white">
            MS
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">Maria Santos</div>
            <div className="text-[11px] text-[#6b6b6b]">Parent / guardian</div>
          </div>
          <button type="button" className="flex size-7 items-center justify-center rounded-md text-[#6b6b6b] hover:bg-white/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Close parent menu">
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-2.5">
          {parentNavSections.map((section) => (
            <div key={section.label}>
              <div className="px-2 py-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9e9e9e]">
                {section.label}
              </div>
              <div className="grid gap-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || (pathname === "/parent" && item.href === "/parent/dashboard");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-medium text-[#6b6b6b] transition hover:bg-[#f2f1ef] hover:text-[#1a1a1a]",
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

        <div className="flex items-center gap-2 border-t border-black/[0.08] px-[18px] py-3.5 text-xs text-[#6b6b6b]">
          <Settings className="size-[15px]" />
          Account settings
        </div>
      </aside>

      <div className="min-h-screen lg:pl-60">
        <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.08] bg-white px-4 py-3.5 pl-14 lg:px-7 lg:pl-7">
          <div>
            <h1 className="text-[17px] font-semibold text-[#1a1a1a]">{meta.title}</h1>
            <p className="mt-0.5 text-xs text-[#6b6b6b]">{meta.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/parent/enroll" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border border-black/15 bg-white px-3.5 text-[13px] font-medium text-[#6b6b6b] transition hover:bg-[#f2f1ef]">
              <UserPlus className="size-4" />
              Enroll student
            </Link>
            <Link href="/parent/pay-tuition" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border border-[#e64a19] bg-[#e64a19] px-3.5 text-[13px] font-medium text-white transition hover:bg-[#bf360c]">
              <Wallet className="size-4" />
              Pay fees
            </Link>
          </div>
        </header>
        <main className="px-4 py-7 lg:px-7">{children}</main>
      </div>
    </div>
  );
}
