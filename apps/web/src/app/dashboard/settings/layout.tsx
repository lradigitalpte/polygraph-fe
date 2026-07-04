"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SettingsSidebar } from "@/components/dashboard/settings-sidebar";
import { TopNav } from "@/components/dashboard/top-nav";
import { IdleTimeout } from "@/components/dashboard/idle-timeout";
import { useCurrentUser } from "@/components/dashboard/use-current-user";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading, can } = useCurrentUser();

  React.useEffect(() => {
    if (!loading && !can("user:view")) {
      toast.error("You don't have access to the admin settings area.");
      router.replace("/dashboard");
    }
  }, [loading, can, router]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IdleTimeout />
      {/* Settings Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50">
        <SettingsSidebar />
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
