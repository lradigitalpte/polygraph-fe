"use client";

import { useParams, usePathname } from "next/navigation";
import { ClientDetailProvider } from "@/components/dashboard/client-detail-context";
import { ClientSidebar } from "@/components/dashboard/client-sidebar";
import { ExamineeSidebar } from "@/components/dashboard/examinee-sidebar";
import { SubjectDetailProvider } from "@/components/dashboard/subject-detail-context";
import { TopNav } from "@/components/dashboard/top-nav";

export default function ClientDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const clientId = Number(params.id);
  const subjectId = params.subjectId != null ? Number(params.subjectId) : NaN;
  const isExamineeRoute =
    Number.isFinite(clientId) &&
    pathname != null &&
    pathname.includes(`/dashboard/clients/${clientId}/examinees/`) &&
    Number.isFinite(subjectId) &&
    subjectId > 0;

  if (!Number.isFinite(clientId) || clientId <= 0) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Invalid client record.
      </div>
    );
  }

  const main = (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50">
        {isExamineeRoute ? <ExamineeSidebar /> : <ClientSidebar />}
      </div>

      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );

  return (
    <ClientDetailProvider clientId={clientId}>
      {isExamineeRoute ? (
        <SubjectDetailProvider clientId={clientId} subjectId={subjectId}>
          {main}
        </SubjectDetailProvider>
      ) : (
        main
      )}
    </ClientDetailProvider>
  );
}
