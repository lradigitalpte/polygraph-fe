"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fetchClients, type ClientRecord } from "@/lib/clients";
import { isOrganizationClient } from "@/lib/client-types";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import { fetchOrganizationSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/client-account";
import { formatClinicDateLabel } from "@/lib/clinic-time";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { GlassStat, GlowPanel, Highlight, Segmented } from "@/components/dashboard/ui-kit";

/* ------------------------------------------------------------------ */
/* View model                                                          */
/* ------------------------------------------------------------------ */

type ClientRow = {
  id: number;
  code: string;
  name: string;
  isOrg: boolean;
  typeLabel: string;
  contactPerson?: string;
  /** Real e-mail, or undefined when missing / an import placeholder. */
  email?: string;
  phone?: string;
  missingContact: boolean;
  exams: number;
  completed: number;
  lastExam?: Date;
  nextExam?: Date;
  outstanding: number;
  lastActivity: number;
};

type ViewMode = "list" | "grid";
type TypeFilter = "all" | "org" | "individual" | "missing";
type SortField = "name" | "exams" | "recent" | "owed";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const ACTIVE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function realEmail(email?: string | null) {
  const value = email?.trim();
  if (!value || /@import\.local$/i.test(value)) return undefined;
  return value;
}

function realPhone(phone?: string | null) {
  const value = phone?.trim();
  if (!value || value.toUpperCase() === "N/A") return undefined;
  return value;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function relativeDay(date: Date, now: number) {
  const days = Math.round((date.getTime() - now) / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days < 14) return `in ${days} days`;
  if (days < -1 && days > -14) return `${-days} days ago`;
  return formatClinicDateLabel(date);
}

function buildRows(clients: ClientRecord[], appointments: AppointmentRecord[], now: number): ClientRow[] {
  const byClient = new Map<number, AppointmentRecord[]>();
  for (const appointment of appointments) {
    const list = byClient.get(appointment.client_id) ?? [];
    list.push(appointment);
    byClient.set(appointment.client_id, list);
  }

  return clients.map((client) => {
    const live = (byClient.get(client.id) ?? []).filter((a) => (a.status || "").toLowerCase() !== "cancelled");
    let lastExam: Date | undefined;
    let nextExam: Date | undefined;
    let outstanding = 0;
    let completed = 0;
    for (const appointment of live) {
      const when = new Date(appointment.scheduled_at);
      if (Number.isNaN(when.getTime())) continue;
      if (when.getTime() <= now) {
        if (!lastExam || when > lastExam) lastExam = when;
      } else if (!nextExam || when < nextExam) {
        nextExam = when;
      }
      if ((appointment.status || "").toLowerCase() === "completed") completed += 1;
      const paid = (appointment.payment_status || "").toLowerCase() === "paid";
      if (!paid && !appointment.prepaid_slot_id) {
        outstanding += Math.max(0, Number(appointment.exam_fee || 0) - Number(appointment.collected_amount || 0));
      }
    }
    const email = realEmail(client.email);
    const phone = realPhone(client.phone);
    const isOrg = isOrganizationClient(client);
    const updated = new Date(client.updated_at).getTime() || 0;
    return {
      id: client.id,
      code: `CL-${String(client.id).padStart(3, "0")}`,
      name: client.name,
      isOrg,
      typeLabel: isOrg ? (client.client_type.toLowerCase().includes("law") ? "Law firm" : "Organisation") : "Individual",
      contactPerson: client.contact_person?.trim() || undefined,
      email,
      phone,
      missingContact: !email && !phone,
      exams: live.length,
      completed,
      lastExam,
      nextExam,
      outstanding,
      lastActivity: Math.max(lastExam?.getTime() ?? 0, nextExam?.getTime() ?? 0, updated),
    };
  });
}

function buildPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ClientsPage() {
  const { can } = useCurrentUser();
  const canViewPayments = can("payment:view");

  const [rows, setRows] = React.useState<ClientRow[]>([]);
  const [currency, setCurrency] = React.useState("AED");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [historyUnavailable, setHistoryUnavailable] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [sortField, setSortField] = React.useState<SortField>("name");
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState<number>(10);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      const [clientsResult, appointmentsResult, orgResult] = await Promise.allSettled([
        fetchClients(),
        fetchAppointments(),
        fetchOrganizationSettings(),
      ]);
      if (!mounted) return;
      if (clientsResult.status === "rejected") {
        setError(clientsResult.reason instanceof Error ? clientsResult.reason.message : "Failed to load clients");
        setLoading(false);
        return;
      }
      const appointments = appointmentsResult.status === "fulfilled" ? appointmentsResult.value : [];
      setHistoryUnavailable(appointmentsResult.status === "rejected");
      if (orgResult.status === "fulfilled" && orgResult.value?.currency) setCurrency(orgResult.value.currency);
      setRows(buildRows(clientsResult.value, appointments, Date.now()));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, sortField, itemsPerPage]);

  const now = Date.now();
  const stats = React.useMemo(() => {
    const orgs = rows.filter((r) => r.isOrg).length;
    const active = rows.filter((r) => r.lastActivity >= now - ACTIVE_WINDOW_MS && (r.lastExam || r.nextExam)).length;
    const upcoming = rows.filter((r) => r.nextExam).length;
    const owed = rows.reduce((sum, r) => sum + r.outstanding, 0);
    const owingClients = rows.filter((r) => r.outstanding > 0).length;
    const missing = rows.filter((r) => r.missingContact).length;
    return { total: rows.length, orgs, individuals: rows.length - orgs, active, upcoming, owed, owingClients, missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = rows.filter((row) => {
      if (typeFilter === "org" && !row.isOrg) return false;
      if (typeFilter === "individual" && row.isOrg) return false;
      if (typeFilter === "missing" && !row.missingContact) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        (row.email?.toLowerCase().includes(q) ?? false) ||
        (row.phone?.replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) ?? false) ||
        (row.contactPerson?.toLowerCase().includes(q) ?? false)
      );
    });
    return [...result].sort((a, b) => {
      if (sortField === "exams") return b.exams - a.exams || a.name.localeCompare(b.name);
      if (sortField === "recent") return b.lastActivity - a.lastActivity;
      if (sortField === "owed") return b.outstanding - a.outstanding || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [rows, searchQuery, typeFilter, sortField]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const pageRows = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageNumbers = buildPageNumbers(currentPage, totalPages);
  const hasFilters = Boolean(searchQuery.trim()) || typeFilter !== "all";

  const exportCsv = () => {
    const headers = ["Client ID", "Name", "Type", "Contact person", "Email", "Phone", "Exams", "Completed", "Last exam", "Next exam"];
    if (canViewPayments) headers.push(`Outstanding (${currency})`);
    const lines = filtered.map((row) => {
      const values: (string | number)[] = [
        row.code,
        row.name,
        row.typeLabel,
        row.contactPerson ?? "",
        row.email ?? "",
        row.phone ?? "",
        row.exams,
        row.completed,
        row.lastExam ? formatClinicDateLabel(row.lastExam) : "",
        row.nextExam ? formatClinicDateLabel(row.nextExam) : "",
      ];
      if (canViewPayments) values.push(row.outstanding.toFixed(2));
      return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Polygraph_Clients_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} client${filtered.length === 1 ? "" : "s"}`);
  };

  const typeOptions = [
    { value: "all" as const, label: "All", count: stats.total },
    { value: "org" as const, label: "Organisations", count: stats.orgs },
    { value: "individual" as const, label: "Individuals", count: stats.individuals },
    { value: "missing" as const, label: "Missing contact", count: stats.missing },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-10">
      {/* Hero */}
      <GlowPanel tone="lavender" orb="70%" lineTop={40} className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 pt-6 sm:gap-8 sm:pt-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
                <Users aria-hidden="true" className="size-4" />
                Clients
              </span>
              <h1 className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] sm:text-[44px]">
                Client <span className="font-semibold">directory</span>
              </h1>
              <p className="max-w-xl text-[15px] text-[#C9C6BC]">
                Organisations and individuals who book exams, with their history and balances.
              </p>
            </div>
            <div className="flex w-full items-center gap-2.5 sm:w-auto">
              <button
                type="button"
                onClick={exportCsv}
                disabled={loading || filtered.length === 0}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.07] px-5 text-sm font-medium text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:opacity-40 sm:flex-initial"
              >
                <Download aria-hidden="true" className="size-4" />
                Export CSV
              </button>
              <Link
                href="/dashboard/clients/new"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#FAF9F5] pr-5 pl-2.5 text-sm font-semibold text-[#1A1915] transition-colors hover:bg-white sm:flex-initial"
              >
                <span className="bg-primary flex size-6 items-center justify-center rounded-full">
                  <Plus aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </span>
                New client
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GlassStat
              label="Clients"
              value={stats.total}
              hint={`${stats.orgs} organisations · ${stats.individuals} individuals`}
              icon={Users}
              accent="lavender"
              loading={loading}
            />
            <GlassStat label="Active (90 days)" value={stats.active} hint="Had or have a session booked" icon={CalendarClock} accent="sage" loading={loading} />
            {canViewPayments ? (
              <GlassStat
                label="Outstanding"
                value={formatMoney(stats.owed, currency)}
                hint={stats.owingClients ? `Across ${stats.owingClients} client${stats.owingClients === 1 ? "" : "s"}` : "Nothing owed"}
                icon={CreditCard}
                accent="amber"
                loading={loading}
              />
            ) : (
              <GlassStat label="Upcoming bookings" value={stats.upcoming} hint="Clients with a future session" icon={CalendarClock} accent="amber" loading={loading} />
            )}
            <GlassStat
              label="Missing contact"
              value={stats.missing}
              hint={stats.missing ? "No email or phone on file" : "Every client is reachable"}
              icon={AlertCircle}
              accent="terracotta"
              loading={loading}
            />
          </div>
        </div>
      </GlowPanel>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-3 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-4 dark:bg-card">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <label htmlFor="client-search" className="sr-only">
              Search clients
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="client-search"
              placeholder="Search name, ID, email, phone or contact person…"
              className="h-11 rounded-full border-0 bg-[#F3F1EA] pr-10 pl-11 text-sm shadow-none dark:bg-muted"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Segmented label="Client type" value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Sort by</span>
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="h-9 w-[170px] rounded-full border-0 bg-[#F3F1EA] px-4 text-sm shadow-none dark:bg-muted" aria-label="Sort clients">
                <SelectValue>
                  {sortField === "name" ? "Name (A–Z)" : sortField === "exams" ? "Most exams" : sortField === "recent" ? "Recent activity" : "Balance owed"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="exams">Most exams</SelectItem>
                <SelectItem value="recent">Recent activity</SelectItem>
                {canViewPayments ? <SelectItem value="owed">Balance owed</SelectItem> : null}
              </SelectContent>
            </Select>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                }}
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[oklch(0.45_0.12_39)] transition-colors hover:bg-primary/10 dark:text-primary"
              >
                <X aria-hidden="true" className="size-3.5" />
                Clear
              </button>
            ) : null}
          </div>
          <div role="group" aria-label="View" className="flex gap-1 rounded-full bg-[#E9E6DD] p-1 dark:bg-muted">
            {(
              [
                { id: "list", icon: List, label: "List view" },
                { id: "grid", icon: LayoutGrid, label: "Card view" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                aria-label={option.label}
                aria-pressed={viewMode === option.id}
                onClick={() => setViewMode(option.id)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-colors",
                  viewMode === option.id
                    ? "bg-white text-foreground shadow-[0_1px_2px_rgba(40,36,20,0.08)] dark:bg-card"
                    : "text-[#55534C] hover:text-foreground dark:text-muted-foreground",
                )}
              >
                <option.icon aria-hidden="true" className="size-4" />
              </button>
            ))}
          </div>
        </div>
        {historyUnavailable ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <AlertCircle aria-hidden="true" className="size-3.5" />
            Exam history couldn&apos;t be loaded, so counts and balances are hidden.
          </p>
        ) : null}
      </div>

      {/* Results */}
      {error ? (
        <div className="rounded-[28px] bg-white p-10 text-center ring-1 ring-border/50 dark:bg-card">
          <p className="text-sm font-medium text-[#8A2C22] dark:text-red-300">{error}</p>
        </div>
      ) : loading ? (
        <div className="overflow-hidden rounded-[28px] bg-white ring-1 ring-border/50 dark:bg-card">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/40 px-6 py-4 last:border-0">
              <div className="size-10 animate-pulse rounded-xl bg-muted" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[28px] bg-white p-12 text-center ring-1 ring-border/50 dark:bg-card">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
            <Search aria-hidden="true" className="size-5 text-muted-foreground" />
          </span>
          <p className="text-[15px] font-medium">{hasFilters ? "No clients match these filters" : "No clients yet"}</p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("all");
              }}
              className="text-sm text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary"
            >
              Clear filters
            </button>
          ) : (
            <Link href="/dashboard/clients/new" className="text-sm text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary">
              Register the first client
            </Link>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/50 text-[13px] text-muted-foreground">
                  <th className="px-6 pt-5 pb-3 font-medium">Client</th>
                  <th className="px-6 pt-5 pb-3 font-medium">Contact</th>
                  <th className="px-6 pt-5 pb-3 font-medium">Exams</th>
                  <th className="px-6 pt-5 pb-3 font-medium">Activity</th>
                  {canViewPayments ? <th className="px-6 pt-5 pb-3 text-right font-medium">Outstanding</th> : null}
                  <th className="relative px-6 pt-5 pb-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pageRows.map((row) => (
                  <tr key={row.id} className="group transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40">
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/clients/${row.id}`} className="flex items-center gap-3.5">
                        <ClientAvatar row={row} />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-[15px] font-medium text-foreground">
                            <Highlight text={row.name} query={searchQuery} />
                          </span>
                          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                            <span className="font-mono text-xs">{row.code}</span>
                            <span aria-hidden="true">·</span>
                            {row.typeLabel}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <ContactLines row={row} query={searchQuery} />
                    </td>
                    <td className="px-6 py-4">
                      {historyUnavailable ? (
                        <span className="text-muted-foreground">–</span>
                      ) : (
                        <span className="flex flex-col gap-0.5">
                          <span className="font-mono tabular-nums">{row.exams}</span>
                          <span className="text-[13px] text-muted-foreground">
                            {row.exams === 0 ? "None yet" : `${row.completed} completed`}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <ActivityLines row={row} now={now} />
                    </td>
                    {canViewPayments ? (
                      <td className="px-6 py-4 text-right">
                        {row.outstanding > 0 ? (
                          <span className="font-mono text-[#8A2C22] tabular-nums dark:text-red-300">{formatMoney(row.outstanding, currency)}</span>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">Settled</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/clients/${row.id}`}
                        aria-label={`Open ${row.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-[#30302E] group-hover:text-[#FAF9F5] dark:group-hover:bg-foreground dark:group-hover:text-background"
                      >
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            total={filtered.length}
            all={rows.length}
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            pageNumbers={pageNumbers}
            onPage={setCurrentPage}
            onPageSize={setItemsPerPage}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((row) => (
              <Link
                key={row.id}
                href={`/dashboard/clients/${row.id}`}
                className="group flex flex-col gap-5 rounded-[26px] bg-white p-5 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-20px_rgba(40,36,20,0.35)] dark:bg-card"
              >
                <div className="flex items-start gap-3.5">
                  <ClientAvatar row={row} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-medium">
                      <Highlight text={row.name} query={searchQuery} />
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      <span className="font-mono text-xs">{row.code}</span> · {row.typeLabel}
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <ContactLines row={row} query={searchQuery} />
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F7F6F1] p-3 dark:bg-muted/50">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Exams</span>
                    <span className="font-mono text-base tabular-nums">{historyUnavailable ? "–" : row.exams}</span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">{row.nextExam ? "Next" : "Last"}</span>
                    <span className="truncate text-sm">
                      {row.nextExam ? relativeDay(row.nextExam, now) : row.lastExam ? relativeDay(row.lastExam, now) : "–"}
                    </span>
                  </span>
                  {canViewPayments ? (
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Owed</span>
                      <span className={cn("truncate font-mono text-sm tabular-nums", row.outstanding > 0 && "text-[#8A2C22] dark:text-red-300")}>
                        {row.outstanding > 0 ? formatMoney(row.outstanding, currency) : "—"}
                      </span>
                    </span>
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Completed</span>
                      <span className="font-mono text-base tabular-nums">{row.completed}</span>
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <div className="overflow-hidden rounded-[26px] bg-white ring-1 ring-border/50 dark:bg-card">
            <Pagination
              total={filtered.length}
              all={rows.length}
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              pageNumbers={pageNumbers}
              onPage={setCurrentPage}
              onPageSize={setItemsPerPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function ClientAvatar({ row }: { row: ClientRow }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center text-xs font-semibold",
        row.isOrg
          ? "rounded-xl bg-[#30302E] text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground"
          : "rounded-full bg-chart-2/20 text-[oklch(0.42_0.14_290)] dark:text-chart-2",
      )}
    >
      {row.isOrg ? <Building2 className="size-4" /> : initialsOf(row.name)}
    </span>
  );
}

function ContactLines({ row, query }: { row: ClientRow; query: string }) {
  if (row.missingContact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F8EEDB] px-2.5 py-1 text-[13px] font-medium text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300">
        <AlertCircle aria-hidden="true" className="size-3.5" />
        No contact details
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col gap-1 text-[13px]">
      {row.contactPerson ? (
        <span className="flex items-center gap-2 text-foreground">
          <UserRound aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            <Highlight text={row.contactPerson} query={query} />
          </span>
        </span>
      ) : null}
      {row.email ? (
        <span className="flex items-center gap-2 text-muted-foreground">
          <Mail aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">
            <Highlight text={row.email} query={query} />
          </span>
        </span>
      ) : null}
      {row.phone ? (
        <span className="flex items-center gap-2 text-muted-foreground">
          <Phone aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate font-mono text-xs">{row.phone}</span>
        </span>
      ) : null}
    </span>
  );
}

function ActivityLines({ row, now }: { row: ClientRow; now: number }) {
  if (!row.nextExam && !row.lastExam) {
    return <span className="text-[13px] text-muted-foreground">No sessions</span>;
  }
  return (
    <span className="flex flex-col gap-1 text-[13px]">
      {row.nextExam ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E7F1E4] px-2.5 py-0.5 font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[#3F7A37] dark:bg-emerald-400" />
          Next {relativeDay(row.nextExam, now)}
        </span>
      ) : null}
      {row.lastExam ? <span className="text-muted-foreground">Last {relativeDay(row.lastExam, now)}</span> : null}
    </span>
  );
}

function Pagination({
  total,
  all,
  currentPage,
  totalPages,
  itemsPerPage,
  pageNumbers,
  onPage,
  onPageSize,
}: {
  total: number;
  all: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  pageNumbers: number[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–{Math.min(currentPage * itemsPerPage, total)}
          </span>{" "}
          of <span className="tabular-nums">{total}</span>
          {total !== all ? ` (filtered from ${all})` : ""}
        </p>
        <Select value={String(itemsPerPage)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border-0 bg-[#F3F1EA] px-3 text-[13px] shadow-none dark:bg-muted" aria-label="Clients per page">
            <SelectValue>{itemsPerPage} per page</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => onPage(Math.max(1, currentPage - 1))}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[#F3F1EA] disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-muted"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          {pageNumbers.map((page, index) => {
            const prev = pageNumbers[index - 1];
            return (
              <React.Fragment key={page}>
                {prev !== undefined && page - prev > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
                <button
                  type="button"
                  aria-current={currentPage === page ? "page" : undefined}
                  onClick={() => onPage(page)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                    currentPage === page
                      ? "bg-[#30302E] font-semibold text-[#FAF9F5] dark:bg-foreground dark:text-background"
                      : "hover:bg-[#F3F1EA] dark:hover:bg-muted",
                  )}
                >
                  {page}
                </button>
              </React.Fragment>
            );
          })}
          <button
            type="button"
            aria-label="Next page"
            disabled={currentPage >= totalPages}
            onClick={() => onPage(Math.min(totalPages, currentPage + 1))}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[#F3F1EA] disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-muted"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
