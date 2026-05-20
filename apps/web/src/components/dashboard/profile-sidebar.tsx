"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCurrentUser, userInitials } from "@/components/dashboard/use-current-user";
import { 
  User, 
  Shield, 
  Bell, 
  Clock,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

const profileNavigation = [
  { name: "My Profile", href: "/dashboard/profile", icon: User },
  { name: "Security", href: "/dashboard/profile/security", icon: Shield },
  { name: "Notifications", href: "/dashboard/profile/notifications", icon: Bell },
  { name: "Availability", href: "/dashboard/profile/availability", icon: Clock },
];

export function ProfileSidebar() {
  const pathname = usePathname();
  const { user, loading } = useCurrentUser();
  const displayName = user?.name ?? "User";
  const displayEmail = user?.email ?? "";
  const initials = userInitials(displayName, displayEmail);

  return (
    <div className="flex h-full w-64 flex-col bg-background border-r border-border">
      {/* Profile Header */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="px-6 py-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            {initials}
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground">{loading ? "…" : displayName}</h2>
            <p className="text-[10px] text-muted-foreground truncate max-w-[9rem]">{displayEmail}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 pb-6">
        {profileNavigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard/profile" && pathname.startsWith(item.href + "/"));
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
    </div>
  );
}
