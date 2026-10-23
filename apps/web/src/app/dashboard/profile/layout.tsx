"use client";

import { ProfileSidebar } from "@/components/dashboard/profile-sidebar";
import { TopNav } from "@/components/dashboard/top-nav";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Profile Sidebar */}
      <div className="hidden lg:flex lg:h-full lg:min-h-0 lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50">
        <ProfileSidebar />
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 flex-col lg:pl-64">
        <TopNav />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
