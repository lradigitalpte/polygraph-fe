"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useParams } from "next/navigation";
import {
  User,
  FileText,
  FolderLock,
  Wallet,
  ArrowLeft,
  LayoutDashboard,
  CalendarPlus,
  Users,
  Building2,
  Mail,
  FileSignature,
  ListChecks,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { formatClientCode, getClientInitials } from "@/lib/clients";
import { getOrganizationAccountSubtitle, isOrganizationClient } from "@/lib/client-types";

type NavItem = { name: string; href: string; icon: typeof User };
type NavGroup = { label: string; items: NavItem[] };

export function ClientSidebar() {
  const pathname = usePathname() ?? "";
  const params = useParams();
  const id = params.id;
  const { client, loading } = useClientDetail();
  const { can, showExaminerWorkspace } = useCurrentUser();
  // Pure examiners never see billing. Examiners granted elevated/override access
  // (showExaminerWorkspace === false) are treated like ops staff and keep it.
  const canViewBilling = can("client:manage") && !showExaminerWorkspace;
  const isOrg = isOrganizationClient(client);
  const orgSubtitle = client && isOrg ? getOrganizationAccountSubtitle(client) : undefined;
  const base = `/dashboard/clients/${id}`;

  const individualGroups: NavGroup[] = [
    {
      label: "Client",
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
        { name: "Secure reports", href: `${base}/reports`, icon: FileSignature },
      ],
    },
    {
      label: "Records",
      items: [
        { name: "Document vault", href: `${base}/documents`, icon: FolderLock },
        ...(can("agreement:view") ? [{ name: "Approvals", href: `${base}/approvals`, icon: ClipboardCheck }] : []),
        ...(canViewBilling ? [{ name: "Account & billing", href: `${base}/account`, icon: Wallet }] : []),
      ],
    },
  ];

  const organizationGroups: NavGroup[] = [
    {
      label: "Account",
      items: [
        { name: "Overview", href: base, icon: LayoutDashboard },
        { name: "Account details", href: `${base}/details`, icon: Building2 },
      ],
    },
    {
      label: "Examinees",
      items: [
        { name: "Examinee roster", href: `${base}/roster`, icon: Users },
        { name: "Request roster", href: `${base}/intake`, icon: Mail },
      ],
    },
    {
      label: "Examinations",
      items: [
        { name: "All sessions", href: `${base}/exams`, icon: FileText },
        { name: "Session questions", href: `${base}/questions`, icon: ListChecks },
        { name: "Secure reports", href: `${base}/reports`, icon: FileSignature },
      ],
    },
    {
      label: "Records",
      items: [
        { name: "Document vault", href: `${base}/documents`, icon: FolderLock },
        ...(canViewBilling ? [{ name: "Account & billing", href: `${base}/account`, icon: Wallet }] : []),
      ],
    },
  ];

  const groups = (isOrg ? organizationGroups : individualGroups).filter((g) => g.items.length > 0);

  // Only the most specific match lights up (Overview is exact; others include sub-pages).
  const activeHref = groups
    .flatMap((g) => g.items)
    .filter((item) => (item.href === base ? pathname === base || pathname === `${base}/` : pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="flex h-full min-h-0 w-64 flex-col p-3 pr-0">
      <div className="flex min-h-0 flex-1 flex-col rounded-[26px] bg-[#2B2A27] text-[#FAF9F5] shadow-[0_8px_24px_rgba(20,20,19,0.18)] ring-1 ring-white/[0.06] dark:bg-[#1B1B19]">
        {/* Header */}
        <div className="flex shrink-0 flex-col gap-4 p-4 pb-3">
          <Link
            href="/dashboard/clients"
            className="flex h-9 w-fit items-center gap-2 rounded-full pr-3.5 pl-2.5 text-[13px] font-medium text-[#C9C6BC] ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-[#FAF9F5]"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to clients
          </Link>

          <div className="flex items-center gap-3 rounded-[18px] bg-white/[0.06] p-2.5">
            {client ? (
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-[14px] text-sm font-semibold",
                  isOrg ? "bg-[#E8E4F7] text-[#4A3F8C]" : "bg-primary text-white",
                )}
              >
                {getClientInitials(client.name)}
              </span>
            ) : (
              <span className="size-11 shrink-0 animate-pulse rounded-[14px] bg-white/10" />
            )}
            <div className="min-w-0">
              {client ? (
                <p className="truncate text-[15px] leading-tight font-medium" title={client.name}>
                  {client.name}
                </p>
              ) : (
                <p className="text-[15px] text-[#9C998F]">{loading ? "Loading…" : `Client ${id}`}</p>
              )}
              <p className="mt-0.5 truncate text-xs text-[#9C998F]">
                {client ? formatClientCode(client.id) : "—"}
                {isOrg ? ` · ${orgSubtitle || "Organization"}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Client" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-3 no-scrollbar">
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
              href={`/dashboard/calendar/book?clientId=${id}` as Route}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#FAF9F5] px-4 text-sm font-medium text-[#2B2A27] transition-colors hover:bg-white"
            >
              <CalendarPlus aria-hidden="true" className="size-4" />
              {isOrg ? "Book session" : "Book exam"}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
