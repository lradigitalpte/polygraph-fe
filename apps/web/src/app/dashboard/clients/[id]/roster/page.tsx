"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Download,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { bulkCreateExaminees, fetchClientExaminees, type ExamineeRosterEntry } from "@/lib/clients";
import { createSubject, formatSubjectCode, formatSubjectName } from "@/lib/subjects";

const CSV_TEMPLATE = `first_name,last_name,email,phone,employee_ref
Jane,Doe,jane@example.com,+1-555-0101,EMP-001
John,Smith,john@example.com,+1-555-0102,EMP-002`;

function parseCsvRows(text: string) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);

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

export default function ExamineeRosterPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const { client } = useClientDetail();
  const [entries, setEntries] = React.useState<ExamineeRosterEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
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

  const filtered = entries.filter((e) => {
    const s = search.toLowerCase();
    const name = formatSubjectName(e.subject).toLowerCase();
    const email = (e.subject.email ?? "").toLowerCase();
    const phone = (e.subject.phone ?? "").toLowerCase();
    return name.includes(s) || email.includes(s) || phone.includes(s);
  });

  const resetForm = () =>
    setForm({ first_name: "", last_name: "", email: "", phone: "", employee_ref: "" });

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
            People tested under {client?.name ?? "this account"}. Add or import, then book each
            person individually — examiner availability is checked when you pick a time slot.
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
          <CardTitle className="text-base">How booking works for {client?.name}</CardTitle>
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
                  Click <strong>Book session</strong> — account stays {client?.name ?? "the firm"}.
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-10 h-11 rounded-xl"
          placeholder="Search name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading roster...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-4">
            <p className="text-muted-foreground max-w-md mx-auto">
              {search
                ? "No examinees match your search."
                : "No examinees yet. Import a CSV (for large groups) or add people one at a time, then use Book session on each row."}
            </p>
            {!search && (
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
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((entry) => (
            <Card key={entry.subject.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <Link
                  href={`/dashboard/clients/${clientId}/examinees/${entry.subject.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="font-bold text-foreground">{formatSubjectName(entry.subject)}</p>
                  <p className="text-[10px] font-mono text-primary mt-0.5">
                    {formatSubjectCode(entry.subject.id)}
                    {entry.subject.employee_ref ? ` · ${entry.subject.employee_ref}` : ""}
                  </p>
                  {(entry.subject.email || entry.subject.phone) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      {entry.subject.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {entry.subject.email}
                        </span>
                      )}
                      {entry.subject.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {entry.subject.phone}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {entry.session_count} session{entry.session_count === 1 ? "" : "s"}
                    </Badge>
                    {entry.last_scheduled_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Last: {new Date(entry.last_scheduled_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1"
                    render={
                      <Link
                        href={`/dashboard/calendar/book?clientId=${clientId}&subjectId=${entry.subject.id}`}
                      />
                    }
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Book session
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    render={<Link href={`/dashboard/clients/${clientId}/examinees/${entry.subject.id}`} />}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add examinee</DialogTitle>
            <DialogDescription>
              Register someone under {client?.name}. You will book appointments for them one at a
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
              Paste CSV or download the template. Columns: first_name, last_name, email, phone,
              employee_ref.
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
