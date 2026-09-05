"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { FileText, ListChecks } from "lucide-react";
import type { Route } from "next";

import { cn } from "@/lib/utils";

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname() ?? "";
  const base = `/dashboard/clients/${params.id}/exams/${params.appointmentId}`;

  const tabs = [
    { name: "Documentation", href: base, icon: FileText, exact: true },
    { name: "Questions", href: `${base}/questions`, icon: ListChecks },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex gap-2 border-b border-border">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href || pathname === `${tab.href}/`
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.name}
              href={tab.href as Route}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
