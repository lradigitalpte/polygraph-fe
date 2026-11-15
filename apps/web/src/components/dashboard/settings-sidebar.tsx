"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Settings as SettingsIcon,
  ShieldCheck,
  History,
  ArrowLeft,
  UserPlus,
  ClipboardList,
  CalendarClock,
  FileText,
  ListChecks,
  FileSignature,
  Receipt,
  Calculator,
  FileBarChart,
  Landmark, DatabaseBackup } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/components/dashboard/use-current-user";

type SettingsItem = {
  name: string;
  href: string;
  icon: typeof SettingsIcon;
  exact?: boolean;
  requires?: string;
};

type SettingsGroup = { label: string; items: SettingsItem[] };

const settingsNavigation: SettingsGroup[] = [
  {
    label: "Organization",
    items: [
      { name: "General", href: "/dashboard/settings", icon: SettingsIcon, exact: true },
      { name: "Bank accounts", href: "/dashboard/settings/bank-accounts", icon: Landmark },
    ],
  },
  {
    label: "Exams & reports",
    items: [
      { name: "Exam types", href: "/dashboard/settings/exam-types", icon: ClipboardList },
      { name: "Question library", href: "/dashboard/settings/question-library", icon: ListChecks },
      { name: "Report templates", href: "/dashboard/settings/report-templates", icon: FileText },
      { name: "Agreements", href: "/dashboard/settings/agreements", icon: FileSignature },
      { name: "Examiner availability", href: "/dashboard/settings/availability", icon: CalendarClock },
    ],
  },
  {
    label: "People & access",
    items: [
      { name: "Users", href: "/dashboard/settings/users", icon: Users },
      { name: "Roles & permissions", href: "/dashboard/settings/roles", icon: ShieldCheck },
      { name: "Audit log", href: "/dashboard/settings/audit", icon: History },
      { name: "Backups", href: "/dashboard/settings/backups", icon: DatabaseBackup, requires: "backup:manage" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { name: "Expenses", href: "/dashboard/settings/accounting/expenses", icon: Receipt, requires: "accounting:view" },
      { name: "Sales report", href: "/dashboard/settings/accounting/sales-report", icon: FileBarChart, requires: "accounting:view" },
      { name: "VAT returns", href: "/dashboard/settings/accounting/vat-returns", icon: Calculator, requires: "accounting:view" },
    ],
  },
];

function isSettingsNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsSidebar() {
  const pathname = usePathname() ?? "";
  const { can } = useCurrentUser();

  const groups = settingsNavigation
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.requires || can(item.requires)) }))
    .filter((group) => group.items.length > 0);

  // "Add new user" lives at /users/new — don't also light up "Users" for it.
  const activeHref = groups
    .flatMap((g) => g.items)
    .filter((item) => isSettingsNavActive(pathname, item.href, item.exact))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const onNewUser = pathname.startsWith("/dashboard/settings/users/new");

  return (
    <div className="flex h-full min-h-0 w-64 flex-col p-3 pr-0">
      <div className="flex min-h-0 flex-1 flex-col rounded-[26px] bg-[#2B2A27] dark:bg-[#1B1B19] text-[#FAF9F5] shadow-[0_8px_24px_rgba(20,20,19,0.18)] ring-1 ring-white/[0.06]">
        {/* Header */}
        <div className="flex shrink-0 flex-col gap-4 p-4 pb-3">
          <Link
            href="/dashboard"
            className="flex h-9 w-fit items-center gap-2 rounded-full pr-3.5 pl-2.5 text-[13px] font-medium text-[#C9C6BC] ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-[#FAF9F5]"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to dashboard
          </Link>
          <div className="px-1">
            <h2 className="text-[17px] font-medium tracking-[-0.01em] text-[#FAF9F5]">Admin center</h2>
            <p className="mt-0.5 text-xs text-[#9C998F]">Organization, team and accounting settings.</p>
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Settings" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-3 no-scrollbar">
          {groups.map((group, index) => (
            <div key={group.label} role="group" aria-label={group.label} className={cn("flex flex-col gap-0.5", index > 0 && "mt-4")}>
              <span className="mb-1 px-3 text-[11px] font-medium tracking-[0.08em] text-[#8A877E] uppercase">{group.label}</span>
              {group.items.map((item) => {
                const isActive = !onNewUser && item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex h-10 shrink-0 items-center gap-3 rounded-[13px] px-3 text-[14px] transition-colors",
                      isActive
                        ? "bg-white/[0.09] font-medium text-[#FAF9F5]"
                        : "text-[#C9C6BC] hover:bg-white/[0.06] hover:text-[#FAF9F5]",
                    )}
                  >
                    {isActive ? <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 -left-3 w-[3px] rounded-r-full bg-primary" /> : null}
                    <item.icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={isActive ? 2.1 : 1.8} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Quick action */}
        <div className="shrink-0 border-t border-white/[0.08] p-3">
          <Link
            href="/dashboard/settings/users/new"
            aria-current={onNewUser ? "page" : undefined}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#FAF9F5] px-4 text-sm font-medium text-[#2B2A27] transition-colors hover:bg-white"
          >
            <UserPlus aria-hidden="true" className="size-4" />
            Add new user
          </Link>
        </div>
      </div>
    </div>
  );
}
