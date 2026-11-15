"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CreditCard,
  FileText,
  History,
  Loader2,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  Save,
  User,
  type LucideIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { deleteClient, formatClientCode, updateClient, type ClientRecord, type ReportVerdictWording } from "@/lib/clients";
import { fetchReportTemplates } from "@/lib/report-templates";
import { reportVerdictWordingDescription } from "@/lib/report-template";
import type { ReportTemplateRecord } from "@/lib/report-template";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  clientType: string;
  gender: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  paymentMethod: string;
  notes: string;
  emailDeliveryMode: "immediate" | "daily_summary" | "important_only" | "none";
  emailBookingNotices: boolean;
  emailSessionReminders: boolean;
  emailExamineeFallback: boolean;
  emailSummaryTime: string;
  reportVerdictWording: ReportVerdictWording;
  defaultReportTemplateId: string;
};

type TabKey = "profile" | "billing" | "reports" | "email" | "notes" | "record";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";

function clientToForm(client: ClientRecord): FormState {
  return {
    name: client.name ?? "",
    clientType: client.client_type || "Individual",
    gender: client.gender ?? "",
    contactPerson: client.contact_person ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    taxId: client.tax_id ?? "",
    paymentMethod: client.preferred_payment_method || "Bank Transfer",
    notes: client.notes ?? "",
    emailDeliveryMode: client.email_delivery_mode || "immediate",
    emailBookingNotices: client.email_booking_notices ?? true,
    emailSessionReminders: client.email_session_reminders ?? true,
    emailExamineeFallback: client.email_examinee_fallback ?? false,
    emailSummaryTime: client.email_summary_time || "17:00",
    reportVerdictWording: client.report_verdict_wording === "forensic" ? "forensic" : "plain",
    defaultReportTemplateId: client.default_report_template_id ? String(client.default_report_template_id) : "",
  };
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isCompanyType(clientType: string) {
  const t = clientType.toLowerCase();
  return t.includes("corporate") || t.includes("law");
}

/** Imported records sometimes carry a made-up address that can't receive mail. */
function isPlaceholderEmail(email: string) {
  const e = email.trim().toLowerCase();
  return e.endsWith("@import.local") || e.endsWith(".local") || e.endsWith("@example.com") || e.endsWith(".invalid");
}

function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="px-1 text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="px-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** A small set of choices as tappable chips — clearer than a dropdown for 2–4 options. */
function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="px-1 text-[13px] font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors disabled:opacity-50",
                active
                  ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background"
                  : "bg-[#F3F1EA] text-[#3D3929] hover:bg-[#ECE9E0] dark:bg-muted dark:text-foreground",
              )}
            >
              {active ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Radio cards for options that need a sentence of explanation. */
function OptionCards<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="px-1 text-[13px] font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex items-start gap-3 rounded-2xl p-4 text-left transition-colors disabled:opacity-50",
                active ? "bg-white ring-2 ring-primary dark:bg-card" : "bg-[#F7F6F1] ring-1 ring-border/50 hover:bg-[#F3F1EA] dark:bg-muted/40 dark:hover:bg-muted",
              )}
            >
              <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", active ? "bg-primary text-white" : "ring-1 ring-border bg-white dark:bg-card")}>
                {active ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.label}</span>
                {option.description ? <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, description, icon: Icon, children }: { title: string; description?: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className={cn(CARD, "p-6")}>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium">{title}</h3>
          {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export default function ClientPersonalDetailsPage() {
  const router = useRouter();
  const { client, clientId, loading, error, setClientRecord } = useClientDetail();
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirtyFields, setDirtyFields] = React.useState<Set<keyof FormState>>(new Set());
  const [reportTemplates, setReportTemplates] = React.useState<ReportTemplateRecord[]>([]);
  const [tab, setTab] = React.useState<TabKey>("profile");

  // Remember the tab in the address (#billing) so a refresh lands back on it.
  React.useEffect(() => {
    const fromHash = window.location.hash.replace("#", "") as TabKey;
    if (["profile", "billing", "reports", "email", "notes", "record"].includes(fromHash)) setTab(fromHash);
  }, []);
  const chooseTab = (next: TabKey) => {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  };

  React.useEffect(() => {
    void fetchReportTemplates().then(setReportTemplates).catch(() => setReportTemplates([]));
  }, []);

  React.useEffect(() => {
    if (client) {
      setForm(clientToForm(client));
      setDirtyFields(new Set());
    }
  }, [client]);

  const dirty = dirtyFields.size > 0;

  // Warn before leaving the page with unsaved edits.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setDirtyFields((prev) => new Set(prev).add(field));
  };

  const handleReset = () => {
    if (client) {
      setForm(clientToForm(client));
      setDirtyFields(new Set());
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form) return;
    if (!form.name.trim()) {
      chooseTab("profile");
      toast.error("Client name is required");
      return;
    }
    if (!form.email.trim()) {
      chooseTab("profile");
      toast.error("Email is required");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateClient(clientId, {
        name: form.name.trim(),
        client_type: form.clientType,
        gender: form.gender.trim() || undefined,
        contact_person: form.contactPerson.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        tax_id: form.taxId.trim() || undefined,
        preferred_payment_method: form.paymentMethod,
        notes: form.notes.trim() || undefined,
        email_delivery_mode: form.emailDeliveryMode,
        email_booking_notices: form.emailBookingNotices,
        email_session_reminders: form.emailSessionReminders,
        email_examinee_fallback: form.emailExamineeFallback,
        email_summary_time: form.emailSummaryTime,
        report_verdict_wording: form.reportVerdictWording,
        default_report_template_id: form.defaultReportTemplateId ? Number(form.defaultReportTemplateId) : null,
      });
      setClientRecord(updated);
      setForm(clientToForm(updated));
      setDirtyFields(new Set());
      toast.success("Client details saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading details…
      </div>
    );
  }

  if (error || !client) {
    return <div className="rounded-[26px] bg-destructive/5 p-6 text-destructive ring-1 ring-destructive/20">{error || "Client record not found."}</div>;
  }

  const isCompany = isCompanyType(form.clientType);
  const placeholderEmail = isPlaceholderEmail(form.email);

  // Which tab each field lives on, so the tab can show a dot when it has unsaved edits.
  const fieldTab: Record<keyof FormState, TabKey> = {
    name: "profile",
    clientType: "profile",
    gender: "profile",
    contactPerson: "profile",
    email: "profile",
    phone: "profile",
    address: "profile",
    taxId: "billing",
    paymentMethod: "billing",
    reportVerdictWording: "reports",
    defaultReportTemplateId: "reports",
    emailDeliveryMode: "email",
    emailBookingNotices: "email",
    emailSessionReminders: "email",
    emailExamineeFallback: "email",
    emailSummaryTime: "email",
    notes: "notes",
  };
  const dirtyTabs = new Set(Array.from(dirtyFields).map((f) => fieldTab[f]));

  const tabs: { key: TabKey; label: string; icon: LucideIcon; hidden?: boolean }[] = [
    { key: "profile", label: isCompany ? "Account" : "Profile", icon: User },
    { key: "billing", label: "Billing", icon: CreditCard },
    { key: "reports", label: "Reports", icon: FileText },
    { key: "email", label: "Email", icon: Mail, hidden: !isCompany },
    { key: "notes", label: "Notes", icon: NotebookPen },
    { key: "record", label: "Record", icon: History },
  ];
  const visibleTabs = tabs.filter((t) => !t.hidden);
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : "profile";

  const templateOptions = [
    { value: "", label: "Organization default", description: "Use whatever is set in Settings → Report templates." },
    ...reportTemplates.map((t) => ({ value: String(t.id), label: t.name, description: undefined as string | undefined })),
  ];

  return (
    <div className="space-y-5 pb-28">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">{isCompany ? "Account details" : "Personal details"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {client.name} · <span className="font-mono text-[13px]">{formatClientCode(client.id)}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Client details sections" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-[#E9E6DD] p-1 no-scrollbar dark:bg-muted">
        {visibleTabs.map((t) => {
          const active = t.key === activeTab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              onClick={() => chooseTab(t.key)}
              className={cn(
                "relative flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors",
                active ? "bg-white text-foreground shadow-sm dark:bg-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon aria-hidden="true" className="size-4" />
              {t.label}
              {dirtyTabs.has(t.key) ? <span aria-label="unsaved changes" className="size-1.5 rounded-full bg-primary" /> : null}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} id="client-details-form">
        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="space-y-5">
          {activeTab === "profile" ? (
            <>
              <Panel title={isCompany ? "Organization" : "Identity"} description="Who this client is." icon={User}>
                <Field label={isCompany ? "Organization name" : "Full name"} htmlFor="name">
                  <Input id="name" required placeholder={isCompany ? "e.g. Acme Corp" : "e.g. John Doe"} className={FIELD} value={form.name} onChange={(e) => set("name", e.target.value)} disabled={saving} />
                </Field>
                <ChoiceChips
                  label="Client type"
                  value={form.clientType}
                  disabled={saving}
                  onChange={(v) => set("clientType", v)}
                  options={[
                    { value: "Individual", label: "Individual" },
                    { value: "Corporate", label: "Corporate" },
                    { value: "Law Firm", label: "Law firm" },
                  ]}
                />
                {isCompany ? (
                  <Field label="Contact person" htmlFor="contact_person">
                    <Input id="contact_person" placeholder="Primary contact name" className={FIELD} value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} disabled={saving} />
                  </Field>
                ) : (
                  <ChoiceChips
                    label="Gender"
                    value={form.gender || ""}
                    disabled={saving}
                    onChange={(v) => set("gender", v)}
                    options={[
                      { value: "Male", label: "Male" },
                      { value: "Female", label: "Female" },
                      { value: "Other", label: "Other" },
                      { value: "", label: "Not specified" },
                    ]}
                  />
                )}
              </Panel>

              <Panel title="Contact" description="How to reach this client." icon={MapPin}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Email" htmlFor="email">
                    <div className="relative">
                      <Mail aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" type="email" required placeholder="client@example.com" className={cn(FIELD, "pl-10", placeholderEmail && "ring-2 ring-[#E0A33A]")} value={form.email} onChange={(e) => set("email", e.target.value)} disabled={saving} />
                    </div>
                  </Field>
                  <Field label="Phone" htmlFor="phone">
                    <div className="relative">
                      <Phone aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="phone" type="tel" placeholder="+971 50 123 4567" className={cn(FIELD, "pl-10")} value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={saving} />
                    </div>
                  </Field>
                </div>
                {placeholderEmail ? (
                  <p role="alert" className="flex items-start gap-2 rounded-2xl bg-[#F8EEDB] px-4 py-3 text-[13px] text-[#5C3D0C] dark:bg-amber-950/60 dark:text-amber-100">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    This looks like a placeholder address from an import — emails sent to it won&apos;t arrive. Replace it with the client&apos;s real email.
                  </p>
                ) : null}
                <Field label="Address" htmlFor="address">
                  <Textarea id="address" placeholder="Building, street, area, city" className="min-h-24 resize-none rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted" value={form.address} onChange={(e) => set("address", e.target.value)} disabled={saving} />
                </Field>
              </Panel>
            </>
          ) : null}

          {activeTab === "billing" ? (
            <Panel title="Billing" description="Used on invoices for this client." icon={CreditCard}>
              <Field label="Tax ID / TRN" htmlFor="tax_id" hint="Printed on invoices when set. Optional.">
                <Input id="tax_id" placeholder="Optional" className={cn(FIELD, "sm:max-w-sm")} value={form.taxId} onChange={(e) => set("taxId", e.target.value)} disabled={saving} />
              </Field>
              <ChoiceChips
                label="Preferred payment method"
                value={form.paymentMethod}
                disabled={saving}
                onChange={(v) => set("paymentMethod", v)}
                options={[
                  { value: "Bank Transfer", label: "Bank transfer" },
                  { value: "Credit Card", label: "Card" },
                ]}
              />
            </Panel>
          ) : null}

          {activeTab === "reports" ? (
            <Panel title="Report preferences" description="How forensic reports for this client are worded and laid out." icon={FileText}>
              <OptionCards<ReportVerdictWording>
                label="Verdict wording"
                value={form.reportVerdictWording}
                disabled={saving}
                onChange={(v) => set("reportVerdictWording", v)}
                options={[
                  { value: "plain", label: "Plain language", description: "Truthful / Not Truthful" },
                  { value: "forensic", label: "Forensic terms", description: "NDI / DI" },
                ]}
              />
              <p className="rounded-2xl bg-[#F7F6F1] px-4 py-3 text-[13px] text-muted-foreground dark:bg-muted/40">{reportVerdictWordingDescription(form.reportVerdictWording)}</p>
              <OptionCards<string>
                label="Report template"
                value={form.defaultReportTemplateId}
                disabled={saving}
                onChange={(v) => set("defaultReportTemplateId", v)}
                options={templateOptions}
              />
            </Panel>
          ) : null}

          {activeTab === "email" && isCompany ? (
            <Panel title="Automatic email" description="Manually shared invoices, documents and reports are not affected." icon={Mail}>
              <OptionCards
                label="Delivery"
                value={form.emailDeliveryMode}
                disabled={saving}
                onChange={(v) => set("emailDeliveryMode", v)}
                options={[
                  { value: "daily_summary", label: "Daily summary", description: "One email a day. Recommended." },
                  { value: "immediate", label: "Immediately", description: "One email per event." },
                  { value: "important_only", label: "Important only", description: "Skip routine notices." },
                  { value: "none", label: "None", description: "No automatic email." },
                ]}
              />
              {form.emailDeliveryMode === "daily_summary" ? (
                <Field label="Summary time (Dubai)" htmlFor="summary_time">
                  <Input id="summary_time" type="time" className={cn(FIELD, "w-40")} value={form.emailSummaryTime} onChange={(e) => set("emailSummaryTime", e.target.value)} disabled={saving} />
                </Field>
              ) : null}
              <div className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-[#F7F6F1] dark:bg-muted/40">
                {(
                  [
                    ["emailBookingNotices", "Appointment confirmations", "Booking notices, when the delivery setting allows."],
                    ["emailSessionReminders", "Session reminders", "Reminders before upcoming sessions."],
                    ["emailExamineeFallback", "Use company email as fallback", "If an examinee has no email, send their message to the company contact."],
                  ] as const
                ).map(([field, label, description]) => {
                  const on = Boolean(form[field]);
                  return (
                    <label key={field} className="flex cursor-pointer items-center gap-4 px-4 py-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="block text-xs text-muted-foreground">{description}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={label}
                        disabled={saving}
                        onClick={() => set(field, !on)}
                        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-[#D6D2C6] dark:bg-muted-foreground/40")}
                      >
                        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
                      </button>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Invoices and payment reminders are always sent by hand. Reports, forms and documents go out only when someone picks a recipient.</p>
            </Panel>
          ) : null}

          {activeTab === "notes" ? (
            <Panel title="Internal notes" description="Only staff see these." icon={NotebookPen}>
              <Textarea
                id="notes"
                aria-label="Internal notes"
                placeholder="Anything the team should know about this client…"
                className="min-h-56 resize-y rounded-2xl border-0 bg-[#F3F1EA] px-4 py-3 text-sm leading-relaxed shadow-none dark:bg-muted"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                disabled={saving}
              />
            </Panel>
          ) : null}

          {activeTab === "record" ? (
            <>
              <Panel title="Record" description="Read-only system details." icon={History}>
                <dl className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-[#F7F6F1] text-sm dark:bg-muted/40">
                  {[
                    ["Client code", formatClientCode(client.id)],
                    ["Registered", formatDate(client.created_at)],
                    ["Last updated", formatDate(client.updated_at)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-4 py-3">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <section className={cn(CARD, "p-6 ring-destructive/25")}>
                <h3 className="text-[15px] font-medium text-destructive">Delete client record</h3>
                <p className="mt-1 mb-4 text-[13px] text-muted-foreground">Permanently removes this client and all examinees, sessions, documents and billing history. This can&apos;t be undone.</p>
                <DeleteConfirmDialog
                  title={`Delete ${client.name}`}
                  description="Type the client name exactly to confirm. This cannot be undone."
                  confirmLabel="Type client name to confirm"
                  confirmPlaceholder={client.name}
                  expectedValue={client.name}
                  triggerLabel="Delete client record"
                  onConfirm={async (typed) => {
                    if (!typed) return;
                    try {
                      await deleteClient(clientId, typed);
                      toast.success("Client record deleted");
                      router.push("/dashboard/clients");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to delete client");
                      throw err;
                    }
                  }}
                />
              </section>
            </>
          ) : null}
        </div>
      </form>

      {/* Save bar: visible on every tab while there are unsaved edits */}
      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-4 sm:pb-4 lg:pl-[17rem]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-full bg-[#2B2A27] py-2 pr-2 pl-5 text-[#FAF9F5] shadow-[0_12px_30px_-10px_rgba(20,20,19,0.5)] dark:bg-[#1B1B19] dark:ring-1 dark:ring-white/10">
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
              Unsaved changes
              <span className="font-normal text-[#C9C6BC]"> · {Array.from(dirtyTabs).map((k) => visibleTabs.find((t) => t.key === k)?.label).filter(Boolean).join(", ")}</span>
            </p>
            <button type="button" onClick={handleReset} disabled={saving} className="h-10 shrink-0 rounded-full px-4 text-[13px] font-medium text-[#C9C6BC] transition-colors hover:bg-white/10 hover:text-[#FAF9F5]">
              Discard
            </button>
            <button
              type="submit"
              form="client-details-form"
              disabled={saving}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#FAF9F5] px-5 text-[13px] font-semibold text-[#2B2A27] transition-colors hover:bg-white disabled:opacity-60"
            >
              {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
