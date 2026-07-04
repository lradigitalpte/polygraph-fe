"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpDown,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Upload,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { ExamineeBookingStatus } from "@/components/dashboard/examinee-booking-status";
import { bulkCreateExaminees, fetchClientExaminees, type ExamineeRosterEntry } from "@/lib/clients";
import { formatOrganizationAccountLabel, isOrganizationClient } from "@/lib/client-types";
import {
  ENGLISH_PROFICIENCY_LEVELS,
  createSubject,
  formatSubjectCode,
  formatSubjectName,
} from "@/lib/subjects";

const CSV_TEMPLATE = `first_name,last_name,email,phone,employee_ref
Jane,Doe,jane@example.com,+1-555-0101,EMP-001
John,Smith,john@example.com,+1-555-0102,EMP-002`;

function parseCsvRows(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // 1. Locate the header row.
  // We search for a line that contains "NAME" (case-insensitive) or "FIRST_NAME".
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().toLowerCase());
    if (cols.includes("name") || cols.includes("first_name")) {
      headerIndex = i;
      break;
    }
  }

  // If no header found, fall back to default parser
  if (headerIndex === -1) {
    const firstLine = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const idx = (name: string) => firstLine.indexOf(name);
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        first_name: cols[idx("first_name")] ?? cols[0] ?? "",
        last_name: cols[idx("last_name")] ?? cols[1] ?? "",
        email: cols[idx("email")] ?? "",
        phone: cols[idx("phone")] ?? "",
        employee_ref: cols[idx("employee_ref")] ?? "",
      };
    });
  }

  const headerLine = lines[headerIndex];
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  
  // Find column positions
  const nameIdx = headers.indexOf("name");
  const firstNameIdx = headers.indexOf("first_name");
  const lastNameIdx = headers.indexOf("last_name");
  const phoneIdx = headers.findIndex(h => h.includes("phone"));
  const emailIdx = headers.findIndex(h => h.includes("mail") || h.includes("email"));
  const remarkIdx = headers.indexOf("remark");
  const empRefIdx = headers.indexOf("employee_ref");

  const results: Array<{
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    employee_ref?: string;
  }> = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = rawLine.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    
    // Skip short lines
    if (cols.length < 2) continue;
    
    let firstName = "";
    let lastName = "";
    
    if (firstNameIdx !== -1) {
      firstName = cols[firstNameIdx] ?? "";
      lastName = cols[lastNameIdx] ?? "";
    } else if (nameIdx !== -1) {
      const fullName = cols[nameIdx] ?? "";
      const parts = fullName.trim().split(/\s+/);
      if (parts.length > 0 && parts[0]) {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ") || "Subject";
      }
    }

    // Skip if name is invalid or contains metadata/legends
    if (!firstName || firstName.toLowerCase().includes("legend") || firstName.toLowerCase().includes("colour")) {
      continue;
    }
    
    // Also skip separator rows that have dates
    if (rawLine.toLowerCase().includes("january") || rawLine.toLowerCase().includes("february") || rawLine.toLowerCase().includes("march") || rawLine.toLowerCase().includes("april")) {
      continue;
    }

    const phone = phoneIdx !== -1 ? cols[phoneIdx] : "";
    
    // If email column contains "SENT" or other status, ignore it
    let email = emailIdx !== -1 ? cols[emailIdx] : "";
    if (email && (email.toLowerCase() === "sent" || email.toLowerCase() === "-")) {
      email = "";
    }

    // Remark or employee_ref
    let ref = "";
    if (empRefIdx !== -1) {
      ref = cols[empRefIdx];
    } else if (remarkIdx !== -1) {
      ref = cols[remarkIdx];
    }

    results.push({
      first_name: firstName,
      last_name: lastName,
      email: email || undefined,
      phone: phone || undefined,
      employee_ref: ref || undefined,
    });
  }

  return results;
}

type BookingFilter = "all" | "booked" | "unbooked";
type SessionFilter = "all" | "has_sessions" | "completed" | "none";
type SortField = "name" | "last_session" | "sessions";

