"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  User,
  FileText,
  FolderLock,
  Wallet,
  ArrowLeft,
  LayoutDashboard,
  PlayCircle,
  Users,
  Building2,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { formatClientCode, getClientInitials } from "@/lib/clients";
import { isOrganizationClient } from "@/lib/client-types";

export function ClientSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const id = params.id;
  const { client, loading } = useClientDetail();
  const { user, can } = useCurrentUser();
  const isExaminer = user?.role?.name === "Examiner";
  const canViewBilling = can("client:manage") && !isExaminer;
  const displayName = client?.name ?? (loading ? "Loading..." : `Client ${id}`);
  const initials = client ? getClientInitials(client.name) : "--";
  const isOrg = isOrganizationClient(client);

  const individualNav = [
    { name: "Client Overview", href: `/dashboard/clients/${id}`, icon: LayoutDashboard },
    { name: "Personal Details", href: `/dashboard/clients/${id}/details`, icon: User },
    { name: "Exam History", href: `/dashboard/clients/${id}/exams`, icon: FileText },
    { name: "Document Vault", href: `/dashboard/clients/${id}/documents`, icon: FolderLock },
    { name: "Account & Billing", href: `/dashboard/clients/${id}/account`, icon: Wallet },
  ];

  const organizationNav = [
    { name: "Account Overview", href: `/dashboard/clients/${id}`, icon: LayoutDashboard },
    { name: "Account Details", href: `/dashboard/clients/${id}/details`, icon: Building2 },
    { name: "Examinee Roster", href: `/dashboard/clients/${id}/roster`, icon: Users },
    { name: "Request Examinee Roster", href: `/dashboard/clients/${id}/intake`, icon: Mail },
    { name: "All Sessions", href: `/dashboard/clients/${id}/exams`, icon: FileText },
    { name: "Document Vault", href: `/dashboard/clients/${id}/documents`, icon: FolderLock },
    { name: "Account & Billing", href: `/dashboard/clients/${id}/account`, icon: Wallet },
  ];

  const fullNav = isOrg ? organizationNav : individualNav;
  // Hide the billing tab from users who can't access billing (e.g. examiners).
  const navigation = canViewBilling
    ? fullNav
    : fullNav.filter((item) => item.href !== `/dashboard/clients/${id}/account`);
  const bookHref = isOrg
    ? `/dashboard/calendar/book?clientId=${id}`
    : `/dashboard/calendar/book?clientId=${id}`;

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-border">
        <Link
          href="/dashboard/clients"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Link>
      </div>

      <div className="px-6 py-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-12 w-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-lg shadow-primary/20">
            {initials}
          </div>
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold tracking-tight text-foreground truncate">
              {displayName}
            </h2>
            <p className="text-[10px] text-primary uppercase font-bold tracking-widest">
              {client ? formatClientCode(client.id) : "Active Record"}
            </p>
            {isOrg && (
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                Organization account
              </p>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 pb-6">
        {navigation.map((item) => {
          const isOverview = item.href === `/dashboard/clients/${id}`;
          const isActive = isOverview
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href as `/dashboard/clients/${string}`}
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

      <div className="p-4 border-t border-border">
        <Link
          href={bookHref as `/dashboard/calendar/book`}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-md shadow-primary/20 active:scale-[0.98]"
        >
          <PlayCircle className="h-4 w-4" />
          {isOrg ? "Book session" : "Start New Test"}
        </Link>
      </div>
    </div>
  );
}
