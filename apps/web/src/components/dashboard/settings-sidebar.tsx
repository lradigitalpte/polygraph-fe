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
  CalendarClock
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNavigation = [
  { name: "General", href: "/dashboard/settings", icon: SettingsIcon },
  { name: "Exam Types", href: "/dashboard/settings/exam-types", icon: ClipboardList },
  { name: "Examiner Availability", href: "/dashboard/settings/availability", icon: CalendarClock },
  { name: "Manage Users", href: "/dashboard/settings/users", icon: Users },
  { name: "Roles & Permissions", href: "/dashboard/settings/roles", icon: ShieldCheck },
  { name: "Audit Logs", href: "/dashboard/settings/audit", icon: History },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-background border-r border-border">
      {/* Settings Header */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="px-6 py-8">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Admin Center</h2>
        <p className="text-xs text-muted-foreground mt-1">Manage organization users, roles, and security logs.</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 pb-6">
        {settingsNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href as any}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Quick Action in Sidebar */}
      <div className="p-4 border-t border-border">
        <Link 
          href="/dashboard/settings/users/new"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 border border-border"
        >
          <UserPlus className="h-4 w-4" />
          Add New User
        </Link>
      </div>
    </div>
  );
}
