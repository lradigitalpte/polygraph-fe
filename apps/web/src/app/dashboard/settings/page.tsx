"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, CalendarDays, CreditCard, ImageUp, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { Segmented } from "@/components/dashboard/ui-kit";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteOrganizationData, fetchOrganizationSettings, updateOrganizationSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const MAX_LOGO_BYTES = 500 * 1024;

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";

type Tab = "profile" | "booking" | "payments" | "danger";
const TABS: { value: Tab; label: string }[] = [
  { value: "profile", label: "Organization" },
  { value: "booking", label: "Booking & currency" },
  { value: "payments", label: "Payments & tax" },
  { value: "danger", label: "Danger zone" },
];

const CURRENCIES = [
  { value: "AED", label: "AED — UAE dirham" },
  { value: "USD", label: "USD — US dollar ($)" },
  { value: "GBP", label: "GBP — British pound (£)" },
  { value: "EUR", label: "EUR — Euro (€)" },
];

type OrgSettings = Awaited<ReturnType<typeof fetchOrganizationSettings>>;

/** Form state, all as strings/booleans as the inputs hold them. */
type FormState = {
  name: string;
  supportEmail: string;
  phone: string;
  address: string;
  website: string;
  trn: string;
  currency: string;
  usdAedRate: string;
  usdGbpRate: string;
  usdEurRate: string;
  sundayBookingsEnabled: boolean;
  passStripeFees: boolean;
  stripeFeePercent: string;
  stripeFeeFixed: string;
  defaultVatRate: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  supportEmail: "",
  phone: "",
  address: "",
  website: "",
  trn: "",
  currency: "AED",
  usdAedRate: "3.6725",
  usdGbpRate: "0.785",
  usdEurRate: "0.925",
  sundayBookingsEnabled: false,
  passStripeFees: false,
  stripeFeePercent: "2.9",
  stripeFeeFixed: "1",
  defaultVatRate: "5",
};

function formFromOrg(org: OrgSettings): FormState {
  return {
    name: org.name ?? "",
    supportEmail: org.support_email ?? "",
    phone: org.phone ?? "",
    address: org.address ?? "",
    website: org.website ?? "",
    trn: org.trn ?? "",
    currency: org.currency ?? "AED",
    usdAedRate: String(org.usd_aed_rate ?? 3.6725),
    usdGbpRate: String(org.usd_gbp_rate ?? 0.785),
    usdEurRate: String(org.usd_eur_rate ?? 0.925),
    sundayBookingsEnabled: org.sunday_bookings_enabled ?? false,
    passStripeFees: org.pass_stripe_fees_to_customer ?? false,
    stripeFeePercent: String(org.stripe_card_fee_percent ?? 2.9),
    stripeFeeFixed: String(org.stripe_card_fee_fixed ?? 1),
    defaultVatRate: String(org.default_vat_rate ?? 5),
  };
}

function readTabFromUrl(): Tab {
  if (typeof window === "undefined") return "profile";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return TABS.some((t) => t.value === tab) ? (tab as Tab) : "profile";
}

