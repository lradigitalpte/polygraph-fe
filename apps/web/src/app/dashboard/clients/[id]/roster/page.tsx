"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Calendar, CalendarCheck, Check, Download, Loader2, Mail, Phone, Search, Ticket, Upload, UserPlus, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/dashboard/ui-kit";
import { cn } from "@/lib/utils";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { bulkCreateExaminees, fetchClientExaminees, type ExamineeRosterEntry } from "@/lib/clients";
import { fetchPrepaidSlotSummary, type PrepaidSlotSummary } from "@/lib/prepaid-slots";
import { formatOrganizationAccountLabel, isOrganizationClient } from "@/lib/client-types";
import { formatClinicDateLabel } from "@/lib/clinic-time";
import { ENGLISH_PROFICIENCY_LEVELS, createSubject, formatSubjectCode, formatSubjectName } from "@/lib/subjects";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const PAGE_STEP = 25;

const CSV_TEMPLATE = `first_name,last_name,email,phone,employee_ref
Jane,Doe,jane@example.com,+971501234567,EMP-001
John,Smith,john@example.com,+971507654321,EMP-002`;

type ImportRow = { first_name: string; last_name: string; email?: string; phone?: string; employee_ref?: string };

/** Splits one CSV line, honouring quotes ("Doe, Jane" stays one cell; "" is a literal quote). */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * Reads pasted CSV (or tab-separated text copied from Excel). Finds the header row by
 * its column names; without one, assumes the template's column order — and keeps the
 * first line as data instead of dropping it.
 */
function parseCsvRows(text: string): { rows: ImportRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], skipped: 0 };
  const sep = lines[0].includes("\t") && !lines[0].includes(",") ? "\t" : ",";
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

  let headerIndex = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = splitCsvLine(lines[i], sep).map(norm);
    if (cols.some((c) => ["name", "fullname", "firstname", "examinee", "employeename"].includes(c))) {
      headerIndex = i;
      headers = cols;
      break;
    }
  }

  const find = (...names: string[]) => headers.findIndex((h) => names.includes(h));
  const idx =
    headerIndex === -1
      ? { first: 0, last: 1, full: -1, email: 2, phone: 3, ref: 4 }
      : {
          first: find("firstname", "first", "givenname"),
          last: find("lastname", "last", "surname", "familyname"),
          full: find("name", "fullname", "examinee", "employeename"),
          email: headers.findIndex((h) => h.includes("mail")),
          phone: headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h === "tel"),
          ref: find("employeeref", "ref", "refid", "employeeid", "staffid", "remark", "remarks"),
        };

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(headerIndex + 1)) {
    const cols = splitCsvLine(line, sep);
    const at = (i: number) => (i >= 0 ? (cols[i] ?? "").trim() : "");
    let first = at(idx.first);
    let last = at(idx.last);
    if (!first && !last && idx.full >= 0) {
      const parts = at(idx.full).split(/\s+/).filter(Boolean);
      first = parts[0] ?? "";
      last = parts.slice(1).join(" ");
    }
    // Rows without a usable name (blank lines, section titles like "Legend") are skipped and counted.
    if (!first || /^(legend|total|colou?r|note)/i.test(first)) {
      skipped++;
      continue;
    }
    const email = at(idx.email);
    rows.push({
      first_name: first,
      last_name: last,
      email: looksLikeEmail(email) ? email : undefined,
      phone: at(idx.phone) || undefined,
      employee_ref: at(idx.ref) || undefined,
    });
  }
  return { rows, skipped };
}

type View = "all" | "unbooked" | "booked" | "never" | "unnamed";
type SortKey = "name" | "recent" | "sessions";

const hasName = (e: ExamineeRosterEntry) => formatSubjectName(e.subject).trim() !== "";
const isBooked = (e: ExamineeRosterEntry) => Boolean(e.next_scheduled_at) || (e.upcoming_count ?? 0) > 0;
const ts = (iso?: string) => (iso ? new Date(iso).getTime() || 0 : 0);
/** Latest thing that happened to this person: next booking, last session, or when they were added. */
const lastActivity = (e: ExamineeRosterEntry) => Math.max(ts(e.next_scheduled_at), ts(e.last_scheduled_at), ts(e.subject.created_at));
const nameKey = (e: ExamineeRosterEntry) => formatSubjectName(e.subject).trim().toLowerCase().replace(/\s+/g, " ");

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function SortHeader({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; className?: string }) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 font-medium", className)}>
      <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1 rounded-md transition-colors hover:text-foreground", active && "font-semibold text-foreground")}>
        {label}
        <Icon aria-hidden="true" className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </th>
  );
}

