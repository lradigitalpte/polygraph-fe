"use client";

import { Sidebar } from "@/components/dashboard/sidebar";
import { TopNav } from "@/components/dashboard/top-nav";
import { IdleTimeout } from "@/components/dashboard/idle-timeout";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export default function MainDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSidebarCollapsed } = useUIStore();
  // Apply the saved sidebar state only after hydration (store uses skipHydration).
  useEffect(() => {
    void useUIStore.persist.rehydrate();
  }, []);
  const pathname = usePathname();
  const isWorkspace = /^\/dashboard\/reports\/[^/]+\/?$/.test(pathname ?? "");

  return (
    <div className="flex h-screen overflow-hidden bg-[#F3F1EA] dark:bg-background">
      <IdleTimeout />
      {/* Sidebar for desktop */}
      <div className="hidden lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col w-full transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "lg:pl-24" : "lg:pl-64"
        )}
      >
        <TopNav />
        {/* `relative` makes this scroll area the containing block for absolutely
            positioned descendants (e.g. sr-only labels), so they can't stretch
            the document and create a second page scrollbar. */}
        <main
          className={cn(
            "relative min-h-0 flex-1",
            // Full-height workspaces (report builder) manage their own scroll areas.
            isWorkspace ? "overflow-hidden p-2 sm:p-3 lg:pt-1" : "overflow-y-auto p-4 sm:p-6 lg:px-8 lg:pt-2 lg:pb-8",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
