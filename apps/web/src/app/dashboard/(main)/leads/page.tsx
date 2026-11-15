"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Flag,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  UserRoundPlus,
  Wallet,
  X,
} from "lucide-react";

import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { GHOST_FIELD, GlassStat, GlowPanel, Highlight, PropertyRow } from "@/components/dashboard/ui-kit";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { deleteLeadAPI, fetchLeads, updateLeadAPI, type LeadRecord, type LeadSource, type LeadStatus } from "@/lib/leads";
import { createClient, fetchClients, type ClientRecord } from "@/lib/clients";
import { fetchOrganizationSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/client-account";
import { clinicDateKey } from "@/lib/clinic-time";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const STAGES = ["New", "Contacted", "Qualified", "Converted", "Lost"] as const satisfies readonly LeadStatus[];
const OPEN_STAGES: LeadStatus[] = ["New", "Contacted", "Qualified"];
const SOURCES = ["Instagram", "Facebook", "LinkedIn", "Referral", "Website", "Phone", "Walk-in"] as const satisfies readonly LeadSource[];
const PRIORITIES = ["Low", "Standard", "Priority", "Urgent"] as const;
const SORTS = ["Newest", "Highest value", "Name A–Z"] as const;

type StageFilter = "All" | "Open" | LeadStatus;

const STAGE_STYLE: Record<LeadStatus, { dot: string; chip: string; bar: string; hint: string }> = {
  New: { dot: "bg-chart-2", chip: "bg-chart-2/15 text-[oklch(0.42_0.14_290)] dark:text-chart-2", bar: "bg-chart-2", hint: "Just came in" },
  Contacted: { dot: "bg-[#E2B35A]", chip: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300", bar: "bg-[#E2B35A]", hint: "Reached out" },
  Qualified: { dot: "bg-primary", chip: "bg-primary/12 text-[oklch(0.42_0.12_39)] dark:text-primary", bar: "bg-primary", hint: "Ready to book" },
  Converted: { dot: "bg-[#3F7A37] dark:bg-emerald-400", chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300", bar: "bg-[#3F7A37]", hint: "Became a client" },
  Lost: { dot: "bg-[#8E8B82]", chip: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground", bar: "bg-[#B5B2A8]", hint: "Didn't proceed" },
};

const SOURCE_ICON: Record<LeadSource, React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>> = {
  Instagram: MessageCircle,
  Facebook: Share2,
  LinkedIn: Globe,
  Referral: UserRoundPlus,
  Website: Globe,
  Phone: Phone,
  "Walk-in": UserRoundPlus,
};

const PRIORITY_LABEL: Record<LeadRecord["priority"], string> = { Low: "Low", Standard: "Standard", Priority: "High", Urgent: "Urgent" };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type DetailForm = { priority: LeadRecord["priority"]; estimatedValue: string; nextStep: string; notes: string };

function formFor(lead: LeadRecord): DetailForm {
  return {
    priority: lead.priority,
    estimatedValue: String(lead.estimatedValue ?? 0),
    nextStep: lead.nextStep ?? "",
    notes: lead.notes ?? "",
  };
}

function leadTime(lead: LeadRecord) {
  const t = Date.parse(lead.createdAt);
  return Number.isNaN(t) ? Date.parse(lead.date) || 0 : t;
}

function toNumber(input: string) {
  const value = Number(input.replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function digits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

/** Client id recorded on a converted lead ("Converted to client CL-043"). */
function linkedClientId(lead: LeadRecord): number | null {
  const match = /CL-(\d+)/.exec(lead.nextStep ?? "");
  return match ? Number(match[1]) : null;
}

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LeadsPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();

  React.useEffect(() => {
    if (!userLoading && !can("lead:view")) {
      toast.error("You don't have permission to access this page.");
      router.replace("/dashboard");
    }
  }, [userLoading, can, router]);

  const [leads, setLeads] = React.useState<LeadRecord[]>([]);
  const [currency, setCurrency] = React.useState("AED");
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreatedBanner, setShowCreatedBanner] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState<StageFilter>("All");
  const [sourceFilter, setSourceFilter] = React.useState<"All" | LeadSource>("All");
  const [sortBy, setSortBy] = React.useState<(typeof SORTS)[number]>("Newest");

  const [selected, setSelected] = React.useState<LeadRecord | null>(null);
  const [form, setForm] = React.useState<DetailForm | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "save" | "stage" | "convert" | "delete">(null);
  const [rowBusy, setRowBusy] = React.useState<number | null>(null);

  const loadLeads = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setLeads(await fetchLeads());
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setShowCreatedBanner(new URLSearchParams(window.location.search).get("created") === "1");
    void loadLeads();
    fetchOrganizationSettings()
      .then((org) => org?.currency && setCurrency(org.currency))
      .catch(() => undefined);
  }, [loadLeads]);

  const money = React.useCallback((value: number) => formatMoney(value, currency), [currency]);

  /* ---------------- analytics ---------------- */

  const stats = React.useMemo(() => {
    const byStage = Object.fromEntries(STAGES.map((s) => [s, leads.filter((l) => l.status === s)])) as Record<LeadStatus, LeadRecord[]>;
    const open = leads.filter((l) => OPEN_STAGES.includes(l.status));
    const openValue = open.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
    const wonValue = byStage.Converted.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
    const closed = byStage.Converted.length + byStage.Lost.length;
    const winRate = closed > 0 ? Math.round((byStage.Converted.length / closed) * 100) : null;

    const todayKey = clinicDateKey(new Date());
    const days = Array.from({ length: 7 }, (_, i) => shiftKey(todayKey, i - 6));
    const keyed = leads.map((l) => clinicDateKey(new Date(leadTime(l))));
    const perDay = days.map((day) => ({
      key: day,
      label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)),
      count: keyed.filter((k) => k === day).length,
    }));
    const thisWeek = perDay.reduce((sum, d) => sum + d.count, 0);
    const prevStart = shiftKey(todayKey, -13);
    const prevEnd = shiftKey(todayKey, -7);
    const lastWeek = keyed.filter((k) => k >= prevStart && k <= prevEnd).length;

    const sources = SOURCES.map((source) => {
      const items = leads.filter((l) => l.source === source);
      const won = items.filter((l) => l.status === "Converted").length;
      return { source, count: items.length, won };
    })
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);

    return { byStage, open, openValue, wonValue, winRate, closed, perDay, thisWeek, lastWeek, sources };
  }, [leads]);

  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = leads.filter((lead) => {
      if (stageFilter === "Open" && !OPEN_STAGES.includes(lead.status)) return false;
      if (stageFilter !== "All" && stageFilter !== "Open" && lead.status !== stageFilter) return false;
      if (sourceFilter !== "All" && lead.source !== sourceFilter) return false;
      if (!q) return true;
      return [lead.name, lead.id, lead.interest, lead.source, lead.email, lead.phone, lead.notes].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      );
    });
    return [...list].sort((a, b) => {
      if (sortBy === "Highest value") return (b.estimatedValue || 0) - (a.estimatedValue || 0);
      if (sortBy === "Name A–Z") return a.name.localeCompare(b.name);
      return leadTime(b) - leadTime(a);
    });
  }, [leads, searchQuery, stageFilter, sourceFilter, sortBy]);

  /* ---------------- mutations ---------------- */

  const replaceLead = React.useCallback((updated: LeadRecord) => {
    setLeads((current) => current.map((l) => (l.backendId === updated.backendId ? updated : l)));
    setSelected((current) => (current?.backendId === updated.backendId ? updated : current));
  }, []);

  /** Turn a lead into a client: reuse a matching client (same e-mail or phone), else create one. */
  const convertLead = React.useCallback(
    async (lead: LeadRecord) => {
      const email = lead.email.trim();
      const phone = digits(lead.phone);
      const candidates = await fetchClients(email || lead.phone || lead.name).catch(() => [] as ClientRecord[]);
      const existing = candidates.find(
        (c) => (email && c.email?.toLowerCase() === email.toLowerCase()) || (phone.length >= 7 && digits(c.phone) === phone),
      );
      const client =
        existing ??
        (await createClient({
          name: lead.name,
          email,
          phone: lead.phone || undefined,
          client_type: "Individual",
          notes: [lead.interest, lead.notes].filter(Boolean).join("\n\n") || undefined,
        }));
      const code = `CL-${String(client.id).padStart(3, "0")}`;
      const updated = await updateLeadAPI(lead.backendId, {
        status: "Converted",
        nextStep: `Converted to client ${code}`,
      });
      replaceLead(updated);
      if (selected?.backendId === updated.backendId) setForm(formFor(updated));
      toast.success(existing ? `${lead.name} linked to existing client ${code}.` : `${lead.name} converted. Client ${code} created.`, {
        action: { label: "Open client", onClick: () => router.push(`/dashboard/clients/${client.id}`) },
      });
    },
    [replaceLead, router, selected],
  );

  const changeStage = React.useCallback(
    async (lead: LeadRecord, stage: LeadStatus, from: "row" | "sheet") => {
      if (stage === lead.status) return;
      if (from === "row") setRowBusy(lead.backendId);
      else setBusy(stage === "Converted" ? "convert" : "stage");
      try {
        if (stage === "Converted") {
          await convertLead(lead);
        } else {
          const updated = await updateLeadAPI(lead.backendId, { status: stage });
          replaceLead(updated);
          toast.success(`${updated.name} moved to ${stage}.`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't update the lead.");
      } finally {
        setRowBusy(null);
        setBusy(null);
      }
    },
    [convertLead, replaceLead],
  );

  const openLead = (lead: LeadRecord) => {
    setSelected(lead);
    setForm(formFor(lead));
    setIsSheetOpen(true);
  };

  const original = selected ? formFor(selected) : null;
  const dirtyFields =
    form && original
      ? (Object.keys(form) as (keyof DetailForm)[]).filter((key) =>
          key === "estimatedValue" ? toNumber(form[key]) !== toNumber(original[key]) : form[key].trim() !== String(original[key]).trim(),
        )
      : [];

  const saveDetails = async () => {
    if (!selected || !form || dirtyFields.length === 0) return;
    setBusy("save");
    try {
      const updated = await updateLeadAPI(selected.backendId, {
        priority: form.priority,
        estimatedValue: toNumber(form.estimatedValue),
        nextStep: form.nextStep.trim(),
        notes: form.notes.trim(),
      });
      replaceLead(updated);
      setForm(formFor(updated));
      toast.success("Lead updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the lead.");
    } finally {
      setBusy(null);
    }
  };

  const deleteLead = async () => {
    if (!selected) return;
    setBusy("delete");
    try {
      await deleteLeadAPI(selected.backendId);
      setLeads((current) => current.filter((l) => l.backendId !== selected.backendId));
      setIsSheetOpen(false);
      toast.success("Lead deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the lead.");
    } finally {
      setBusy(null);
    }
  };

  const hasFilters = Boolean(searchQuery.trim()) || stageFilter !== "All" || sourceFilter !== "All";
  const clearFilters = () => {
    setSearchQuery("");
    setStageFilter("All");
    setSourceFilter("All");
  };
  const weekDelta = stats.thisWeek - stats.lastWeek;
  const maxDay = Math.max(1, ...stats.perDay.map((d) => d.count));

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-10">
      {/* Hero */}
      <GlowPanel tone="amber" orb="66%" lineTop={40} className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 pt-6 sm:gap-8 sm:pt-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
                <Target aria-hidden="true" className="size-4" />
                Leads
              </span>
              <h1 className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] sm:text-[44px]">
                Lead <span className="font-semibold">pipeline</span>
              </h1>
              <p className="max-w-xl text-[15px] text-[#C9C6BC]">Every enquiry from first contact to booked client.</p>
            </div>
            <div className="flex w-full items-center gap-2.5 sm:w-auto">
              <button
                type="button"
                onClick={() => void loadLeads()}
                disabled={isLoading}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.07] px-5 text-sm font-medium text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:opacity-50 sm:flex-initial"
              >
                <RefreshCw aria-hidden="true" className={cn("size-4", isLoading && "animate-spin")} />
                Refresh
              </button>
              <Link
                href="/dashboard/leads/new"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#FAF9F5] pr-5 pl-2.5 text-sm font-semibold text-[#1A1915] transition-colors hover:bg-white sm:flex-initial"
              >
                <span className="bg-primary flex size-6 items-center justify-center rounded-full">
                  <Plus aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </span>
                New lead
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GlassStat label="Open leads" value={stats.open.length} hint={`${money(stats.openValue)} potential`} icon={CircleDot} accent="lavender" loading={isLoading} />
            <GlassStat
              label="New this week"
              value={stats.thisWeek}
              hint={weekDelta === 0 ? "Same as last week" : `${weekDelta > 0 ? "+" : ""}${weekDelta} vs last week`}
              icon={TrendingUp}
              accent="amber"
              loading={isLoading}
            />
            <GlassStat
              label="Win rate"
              value={stats.winRate === null ? "–" : `${stats.winRate}%`}
              hint={stats.closed ? `${stats.byStage.Converted.length} won · ${stats.byStage.Lost.length} lost` : "No closed leads yet"}
              icon={Target}
              accent="sage"
              loading={isLoading}
            />
            <GlassStat
              label="Won value"
              value={money(stats.wonValue)}
              hint={`From ${stats.byStage.Converted.length} converted lead${stats.byStage.Converted.length === 1 ? "" : "s"}`}
              icon={Trophy}
              accent="terracotta"
              loading={isLoading}
            />
          </div>
        </div>
      </GlowPanel>

      {showCreatedBanner ? (
        <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[#E7F1E4] px-4 py-3 text-sm text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            New lead added to the pipeline.
          </span>
          <button type="button" aria-label="Dismiss" onClick={() => setShowCreatedBanner(false)} className="flex size-7 items-center justify-center rounded-full hover:bg-white/60">
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* Pipeline strip — doubles as the stage filter */}
      <section aria-label="Pipeline stages" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const items = stats.byStage[stage];
          const value = items.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
          const active = stageFilter === stage;
          const share = leads.length ? (items.length / leads.length) * 100 : 0;
          return (
            <button
              key={stage}
              type="button"
              aria-pressed={active}
              onClick={() => setStageFilter(active ? "All" : stage)}
              className={cn(
                "flex flex-col gap-3 rounded-[22px] bg-white p-4 text-left ring-1 transition-all dark:bg-card",
                active ? "ring-2 ring-foreground/80" : "ring-border/50 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-18px_rgba(40,36,20,0.4)]",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden="true" className={cn("size-2 rounded-full", STAGE_STYLE[stage].dot)} />
                  {stage}
                </span>
                <span className="text-xs text-muted-foreground">{STAGE_STYLE[stage].hint}</span>
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[28px] leading-none font-medium tracking-[-0.02em] tabular-nums">{isLoading ? "–" : items.length}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">{value > 0 ? money(value) : ""}</span>
              </span>
              <span aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-[#F0EDE4] dark:bg-muted">
                <span className={cn("block h-full rounded-full", STAGE_STYLE[stage].bar)} style={{ width: `${share}%` }} />
              </span>
            </button>
          );
        })}
      </section>

      {/* Insights */}
      <section className="flex flex-wrap gap-4">
        <div className="flex min-w-0 flex-[3_1_420px] flex-col gap-4 rounded-[28px] bg-white p-6 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">New enquiries</h2>
              <span className="text-[13px] text-muted-foreground">Last 7 days</span>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                weekDelta > 0
                  ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300"
                  : weekDelta < 0
                    ? "bg-[#F6E3E1] text-[#8A2C22] dark:bg-red-950 dark:text-red-300"
                    : "bg-[#F3F1EA] text-[#55534C] dark:bg-muted dark:text-muted-foreground",
              )}
            >
              {stats.thisWeek} this week · {stats.lastWeek} last week
            </span>
          </div>
          <div
            role="img"
            aria-label={`New enquiries per day: ${stats.perDay.map((d) => `${d.label} ${d.count}`).join(", ")}`}
            className="flex h-40 items-end gap-2"
          >
            {stats.perDay.map((day, index) => (
              <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className={cn("font-mono text-xs tabular-nums", day.count ? "text-foreground" : "text-muted-foreground/60")}>{day.count}</span>
                <span
                  className={cn("w-full max-w-12 rounded-lg", index === 6 ? "bg-primary" : day.count ? "bg-[#ECE9E0] dark:bg-muted" : "bg-[#F3F1EA] dark:bg-muted/50")}
                  style={{ height: `${Math.max(day.count ? 10 : 4, (day.count / maxDay) * 110)}px` }}
                />
                <span className={cn("text-xs", index === 6 ? "font-semibold text-foreground" : "text-muted-foreground")}>{index === 6 ? "Today" : day.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-[2_1_300px] flex-col gap-4 rounded-[28px] bg-white p-6 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Where leads come from</h2>
            <span className="text-[13px] text-muted-foreground">All time · and how many became clients</span>
          </div>
          {stats.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {stats.sources.map((s, index) => {
                const Icon = SOURCE_ICON[s.source];
                return (
                  <li key={s.source}>
                    <button
                      type="button"
                      onClick={() => setSourceFilter(sourceFilter === s.source ? "All" : s.source)}
                      aria-pressed={sourceFilter === s.source}
                      className={cn("flex w-full flex-col gap-1.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/50", sourceFilter === s.source && "bg-[#F7F6F1] dark:bg-muted/50")}
                    >
                      <span className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2.5">
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground">
                            <Icon aria-hidden="true" className="size-3.5" />
                          </span>
                          {s.source}
                          {index === 0 && stats.sources.length > 1 ? (
                            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-[oklch(0.42_0.12_39)] dark:text-primary">Top</span>
                          ) : null}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          <span className="font-mono text-foreground tabular-nums">{s.count}</span> · {s.won} won
                        </span>
                      </span>
                      <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-[#F0EDE4] dark:bg-muted">
                        <span className="flex h-full" style={{ width: `${(s.count / leads.length) * 100}%` }}>
                          <span className="h-full bg-[#3F7A37]" style={{ flexGrow: s.won }} />
                          <span className="h-full bg-[#ECE9E0] dark:bg-foreground/30" style={{ flexGrow: s.count - s.won }} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-3 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-4 lg:flex-row lg:items-center lg:justify-between dark:bg-card">
        <div className="relative w-full lg:max-w-md">
          <label htmlFor="lead-search" className="sr-only">
            Search leads
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="lead-search"
            placeholder="Search name, interest, email, phone or notes…"
            className="h-11 rounded-full border-0 bg-[#F3F1EA] pr-10 pl-11 text-sm shadow-none dark:bg-muted"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")} className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card">
              <X aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as StageFilter)}>
            <SelectTrigger aria-label="Stage" className="h-10 w-auto min-w-36 rounded-full border-0 bg-[#F3F1EA] px-4 text-sm shadow-none dark:bg-muted">
              <SelectValue>{stageFilter === "All" ? "All stages" : stageFilter === "Open" ? "Open leads" : stageFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All stages</SelectItem>
              <SelectItem value="Open">Open leads</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as "All" | LeadSource)}>
            <SelectTrigger aria-label="Source" className="h-10 w-auto min-w-36 rounded-full border-0 bg-[#F3F1EA] px-4 text-sm shadow-none dark:bg-muted">
              <SelectValue>{sourceFilter === "All" ? "All sources" : sourceFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as (typeof SORTS)[number])}>
            <SelectTrigger aria-label="Sort" className="h-10 w-auto min-w-36 rounded-full border-0 bg-[#F3F1EA] px-4 text-sm shadow-none dark:bg-muted">
              <SelectValue>{sortBy}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters ? (
            <button type="button" onClick={clearFilters} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[oklch(0.45_0.12_39)] transition-colors hover:bg-primary/10 dark:text-primary">
              <X aria-hidden="true" className="size-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/50 text-[13px] text-muted-foreground">
                <th className="px-6 pt-5 pb-3 font-medium">Lead</th>
                <th className="px-6 pt-5 pb-3 font-medium">Interest</th>
                <th className="px-6 pt-5 pb-3 font-medium">Stage</th>
                <th className="px-6 pt-5 pb-3 font-medium">Next step</th>
                <th className="px-6 pt-5 pb-3 text-right font-medium">Value</th>
                <th className="relative px-6 pt-5 pb-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                [0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-10 animate-pulse rounded-xl bg-muted" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-[15px] font-medium">{hasFilters ? "No leads match these filters" : "No leads yet"}</p>
                    {hasFilters ? (
                      <button type="button" onClick={clearFilters} className="mt-1 text-sm text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary">
                        Clear filters
                      </button>
                    ) : (
                      <Link href="/dashboard/leads/new" className="mt-1 inline-block text-sm text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary">
                        Record the first enquiry
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const Icon = SOURCE_ICON[lead.source];
                  const clientId = linkedClientId(lead);
                  const isOpen = OPEN_STAGES.includes(lead.status);
                  return (
                    <tr key={lead.backendId} className="group cursor-pointer transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40" onClick={() => openLead(lead)}>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-3">
                          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ECE9E0] text-xs font-semibold text-[#3D3929] dark:bg-muted dark:text-foreground">
                            {initialsOf(lead.name)}
                          </span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[15px] font-medium">
                                <Highlight text={lead.name} query={searchQuery} />
                              </span>
                              {lead.priority === "Urgent" || lead.priority === "Priority" ? (
                                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", lead.priority === "Urgent" ? "bg-[#F6E3E1] text-[#8A2C22] dark:bg-red-950 dark:text-red-300" : "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300")}>
                                  <Flag aria-hidden="true" className="size-3" />
                                  {PRIORITY_LABEL[lead.priority]}
                                </span>
                              ) : null}
                            </span>
                            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                              <Icon aria-hidden="true" className="size-3.5" />
                              {lead.source} · {lead.date}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="max-w-sm px-6 py-4">
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm">
                            <Highlight text={lead.interest || "—"} query={searchQuery} />
                          </span>
                          {lead.notes ? <span className="line-clamp-1 text-[13px] text-muted-foreground">{lead.notes}</span> : null}
                        </span>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <Select value={lead.status} onValueChange={(v) => void changeStage(lead, v as LeadStatus, "row")} disabled={rowBusy === lead.backendId}>
                          <SelectTrigger aria-label={`Stage for ${lead.name}`} className={cn("h-8 w-auto gap-1.5 rounded-full border-0 px-3 text-[13px] font-medium shadow-none", STAGE_STYLE[lead.status].chip)}>
                            {rowBusy === lead.backendId ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <span aria-hidden="true" className={cn("size-1.5 rounded-full", STAGE_STYLE[lead.status].dot)} />}
                            <SelectValue>{lead.status}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STAGES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s === "Converted" && lead.status !== "Converted" ? "Converted (creates client)" : s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="max-w-[240px] px-6 py-4 text-[13px]">
                        {lead.status === "Converted" ? (
                          clientId ? (
                            <Link href={`/dashboard/clients/${clientId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-medium text-[#2D5A27] hover:underline dark:text-emerald-300">
                              Client CL-{String(clientId).padStart(3, "0")}
                              <ArrowUpRight aria-hidden="true" className="size-3.5" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Converted</span>
                          )
                        ) : lead.status === "Lost" ? (
                          <span className="text-muted-foreground">Closed</span>
                        ) : (
                          <span className={cn("line-clamp-2", isOpen && !lead.nextStep && "text-muted-foreground")}>{lead.nextStep || "No next step set"}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono tabular-nums">{lead.estimatedValue ? money(lead.estimatedValue) : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-[#30302E] group-hover:text-[#FAF9F5] dark:group-hover:bg-foreground dark:group-hover:text-background">
                          <ChevronRight aria-hidden="true" className="size-4" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && leads.length > 0 ? (
          <div className="border-t border-border/50 px-6 py-4 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{filtered.length}</span> of <span className="tabular-nums">{leads.length}</span> leads
          </div>
        ) : null}
      </div>

      {/* Detail sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full gap-0 overflow-hidden border-l border-border/50 bg-white p-0 shadow-2xl sm:max-w-[640px] dark:bg-card [&_[data-slot=sheet-close]]:top-5 [&_[data-slot=sheet-close]]:right-5 [&_[data-slot=sheet-close]]:z-30 [&_[data-slot=sheet-close]]:flex [&_[data-slot=sheet-close]]:size-9 [&_[data-slot=sheet-close]]:items-center [&_[data-slot=sheet-close]]:justify-center [&_[data-slot=sheet-close]]:rounded-full [&_[data-slot=sheet-close]]:bg-white/10! [&_[data-slot=sheet-close]]:text-[#FAF9F5] [&_[data-slot=sheet-close]]:opacity-100 [&_[data-slot=sheet-close]]:ring-1 [&_[data-slot=sheet-close]]:ring-white/15">
          {selected && form ? (
            <div className="relative flex h-full flex-col">
              <GlowPanel tone={selected.status === "Converted" ? "sage" : selected.status === "Lost" ? "ink" : "amber"} orb="60%" lineTop={0} className="shrink-0 rounded-none px-6 pt-6 pb-5 shadow-none ring-0 sm:px-7">
                <div key={`head-${selected.backendId}`} className="flex flex-col gap-3 pr-12 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 motion-safe:duration-500 motion-safe:fill-mode-both">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[13px] font-medium text-[#FAF9F5] ring-1 ring-white/15">
                      <span aria-hidden="true" className={cn("size-1.5 rounded-full", STAGE_STYLE[selected.status].dot)} />
                      {selected.status}
                    </span>
                    <span className="font-mono text-xs text-[#B5B2A8]">{selected.id}</span>
                  </div>
                  <SheetTitle className="text-2xl leading-tight font-medium tracking-[-0.02em] text-[#FAF9F5]">{selected.name}</SheetTitle>
                  <SheetDescription className="text-sm text-[#C9C6BC]">{selected.interest || "No interest recorded"}</SheetDescription>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#C9C6BC]">
                    {selected.phone ? (
                      <a href={`tel:${selected.phone}`} className="flex items-center gap-1.5 text-[#C9C6BC] hover:text-[#FAF9F5]">
                        <Phone aria-hidden="true" className="size-3.5" />
                        <span className="font-mono">{selected.phone}</span>
                      </a>
                    ) : null}
                    {selected.email ? (
                      <a href={`mailto:${selected.email}`} className="flex items-center gap-1.5 text-[#C9C6BC] hover:text-[#FAF9F5]">
                        <Mail aria-hidden="true" className="size-3.5" />
                        {selected.email}
                      </a>
                    ) : null}
                    <span className="flex items-center gap-1.5">
                      <MessageCircle aria-hidden="true" className="size-3.5" />
                      Prefers {selected.preferredContact.toLowerCase()}
                    </span>
                  </div>
                </div>
              </GlowPanel>

              <div className={cn("min-h-0 flex-1 overflow-y-auto", dirtyFields.length > 0 && "pb-24")}>
                <div key={`body-${selected.backendId}`} className="flex flex-col gap-7 px-4 py-5 sm:px-6">
                  {/* Stage */}
                  <section className="flex flex-col gap-2.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:delay-100">
                    <h3 className="px-1 text-[13px] font-medium">Stage</h3>
                    <div role="radiogroup" aria-label="Lead stage" className="flex flex-wrap gap-1.5">
                      {STAGES.map((stage) => {
                        const active = selected.status === stage;
                        return (
                          <button
                            key={stage}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={busy !== null}
                            onClick={() => void changeStage(selected, stage, "sheet")}
                            className={cn(
                              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-all disabled:opacity-50",
                              active ? cn(STAGE_STYLE[stage].chip, "font-medium") : "text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
                            )}
                          >
                            <span aria-hidden="true" className={cn("size-1.5 rounded-full", STAGE_STYLE[stage].dot, !active && "opacity-60")} />
                            {stage}
                          </button>
                        );
                      })}
                    </div>
                    {selected.status !== "Converted" ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void changeStage(selected, "Converted", "sheet")}
                        className="mt-1 flex items-center justify-between gap-3 rounded-2xl bg-[#E7F1E4] px-4 py-3 text-left transition-colors hover:bg-[#DCEBD8] disabled:opacity-60 dark:bg-emerald-950/60 dark:hover:bg-emerald-950"
                      >
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-[#2D5A27] dark:text-emerald-300">Convert to client</span>
                          <span className="text-[13px] text-[#3F6B39] dark:text-emerald-400/80">Links an existing client with the same email or phone, or creates one.</span>
                        </span>
                        {busy === "convert" ? <Loader2 aria-hidden="true" className="size-4 animate-spin text-[#2D5A27]" /> : <ArrowUpRight aria-hidden="true" className="size-4 text-[#2D5A27] dark:text-emerald-300" />}
                      </button>
                    ) : linkedClientId(selected) ? (
                      <Link href={`/dashboard/clients/${linkedClientId(selected)}`} className="mt-1 flex items-center justify-between gap-3 rounded-2xl bg-[#E7F1E4] px-4 py-3 text-sm font-medium text-[#2D5A27] transition-colors hover:bg-[#DCEBD8] dark:bg-emerald-950/60 dark:text-emerald-300">
                        Open client CL-{String(linkedClientId(selected)).padStart(3, "0")}
                        <ArrowUpRight aria-hidden="true" className="size-4" />
                      </Link>
                    ) : null}
                  </section>

                  {/* Properties */}
                  <section className="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:delay-150">
                    <h3 className="mb-1 px-1 text-[13px] font-medium">Details</h3>
                    <PropertyRow icon={Flag} label="Priority">
                      <div role="radiogroup" aria-label="Priority" className="flex flex-wrap gap-1.5 px-1.5 py-1">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p}
                            type="button"
                            role="radio"
                            aria-checked={form.priority === p}
                            onClick={() => setForm({ ...form, priority: p })}
                            className={cn(
                              "h-8 rounded-full px-3 text-[13px] transition-colors",
                              form.priority === p
                                ? p === "Urgent"
                                  ? "bg-[#F6E3E1] font-medium text-[#8A2C22] dark:bg-red-950 dark:text-red-300"
                                  : p === "Priority"
                                    ? "bg-[#F8EEDB] font-medium text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300"
                                    : "bg-[#ECE9E0] font-medium text-foreground dark:bg-muted"
                                : "text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted",
                            )}
                          >
                            {PRIORITY_LABEL[p]}
                          </button>
                        ))}
                      </div>
                    </PropertyRow>
                    <PropertyRow icon={Wallet} label={`Est. value (${currency})`} htmlFor="lead-value">
                      <Input id="lead-value" inputMode="decimal" className={cn(GHOST_FIELD, "font-mono")} value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} />
                    </PropertyRow>
                    {OPEN_STAGES.includes(selected.status) ? (
                      <PropertyRow icon={CircleDot} label="Next step" htmlFor="lead-next">
                        <Input id="lead-next" placeholder="e.g. Call back Thursday with pricing" className={GHOST_FIELD} value={form.nextStep} onChange={(e) => setForm({ ...form, nextStep: e.target.value })} />
                      </PropertyRow>
                    ) : null}
                    <PropertyRow icon={Clock} label="Received">
                      <div className="flex h-10 items-center px-3 text-sm">
                        {selected.date} · via {selected.source}
                      </div>
                    </PropertyRow>
                  </section>

                  {/* Notes */}
                  <section className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:delay-200">
                    <label htmlFor="lead-notes" className="px-1 text-[13px] font-medium">
                      Notes
                    </label>
                    <Textarea
                      id="lead-notes"
                      className="min-h-28 resize-y rounded-xl border border-transparent bg-[#F7F6F1] px-3.5 py-3 text-sm leading-relaxed shadow-none transition-colors hover:bg-[#F3F1EA] focus-visible:border-border focus-visible:bg-white focus-visible:ring-0 dark:bg-muted/50 dark:focus-visible:bg-card"
                      placeholder="What they need, context from the call, objections…"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </section>

                  <div className="flex items-center justify-between gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:delay-[250ms]">
                    <span className="text-xs text-muted-foreground">Updated {new Date(selected.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                    <DeleteConfirmDialog
                      title={`Delete ${selected.name}`}
                      description="This removes the lead from the pipeline. Any client already created from it is kept. This can't be undone."
                      confirmLabel="Confirmation"
                      triggerLabel="Delete lead"
                      onConfirm={deleteLead}
                      trigger={
                        <button type="button" className="flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-[#8A2C22] transition-colors hover:bg-[#F6E3E1] dark:text-red-300 dark:hover:bg-red-950">
                          <Trash2 aria-hidden="true" className="size-3.5" />
                          {busy === "delete" ? "Deleting…" : "Delete lead"}
                        </button>
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Floating save bar */}
              <div
                aria-hidden={dirtyFields.length === 0}
                className={cn(
                  "pointer-events-none absolute inset-x-4 bottom-4 z-20 origin-bottom transition-[transform,opacity] sm:inset-x-6 motion-reduce:transition-none",
                  dirtyFields.length > 0 ? "translate-y-0 scale-100 opacity-100 duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]" : "translate-y-6 scale-[0.96] opacity-0 duration-200 ease-in",
                )}
              >
                <div className={cn("flex items-center justify-between gap-3 rounded-full bg-[#1E1D1B] py-2 pr-2 pl-5 text-[#FAF9F5] shadow-[0_16px_40px_-12px_rgba(20,20,19,0.55)] ring-1 ring-white/10", dirtyFields.length > 0 && "pointer-events-auto")}>
                  <span aria-live="polite" className="flex items-center gap-2 text-[13px]">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                    {dirtyFields.length} unsaved change{dirtyFields.length === 1 ? "" : "s"}
                  </span>
                  <div className="flex gap-1.5">
                    <button type="button" tabIndex={dirtyFields.length ? 0 : -1} onClick={() => setForm(formFor(selected))} className="h-9 rounded-full px-4 text-sm text-[#C9C6BC] transition-colors hover:bg-white/10 hover:text-[#FAF9F5]">
                      Discard
                    </button>
                    <button type="button" tabIndex={dirtyFields.length ? 0 : -1} disabled={busy === "save"} onClick={() => void saveDetails()} className="h-9 rounded-full bg-[#FAF9F5] px-5 text-sm font-semibold text-[#1A1915] transition-colors hover:bg-white disabled:opacity-50">
                      {busy === "save" ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
