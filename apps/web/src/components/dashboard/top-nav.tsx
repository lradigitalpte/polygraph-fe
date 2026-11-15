"use client";

import {
  Bell,
  Calendar,
  Moon,
  Sun,
  User,
  Settings,
  LogOut,
  Plus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { authClient } from "@/lib/auth-client";
import { usePathname, useRouter } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import { GlobalSearch } from "./global-search";
import { useCurrentUser, userInitials, clearCurrentUserCache } from "./use-current-user";
import { recordLogoutReason } from "@/lib/session-reliability";

const PAGE_TITLES: Record<string, string> = {
  exams: "Exams",
  clients: "Clients",
  intake: "Batch intake",
  leads: "Leads",
  calendar: "Calendar",
  reminders: "Reminders",
  payments: "Payments",
  inventory: "Inventory",
  reports: "Reports",
  analytics: "Analytics",
  settings: "Settings",
  profile: "My profile",
};

export function TopNav() {
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, can } = useCurrentUser();
  const canViewAdmin = can("user:view");
  const displayName = user?.name ?? "User";
  const displayEmail = user?.email ?? "";
  const initials = userInitials(displayName, displayEmail);

  const handleSignOut = async () => {
    recordLogoutReason("manual");
    clearCurrentUserCache();
    await authClient.signOut();
    router.push("/login");
  };

  const pageTitle = (() => {
    const segment = pathname.replace(/^\/dashboard\/?/, "").split("/")[0];
    if (!segment) return "Overview";
    return PAGE_TITLES[segment] ?? segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  })();
  const onDashboard = pathname === "/dashboard";

  const iconButton =
    "relative flex size-11 items-center justify-center rounded-full bg-[#2B2A27] dark:bg-[#1B1B19] text-[#FAF9F5] shadow-[0_1px_2px_rgba(20,20,19,0.2)] ring-1 ring-white/[0.06] transition-colors hover:bg-[#3A3935]";

  return (
    <header className="sticky top-0 z-40 flex h-[76px] shrink-0 items-center gap-x-3 bg-[#F3F1EA]/85 px-4 backdrop-blur-md sm:gap-x-4 sm:px-6 lg:px-8 dark:bg-background/85">
      <MobileNav />
      <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-sm text-[#55534C] lg:flex dark:text-muted-foreground">
        <span className="font-semibold text-foreground">Polygraph</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{pageTitle}</span>
      </nav>
      <div className="flex flex-1 items-center justify-end gap-x-2 sm:gap-x-3">
        <div className="flex flex-1 justify-center lg:max-w-md">
          <GlobalSearch />
        </div>

        {!onDashboard && (
          <button
            type="button"
            className="hidden h-11 items-center gap-2 rounded-full bg-[#30302E] pr-5 pl-2.5 text-sm font-semibold text-[#FAF9F5] shadow-[0_8px_20px_-10px_rgba(48,48,46,0.6)] transition-colors hover:bg-[#1F1F1D] sm:flex dark:bg-secondary dark:text-secondary-foreground"
            onClick={() => router.push("/dashboard/calendar/book")}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[#1A1915]">
              <Plus className="size-3.5" strokeWidth={3} aria-hidden="true" />
            </span>
            New exam
          </button>
        )}

        <button type="button" className={iconButton} onClick={() => router.push("/dashboard/calendar")} aria-label="Open calendar">
          <Calendar className="size-[18px]" aria-hidden="true" />
        </button>

        <button type="button" className={iconButton} aria-label="Notifications">
          <Bell className="size-[18px]" aria-hidden="true" />
          <span className="absolute top-2.5 right-3 size-2 rounded-full border-2 border-[#2B2A27] dark:border-[#1B1B19] bg-primary" />
        </button>

        <button
          type="button"
          className={iconButton}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="size-[18px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" aria-hidden="true" />
          <Moon className="absolute size-[18px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" aria-hidden="true" />
        </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Account menu for ${displayName}`}
              className="flex size-11 items-center justify-center rounded-full bg-[#30302E] text-sm font-semibold text-[#FAF9F5] shadow-sm transition-opacity hover:opacity-90 dark:bg-secondary dark:text-secondary-foreground"
            >
              {initials}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-2">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{displayEmail}</p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>My Profile</span>
                </DropdownMenuItem>
                {canViewAdmin && (
                  <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Admin Settings</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