function formatLastSession(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function ExamineeRosterPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const { client } = useClientDetail();
  const accountLabel = client
    ? isOrganizationClient(client)
      ? formatOrganizationAccountLabel(client)
      : client.name
    : "this account";
  const [entries, setEntries] = React.useState<ExamineeRosterEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [bookingFilter, setBookingFilter] = React.useState<BookingFilter>("all");
  const [sessionFilter, setSessionFilter] = React.useState<SessionFilter>("all");
  const [sortField, setSortField] = React.useState<SortField>("name");
  const [sortAsc, setSortAsc] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 15;
  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [importText, setImportText] = React.useState("");
  const [form, setForm] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    employee_ref: "",
    english_proficiency: "",
    interpreter_required: false,
  });

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
    setCurrentPage(1);
  }, [search, bookingFilter, sessionFilter, sortField, sortAsc]);

  const filtered = React.useMemo(() => {
    const s = search.toLowerCase().trim();
    let rows = entries.filter((e) => {
      const name = formatSubjectName(e.subject).toLowerCase();
      const email = (e.subject.email ?? "").toLowerCase();
      const phone = (e.subject.phone ?? "").toLowerCase();
      const ref = (e.subject.employee_ref ?? "").toLowerCase();
      const code = formatSubjectCode(e.subject.id).toLowerCase();
      const matchesSearch =
        !s ||
        name.includes(s) ||
        email.includes(s) ||
        phone.includes(s) ||
        ref.includes(s) ||
        code.includes(s);

      const isBooked = Boolean(e.next_scheduled_at) || (e.upcoming_count ?? 0) > 0;
      const matchesBooking =
        bookingFilter === "all" ||
        (bookingFilter === "booked" && isBooked) ||
        (bookingFilter === "unbooked" && !isBooked);

      const matchesSession =
        sessionFilter === "all" ||
        (sessionFilter === "has_sessions" && e.session_count > 0) ||
        (sessionFilter === "completed" && e.completed_count > 0) ||
        (sessionFilter === "none" && e.session_count === 0);

      return matchesSearch && matchesBooking && matchesSession;
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = formatSubjectName(a.subject).localeCompare(formatSubjectName(b.subject));
      } else if (sortField === "last_session") {
        const aTime = a.last_scheduled_at ? new Date(a.last_scheduled_at).getTime() : 0;
        const bTime = b.last_scheduled_at ? new Date(b.last_scheduled_at).getTime() : 0;
        cmp = aTime - bTime;
      } else {
        cmp = a.session_count - b.session_count;
      }
      return sortAsc ? cmp : -cmp;
    });

    return rows;
  }, [entries, search, bookingFilter, sessionFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const stats = React.useMemo(() => {
    const booked = entries.filter(
      (e) => Boolean(e.next_scheduled_at) || (e.upcoming_count ?? 0) > 0,
    ).length;
    const withHistory = entries.filter((e) => e.session_count > 0).length;
    return { total: entries.length, booked, withHistory };
  }, [entries]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((v) => !v);
    } else {
      setSortField(field);
      setSortAsc(field === "name");
    }
  };

  const handleExportCsv = () => {
    const headers = ["Code", "First Name", "Last Name", "Email", "Phone", "Ref ID", "Sessions", "Completed", "Last Session", "Booking Status"];
    const rows = filtered.map((entry) => {
      const isBooked = Boolean(entry.next_scheduled_at) || (entry.upcoming_count ?? 0) > 0;
      return [
        formatSubjectCode(entry.subject.id),
        entry.subject.first_name,
        entry.subject.last_name,
        entry.subject.email ?? "",
        entry.subject.phone ?? "",
        entry.subject.employee_ref ?? "",
        String(entry.session_count),
        String(entry.completed_count),
        formatLastSession(entry.last_scheduled_at),
        isBooked ? "Booked" : "Not booked",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `examinee-roster-${clientId}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} examinee(s)`);
  };

  const resetForm = () =>
    setForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      employee_ref: "",
      english_proficiency: "",
      interpreter_required: false,
    });

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
      resetForm();
      await load();
      router.push(`/dashboard/clients/${clientId}/examinees/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add examinee");
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    const rows = parseCsvRows(importText);
    if (rows.length === 0) {
      toast.error("Paste CSV with a header row and at least one examinee");
      return;
    }
    setSaving(true);
    try {
      const result = await bulkCreateExaminees(clientId, rows);
      toast.success(`Imported ${result.created} examinee(s)`);
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
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "examinee-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Examinee roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            People tested under {accountLabel}. Add or import, then book each person individually
            — examiner availability is checked when you pick a time slot.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add examinee
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How booking works for {accountLabel}</CardTitle>
          <CardDescription>One appointment = one examinee + one time slot + one available examiner.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-3 text-sm">
            <li className="flex gap-3 rounded-xl border border-border/50 bg-background p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              <div>
                <p className="font-semibold">Add or import examinees</p>
                <p className="text-xs text-muted-foreground mt-1">Name, email, phone for each person.</p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl border border-border/50 bg-background p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </span>
              <div>
                <p className="font-semibold">Book per person</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click <strong>Book session</strong> — billing stays under {accountLabel}.
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl border border-border/50 bg-background p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </span>
              <div>
                <p className="font-semibold">Pick examiner & time</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Step 2 shows only slots when the examiner is free (calendar blocks apply).
                </p>
              </div>
            </li>
          </ol>
          <Button
            className="mt-4 gap-2"
            render={<Link href={`/dashboard/calendar/book?clientId=${clientId}`} />}
          >
            Open booking wizard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/50 bg-card/40">
          <CardContent className="pt-5 pb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total examinees</p>
            <p className="text-2xl font-black mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/40">
          <CardContent className="pt-5 pb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upcoming booked</p>
            <p className="text-2xl font-black mt-1 text-emerald-600">{stats.booked}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/40">
          <CardContent className="pt-5 pb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">With session history</p>
            <p className="text-2xl font-black mt-1">{stats.withHistory}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10 h-11 rounded-xl"
            placeholder="Search name, email, phone, or ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={bookingFilter} onValueChange={(v) => setBookingFilter(v as BookingFilter)}>
            <SelectTrigger className="h-11 w-[160px] rounded-xl">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Booking" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All booking</SelectItem>
              <SelectItem value="booked">Exam booked</SelectItem>
              <SelectItem value="unbooked">Not booked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sessionFilter} onValueChange={(v) => setSessionFilter(v as SessionFilter)}>
            <SelectTrigger className="h-11 w-[160px] rounded-xl">
              <SelectValue placeholder="Sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sessions</SelectItem>
              <SelectItem value="has_sessions">Has sessions</SelectItem>
              <SelectItem value="completed">Has completed</SelectItem>
              <SelectItem value="none">No sessions</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-11 rounded-xl gap-2" onClick={handleExportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden shadow-xl shadow-foreground/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">
                  <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => toggleSort("name")}>
                    Examinee
                    <ArrowUpDown className={cn("h-3 w-3", sortField === "name" ? "opacity-100" : "opacity-40")} />
                  </button>
                </th>
                <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Contact</th>
                <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Booking</th>
                <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">
                  <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => toggleSort("sessions")}>
                    Sessions
                    <ArrowUpDown className={cn("h-3 w-3", sortField === "sessions" ? "opacity-100" : "opacity-40")} />
                  </button>
                </th>
                <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">
                  <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => toggleSort("last_session")}>
                    Last session
                    <ArrowUpDown className={cn("h-3 w-3", sortField === "last_session" ? "opacity-100" : "opacity-40")} />
                  </button>
                </th>
                <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Loading roster...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-muted-foreground mb-4">
                      {search || bookingFilter !== "all" || sessionFilter !== "all"
                        ? "No examinees match your filters."
                        : "No examinees yet. Import a CSV or add people one at a time."}
                    </p>
                    {!search && bookingFilter === "all" && sessionFilter === "all" && (
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
                          <Upload className="h-4 w-4" />
                          Import CSV
                        </Button>
                        <Button onClick={() => setAddOpen(true)} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Add examinee
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginated.map((entry) => {
                  const name = formatSubjectName(entry.subject);
                  return (
                    <tr key={entry.subject.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/clients/${clientId}/examinees/${entry.subject.id}`}
                          className="flex items-center gap-3 min-w-[200px]"
                        >
                          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {name}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                              {formatSubjectCode(entry.subject.id)}
                              {entry.subject.employee_ref ? ` · ${entry.subject.employee_ref}` : ""}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 min-w-[160px]">
                          {entry.subject.email ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                              <span className="truncate">{entry.subject.email}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">No email</span>
                          )}
                          {entry.subject.phone ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                              <span>{entry.subject.phone}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">No phone</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <ExamineeBookingStatus entry={entry} compact />
                      </td>
                      <td className="px-6 py-4">
                        {entry.session_count > 0 ? (
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {entry.session_count} total
                            {entry.completed_count > 0 ? ` · ${entry.completed_count} done` : ""}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {formatLastSession(entry.last_scheduled_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-1 rounded-lg h-8"
                            render={
                              <Link
                                href={`/dashboard/calendar/book?clientId=${clientId}&subjectId=${entry.subject.id}`}
                              />
                            }
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            Book
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg h-8"
                            render={<Link href={`/dashboard/clients/${clientId}/examinees/${entry.subject.id}`} />}
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border/40 bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
              {filtered.length !== entries.length ? ` (filtered from ${entries.length})` : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-lg"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-semibold tabular-nums px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-lg"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add examinee</DialogTitle>
            <DialogDescription>
              Register someone under {accountLabel}. You will book appointments for them one at a
              time.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>First name *</Label>
              <Input
                className="h-11 rounded-xl"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Last name *</Label>
              <Input
                className="h-11 rounded-xl"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                className="h-11 rounded-xl"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                className="h-11 rounded-xl"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Employee / ref ID</Label>
              <Input
                className="h-11 rounded-xl"
                placeholder="EMP-001"
                value={form.employee_ref}
                onChange={(e) => setForm((f) => ({ ...f, employee_ref: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>English proficiency</Label>
              <Select
                value={form.english_proficiency || "unset"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, english_proficiency: v === "unset" ? "" : String(v) }))
                }
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Not assessed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not assessed</SelectItem>
                  {ENGLISH_PROFICIENCY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 cursor-pointer">
              <Checkbox
                checked={form.interpreter_required}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, interpreter_required: checked === true }))
                }
              />
              <span>
                <span className="block text-sm font-semibold">Interpreter required</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Flag if a translator must be booked for this examinee.
                </span>
              </span>
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleAdd()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save & open profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Import examinees (CSV)</DialogTitle>
            <DialogDescription>
              Paste CSV or download the template. Supports standard templates and custom layouts containing columns like Name, Phone, and Remark.
            </DialogDescription>
          </DialogHeader>
          <Button type="button" variant="outline" size="sm" className="gap-2 w-fit" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            Download template
          </Button>
          <Textarea
            className="min-h-[160px] font-mono text-xs rounded-xl"
            placeholder={CSV_TEMPLATE}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleImport()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Import rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
