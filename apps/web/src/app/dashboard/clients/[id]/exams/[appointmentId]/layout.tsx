"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, FileText, ListChecks } from "lucide-react";
import type { Route } from "next";

import { cn } from "@/lib/utils";
import { useSessionRoute } from "@/components/dashboard/session-route";

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { base, back, backLabel } = useSessionRoute();

  const tabs = [
    { name: "Documentation", href: base, icon: FileText, exact: true },
    { name: "Questions", href: `${base}/questions`, icon: ListChecks },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Session sections" className="flex gap-1 rounded-full bg-[#E9E6DD] p-1 dark:bg-muted">
          {tabs.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href || pathname === `${tab.href}/`
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.name}
                href={tab.href as Route}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full px-4 text-sm transition-colors",
                  isActive
                    ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(40,36,20,0.08)] dark:bg-card"
                    : "text-[#3D3929] hover:text-foreground dark:text-muted-foreground",
                )}
              >
                <tab.icon aria-hidden="true" className="size-4" />
                {tab.name}
              </Link>
            );
          })}
        </nav>
        <Link
          href={back as Route}
          className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" /> {backLabel}
        </Link>
      </div>
      {children}
    </div>
  );
}
