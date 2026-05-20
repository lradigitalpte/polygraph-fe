"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Filter,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Search,
  Share2,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UserRoundPlus,
  Zap,
} from "lucide-react";
import {
  deleteLeadAPI,
  fetchLeads,
  updateLeadAPI,
  type LeadRecord,
  type LeadSource,
  type LeadStatus,
} from "@/lib/leads";
import { createClient } from "@/lib/clients";
import { cn } from "@/lib/utils";

const statusOptions = ["All", "New", "Contacted", "Qualified", "Converted", "Lost"] as const;
const sourceOptions = ["All", "Instagram", "Facebook", "LinkedIn", "Referral", "Website", "Phone", "Walk-in"] as const;
const sortOptions = ["Newest", "Highest value", "Name A-Z"] as const;
const pipelineStatuses = statusOptions.slice(1) as ReadonlyArray<LeadStatus>;
const priorityOptions = ["Low", "Standard", "Priority", "Urgent"] as const;

const sourceMeta: Record<LeadSource, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  Instagram: { icon: MessageCircle, color: "text-pink-500" },
  Facebook: { icon: Share2, color: "text-blue-600" },
  LinkedIn: { icon: Globe, color: "text-sky-600" },
  Referral: { icon: UserRoundPlus, color: "text-emerald-500" },
  Website: { icon: Globe, color: "text-violet-500" },
  Phone: { icon: Phone, color: "text-amber-500" },
  "Walk-in": { icon: UserRoundPlus, color: "text-orange-500" },
};

const statusTone: Record<LeadStatus, string> = {
  New: "bg-sky-500 text-white",
  Contacted: "bg-amber-500 text-white",
  Qualified: "bg-violet-500 text-white",
  Converted: "bg-emerald-500 text-white",
  Lost: "bg-rose-500 text-white",
};

type LeadDetailForm = {
  status: LeadStatus;
  priority: LeadRecord["priority"];
  estimatedValue: string;
  nextStep: string;
  notes: string;
};

const emptyLeadDetailForm: LeadDetailForm = {
  status: "New",
  priority: "Standard",
  estimatedValue: "0",
  nextStep: "",
  notes: "",
};

function buildSparkPath(values: number[]) {
  const width = 320;
  const height = 120;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 22) - 10;
    return `${x},${y}`;
  });

  return {
    line: points.join(" "),
    area: `M 0,${height} L ${points.join(" L ")} L ${width},${height} Z`,
  };
}

function toStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLeadTimestamp(lead: LeadRecord) {
  const timestamp = Date.parse(lead.createdAt);
  return Number.isNaN(timestamp) ? Date.parse(lead.date) || 0 : timestamp;
}

function formatTrend(value: number) {
  if (value > 0) {
    return `+${value.toFixed(0)}%`;
  }

  if (value < 0) {
    return `${value.toFixed(0)}%`;
  }

  return "0%";
}

