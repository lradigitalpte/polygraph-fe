"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ENGLISH_PROFICIENCY_LEVELS } from "@/lib/subjects";

// ─── Types ────────────────────────────────────────────────────────────────────

type IntakeFormMeta = {
  client_name: string;
  recipient_name: string;
  message: string;
  expires_at: string;
  status: string;
};

type SubjectRow = {
  _key: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  employee_ref: string;
  nationality: string;
  gender: string;
  id_number: string;
  english_proficiency: string;
  interpreter_required: boolean;
  preferred_date: string;
  preferred_time: string;
};

function emptyRow(): SubjectRow {
  return {
    _key: `r-${Date.now()}-${Math.random()}`,
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    employee_ref: "",
    nationality: "",
    gender: "",
    id_number: "",
    english_proficiency: "",
    interpreter_required: false,
    preferred_date: "",
    preferred_time: "",
  };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchIntakeForm(token: string): Promise<IntakeFormMeta> {
  const res = await fetch(`${API}/api/public/intake/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Unable to load this form");
  return data;
}

async function submitIntakeForm(
  token: string,
  subjects: Omit<SubjectRow, "_key">[],
  agreed: boolean
): Promise<{ message: string; created: number }> {
  const res = await fetch(`${API}/api/public/intake/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjects, agreed }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Submission failed");
  return data;
}

// ─── Small helpers ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicIntakePage() {
  const params = useParams();
  const token = params.token as string;

  const [meta, setMeta] = React.useState<IntakeFormMeta | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<SubjectRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [agreedAccuracy, setAgreedAccuracy] = React.useState(false);
  const [agreedConsent, setAgreedConsent] = React.useState(false);
  const agreed = agreedAccuracy && agreedConsent;

  React.useEffect(() => {
    if (!token) return;
    fetchIntakeForm(token)
      .then(setMeta)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load form"))
      .finally(() => setLoading(false));
  }, [token]);

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r._key !== key) : prev));
  }

  function update(key: string, field: keyof SubjectRow, value: string | boolean) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const valid = rows.filter((r) => r.first_name.trim() || r.last_name.trim());
    if (valid.length === 0) {
      setSubmitError("Please add at least one person before submitting.");
      return;
    }

    const incomplete = valid.findIndex(
      (r) =>
        !r.first_name.trim() ||
        !r.last_name.trim() ||
        !r.gender.trim() ||
        !r.preferred_date.trim() ||
        !r.preferred_time.trim()
    );
    if (incomplete !== -1) {
      setSubmitError(
        `Person ${incomplete + 1}: first name, last name, gender, and a preferred date & time are required.`
      );
      return;
    }

    if (!agreed) {
      setSubmitError("Please tick both declaration boxes below before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      await submitIntakeForm(
        token,
        valid.map(({ _key: _k, ...rest }) => rest),
        agreed
      );
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error (expired / not found) ──
  if (error || !meta) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-destructive">This link is unavailable</CardTitle>
            <CardDescription>{error ?? "The form could not be loaded."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // ── Success ──
  if (done) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-3">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
            </div>
            <CardTitle className="text-xl">Submission received</CardTitle>
            <CardDescription>
              Thank you. We have received the examinee details for{" "}
              <strong>{meta.client_name}</strong> and will be in touch to confirm appointments.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // ── Form ──
  const expiryDate = new Date(meta.expires_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Polygraph Forensic System
          </p>
          <h1 className="text-2xl font-bold">Examinee intake form</h1>
          <p className="text-sm text-muted-foreground">
            For: <strong>{meta.client_name}</strong> · Expires {expiryDate}
          </p>
        </div>

        {/* Custom message from admin */}
        {meta.message && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4 text-sm whitespace-pre-line">
              {meta.message}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Fill in one row per person to be examined.</p>
            <p>• <strong>First name</strong> and <strong>Last name</strong> are required for each person.</p>
            <p>• All other fields are optional but help us prepare for the session.</p>
            <p>• Submit once — you cannot resubmit after the form is sent.</p>
          </CardContent>
        </Card>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">People to be examined</CardTitle>
              <CardDescription>
                Add one section per individual. Fields marked * are required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {rows.map((row, i) => (
                <div
                  key={row._key}
                  className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Person {i + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(row._key)}
                      disabled={rows.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="First name *">
                      <Input
                        placeholder="First name"
                        value={row.first_name}
                        onChange={(e) => update(row._key, "first_name", e.target.value)}
                      />
                    </Field>
                    <Field label="Last name *">
                      <Input
                        placeholder="Last name"
                        value={row.last_name}
                        onChange={(e) => update(row._key, "last_name", e.target.value)}
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        value={row.email}
                        onChange={(e) => update(row._key, "email", e.target.value)}
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        placeholder="+971…"
                        value={row.phone}
                        onChange={(e) => update(row._key, "phone", e.target.value)}
                      />
                    </Field>
                    <Field label="Employee ref / ID">
                      <Input
                        placeholder="EMP-001"
                        value={row.employee_ref}
                        onChange={(e) => update(row._key, "employee_ref", e.target.value)}
                      />
                    </Field>
                    <Field label="ID / passport number">
                      <Input
                        placeholder="ID or passport no."
                        value={row.id_number}
                        onChange={(e) => update(row._key, "id_number", e.target.value)}
                      />
                    </Field>
                    <Field label="Nationality">
                      <Input
                        placeholder="Nationality"
                        value={row.nationality}
                        onChange={(e) => update(row._key, "nationality", e.target.value)}
                      />
                    </Field>
                    <Field label="Gender *">
                      <Select
                        value={row.gender}
                        onValueChange={(v) => update(row._key, "gender", String(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="English proficiency">
                      <Select
                        value={row.english_proficiency}
                        onValueChange={(v) => update(row._key, "english_proficiency", String(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="How well do they speak English?" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENGLISH_PROFICIENCY_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Preferred date *">
                      <Input
                        type="date"
                        value={row.preferred_date}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => update(row._key, "preferred_date", e.target.value)}
                      />
                    </Field>
                    <Field label="Preferred time *">
                      <Input
                        type="time"
                        value={row.preferred_time}
                        onChange={(e) => update(row._key, "preferred_time", e.target.value)}
                      />
                    </Field>
                  </div>

                  <label className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 cursor-pointer">
                    <Checkbox
                      checked={row.interpreter_required}
                      onCheckedChange={(checked) =>
                        update(row._key, "interpreter_required", checked === true)
                      }
                    />
                    <span className="text-sm">
                      This person needs an interpreter for the examination
                    </span>
                  </label>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={addRow}
              >
                <Plus className="h-3.5 w-3.5" />
                Add person
              </Button>
            </CardContent>
          </Card>

          {submitError && (
            <p className="text-sm text-destructive text-center">{submitError}</p>
          )}

          {/* Privacy note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Information submitted here is stored securely and used only to prepare and conduct
              polygraph examinations for <strong>{meta.client_name}</strong>. It is not shared with
              third parties.
            </span>
          </div>

          {/* Declaration / sign-off */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Declaration</CardTitle>
              <CardDescription>
                Both boxes must be ticked before you can submit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <label htmlFor="consent-accuracy" className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  id="consent-accuracy"
                  checked={agreedAccuracy}
                  onCheckedChange={(checked) => {
                    setAgreedAccuracy(checked === true);
                    if (checked) setSubmitError(null);
                  }}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground">
                  On behalf of <strong>{meta.client_name}</strong>, I confirm that the details
                  provided above are accurate and complete to the best of my knowledge, and that the
                  individuals listed are authorised to be scheduled for a polygraph examination.
                </span>
              </label>
              <label htmlFor="consent-data" className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  id="consent-data"
                  checked={agreedConsent}
                  onCheckedChange={(checked) => {
                    setAgreedConsent(checked === true);
                    if (checked) setSubmitError(null);
                  }}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground">
                  I consent to this information being stored and used to prepare and conduct those
                  polygraph examinations for <strong>{meta.client_name}</strong>.
                </span>
              </label>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={submitting || !agreed}
              className="min-w-40 gap-2"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                `Submit ${rows.filter((r) => r.first_name || r.last_name).length || ""} ${rows.filter((r) => r.first_name || r.last_name).length === 1 ? "person" : "people"}`
              )}
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-muted-foreground pb-8">
          Polygraph Forensic System · <a href="mailto:admin@polygraph.ae" className="underline">admin@polygraph.ae</a>
        </p>
      </div>
    </div>
  );
}
