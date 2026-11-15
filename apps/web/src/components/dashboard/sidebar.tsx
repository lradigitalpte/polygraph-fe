"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Settings,
  LogOut,
  CalendarDays,
  CalendarClock,
  Target,
  Wallet,
  BellRing,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Package,
  FileSignature,
  ChartNoAxesCombined,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useUIStore } from "@/lib/store";
import { useCurrentUser, clearCurrentUserCache, userInitials } from "@/components/dashboard/use-current-user";
import { recordLogoutReason } from "@/lib/session-reliability";

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  requires?: string;
  /** Shorter label shown under the icon when the sidebar is collapsed. */
  short?: string;
};

type NavGroup = { label?: string; items: NavItem[] };

// Ops nav for Admin / ops users, grouped by what the work is. Items with
// `requires` are permission-filtered, and empty groups are dropped.
const staffNav: NavGroup[] = [
  { items: [{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Examinations",
    items: [
      { name: "Exams", href: "/dashboard/exams", icon: ClipboardCheck },
      { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
      { name: "Reports", href: "/dashboard/reports", icon: FileSignature, requires: "exam:view" },
      { name: "Reminders", href: "/dashboard/reminders", icon: BellRing, requires: "reminder:view" },
    ],
  },
  {
    label: "Clients",
    items: [
      { name: "Clients", href: "/dashboard/clients", icon: Users },
      { name: "Leads", href: "/dashboard/leads", icon: Target, requires: "lead:view" },
    ],
  },
  {
    label: "Business",
    items: [
      { name: "Payments", href: "/dashboard/payments", icon: Wallet, requires: "payment:view" },
      { name: "Analytics", href: "/dashboard/analytics", icon: ChartNoAxesCombined, requires: "exam:view" },
      { name: "Inventory", href: "/dashboard/inventory", icon: Package, requires: "user:view" },
    ],
  },
];

// Pinned above the account card at the bottom.
const staffFooterNav: NavItem[] = [{ name: "Settings", href: "/dashboard/settings", icon: Settings, requires: "user:view" }];

// Dedicated, curated nav for Examiners — their workspace, not "admin minus items".
const examinerNav: NavGroup[] = [
  { items: [{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "My work",
    items: [
      { name: "My Exams", short: "Exams", href: "/dashboard/exams", icon: ClipboardCheck },
      { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
      { name: "Reports", href: "/dashboard/reports", icon: FileSignature },
      { name: "Clients", href: "/dashboard/clients", icon: Users },
      { name: "My Analytics", short: "Analytics", href: "/dashboard/analytics", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Me",
    items: [
      { name: "My Availability", short: "Availability", href: "/dashboard/profile/availability", icon: CalendarClock },
      { name: "My Profile", short: "Profile", href: "/dashboard/profile", icon: UserCircle },
    ],
  },
];

// Personal shortcuts kept for examiners who are escalated into the ops nav, so
// a privileged examiner still reaches their own availability/profile tools.
const examinerPersonalNav: NavGroup = {
  label: "Me",
  items: [
    { name: "My Availability", short: "Availability", href: "/dashboard/profile/availability", icon: CalendarClock },
    { name: "My Profile", short: "Profile", href: "/dashboard/profile", icon: UserCircle },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarCollapsed: collapsed, toggleSidebar } = useUIStore();
  const { user, loading, can, isExaminer, showExaminerWorkspace } = useCurrentUser();

  const allowed = (item: NavItem) => !item.requires || (!loading && can(item.requires));

  // Pure examiners get their own curated nav. Everyone else — including
  // examiners granted elevated/override permissions — gets the ops nav, with
  // permission-gated items hidden (also while permissions load).
  const groups: NavGroup[] = showExaminerWorkspace
    ? examinerNav
    : [...staffNav, ...(isExaminer ? [examinerPersonalNav] : [])]
        .map((group) => ({ ...group, items: group.items.filter(allowed) }))
        .filter((group) => group.items.length > 0);
  const footerNav = showExaminerWorkspace ? [] : staffFooterNav.filter(allowed);

  const handleSignOut = async () => {
    recordLogoutReason("manual");
    clearCurrentUserCache();
    await authClient.signOut();
    router.push("/login");
  };

  const isActivePath = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  // Highlight only the most specific matching item (e.g. "My Availability" over "My Profile").
  const activeHref = [...groups.flatMap((g) => g.items), ...footerNav]
    .filter((item) => isActivePath(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const initials = userInitials(user?.name ?? "User", user?.email ?? "");

  const renderItem = (item: NavItem) => {
    const isActive = item.href === activeHref;
    return (
      <Link
        key={item.href}
        href={item.href as any}
        aria-current={isActive ? "page" : undefined}
        title={collapsed && item.short ? item.name : undefined}
        className={cn(
          "group relative flex shrink-0 items-center rounded-[13px] transition-colors",
          collapsed ? "w-[68px] flex-col justify-center gap-1 px-1 py-2" : "h-10 gap-3 px-3 text-[14px]",
          isActive
            ? collapsed
              ? "bg-white/[0.12] text-[#FAF9F5]"
              : "bg-white/[0.09] font-medium text-[#FAF9F5]"
            : "text-[#C9C6BC] hover:bg-white/[0.06] hover:text-[#FAF9F5]",
        )}
      >
        {/* Active marker on the left edge when expanded */}
        {isActive && !collapsed ? (
          <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 -left-3 w-[3px] rounded-r-full bg-primary" />
        ) : null}
        <item.icon className="size-[18px] shrink-0" strokeWidth={isActive ? 2.1 : 1.8} aria-hidden="true" />
        {collapsed ? (
          <span className="w-full truncate text-center text-[10.5px] leading-tight font-medium">{item.short ?? item.name}</span>
        ) : (
          <span className="flex-1 truncate whitespace-nowrap">{item.name}</span>
        )}
        {item.badge ? (
          collapsed ? (
            <span className="absolute top-1.5 right-3 size-2 rounded-full border-2 border-[#2B2A27] dark:border-[#1B1B19] bg-primary" />
          ) : (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-[#1A1915]">
              {item.badge}
            </span>
          )
        ) : null}
      </Link>
    );
  };

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? 96 : 256 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="relative flex h-full min-h-0 flex-col p-3 pr-0"
    >
      <div className="relative flex min-h-0 flex-1 flex-col rounded-[26px] bg-[#2B2A27] dark:bg-[#1B1B19] text-[#FAF9F5] shadow-[0_8px_24px_rgba(20,20,19,0.18)] ring-1 ring-white/[0.06]">
        {/* Logo */}
        <div className={cn("flex h-[72px] shrink-0 items-center", collapsed ? "justify-center px-2" : "px-4")}>
          <Link
            href="/dashboard"
            aria-label="Polygraph dashboard"
            className={cn(
              "flex items-center overflow-hidden rounded-[15px] bg-white/[0.06] ring-1 ring-white/[0.08]",
              collapsed ? "size-11 justify-center" : "h-11 px-3",
            )}
          >
            <Image
              src="/logo.png"
              alt="Polygraph"
              width={2048}
              height={674}
              priority
              className={cn("w-auto object-contain", collapsed ? "h-4 max-w-8" : "h-7")}
            />
          </Link>
        </div>

        {/* Collapse toggle, sitting on the sidebar's edge */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-[22px] -right-3.5 z-10 flex size-7 items-center justify-center rounded-full bg-[#2B2A27] dark:bg-[#1B1B19] text-[#C9C6BC] shadow-[0_1px_3px_rgba(0,0,0,0.3)] ring-1 ring-white/20 transition-colors hover:bg-[#3A3935] hover:text-[#FAF9F5]"
        >
          {collapsed ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronLeft className="size-4" aria-hidden="true" />}
        </button>

        {/* Navigation */}
        <nav
          aria-label="Main"
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-2 no-scrollbar",
            collapsed ? "items-center px-2" : "px-3",
          )}
        >
          {/* While the role is still resolving, show placeholders instead of the wrong nav. */}
          {loading && !user ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={cn("flex h-10 items-center gap-3", collapsed ? "w-11 justify-center" : "px-3")}>
                  <div className="size-[18px] shrink-0 animate-pulse rounded bg-white/10" />
                  {!collapsed && <div className="h-3 flex-1 animate-pulse rounded bg-white/10" />}
                </div>
              ))}
            </div>
          ) : (
            groups.map((group, index) => (
              <div
                key={group.label ?? `group-${index}`}
                role="group"
                aria-label={group.label}
                className={cn("flex flex-col gap-0.5", collapsed && "items-center", index > 0 && "mt-4")}
              >
                {group.label ? (
                  collapsed ? (
                    <span aria-hidden="true" className="mb-2 h-px w-6 bg-white/15" />
                  ) : (
                    <span className="mb-1 px-3 text-[11px] font-medium tracking-[0.08em] text-[#8A877E] uppercase">{group.label}</span>
                  )
                ) : null}
                {group.items.map(renderItem)}
              </div>
            ))
          )}
        </nav>

        {/* Footer: settings, account, sign out */}
        <div className={cn("flex shrink-0 flex-col gap-1 border-t border-white/[0.08] p-3", collapsed && "items-center px-2")}>
          {footerNav.map(renderItem)}
          {user ? (
            <div className={cn("mt-1 flex items-center gap-1", collapsed ? "flex-col" : "rounded-[18px] bg-white/[0.06] p-1.5")}>
              <Link
                href="/dashboard/profile"
                title={collapsed ? user.name : undefined}
                aria-label={collapsed ? `My profile (${user.name})` : undefined}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2.5 rounded-[14px] transition-colors hover:bg-white/[0.08]",
                  collapsed ? "justify-center p-0.5" : "p-1",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FAF9F5] text-[13px] font-semibold text-[#2B2A27]">
                  {initials}
                </span>
                {!collapsed && (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm leading-tight font-medium">{user.name}</span>
                    <span className="truncate text-xs text-[#9C998F]">{user.email}</span>
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#F2766B] transition-colors hover:bg-[#F2766B]/15"
              >
                <LogOut className="size-[18px]" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
