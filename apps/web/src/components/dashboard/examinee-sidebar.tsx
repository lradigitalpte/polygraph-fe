"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useParams } from "next/navigation";
import { ArrowLeft, CalendarPlus, FileText, FolderLock, Languages, LayoutDashboard, ListChecks, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { formatClientCode } from "@/lib/clients";
import { formatSubjectCode, formatSubjectName } from "@/lib/subjects";

type NavItem = { name: string; href: string; icon: typeof User };
type NavGroup = { label: string; items: NavItem[] };

/** Dark floating sidebar for one examinee — same look as the client sidebar it sits under. */
export function ExamineeSidebar() {
  const pathname = usePathname() ?? "";
  const params = useParams();
  const clientId = params.id;
  const subjectId = params.subjectId;
  const base = `/dashboard/clients/${clientId}/examinees/${subjectId}`;
  const { client } = useClientDetail();
  const { subject, loading } = useSubjectDetail();
  const { can } = useCurrentUser();

  const name = subject ? formatSubjectName(subject).trim() : "";
  const initials = subject ? `${subject.first_name?.[0] ?? ""}${subject.last_name?.[0] ?? ""}`.toUpperCase() || "?" : "";

  const groups: NavGroup[] = [
    {
      label: "Examinee",
      items: [
        { name: "Overview", href: base, icon: LayoutDashboard },
        { name: "Personal details", href: `${base}/details`, icon: User },
      ],
    },
    {
      label: "Examinations",
      items: [
        { name: "Exam history", href: `${base}/exams`, icon: FileText },
        { name: "Session questions", href: `${base}/questions`, icon: ListChecks },
      ],
    },
    {
      label: "Records",
      items: [{ name: "Documents", href: `${base}/documents`, icon: FolderLock }],
    },
  ];

  // Only the most specific match lights up (Overview is exact; others include sub-pages).
  const activeHref = groups
    .flatMap((g) => g.items)
    .filter((item) => (item.href === base ? pathname === base || pathname === `${base}/` : pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const english = subject?.english_proficiency?.trim();

  return (
    <div className="flex h-full min-h-0 w-64 flex-col p-3 pr-0">
      <div className="flex min-h-0 flex-1 flex-col rounded-[26px] bg-[#2B2A27] text-[#FAF9F5] shadow-[0_8px_24px_rgba(20,20,19,0.18)] ring-1 ring-white/[0.06] dark:bg-[#1B1B19]">
        {/* Header */}
        <div className="flex shrink-0 flex-col gap-4 p-4 pb-3">
          <Link
            href={`/dashboard/clients/${clientId}/roster` as Route}
            className="flex h-9 w-fit items-center gap-2 rounded-full pr-3.5 pl-2.5 text-[13px] font-medium text-[#C9C6BC] ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-[#FAF9F5]"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to roster
          </Link>

          <div className="rounded-[18px] bg-white/[0.06] p-2.5">
            {/* Account this person is tested under */}
            <Link
              href={`/dashboard/clients/${clientId}` as Route}
              title={client?.name}
              className="mb-2.5 flex items-center gap-1.5 truncate rounded-lg px-1 text-[11px] font-medium tracking-[0.06em] text-[#8A877E] uppercase transition-colors hover:text-[#C9C6BC]"
            >
              <span className="truncate">{client?.name ?? "Account"}</span>
              {client ? <span className="shrink-0 font-mono normal-case tracking-normal">· {formatClientCode(client.id)}</span> : null}
            </Link>
            <div className="flex items-center gap-3">
              {subject ? (
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-[14px] text-sm font-semibold",
                    name ? "bg-primary text-white" : "bg-[#F8EEDB] text-[#8A5A12]",
                  )}
                >
                  {initials}
                </span>
              ) : (
                <span className="size-11 shrink-0 animate-pulse rounded-[14px] bg-white/10" />
              )}
              <div className="min-w-0">
                {subject ? (
                  <p className={cn("truncate text-[15px] leading-tight font-medium", !name && "text-[#E2B35A] italic")} title={name || undefined}>
                    {name || "No name yet"}
                  </p>
                ) : (
                  <p className="text-[15px] text-[#9C998F]">{loading ? "Loading…" : "Examinee"}</p>
                )}
                <p className="mt-0.5 truncate font-mono text-xs text-[#9C998F]">{subject ? formatSubjectCode(subject.id) : "—"}</p>
              </div>
            </div>
            {english || subject?.interpreter_required ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {english ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] text-[#C9C6BC]">
                    <Languages aria-hidden="true" className="size-3" /> {english}
                  </span>
                ) : null}
                {subject?.interpreter_required ? (
                  <span className="rounded-full bg-[#E2B35A]/20 px-2 py-0.5 text-[11px] font-medium text-[#F0CD85]">Needs interpreter</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Examinee" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-3 no-scrollbar">
          {groups.map((group, index) => (
            <div key={group.label} role="group" aria-label={group.label} className={cn("flex flex-col gap-0.5", index > 0 && "mt-4")}>
              <span className="mb-1 px-3 text-[11px] font-medium tracking-[0.08em] text-[#8A877E] uppercase">{group.label}</span>
              {group.items.map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex h-10 shrink-0 items-center gap-3 rounded-[13px] px-3 text-[14px] transition-colors",
                      isActive ? "bg-white/[0.09] font-medium text-[#FAF9F5]" : "text-[#C9C6BC] hover:bg-white/[0.06] hover:text-[#FAF9F5]",
                    )}
                  >
                    {isActive ? <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 -left-3 w-[3px] rounded-r-full bg-primary" /> : null}
                    <item.icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={isActive ? 2.1 : 1.8} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Quick action */}
        {can("appointment:create") ? (
          <div className="shrink-0 border-t border-white/[0.08] p-3">
            <Link
              href={`/dashboard/calendar/book?clientId=${clientId}&subjectId=${subjectId}` as Route}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#FAF9F5] px-4 text-sm font-medium text-[#2B2A27] transition-colors hover:bg-white"
            >
              <CalendarPlus aria-hidden="true" className="size-4" />
              Book session
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
