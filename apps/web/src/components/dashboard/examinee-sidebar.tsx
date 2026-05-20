"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  FileText,
  FolderLock,
  LayoutDashboard,
  PlayCircle,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { formatSubjectCode, formatSubjectName } from "@/lib/subjects";

export function ExamineeSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const clientId = params.id;
  const subjectId = params.subjectId;
  const base = `/dashboard/clients/${clientId}/examinees/${subjectId}`;
  const { client } = useClientDetail();
  const { subject, loading } = useSubjectDetail();

  const displayName = subject ? formatSubjectName(subject) : loading ? "Loading..." : "Examinee";
  const initials = subject
    ? `${subject.first_name?.[0] ?? ""}${subject.last_name?.[0] ?? ""}`.toUpperCase() || "EX"
    : "--";

  const navigation = [
    { name: "Overview", href: base, icon: LayoutDashboard },
    { name: "Personal Details", href: `${base}/details`, icon: User },
    { name: "Exam History", href: `${base}/exams`, icon: FileText },
    { name: "Biometric Data", href: `${base}/biometrics`, icon: Activity },
    { name: "Documents", href: `${base}/documents`, icon: FolderLock },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-border">
        <Link
          href={`/dashboard/clients/${clientId}/roster`}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to roster
        </Link>
      </div>

      <div className="px-6 py-6 border-b border-border/50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 truncate">
          {client?.name ?? "Account"}
        </p>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
            {initials}
          </div>
          <div className="overflow-hidden min-w-0">
            <h2 className="text-sm font-bold truncate">{displayName}</h2>
            <p className="text-[10px] text-primary uppercase font-bold tracking-widest">
              {subject ? formatSubjectCode(subject.id) : "Examinee"}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isOverview = item.href === base;
          const isActive = isOverview
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href as `/dashboard/clients/${string}/examinees/${string}`}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <ButtonLink
          href={`/dashboard/calendar/book?clientId=${clientId}&subjectId=${subjectId}`}
        />
      </div>
    </div>
  );
}

function ButtonLink({ href }: { href: string }) {
  return (
    <Link
      href={href as `/dashboard/calendar/book`}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
    >
      <PlayCircle className="h-4 w-4" />
      Book session
    </Link>
  );
}
