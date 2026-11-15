"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, FileBarChart, Receipt } from "lucide-react";
import { PageHero, type GlowTone } from "@/components/dashboard/ui-kit";
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
  /** Headline; wrap the emphasised word in <strong className="font-semibold">. */
  title: React.ReactNode;
  description: string;
  actions?: React.ReactNode;
  tone?: GlowTone;
  /** GlassStat tiles shown inside the hero. */
  stats?: React.ReactNode;
  children: React.ReactNode;
};

export function AccountingShell({ title, description, actions, tone = "amber", stats, children }: AccountingShellProps) {
  const pathname = usePathname() ?? "";

  return (
    <div className="space-y-5 pb-10">
      <header className="space-y-5">
        <PageHero tone={tone} orb="72%" lineTop={40} icon={Calculator} eyebrow="Accounting" title={title} description={description} actions={actions}>
          {stats}
        </PageHero>
        <nav aria-label="Accounting sections" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-[#E9E6DD] p-1 no-scrollbar sm:w-fit dark:bg-muted">
          {ACCOUNTING_TABS.map((tab) => {
            const active = pathname.includes(tab.match);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(40,36,20,0.08)] dark:bg-card"
                    : "text-[#3D3929] hover:text-foreground dark:text-muted-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
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
