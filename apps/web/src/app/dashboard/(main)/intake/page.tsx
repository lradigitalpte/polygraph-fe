"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ClientRecord, fetchClients } from "@/lib/clients";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import {
  bulkSchedule,
  type BulkScheduleRow,
} from "@/lib/exam-booking";

// ─── CSV helpers ────────────────────────────────────────────────────────────

const CSV_TEMPLATE = `first_name,last_name,email,phone,employee_ref
Jane,Doe,jane@example.com,+971-50-0001,EMP-001
John,Smith,john@example.com,+971-50-0002,EMP-002`;

function parseCsvRows(text: string): ExamineeRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const idx = (n: string) => header.indexOf(n);
  return lines.slice(1).map((line, i) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      _key: `csv-${i}-${Date.now()}`,
      first_name: cols[idx("first_name")] ?? cols[0] ?? "",
      last_name: cols[idx("last_name")] ?? cols[1] ?? "",
      email: cols[idx("email")] ?? "",
      phone: cols[idx("phone")] ?? "",
      employee_ref: cols[idx("employee_ref")] ?? "",
      offset_minutes: 0,
    };
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ExamineeRow = {
  _key: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  employee_ref: string;
  offset_minutes: number;
};

function emptyRow(): ExamineeRow {
  return {
    _key: `row-${Date.now()}-${Math.random()}`,
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    employee_ref: "",
    offset_minutes: 0,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BatchIntakePage() {
  const router = useRouter();

  // Data
  const [clients, setClients] = React.useState<ClientRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);

  // Form state
  const [clientId, setClientId] = React.useState<string>("");
  const [examinerId, setExaminerId] = React.useState<string>("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("09:00");
  const [duration, setDuration] = React.useState("60");
  const [examFee, setExamFee] = React.useState("");
  const [paymentMode, setPaymentMode] = React.useState("Bank Transfer");
  const [notes, setNotes] = React.useState("");
  const [rows, setRows] = React.useState<ExamineeRow[]>([emptyRow()]);

  // UI state
  const [submitting, setSubmitting] = React.useState(false);
  const [csvText, setCsvText] = React.useState("");
  const [showCsvImport, setShowCsvImport] = React.useState(false);

  // Load clients + examiners on mount
  React.useEffect(() => {
    Promise.all([fetchClients(), fetchExaminers()])
      .then(([c, e]) => {
        setClients(c);
        setExaminers(e);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load data"))
      .finally(() => setLoadingData(false));
  }, []);

  // ── Row helpers ──────────────────────────────────────────────────────────

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r._key !== key));
  }

  function updateRow(key: string, field: keyof ExamineeRow, value: string | number) {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  }

  function handleCsvImport() {
    const parsed = parseCsvRows(csvText);
    if (parsed.length === 0) {
      toast.error("Paste CSV with a header row and at least one row");
      return;
    }
    setRows(parsed);
    setCsvText("");
    setShowCsvImport(false);
    toast.success(`Loaded ${parsed.length} row(s) from CSV`);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch-intake-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clientId) { toast.error("Select a client / organisation"); return; }
    if (!examinerId) { toast.error("Select an examiner"); return; }
    if (!date) { toast.error("Pick a session date"); return; }

    const validRows = rows.filter((r) => r.first_name.trim() || r.last_name.trim());
    if (validRows.length === 0) {
      toast.error("Add at least one examinee");
      return;
    }

    // Build ISO8601 timestamp from date + time inputs
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

    const examinees: BulkScheduleRow[] = validRows.map((r) => ({
      first_name: r.first_name.trim(),
      last_name: r.last_name.trim(),
      email: r.email.trim() || undefined,
      phone: r.phone.trim() || undefined,
      employee_ref: r.employee_ref.trim() || undefined,
      offset_minutes: r.offset_minutes || 0,
    }));

    setSubmitting(true);
    try {
      const result = await bulkSchedule({
        client_id: Number(clientId),
        examiner_id: Number(examinerId),
        scheduled_at: scheduledAt,
        duration: Number(duration) || 60,
        exam_fee: examFee ? Number(examFee) : undefined,
        payment_mode: paymentMode,
        notes: notes.trim(),
        examinees,
      });

      toast.success(
        `Batch scheduled: ${result.scheduled} appointment${result.scheduled !== 1 ? "s" : ""} created`
      );
      router.push(`/dashboard/clients/${clientId}/roster`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch schedule failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/dashboard/clients"
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batch intake</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add examinees for an organisation and schedule all their appointments in one step.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Session details ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session details</CardTitle>
            <CardDescription>
              These settings apply to every appointment in this batch.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {/* Client */}
            <div className="space-y-1.5">
              <Label htmlFor="client">Organisation / Client *</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(String(v))}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.client_type !== "Individual" && (
                        <span className="ml-1 text-muted-foreground text-xs">({c.client_type})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Examiner */}
            <div className="space-y-1.5">
              <Label htmlFor="examiner">Examiner *</Label>
              <Select value={examinerId} onValueChange={(v) => setExaminerId(String(v))}>
                <SelectTrigger id="examiner">
                  <SelectValue placeholder="Select examiner…" />
                </SelectTrigger>
                <SelectContent>
                  {examiners.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="date">Session date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>

            {/* Start time */}
            <div className="space-y-1.5">
              <Label htmlFor="time">Start time *</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration per session (min)</Label>
              <Input
                id="duration"
                type="number"
                min={15}
                max={480}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>

            {/* Fee */}
            <div className="space-y-1.5">
              <Label htmlFor="fee">Exam fee (AED)</Label>
              <Input
                id="fee"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={examFee}
                onChange={(e) => setExamFee(e.target.value)}
              />
            </div>

            {/* Payment mode */}
            <div className="space-y-1.5">
              <Label htmlFor="payment">Payment mode</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(String(v))}>
                <SelectTrigger id="payment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Bank Transfer", "Credit Card"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Any instructions or context for this batch…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Examinee roster ── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Examinees
                </CardTitle>
                <CardDescription className="mt-1">
                  One row = one person = one appointment. Use{" "}
                  <strong>Offset (min)</strong> to stagger start times automatically.
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={downloadTemplate}
                >
                  <Download className="h-3.5 w-3.5" />
                  Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowCsvImport((v) => !v)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV
                </Button>
              </div>
            </div>

            {/* CSV import area */}
            {showCsvImport && (
              <div className="mt-4 space-y-2">
                <Textarea
                  rows={5}
                  placeholder={CSV_TEMPLATE}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="font-mono text-xs"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleCsvImport}>
                    Load rows
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowCsvImport(false); setCsvText(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr_6rem_2.5rem] gap-2 px-1">
              {["First name", "Last name", "Email", "Phone", "Employee ref", "Offset (min)", ""].map(
                (h) => (
                  <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </span>
                )
              )}
            </div>

            {/* Rows */}
            {rows.map((row, i) => (
              <div
                key={row._key}
                className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_1fr_1fr_6rem_2.5rem] items-center"
              >
                <Input
                  placeholder="First name"
                  value={row.first_name}
                  onChange={(e) => updateRow(row._key, "first_name", e.target.value)}
                  aria-label={`Row ${i + 1} first name`}
                />
                <Input
                  placeholder="Last name"
                  value={row.last_name}
                  onChange={(e) => updateRow(row._key, "last_name", e.target.value)}
                  aria-label={`Row ${i + 1} last name`}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={row.email}
                  onChange={(e) => updateRow(row._key, "email", e.target.value)}
                  aria-label={`Row ${i + 1} email`}
                />
                <Input
                  placeholder="Phone"
                  value={row.phone}
                  onChange={(e) => updateRow(row._key, "phone", e.target.value)}
                  aria-label={`Row ${i + 1} phone`}
                />
                <Input
                  placeholder="Ref"
                  value={row.employee_ref}
                  onChange={(e) => updateRow(row._key, "employee_ref", e.target.value)}
                  aria-label={`Row ${i + 1} employee ref`}
                />
                <Input
                  type="number"
                  min={0}
                  step={15}
                  placeholder="0"
                  value={row.offset_minutes || ""}
                  onChange={(e) =>
                    updateRow(row._key, "offset_minutes", Number(e.target.value))
                  }
                  aria-label={`Row ${i + 1} offset minutes`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(row._key)}
                  disabled={rows.length === 1}
                  aria-label="Remove row"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 mt-2"
              onClick={addRow}
            >
              <Plus className="h-3.5 w-3.5" />
              Add row
            </Button>
          </CardContent>
        </Card>

        {/* ── Submit ── */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" render={<Link href="/dashboard/clients" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="gap-2 min-w-36">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scheduling…
              </>
            ) : (
              <>
                <Users className="h-4 w-4" />
                Schedule {rows.filter((r) => r.first_name || r.last_name).length || ""} appointment
                {rows.filter((r) => r.first_name || r.last_name).length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
