"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, FileBarChart, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCOUNTING_TABS = [
  {
    href: "/dashboard/settings/accounting/expenses",
    label: "Expense log",
    icon: Receipt,
    match: "/accounting/expenses",
  },
  {
    href: "/dashboard/settings/accounting/sales-report",
    label: "Sales report",
    icon: FileBarChart,
    match: "/accounting/sales-report",
  },
  {
    href: "/dashboard/settings/accounting/vat-returns",
    label: "VAT returns",
    icon: Calculator,
    match: "/accounting/vat-returns",
  },
] as const;

type AccountingShellProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AccountingShell({ title, description, actions, children }: AccountingShellProps) {
  const pathname = usePathname() ?? "";

  return (
    <div className="space-y-8">
      <header className="space-y-6 border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Admin · Accounting
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <nav
          className="inline-flex rounded-lg border border-border bg-muted/40 p-1"
          aria-label="Accounting sections"
        >
          {ACCOUNTING_TABS.map((tab) => {
            const active = pathname.includes(tab.match);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}
