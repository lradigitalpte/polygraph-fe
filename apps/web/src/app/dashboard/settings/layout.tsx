"use client";

import { SettingsSidebar } from "@/components/dashboard/settings-sidebar";
import { TopNav } from "@/components/dashboard/top-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Settings Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50">
        <SettingsSidebar />
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
