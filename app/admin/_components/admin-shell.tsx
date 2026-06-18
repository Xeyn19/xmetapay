"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  MonitorCog,
  Plus,
  ReceiptText,
  Send,
  Settings,
  UserPlus,
  X,
} from "lucide-react";

import { AdminModalId, AdminModals } from "./admin-modals";
import { AdminButton } from "./admin-ui";
import { navSections, pageMeta } from "../_data/admin-dashboard-data";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<AdminModalId | null>(null);
  const meta = pageMeta[pathname] ?? pageMeta["/admin/dashboard"];

  const openModal = (modal: AdminModalId) => setActiveModal(modal);
  const closeModal = () => setActiveModal(null);

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#0f1117]">
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed left-3 top-3 z-[120] flex size-8 items-center justify-center rounded-lg bg-[#e64a19] text-white shadow-sm lg:hidden"
        aria-label="Open admin menu"
      >
        <Menu className="size-4.5" />
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[90] bg-[#0f1117]/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close admin menu overlay"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[100] flex w-[232px] flex-col bg-[#0f1117] text-white transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="border-b border-white/[0.07] px-4 pb-3.5 pt-[18px]">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-[#e64a19]">
              <ReceiptText className="size-[17px]" />
            </span>
            <span className="text-sm font-bold tracking-[-0.02em]">XMETA Pay</span>
          </div>
          <p className="text-[10.5px] leading-4 text-white/40">
            Brentwood Academy of Las Pinas
            <br />
            Admin dashboard - SY 2025-2026
          </p>
        </div>

        <div className="flex items-center gap-2.5 border-b border-white/[0.07] bg-white/[0.04] px-4 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e64a19] text-[11px] font-bold">
            CN
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white/90">Ms. Charmaine Nase</div>
            <div className="text-[10px] text-white/40">School administrator</div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto flex size-7 items-center justify-center rounded-md text-white/55 hover:bg-white/10 lg:hidden"
            aria-label="Close admin menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-2">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="px-2 py-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white/25">
                {section.label}
              </div>
              <div className="grid gap-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || (pathname === "/admin" && item.href === "/admin/dashboard");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-white/55 transition hover:bg-white/[0.07] hover:text-white/90",
                        active && "bg-[#e64a19] text-white hover:bg-[#e64a19] hover:text-white"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-[#c62828] px-1.5 text-[9.5px] font-bold leading-4 text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-3 text-[11.5px] text-white/35">
          <Settings className="size-[15px]" />
          Settings & configuration
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[232px]">
        <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.07] bg-white px-4 py-3 pl-14 lg:px-6 lg:pl-6">
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-[-0.02em] text-[#0f1117]">{meta.title}</h1>
            <p className="mt-0.5 text-[11.5px] text-[#5a6070]">{meta.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton data-modal-trigger="reminder" onClick={() => openModal("reminder")}><Send className="size-4" />Send reminders</AdminButton>
            <AdminButton data-modal-trigger="payment" onClick={() => openModal("payment")}><Plus className="size-4" />Record payment</AdminButton>
            <AdminButton data-modal-trigger="enroll" tone="primary" onClick={() => openModal("enroll")}><UserPlus className="size-4" />Enroll student</AdminButton>
          </div>
        </header>

        <main className="px-4 py-[22px] lg:px-6">{children}</main>
      </div>

      <AdminModals activeModal={activeModal} onClose={closeModal} />
      <div className="pointer-events-none fixed bottom-5 right-6 hidden items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-[11px] text-[#9ba3b8] shadow-sm backdrop-blur xl:flex">
        <MonitorCog className="size-3.5" />
        UI prototype
      </div>
    </div>
  );
}