function parseNumericInput(input: string) {
  const normalized = input.replace(/[^\d.\-]/g, "").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function buildLeadForm(lead: LeadRecord): LeadDetailForm {
  return {
    status: lead.status,
    priority: lead.priority,
    estimatedValue: String(lead.estimatedValue ?? 0),
    nextStep: lead.nextStep ?? "",
    notes: lead.notes ?? "",
  };
}

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<(typeof statusOptions)[number]>("All");
  const [sourceFilter, setSourceFilter] = React.useState<(typeof sourceOptions)[number]>("All");
  const [sortBy, setSortBy] = React.useState<(typeof sortOptions)[number]>("Newest");
  const [selectedLead, setSelectedLead] = React.useState<LeadRecord | null>(null);
  const [detailForm, setDetailForm] = React.useState<LeadDetailForm>(emptyLeadDetailForm);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [leads, setLeads] = React.useState<LeadRecord[]>([]);
  const [showCreatedBanner, setShowCreatedBanner] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isConverting, setIsConverting] = React.useState(false);
  const [savingRowId, setSavingRowId] = React.useState<number | null>(null);

  const loadLeads = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const records = await fetchLeads();
      setLeads(records);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setShowCreatedBanner(new URLSearchParams(window.location.search).get("created") === "1");
    void loadLeads();
  }, [loadLeads]);

  React.useEffect(() => {
    if (!selectedLead) {
      setDetailForm(emptyLeadDetailForm);
      return;
    }

    setDetailForm(buildLeadForm(selectedLead));
  }, [selectedLead]);

  const filteredLeads = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const result = leads.filter((lead) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        lead.name.toLowerCase().includes(normalizedQuery) ||
        lead.id.toLowerCase().includes(normalizedQuery) ||
        lead.interest.toLowerCase().includes(normalizedQuery) ||
        lead.source.toLowerCase().includes(normalizedQuery);

      const matchesStatus = statusFilter === "All" || lead.status === statusFilter;
      const matchesSource = sourceFilter === "All" || lead.source === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    });

    return result.sort((left, right) => {
      if (sortBy === "Highest value") {
        return right.estimatedValue - left.estimatedValue;
      }

      if (sortBy === "Name A-Z") {
        return left.name.localeCompare(right.name);
      }

      return parseLeadTimestamp(right) - parseLeadTimestamp(left);
    });
  }, [leads, searchQuery, sortBy, sourceFilter, statusFilter]);

  const analytics = React.useMemo(() => {
    const today = toStartOfDay(new Date());
    const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

    const weeklyLabels = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      return weekdayFormatter.format(day);
    });

    const weeklyIntake = weeklyLabels.map((_, index) => {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() - (6 - index));

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      return leads.filter((lead) => {
        const timestamp = parseLeadTimestamp(lead);
        return timestamp >= dayStart.getTime() && timestamp < dayEnd.getTime();
      }).length;
    });

    const currentWindowStart = new Date(today);
    currentWindowStart.setDate(today.getDate() - 6);

    const previousWindowStart = new Date(currentWindowStart);
    previousWindowStart.setDate(currentWindowStart.getDate() - 7);

    const intakeLast7Days = weeklyIntake.reduce((sum, count) => sum + count, 0);
    const previous7Days = leads.filter((lead) => {
      const timestamp = parseLeadTimestamp(lead);
      return timestamp >= previousWindowStart.getTime() && timestamp < currentWindowStart.getTime();
    }).length;

    return { weeklyIntake, weeklyLabels, intakeLast7Days, previous7Days };
  }, [leads]);

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((lead) => lead.status === "Converted").length;
  const activePipelineCount = leads.filter((lead) => lead.status !== "Converted" && lead.status !== "Lost").length;
  const totalPipelineValue = leads
    .filter((lead) => lead.status !== "Lost")
    .reduce((sum, lead) => sum + lead.estimatedValue, 0);

  const sourceCounts = React.useMemo(() => {
    return leads.reduce<Record<LeadSource, number>>((accumulator, lead) => {
      accumulator[lead.source] += 1;
      return accumulator;
    }, {
      Instagram: 0,
      Facebook: 0,
      LinkedIn: 0,
      Referral: 0,
      Website: 0,
      Phone: 0,
      "Walk-in": 0,
    });
  }, [leads]);

  const stageCounts = React.useMemo(() => {
    return pipelineStatuses.map((status) => ({
      status,
      count: leads.filter((lead) => lead.status === status).length,
    }));
  }, [leads]);

  const topSource = React.useMemo(() => {
    const [entry] = Object.entries(sourceCounts).sort((left, right) => right[1] - left[1]);

    if (!entry) {
      return { source: "Website" as LeadSource, count: 0 };
    }

    return { source: entry[0] as LeadSource, count: entry[1] };
  }, [sourceCounts]);

  const conversionRate = totalLeads === 0 ? 0 : (convertedLeads / totalLeads) * 100;
  const topSourceRate = totalLeads === 0 ? 0 : Math.round((topSource.count / totalLeads) * 100);
  const sourceMix = Object.entries(sourceCounts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);
  const chartPath = buildSparkPath(analytics.weeklyIntake);
  const intakeGrowth = analytics.previous7Days === 0
    ? (analytics.intakeLast7Days > 0 ? 100 : 0)
    : ((analytics.intakeLast7Days - analytics.previous7Days) / analytics.previous7Days) * 100;

  const upsertLead = React.useCallback((updatedLead: LeadRecord) => {
    setLeads((current) => current.map((lead) => (lead.backendId === updatedLead.backendId ? updatedLead : lead)));
    setSelectedLead(updatedLead);
  }, []);

  const updateLeadStatusInline = React.useCallback(async (lead: LeadRecord, status: LeadStatus) => {
    setSavingRowId(lead.backendId);
    try {
      const updatedLead = await updateLeadAPI(lead.backendId, { status });
      setLeads((current) => current.map((l) => (l.backendId === updatedLead.backendId ? updatedLead : l)));
      if (selectedLead?.backendId === updatedLead.backendId) {
        setSelectedLead(updatedLead);
        setDetailForm(buildLeadForm(updatedLead));
      }
      toast.success(`${updatedLead.name} moved to ${status}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update stage.");
    } finally {
      setSavingRowId(null);
    }
  }, [selectedLead]);

  const persistLeadChanges = React.useCallback(async (overrides?: Partial<LeadDetailForm>) => {
    if (!selectedLead) {
      return;
    }

    const nextForm = { ...detailForm, ...overrides };
    setIsSaving(true);

    try {
      const updatedLead = await updateLeadAPI(selectedLead.backendId, {
        status: nextForm.status,
        priority: nextForm.priority,
        notes: nextForm.notes.trim(),
        nextStep: nextForm.nextStep.trim(),
        estimatedValue: parseNumericInput(nextForm.estimatedValue),
      });

      upsertLead(updatedLead);
      setDetailForm(buildLeadForm(updatedLead));
      toast.success(`${updatedLead.name} updated.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update lead.");
    } finally {
      setIsSaving(false);
    }
  }, [detailForm, selectedLead, upsertLead]);

  const handleDeleteLead = React.useCallback(async () => {
    if (!selectedLead) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedLead.name} from the pipeline?`);

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteLeadAPI(selectedLead.backendId);
      setLeads((current) => current.filter((lead) => lead.backendId !== selectedLead.backendId));
      setSelectedLead(null);
      setIsSheetOpen(false);
      toast.success("Lead deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete lead.");
    } finally {
      setIsDeleting(false);
    }
  }, [selectedLead]);

  const handleConvertToCase = React.useCallback(async () => {
    if (!selectedLead) {
      return;
    }

    setIsConverting(true);
    try {
      const client = await createClient({
        name: selectedLead.name,
        email: selectedLead.email,
        phone: selectedLead.phone || undefined,
        client_type: "individual",
        notes: selectedLead.notes || undefined,
      });

      const updatedLead = await updateLeadAPI(selectedLead.backendId, { status: "Converted" });
      upsertLead(updatedLead);
      setDetailForm(buildLeadForm(updatedLead));

      toast.success(`${selectedLead.name} converted — client profile created.`, {
        action: {
          label: "Open Client",
          onClick: () => {
            window.location.href = `/dashboard/clients/${client.id}`;
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to convert lead to case.");
    } finally {
      setIsConverting(false);
    }
  }, [selectedLead, upsertLead]);

  return (
    <div className="mx-auto max-w-400 space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-4xl border border-border/60 bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,107,51,0.18),transparent_34%),radial-gradient(circle_at_right,rgba(19,145,214,0.12),transparent_30%)]" />
        <div className="relative grid gap-6 p-6 xl:grid-cols-[1.35fr_0.95fr] xl:p-8">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-none px-3 py-1 uppercase tracking-[0.24em]">
                Lead Command
              </Badge>
              <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Polygraph forensic intake desk
              </span>
            </div>

            <div className="max-w-3xl space-y-3">
              <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                <Target className="h-8 w-8 text-primary" />
                Lead Acquisition Pipeline
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Track manual intake, qualify case demand, and route high-value polygraph inquiries into the right conversion lane.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/leads/new"
                className={cn(buttonVariants({ className: "h-11 rounded-xl px-5 font-bold shadow-lg shadow-primary/15" }))}
              >
                <Plus className="mr-2 h-4 w-4" />
                Manual Entry
              </Link>
              <Button variant="outline" className="h-11 rounded-xl border-border/60 px-5 font-semibold" onClick={() => void loadLeads()}>
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                Refresh Intake
              </Button>
            </div>

            {showCreatedBanner ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                New lead added to the pipeline and pinned at the top of the board.
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Intake",
                  value: totalLeads.toString(),
                  sub: `${analytics.intakeLast7Days} in last 7 days`,
                  icon: TrendingUp,
                  accent: "from-sky-500/20 via-sky-500/5 to-transparent",
                },
                {
                  label: "Conversion Rate",
                  value: `${conversionRate.toFixed(1)}%`,
                  sub: `${convertedLeads} converted leads`,
                  icon: Target,
                  accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
                },
                {
                  label: "Active Pipeline",
                  value: `${activePipelineCount} Leads`,
                  sub: `Est. $${totalPipelineValue.toLocaleString()} value`,
                  icon: Zap,
                  accent: "from-amber-500/20 via-amber-500/5 to-transparent",
                },
                {
                  label: "Top Source",
                  value: topSource.count > 0 ? topSource.source : "No source yet",
                  sub: totalLeads > 0 ? `${topSourceRate}% of total leads` : "Waiting on intake activity",
                  icon: MessageCircle,
                  accent: "from-pink-500/20 via-pink-500/5 to-transparent",
                },
              ].map((metric) => {
                const Icon = metric.icon;

                return (
                  <Card key={metric.label} className="overflow-hidden border-border/70 bg-background/80 backdrop-blur-sm">
                    <CardContent className="relative p-5">
                      <div className={cn("absolute inset-x-0 top-0 h-16 bg-linear-to-b", metric.accent)} />
                      <div className="relative flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{metric.label}</p>
                          <p className="mt-3 text-3xl font-semibold tracking-tight">{metric.value}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{metric.sub}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-card p-3">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card className="border-border/70 bg-background/85 backdrop-blur-sm">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Intake Momentum</CardTitle>
                  <CardDescription>New inquiries captured across the last 7 days</CardDescription>
                </div>
                <Badge className="rounded-none" variant="secondary">
                  <TrendingUp className="mr-1 h-3.5 w-3.5" />
                  {formatTrend(intakeGrowth)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-border/70 bg-card p-4">
                <svg aria-label="Weekly lead intake chart" className="h-44 w-full" viewBox="0 0 320 120" preserveAspectRatio="none" role="img">
                  <defs>
                    <linearGradient id="lead-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  <path d={chartPath.area} fill="url(#lead-fill)" />
                  <polyline fill="none" points={chartPath.line} stroke="var(--color-primary)" strokeWidth="3" />
                </svg>
                <div className="mt-3 grid grid-cols-7 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {analytics.weeklyLabels.map((label, index) => (
                    <span key={`${label}-${index}`} className={index === analytics.weeklyLabels.length - 1 ? "text-right" : undefined}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-card p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Pipeline Stages</p>
                  <div className="mt-4 space-y-4">
                    {stageCounts.map((item) => (
                      <div key={item.status} className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span>{item.status}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              item.status === "Converted" ? "bg-emerald-500" :
                              item.status === "Qualified" ? "bg-violet-500" :
                              item.status === "Contacted" ? "bg-amber-500" :
                              item.status === "Lost" ? "bg-rose-500" :
                              "bg-sky-500"
                            )}
                            style={{ width: `${totalLeads === 0 ? 0 : (item.count / totalLeads) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Source Mix</p>
                  <div className="mt-4 space-y-3">
                    {sourceMix.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No intake source data yet.</p>
                    ) : sourceMix.map(([source, count]) => {
                      const meta = sourceMeta[source as LeadSource];
                      const Icon = meta.icon;
                      const width = totalLeads === 0 ? 0 : (count / totalLeads) * 100;

                      return (
                        <div key={source} className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <span className={cn("rounded-lg border border-border/50 bg-background p-1.5", meta.color)}>
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              <span>{source}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{Math.round(width)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, source, or service..."
              className="h-11 rounded-xl border-border/60 bg-card pl-10"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={statusFilter === status ? "default" : "outline"}
                  className="h-10 rounded-xl px-4 text-[11px] font-black uppercase tracking-[0.18em]"
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </Button>
              ))}
            </div>

            <div className="flex gap-3">
              <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as (typeof sourceOptions)[number])}>
                <SelectTrigger className="h-10 min-w-40 rounded-xl border-border/60 bg-card">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((source) => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as (typeof sortOptions)[number])}>
                <SelectTrigger className="h-10 min-w-40 rounded-xl border-border/60 bg-card">
                  <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing {filteredLeads.length} of {totalLeads} leads in pipeline.
          </span>
          <span>
            {statusFilter !== "All" || sourceFilter !== "All" || searchQuery ? "Filters active" : "No filters applied"}
          </span>
        </div>

        <div className="overflow-hidden rounded-4xl border border-border/50 bg-card/30 shadow-xl shadow-foreground/2">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lead</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Source</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Interest</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pipeline</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Value</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-sm text-muted-foreground">
                      Loading leads...
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-sm text-muted-foreground">
                      No leads match the current filters. Adjust search, stage, or source to widen the pipeline.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const meta = sourceMeta[lead.source];
                    const Icon = meta.icon;

                    return (
                      <tr key={lead.backendId} className="group transition-colors hover:bg-primary/2">
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{lead.id}</span>
                            <span className="text-sm font-extrabold text-foreground">{lead.name}</span>
                            <span className="text-xs text-muted-foreground">{lead.date}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2.5">
                            <span className={cn("rounded-xl border border-border/50 bg-background p-2", meta.color)}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-xs font-bold text-foreground">{lead.source}</p>
                              <p className="text-[11px] text-muted-foreground">{lead.preferredContact} first</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-foreground">{lead.interest}</p>
                            <p className="line-clamp-2 max-w-sm text-[11px] text-muted-foreground">{lead.notes}</p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-2">
                            <Select
                              value={lead.status}
                              onValueChange={(value) => void updateLeadStatusInline(lead, value as LeadStatus)}
                              disabled={savingRowId === lead.backendId}
                            >
                              <SelectTrigger className={cn("h-7 w-32 gap-1 rounded-lg border-none px-2 text-[9px] font-black uppercase tracking-widest shadow-none [&>svg]:h-3 [&>svg]:w-3", statusTone[lead.status])}>
                                {savingRowId === lead.backendId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {pipelineStatuses.map((status) => (
                                  <SelectItem key={status} value={status} className="text-[11px]">{status}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[11px] font-semibold text-muted-foreground">{lead.priority} priority</p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <p className="text-sm font-extrabold text-foreground">${lead.estimatedValue.toLocaleString()}</p>
                            <p className="text-[11px] text-muted-foreground">{lead.nextStep}</p>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary"
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsSheetOpen(true);
                            }}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-hidden border-l border-border/50 bg-card/95 p-0 backdrop-blur-3xl sm:max-w-md">
          {selectedLead ? (
            <div className="flex h-full flex-col">
              <div className="relative h-48 shrink-0 bg-neutral-950 p-6 text-white">
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/55 to-transparent" />
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808014_1px,transparent_1px),linear-gradient(to_bottom,#80808014_1px,transparent_1px)] bg-size-[16px_16px]" />
                </div>
                <div className="relative z-10 flex h-full flex-col justify-end gap-3">
                  <Badge className={cn("w-fit rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest", statusTone[detailForm.status])}>
                    {detailForm.status}
                  </Badge>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/60">{selectedLead.id}</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight">{selectedLead.name}</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{selectedLead.email}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                <SheetHeader className="space-y-2 text-left">
                  <SheetTitle className="text-base font-black tracking-tight">Lead Detail Sheet</SheetTitle>
                  <SheetDescription>
                    Review inquiry context, move the lead through the pipeline, and keep the next action current.
                  </SheetDescription>
                </SheetHeader>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border/50 bg-background/80 p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Phone</p>
                    <p className="mt-2 text-sm font-bold">{selectedLead.phone}</p>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-background/80 p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Source</p>
                    <p className="mt-2 text-sm font-bold">{selectedLead.source}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/80 p-5">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-primary">Pipeline Stage</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {pipelineStatuses.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        variant={detailForm.status === status ? "default" : "outline"}
                        className="h-10 rounded-xl text-[11px] font-black uppercase tracking-[0.16em]"
                        disabled={isSaving || isDeleting || isConverting}
                        onClick={() => void persistLeadChanges({ status })}
                      >
                        {isSaving && detailForm.status !== status ? null : isSaving && detailForm.status === status ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lead-priority">Priority</Label>
                    <Select
                      value={detailForm.priority}
                      onValueChange={(value) => setDetailForm((current) => ({
                        ...current,
                        priority: value as LeadRecord["priority"],
                      }))}
                    >
                      <SelectTrigger id="lead-priority" className="h-11 rounded-xl border-border/60 bg-background">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map((priority) => (
                          <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lead-value">Estimated Value</Label>
                    <Input
                      id="lead-value"
                      inputMode="decimal"
                      className="h-11 rounded-xl border-border/60 bg-background"
                      value={detailForm.estimatedValue}
                      onChange={(event) => setDetailForm((current) => ({
                        ...current,
                        estimatedValue: event.target.value,
                      }))}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/80 p-5">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-primary">Inquiry Context</p>
                  <p className="mt-3 text-sm font-semibold text-foreground">{selectedLead.interest}</p>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="lead-notes">Notes</Label>
                    <Textarea
                      id="lead-notes"
                      className="min-h-28 rounded-2xl border-border/60 bg-background"
                      value={detailForm.notes}
                      onChange={(event) => setDetailForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-border/50 bg-background/80 p-5">
                  <Label htmlFor="lead-next-step">Next Step</Label>
                  <Input
                    id="lead-next-step"
                    className="h-11 rounded-xl border-border/60 bg-background"
                    value={detailForm.nextStep}
                    onChange={(event) => setDetailForm((current) => ({
                      ...current,
                      nextStep: event.target.value,
                    }))}
                  />
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/80 p-5">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Engagement Snapshot</p>
                  <div className="mt-4 space-y-4">
                    {[
                      { label: "Intake recorded", meta: selectedLead.date },
                      { label: "Preferred contact", meta: selectedLead.preferredContact },
                      { label: "Last updated", meta: new Date(selectedLead.updatedAt).toLocaleString() },
                    ].map((entry) => (
                      <div key={entry.label} className="flex items-center justify-between gap-3 border-b border-border/40 pb-3 text-sm last:border-b-0 last:pb-0">
                        <span className="font-semibold text-foreground">{entry.label}</span>
                        <span className="text-right text-muted-foreground">{entry.meta}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="h-11 rounded-xl font-bold"
                    onClick={() => void handleConvertToCase()}
                    disabled={isSaving || isDeleting || isConverting}
                  >
                    {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Convert to Case
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl font-bold"
                    onClick={() => void persistLeadChanges()}
                    disabled={isSaving || isDeleting}
                  >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>

                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl border-rose-500/30 font-bold text-rose-600 hover:bg-rose-500/8 hover:text-rose-700"
                  onClick={() => void handleDeleteLead()}
                  disabled={isSaving || isDeleting}
                >
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete Lead
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