export default function ExamineeRosterPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const { client } = useClientDetail();
  const accountLabel = client ? (isOrganizationClient(client) ? formatOrganizationAccountLabel(client) : client.name) : "this account";

  const [entries, setEntries] = React.useState<ExamineeRosterEntry[]>([]);
  const [prepaid, setPrepaid] = React.useState<PrepaidSlotSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState<View>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("recent");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [shown, setShown] = React.useState(PAGE_STEP);
  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [importText, setImportText] = React.useState("");
  const [form, setForm] = React.useState({ first_name: "", last_name: "", email: "", phone: "", employee_ref: "", english_proficiency: "", interpreter_required: false });

  const load = React.useCallback(async () => {
    if (!Number.isFinite(clientId)) return;
    setLoading(true);
    try {
      setEntries(await fetchClientExaminees(clientId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!Number.isFinite(clientId) || !client || !isOrganizationClient(client)) {
      setPrepaid(null);
      return;
    }
    fetchPrepaidSlotSummary(clientId).then(setPrepaid).catch(() => setPrepaid(null));
  }, [clientId, client]);

  React.useEffect(() => setShown(PAGE_STEP), [search, view, sortKey, sortDir]);

  const counts = React.useMemo(
    () => ({
      all: entries.length,
      booked: entries.filter(isBooked).length,
      unbooked: entries.filter((e) => !isBooked(e)).length,
      never: entries.filter((e) => e.session_count === 0 && !isBooked(e)).length,
      unnamed: entries.filter((e) => !hasName(e)).length,
      tested: entries.filter((e) => e.completed_count > 0).length,
    }),
    [entries],
  );

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = entries.filter((e) => {
      if (view === "booked" && !isBooked(e)) return false;
      if (view === "unbooked" && isBooked(e)) return false;
      if (view === "never" && (e.session_count > 0 || isBooked(e))) return false;
      if (view === "unnamed" && hasName(e)) return false;
      if (!q) return true;
      return [formatSubjectName(e.subject), e.subject.email, e.subject.phone, e.subject.employee_ref, formatSubjectCode(e.subject.id)].some((v) => (v ?? "").toLowerCase().includes(q));
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      if (sortKey === "name") {
        // Unnamed records always last, whichever way the names run.
        const an = formatSubjectName(a.subject);
        const bn = formatSubjectName(b.subject);
        if (!an !== !bn) return an ? -1 : 1;
        return dir * an.localeCompare(bn, undefined, { sensitivity: "base" });
      }
      const diff = sortKey === "sessions" ? a.session_count - b.session_count : lastActivity(a) - lastActivity(b);
      return dir * diff || b.subject.id - a.subject.id;
    });
  }, [entries, search, view, sortKey, sortDir]);

  /** Names that appear on more than one record, so staff can spot double entries. */
  const duplicateNames = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const e of entries) {
      const k = nameKey(e);
      if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [entries]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const visible = filtered.slice(0, shown);
  const parsed = React.useMemo(() => parseCsvRows(importText), [importText]);

  const handleExportCsv = () => {
    const headers = ["Code", "First name", "Last name", "Email", "Phone", "Ref", "Sessions", "Completed", "Last session", "Booking"];
    const rows = filtered.map((e) => [
      formatSubjectCode(e.subject.id),
      e.subject.first_name,
      e.subject.last_name,
      e.subject.email ?? "",
      e.subject.phone ?? "",
      e.subject.employee_ref ?? "",
      String(e.session_count),
      String(e.completed_count),
      e.last_scheduled_at ? formatClinicDateLabel(e.last_scheduled_at) : "",
      isBooked(e) ? "Booked" : "Not booked",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `examinee-roster-${clientId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} examinee${filtered.length === 1 ? "" : "s"}`);
  };

  const handleAdd = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    setSaving(true);
    try {
      const created = await createSubject({
        client_id: clientId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        employee_ref: form.employee_ref.trim() || undefined,
        english_proficiency: form.english_proficiency || undefined,
        interpreter_required: form.interpreter_required,
      });
      toast.success("Examinee added");
      setAddOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", employee_ref: "", english_proficiency: "", interpreter_required: false });
      await load();
      router.push(`/dashboard/clients/${clientId}/examinees/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add examinee");
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (parsed.rows.length === 0) {
      toast.error("No examinees found in what you pasted");
      return;
    }
    setSaving(true);
    try {
      const result = await bulkCreateExaminees(clientId, parsed.rows);
      toast.success(`Imported ${result.created} examinee${result.created === 1 ? "" : "s"}`);
      setImportOpen(false);
      setImportText("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "examinee-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pill = "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted";

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Examinee roster</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Everyone tested under {accountLabel}. Book each person individually; billing stays on the company account.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => setImportOpen(true)} className={cn(pill, "h-10 px-4")}>
            <Upload aria-hidden="true" className="size-4" /> Import
          </button>
          <button type="button" onClick={() => setAddOpen(true)} className="flex h-10 items-center gap-1.5 rounded-full bg-[#2B2A27] px-4 text-sm font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background">
            <UserPlus aria-hidden="true" className="size-4" /> Add examinee
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Examinees", value: counts.all, hint: `${counts.tested} tested`, icon: Users },
          { label: "Booked", value: counts.booked, hint: "Have an upcoming session", icon: Calendar },
          { label: "Never booked", value: counts.never, hint: "Waiting for a first session", icon: UserPlus },
          prepaid && prepaid.total > 0
            ? { label: "Prepaid slots", value: prepaid.available, hint: `free · ${prepaid.consumed} used of ${prepaid.total}`, icon: Ticket }
            : { label: "Not booked", value: counts.unbooked, hint: "No upcoming session", icon: Calendar },
        ].map((s) => (
          <div key={s.label} className={cn(CARD, "p-4")}>
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <s.icon aria-hidden="true" className="size-3.5" /> {s.label}
            </p>
            <p className="mt-1 text-2xl font-medium tracking-[-0.02em] tabular-nums">{loading ? "—" : s.value}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      {counts.unnamed > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-[#F8EEDB] px-4 py-3 sm:flex-row sm:items-center dark:bg-amber-950/60">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-[#8A5A12] dark:text-amber-300" />
          <p className="flex-1 text-[13px] text-[#5C3D0C] dark:text-amber-100">
            {counts.unnamed} examinee record{counts.unnamed === 1 ? " has" : "s have"} no name, so they can&apos;t be told apart. Open each one to add the name, or delete it if it was created by mistake.
          </p>
          <button type="button" onClick={() => setView("unnamed")} className="h-9 shrink-0 rounded-full bg-white/70 px-3.5 text-[13px] font-medium text-[#5C3D0C] hover:bg-white dark:bg-black/20 dark:text-amber-100">
            Show them
          </button>
        </div>
      ) : null}

      {/* List */}
      <section aria-label="Examinees" className={cn(CARD, "overflow-hidden")}>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Segmented<View>
              label="Show"
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "never", label: "Never booked", count: counts.never },
                { value: "booked", label: "Booked", count: counts.booked },
                { value: "unbooked", label: "Not booked", count: counts.unbooked },
                ...(counts.unnamed ? [{ value: "unnamed" as const, label: "No name", count: counts.unnamed }] : []),
              ]}
            />
            <div className="flex items-center gap-2">
              <div className="relative w-full lg:w-64">
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search examinees" placeholder="Name, email, phone, ref or EXM code…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 rounded-full border-0 bg-[#F3F1EA] pr-9 pl-10 text-sm shadow-none dark:bg-muted" />
                {search ? (
                  <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card">
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={handleExportCsv} disabled={filtered.length === 0} className={cn(pill, "h-10 shrink-0")} title="Download the examinees shown as a spreadsheet">
                <Download aria-hidden="true" className="size-4" /> Export
              </button>
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {sortKey === "recent"
              ? sortDir === "desc"
                ? "Most recent first — by latest session, booking or date added."
                : "Oldest activity first."
              : sortKey === "name"
                ? `Sorted by name, ${sortDir === "asc" ? "A–Z" : "Z–A"}.`
                : sortDir === "desc"
                  ? "Most sessions first."
                  : "Fewest sessions first."}{" "}
            Click a column heading to change the order.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center border-t border-border/50 py-16 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" /> Loading roster…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
              <Users aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">{entries.length === 0 ? "No examinees yet. Import the company's list or add people one at a time." : "No examinees match."}</p>
            {entries.length === 0 ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => setImportOpen(true)} className={pill}>
                  <Upload aria-hidden="true" className="size-4" /> Import
                </button>
                <button type="button" onClick={() => setAddOpen(true)} className={pill}>
                  <UserPlus aria-hidden="true" className="size-4" /> Add examinee
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setView("all");
                }}
                className={pill}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-border/50">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#F7F6F1] text-left text-xs text-muted-foreground dark:bg-muted/40">
                <tr>
                  <SortHeader label="Examinee" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} className="pl-5" />
                  <th scope="col" className="px-3 py-2.5 font-medium">Contact</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Booking</th>
                  <SortHeader label="Sessions" active={sortKey === "sessions"} dir={sortDir} onClick={() => toggleSort("sessions")} />
                  <SortHeader label="Last session" active={sortKey === "recent"} dir={sortDir} onClick={() => toggleSort("recent")} />
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {visible.map((e) => {
                  const name = formatSubjectName(e.subject);
                  const profile = `/dashboard/clients/${clientId}/examinees/${e.subject.id}` as Route;
                  const booked = isBooked(e);
                  const duplicate = name && duplicateNames.has(nameKey(e));
                  return (
                    <tr key={e.subject.id} className="transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/30">
                      <td className="py-3 pr-3 pl-5">
                        <Link href={profile} className="group flex min-w-0 items-center gap-3">
                          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold", name ? "bg-primary/12 text-[oklch(0.45_0.12_39)] dark:text-primary" : "bg-[#F8EEDB] text-[#8A5A12]")}>
                            {initials(name)}
                          </span>
                          <span className="min-w-0">
                            <span className={cn("block max-w-[260px] truncate font-medium group-hover:underline group-hover:underline-offset-4", !name && "text-[#8A5A12] italic dark:text-amber-300")}>
                              {name || "Unnamed — add a name"}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-mono">{formatSubjectCode(e.subject.id)}</span>
                              {e.subject.employee_ref ? <span className="max-w-[140px] truncate">· {e.subject.employee_ref}</span> : null}
                              {duplicate ? (
                                <span title="Another examinee on this account has the same name — check it isn't a double entry." className="rounded-full bg-[#F8EEDB] px-1.5 text-[10px] font-semibold text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">
                                  Same name
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {e.subject.email || e.subject.phone ? (
                          <>
                            {e.subject.email ? (
                              <span className="flex max-w-[220px] items-center gap-1 truncate">
                                <Mail aria-hidden="true" className="size-3 shrink-0" /> <span className="truncate">{e.subject.email}</span>
                              </span>
                            ) : null}
                            {e.subject.phone ? (
                              <span className="flex items-center gap-1 tabular-nums">
                                <Phone aria-hidden="true" className="size-3 shrink-0" /> {e.subject.phone}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {booked ? (
                          <span className="inline-flex flex-col">
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#E7F1E4] px-2.5 py-0.5 text-xs font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
                              <CalendarCheck aria-hidden="true" className="size-3" /> Booked
                            </span>
                            {e.next_scheduled_at ? <span className="mt-0.5 text-xs text-muted-foreground">{formatClinicDateLabel(e.next_scheduled_at)}</span> : null}
                          </span>
                        ) : e.session_count === 0 ? (
                          <span className="inline-flex rounded-full bg-[#F8EEDB] px-2.5 py-0.5 text-xs font-medium text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">Never booked</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-[#ECE9E0] px-2.5 py-0.5 text-xs font-medium text-[#55534C] dark:bg-muted dark:text-muted-foreground">Not booked</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs tabular-nums">
                        {e.session_count > 0 ? (
                          <>
                            <span className="font-medium text-foreground">{e.completed_count}</span>
                            <span className="text-muted-foreground"> of {e.session_count} done</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {e.last_scheduled_at ? formatClinicDateLabel(e.last_scheduled_at) : <span title={`Added ${formatClinicDateLabel(e.subject.created_at)}`}>No sessions yet</span>}
                      </td>
                      <td className="py-3 pr-5 pl-3 text-right">
                        <Link
                          href={`/dashboard/calendar/book?clientId=${clientId}&subjectId=${e.subject.id}` as Route}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#2B2A27] px-3 text-[13px] font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background"
                        >
                          <Calendar aria-hidden="true" className="size-3.5" /> Book
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > visible.length ? (
          <div className="flex flex-col items-center gap-2 border-t border-border/50 p-4">
            <p className="text-xs text-muted-foreground">
              Showing {visible.length} of {filtered.length}
            </p>
            <button type="button" onClick={() => setShown((n) => n + PAGE_STEP)} className={cn(pill, "h-10 px-5")}>
              Show {Math.min(PAGE_STEP, filtered.length - visible.length)} more
            </button>
          </div>
        ) : null}
      </section>

      {/* Add */}
      <Dialog open={addOpen} onOpenChange={(o) => !saving && setAddOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[26px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add examinee</DialogTitle>
            <DialogDescription>Register someone under {accountLabel}. You&apos;ll book their sessions one at a time.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["first_name", "First name", "text", true],
                ["last_name", "Last name", "text", true],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <label htmlFor={`add-${key}`} className="px-1 text-[13px] font-medium">
                  {label} <span className="text-destructive">*</span>
                </label>
                <Input id={`add-${key}`} type={type} className={FIELD} value={form[key]} onChange={(ev) => setForm((f) => ({ ...f, [key]: ev.target.value }))} />
              </div>
            ))}
            <div className="grid gap-1.5 sm:col-span-2">
              <label htmlFor="add-email" className="px-1 text-[13px] font-medium">Email</label>
              <Input id="add-email" type="email" className={FIELD} value={form.email} onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="add-phone" className="px-1 text-[13px] font-medium">Phone</label>
              <Input id="add-phone" type="tel" placeholder="+971 50 123 4567" className={FIELD} value={form.phone} onChange={(ev) => setForm((f) => ({ ...f, phone: ev.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="add-ref" className="px-1 text-[13px] font-medium">Employee / ref ID</label>
              <Input id="add-ref" placeholder="EMP-001" className={FIELD} value={form.employee_ref} onChange={(ev) => setForm((f) => ({ ...f, employee_ref: ev.target.value }))} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <span className="px-1 text-[13px] font-medium">English</span>
              <div role="radiogroup" aria-label="English proficiency" className="flex flex-wrap gap-1.5">
                {["", ...ENGLISH_PROFICIENCY_LEVELS].map((level) => {
                  const on = form.english_proficiency === level;
                  return (
                    <button
                      key={level || "unset"}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setForm((f) => ({ ...f, english_proficiency: level }))}
                      className={cn("flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-medium transition-colors", on ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background" : "bg-[#F3F1EA] hover:bg-[#ECE9E0] dark:bg-muted")}
                    >
                      {on ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
                      {level || "Not assessed"}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-4 rounded-2xl bg-[#F7F6F1] px-4 py-3 sm:col-span-2 dark:bg-muted/40">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Interpreter required</span>
                <span className="block text-xs text-muted-foreground">Flag if a translator must be booked for this examinee.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.interpreter_required}
                aria-label="Interpreter required"
                onClick={() => setForm((f) => ({ ...f, interpreter_required: !f.interpreter_required }))}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", form.interpreter_required ? "bg-primary" : "bg-[#D6D2C6] dark:bg-muted-foreground/40")}
              >
                <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", form.interpreter_required && "translate-x-5")} />
              </button>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => void handleAdd()} disabled={saving || !form.first_name.trim() || !form.last_name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save &amp; open profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import with a preview */}
      <Dialog open={importOpen} onOpenChange={(o) => !saving && setImportOpen(o)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[26px] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import examinees</DialogTitle>
            <DialogDescription>Paste rows from the company&apos;s spreadsheet (CSV, or copy straight from Excel). A column called Name, or First name + Last name, is enough; Email, Phone and Ref are picked up when present.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={downloadTemplate} className={pill}>
              <Download aria-hidden="true" className="size-4" /> Template
            </button>
            {importText.trim() ? (
              <span className="text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">{parsed.rows.length}</span> to import{parsed.skipped ? ` · ${parsed.skipped} row${parsed.skipped === 1 ? "" : "s"} skipped (no name)` : ""}
              </span>
            ) : null}
          </div>
          <Textarea className="min-h-36 rounded-2xl border-0 bg-[#F3F1EA] px-4 py-3 font-mono text-xs shadow-none dark:bg-muted" placeholder={CSV_TEMPLATE} value={importText} onChange={(e) => setImportText(e.target.value)} />
          {parsed.rows.length > 0 ? (
            <div className="overflow-hidden rounded-2xl ring-1 ring-border/60">
              <p className="bg-[#F7F6F1] px-4 py-2 text-xs font-medium text-muted-foreground dark:bg-muted/40">Preview — check the names landed in the right columns</p>
              <ul className="max-h-56 divide-y divide-border/50 overflow-y-auto text-sm">
                {parsed.rows.slice(0, 50).map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2">
                    <span className="font-medium">
                      {r.first_name} {r.last_name || <span className="text-[#8A5A12] italic">(no surname)</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{[r.email, r.phone, r.employee_ref].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
                {parsed.rows.length > 50 ? <li className="px-4 py-2 text-xs text-muted-foreground">…and {parsed.rows.length - 50} more</li> : null}
              </ul>
            </div>
          ) : null}
          {parsed.rows.some((r) => !r.last_name) ? (
            <p className="text-xs text-muted-foreground">Rows without a surname are saved with the surname &ldquo;Record&rdquo; — fix them on the profile afterwards.</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setImportOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="gap-2 rounded-full" onClick={() => void handleImport()} disabled={saving || parsed.rows.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Import {parsed.rows.length || ""} examinee{parsed.rows.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