export default function SettingsPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("profile");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = React.useState<FormState>(EMPTY_FORM);
  const [logo, setLogo] = React.useState("");
  const [logoChanged, setLogoChanged] = React.useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const applyOrg = React.useCallback((org: OrgSettings) => {
    const next = formFromOrg(org);
    setForm(next);
    setSaved(next);
    setLogo(org.logo_data_url ?? "");
    setLogoChanged(false);
  }, []);

  React.useEffect(() => {
    setTab(readTabFromUrl());
  }, []);

  const changeTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "profile") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        applyOrg(await fetchOrganizationSettings());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [applyOrg]);

  const dirty = logoChanged || (Object.keys(form) as (keyof FormState)[]).some((key) => form[key] !== saved[key]);

  // Warn before leaving the page with unsaved edits.
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      changeTab("profile");
      toast.error("Organization name is required");
      return;
    }
    setSaving(true);
    try {
      const org = await updateOrganizationSettings({
        name: form.name.trim(),
        support_email: form.supportEmail.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        currency: form.currency,
        usd_aed_rate: parseFloat(form.usdAedRate) || 3.6725,
        usd_gbp_rate: parseFloat(form.usdGbpRate) || 0.785,
        usd_eur_rate: parseFloat(form.usdEurRate) || 0.925,
        sunday_bookings_enabled: form.sundayBookingsEnabled,
        pass_stripe_fees_to_customer: form.passStripeFees,
        stripe_card_fee_percent: parseFloat(form.stripeFeePercent) || 2.9,
        stripe_card_fee_fixed: parseFloat(form.stripeFeeFixed) || 1,
        default_vat_rate: parseFloat(form.defaultVatRate) || 5,
        website: form.website.trim(),
        trn: form.trn.trim(),
        ...(logoChanged ? { logo_data_url: logo } : {}),
      });
      applyOrg(org);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm(saved);
    if (logoChanged) {
      // Reload to restore the stored logo rather than keeping the unsaved one.
      void fetchOrganizationSettings()
        .then((org) => {
          setLogo(org.logo_data_url ?? "");
          setLogoChanged(false);
        })
        .catch(() => undefined);
    }
  };

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error("Logo must be a PNG or JPEG image");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo must be 500 KB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(String(reader.result ?? ""));
      setLogoChanged(true);
    };
    reader.onerror = () => toast.error("Could not read the logo file");
    reader.readAsDataURL(file);
  };

  const handleDeleteOrganization = async (confirmName: string) => {
    try {
      await deleteOrganizationData(confirmName);
      toast.success("Organization data deleted. Users and roles were kept.");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete organization");
      throw err;
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Header + save */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">General settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your organization profile, booking rules and payment defaults.</p>
        </div>
        {tab !== "danger" ? (
          <div className="flex items-center gap-2">
            {dirty ? (
              <>
                <span className="hidden items-center gap-1.5 text-[13px] text-muted-foreground sm:flex">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-[#E2B35A]" />
                  Unsaved changes
                </span>
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={saving}
                  className="flex h-10 items-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-white disabled:opacity-50 dark:hover:bg-muted"
                >
                  Discard
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading || !dirty}
              className="flex h-10 items-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-secondary dark:text-secondary-foreground"
            >
              {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : null}
      </div>

      <Segmented label="Settings section" value={tab} onChange={changeTab} options={TABS} />

      {loading ? (
        <Panel>
          <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="grid gap-2">
                <div className="h-3 w-24 animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
                <div className="h-11 animate-pulse rounded-xl bg-[#F3F1EA] dark:bg-muted" />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* ---------------- Organization ---------------- */}
      {!loading && tab === "profile" ? (
        <>
          <Panel icon={Building2} title="Organization profile" description="Shown on reports, invoices, quotations and client emails.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="org-name" label="Organization name" className="sm:col-span-2">
                <Input id="org-name" className={FIELD} value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!form.name.trim()} />
              </Field>
              <Field id="org-email" label="Support email">
                <Input id="org-email" type="email" className={FIELD} value={form.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} />
              </Field>
              <Field id="org-phone" label="Phone number">
                <Input id="org-phone" type="tel" placeholder="+971 4 000 0000" className={FIELD} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field id="org-address" label="Address" className="sm:col-span-2">
                <Input id="org-address" className={FIELD} value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
              <Field id="org-website" label="Website">
                <Input id="org-website" placeholder="www.example.com" className={FIELD} value={form.website} onChange={(e) => set("website", e.target.value)} />
              </Field>
              <Field id="org-trn" label="Tax registration number (TRN)" hint="Shown under your contact details on every invoice and quotation.">
                <Input
                  id="org-trn"
                  inputMode="numeric"
                  placeholder="100000000000003"
                  className={cn(FIELD, "font-mono")}
                  value={form.trn}
                  onChange={(e) => set("trn", e.target.value)}
                />
              </Field>
            </div>
          </Panel>

          <Panel icon={ImageUp} title="Company logo" description="Shown on client agreements and their PDF copies. PNG or JPEG, up to 500 KB.">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-48 items-center justify-center rounded-2xl border border-dashed border-border bg-[#F3F1EA] dark:bg-muted">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- inline data: URL preview
                  <img src={logo} alt="Company logo" className="max-h-16 max-w-44 object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                >
                  <ImageUp aria-hidden="true" className="size-4" />
                  {logo ? "Replace" : "Upload logo"}
                </button>
                {logo ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLogo("");
                      setLogoChanged(true);
                    }}
                    className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Remove
                  </button>
                ) : null}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  handleLogoFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </Panel>
        </>
      ) : null}

      {/* ---------------- Booking & currency ---------------- */}
      {!loading && tab === "booking" ? (
        <>
          <Panel icon={CalendarDays} title="Booking rules" description="Controls which days clients and staff can book.">
            <SwitchRow
              label="Allow Sunday bookings"
              description="Booking availability runs Monday to Sunday. When off, Sundays stay closed."
              checked={form.sundayBookingsEnabled}
              onChange={(v) => set("sundayBookingsEnabled", v)}
            />
          </Panel>

          <Panel title="Currency" description="The default currency for fees, invoices and quotations.">
            <div className="grid gap-5">
              <Field id="org-currency" label="Default currency" className="max-w-sm">
                <Select value={form.currency} onValueChange={(val) => set("currency", String(val))}>
                  <SelectTrigger id="org-currency" className={cn(FIELD, "w-full")}>
                    <SelectValue>{CURRENCIES.find((c) => c.value === form.currency)?.label ?? form.currency}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-2">
                <p className="px-1 text-[13px] font-medium">Conversion rates</p>
                <p className="-mt-1 px-1 text-xs text-muted-foreground">How much of each currency equals 1 USD. Used when a fee is entered in USD.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <RateField id="usd-aed-rate" code="AED" value={form.usdAedRate} onChange={(v) => set("usdAedRate", v)} />
                  <RateField id="usd-gbp-rate" code="GBP" value={form.usdGbpRate} onChange={(v) => set("usdGbpRate", v)} />
                  <RateField id="usd-eur-rate" code="EUR" value={form.usdEurRate} onChange={(v) => set("usdEurRate", v)} />
                </div>
              </div>
            </div>
          </Panel>
        </>
      ) : null}

      {/* ---------------- Payments & tax ---------------- */}
      {!loading && tab === "payments" ? (
        <>
          <Panel icon={CreditCard} title="Online card payments" description="Optional processing fee on the client payment page. You can override it per invoice when sending.">
            <div className="grid gap-5">
              <SwitchRow
                label="Pass processing fee to customer"
                description="The payment page shows the invoice or deposit plus a separate processing-fee line. Only the invoice amount reduces the balance due. Check this complies with your local rules before turning it on."
                checked={form.passStripeFees}
                onChange={(v) => set("passStripeFees", v)}
              />
              <div className={cn("grid gap-5 sm:grid-cols-2", !form.passStripeFees && "opacity-60")}>
                <Field id="proc-fee-percent" label="Processing fee (%)">
                  <Input
                    id="proc-fee-percent"
                    type="number"
                    step="0.1"
                    min={0}
                    className={cn(FIELD, "tabular-nums")}
                    value={form.stripeFeePercent}
                    onChange={(e) => set("stripeFeePercent", e.target.value)}
                  />
                </Field>
                <Field id="proc-fee-fixed" label={`Fixed fee per charge (${form.currency})`}>
                  <Input
                    id="proc-fee-fixed"
                    type="number"
                    step="0.01"
                    min={0}
                    className={cn(FIELD, "tabular-nums")}
                    value={form.stripeFeeFixed}
                    onChange={(e) => set("stripeFeeFixed", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Tax" description="Defaults applied to new quotations. Existing quotations keep their rate.">
            <Field id="default-vat-rate" label="Default VAT rate (%)" className="max-w-xs">
              <Input
                id="default-vat-rate"
                type="number"
                min={0}
                step="0.01"
                className={cn(FIELD, "tabular-nums")}
                value={form.defaultVatRate}
                onChange={(e) => set("defaultVatRate", e.target.value)}
              />
            </Field>
          </Panel>
        </>
      ) : null}

      {/* ---------------- Danger zone ---------------- */}
      {!loading && tab === "danger" ? (
        <section className="flex flex-col gap-4 rounded-[26px] bg-white p-5 ring-1 ring-destructive/25 sm:p-6 dark:bg-card">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="text-[17px] font-medium text-destructive">Delete organization data</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Permanently deletes all clients, examinees, appointments, exams, leads, forms and audit logs. Staff accounts, roles and exam types are
                kept. This can&apos;t be undone.
              </p>
            </div>
          </div>
          <div className="pl-12">
            <DeleteConfirmDialog
              title="Delete organization data"
              description={`Type "${saved.name || "your organization name"}" to confirm. This cannot be undone.`}
              confirmLabel="Type organization name to confirm"
              expectedValue={saved.name}
              triggerLabel="Delete organization data"
              onConfirm={async (typed) => {
                if (!typed) return;
                await handleDeleteOrganization(typed);
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Panel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-[26px] bg-white p-5 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-6 dark:bg-card">
      {title ? (
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground">
              <Icon aria-hidden="true" className="size-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium tracking-[-0.01em]">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
}

function Field({ id, label, hint, className, children }: { id: string; label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={id} className="px-1 text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="px-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RateField({ id, code, value, onChange }: { id: string; code: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#F7F6F1] p-3 dark:bg-muted/40">
      <label htmlFor={id} className="shrink-0 text-[13px] text-muted-foreground">
        1 USD =
      </label>
      <div className="relative min-w-0 flex-1">
        <Input
          id={id}
          type="number"
          step="0.0001"
          min={0}
          className={cn(FIELD, "bg-white pr-12 tabular-nums dark:bg-card")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{code}</span>
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </label>
        {description ? <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          checked ? "bg-[#30302E] dark:bg-[#5FA86C]" : "bg-[#D9D5CA] dark:bg-zinc-600",
        )}
      >
        <span
          aria-hidden="true"
          className={cn("absolute top-0.5 left-0.5 block size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0")}
        />
      </button>
    </div>
  );
}
