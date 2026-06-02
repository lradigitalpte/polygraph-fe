"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Calendar,
  CalendarClock,
  Target,
  CreditCard,
  BellRing,
  UserCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useUIStore } from "@/lib/store";
import { useCurrentUser, clearCurrentUserCache } from "@/components/dashboard/use-current-user";

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  requires?: string;
};

// Full operations nav for Admin / ops users. Items with `requires` are still
// permission-filtered so the ops "User" role only sees what it's allowed.
const staffNav: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Exams", href: "/dashboard/exams", icon: FileText },
  { name: "Clients", href: "/dashboard/clients", icon: Users },
  { name: "Leads", href: "/dashboard/leads", icon: Target, requires: "lead:view" },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "Reminders", href: "/dashboard/reminders", icon: BellRing, requires: "reminder:view" },
  { name: "Payments", href: "/dashboard/payments", icon: CreditCard, requires: "payment:view" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, requires: "user:view" },
];

// Dedicated, curated nav for Examiners — their workspace, not "admin minus items".
const examinerNav: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Exams", href: "/dashboard/exams", icon: FileText },
  { name: "Clients", href: "/dashboard/clients", icon: Users },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "My Availability", href: "/dashboard/profile/availability", icon: CalendarClock },
  { name: "My Profile", href: "/dashboard/profile", icon: UserCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarCollapsed, toggleSidebar } = useUIStore();
  const { user, loading, can } = useCurrentUser();

  const isExaminer = user?.role?.name === "Examiner";

  // Examiners get their own curated nav. Everyone else gets the ops nav, with
  // permission-gated items filtered out (and hidden while permissions load).
  const filteredNavigation = isExaminer
    ? examinerNav
    : staffNav.filter((item) => {
        if (!item.requires) return true;
        if (loading) return false;
        return can(item.requires);
      });

  const handleSignOut = async () => {
    clearCurrentUserCache();
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <motion.div 
      initial={false}
      animate={{ width: isSidebarCollapsed ? 80 : 256 }}
      className="flex h-full flex-col bg-card border-r border-border transition-all duration-300 ease-in-out relative"
    >
      {/* Logo Area */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3 font-bold text-xl tracking-tight overflow-hidden">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-sm">
            P
          </div>
          <AnimatePresence mode="wait">
            {!isSidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="whitespace-nowrap"
              >
                Polygraph
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
        {/* While the role is still resolving, show placeholders instead of the wrong nav. */}
        {loading && !user ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="h-5 w-5 shrink-0 rounded bg-muted animate-pulse" />
              {!isSidebarCollapsed && <div className="h-3 flex-1 rounded bg-muted animate-pulse" />}
            </div>
          ))
        ) : filteredNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href as any}
              className={cn(
                "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isSidebarCollapsed ? "justify-center" : "gap-3"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden="true"
              />
              <AnimatePresence>
                {!isSidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="whitespace-nowrap overflow-hidden flex-1"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>

              {!isSidebarCollapsed && item.badge && (
                <motion.span 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    item.badge === "New" || item.badge === "!" 
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.badge}
                </motion.span>
              )}

              {isSidebarCollapsed && item.badge && (
                <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary border-2 border-card" />
              )}
              
              {/* Tooltip for collapsed state (native title for now) */}
              {isSidebarCollapsed && (
                <div className="sr-only">{item.name}</div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Toggle & Sign Out */}
      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isSidebarCollapsed ? "justify-center" : "gap-3"
          )}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>

        <button
          onClick={handleSignOut}
          className={cn(
            "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
            isSidebarCollapsed ? "justify-center" : "gap-3"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!isSidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </motion.div>
  );
}
