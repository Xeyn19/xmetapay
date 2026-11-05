import Link from "next/link";
import { CreditCard, Receipt } from "lucide-react";

import { cn } from "@/lib/utils";

type TuitionWorkspaceView = "balances" | "payments";

const workspaceItems = [
  {
    view: "balances" as const,
    href: "/admin/tuition",
    label: "Student balances",
    description: "Assessments, due dates, payment plans, and reminders",
    icon: Receipt,
  },
  {
    view: "payments" as const,
    href: "/admin/collections",
    label: "Payment history",
    description: "Transactions, references, channels, and payment status",
    icon: CreditCard,
  },
];

export function TuitionWorkspaceNav({ current }: { current: TuitionWorkspaceView }) {
  return (
    <nav
      aria-label="Tuition workspace"
      className="mb-[18px] grid gap-2 rounded-xl border border-border bg-card p-2 min-[520px]:grid-cols-2"
    >
      {workspaceItems.map((item) => {
        const active = item.view === current;
        const Icon = item.icon;

        return (
          <Link
            key={item.view}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 transition focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-transparent text-foreground hover:border-border hover:bg-muted",
            )}
          >
            <span className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              active ? "bg-primary-foreground/15" : "bg-muted text-primary",
            )}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{item.label}</span>
              <span className={cn(
                "mt-0.5 block text-xs leading-5",
                active ? "text-primary-foreground/80" : "text-muted-foreground",
              )}>
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
