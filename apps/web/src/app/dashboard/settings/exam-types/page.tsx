"use client";

import * as React from "react";
import { ClipboardList, Clock3, Eye, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/dashboard/ui-kit";
import {
  createExamType,
  deleteExamType,
  fetchExamTypes,
  updateExamType,
  type ExamTypeRecord,
} from "@/lib/exam-booking";
import { formatMoney, catalogPriceInCurrency, CATALOG_PRICE_CURRENCY } from "@/lib/client-account";
import { fetchOrganizationSettings, type OrganizationSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  description: string;
  category: string;
  duration: string;
  /** What the user typed, in `priceCurrency`. */
  price: string;
  active: boolean;
};

type StatusFilter = "all" | "active" | "inactive";

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const DURATION_PRESETS = [60, 90, 120, 150, 180];

const emptyForm: FormState = {
  name: "",
  description: "",
  category: "",
  duration: "150",
  price: "",
  active: true,
};

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Turn a price typed in the org currency into the USD catalog price.
 * Billing converts USD → org currency and rounds UP to a whole unit, so pick
 * the cent value that bills back to exactly what was typed.
 */
function usdForLocalPrice(local: number, currency: string, rates: OrganizationSettings) {
  if (local <= 0) return 0;
  const rate = currency === "AED" ? rates.usd_aed_rate ?? 3.6725 : currency === "GBP" ? rates.usd_gbp_rate ?? 0.785 : currency === "EUR" ? rates.usd_eur_rate ?? 0.925 : 1;
  let usd = Math.round((local / rate) * 100) / 100;
  for (let i = 0; i < 5 && catalogPriceInCurrency(usd, currency, rates) > Math.ceil(local); i += 1) usd = Math.round((usd - 0.01) * 100) / 100;
  for (let i = 0; i < 5 && catalogPriceInCurrency(usd, currency, rates) < Math.ceil(local); i += 1) usd = Math.round((usd + 0.01) * 100) / 100;
  return usd;
}

export default function ExamTypesSettingsPage() {
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"view" | "edit">("edit");
  const [viewing, setViewing] = React.useState<ExamTypeRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [orgCurrency, setOrgCurrency] = React.useState("AED");
  const [orgSettings, setOrgSettings] = React.useState<OrganizationSettings | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [priceCurrency, setPriceCurrency] = React.useState<string>(CATALOG_PRICE_CURRENCY);
  const [deleting, setDeleting] = React.useState<ExamTypeRecord | null>(null);
  const [deletingBusy, setDeletingBusy] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  const loadExamTypes = React.useCallback(async () => {
    try {
      setError(null);
      setExamTypes(await fetchExamTypes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exam types");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadExamTypes();
    void (async () => {
      try {
        const org = await fetchOrganizationSettings();
        setOrgSettings(org);
        if (org.currency) setOrgCurrency(org.currency);
      } catch {
        // Without org settings we just show USD.
      }
    })();
  }, [loadExamTypes]);

  const showLocal = orgCurrency !== CATALOG_PRICE_CURRENCY && orgSettings !== null;
  const localPrice = React.useCallback(
    (usd: number) => (orgSettings ? catalogPriceInCurrency(usd, orgCurrency, orgSettings) : usd),
    [orgCurrency, orgSettings],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const openView = (examType: ExamTypeRecord) => {
    setViewing(examType);
    setMode("view");
    setOpen(true);
  };

  const openCreate = () => {
    setMode("edit");
    setViewing(null);
    setEditingId(null);
    setForm(emptyForm);
    setPriceCurrency(showLocal ? orgCurrency : CATALOG_PRICE_CURRENCY);
    setOpen(true);
  };

  const openEdit = (examType: ExamTypeRecord) => {
    setMode("edit");
    setViewing(examType);
    setEditingId(examType.id);
    setForm({
      name: examType.name,
      description: examType.description || "",
      category: examType.category || "",
      duration: String(examType.duration),
      price: String(examType.price ?? 0),
      active: examType.active,
    });
    // Editing starts from the stored USD value so nothing shifts unless the price is changed.
    setPriceCurrency(CATALOG_PRICE_CURRENCY);
    setOpen(true);
  };

  /** Switch the price field's currency, converting what's typed. */
  const changePriceCurrency = (next: string) => {
    if (next === priceCurrency || !orgSettings) return;
    const typed = Number(form.price);
    if (form.price !== "" && Number.isFinite(typed)) {
      const converted = next === CATALOG_PRICE_CURRENCY ? usdForLocalPrice(typed, orgCurrency, orgSettings) : localPrice(typed);
      set("price", String(converted));
    }
    setPriceCurrency(next);
  };

  const typedPrice = Number(form.price);
  const usdPrice =
    form.price === "" || !Number.isFinite(typedPrice)
      ? NaN
      : priceCurrency === CATALOG_PRICE_CURRENCY || !orgSettings
        ? typedPrice
        : usdForLocalPrice(typedPrice, orgCurrency, orgSettings);

  const handleSave = async () => {
    const duration = Number(form.duration);
    if (!form.name.trim()) {
      toast.error("Exam type name is required");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Duration must be greater than 0");
      return;
    }
    if (!Number.isFinite(usdPrice) || usdPrice < 0) {
      toast.error("Enter a price of 0 or more");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      duration,
      price: usdPrice,
      active: form.active,
    };

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateExamType(editingId, payload);
        setExamTypes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Exam type updated");
        setViewing(updated);
        setMode("view");
        return;
      } else {
        const created = await createExamType(payload);
        setExamTypes((current) => [...current, created]);
        toast.success("Exam type created");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save exam type");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (examType: ExamTypeRecord) => {
    setTogglingId(examType.id);
    try {
      const updated = await updateExamType(examType.id, {
        name: examType.name,
        description: examType.description || "",
        category: examType.category || "",
        duration: examType.duration,
        price: examType.price ?? 0,
        active: !examType.active,
      });
      setExamTypes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.active ? `${updated.name} is bookable again` : `${updated.name} hidden from new bookings`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update exam type");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteExamType(deleting.id);
      setExamTypes((current) => current.filter((item) => item.id !== deleting.id));
      toast.success("Exam type deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete exam type");
    } finally {
      setDeletingBusy(false);
    }
  };

  const counts = React.useMemo(
    () => ({
      all: examTypes.length,
      active: examTypes.filter((t) => t.active).length,
      inactive: examTypes.filter((t) => !t.active).length,
    }),
    [examTypes],
  );

  const needle = search.trim().toLowerCase();
  const visible = React.useMemo(
    () =>
      examTypes
        .filter((t) => (status === "all" ? true : status === "active" ? t.active : !t.active))
        .filter((t) => !needle || [t.name, t.category ?? "", t.description ?? ""].some((v) => v.toLowerCase().includes(needle)))
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    [examTypes, status, needle],
  );

  const categories = React.useMemo(
    () => [...new Set(examTypes.map((t) => t.category?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [examTypes],
  );

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">Exam types</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The examinations clients can book. Prices are stored in USD
            {showLocal ? <> and billed in {orgCurrency}, converted once when an invoice or booking is created</> : null}.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-2 self-start rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] sm:self-auto dark:bg-secondary dark:text-secondary-foreground"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add exam type
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-3 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-4 lg:flex-row lg:items-center lg:justify-between dark:bg-card">
        <Segmented
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "active", label: "Bookable", count: counts.active },
            { value: "inactive", label: "Hidden", count: counts.inactive },
          ]}
        />
        <div className="relative w-full lg:w-80">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search exam types"
            placeholder="Search name, category or description"
            className={cn(FIELD, "rounded-full pr-10 pl-10")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
        {/* Column headings (desktop) */}
        <div className="hidden grid-cols-[minmax(0,1fr)_7.5rem_11rem_9.5rem_8.5rem] items-center gap-6 border-b border-border/50 px-7 py-3.5 text-xs font-medium text-muted-foreground lg:grid">
          <span>Exam type</span>
          <span>Duration</span>
          <span className="text-right">Price</span>
          <span>Bookable</span>
          <span className="sr-only">Actions</span>
        </div>

        {loading ? (
          <ul aria-hidden="true" className="divide-y divide-border/50">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
                  <div className="h-3 w-72 max-w-full animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
                </div>
                <div className="h-4 w-20 animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadExamTypes();
              }}
              className="flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
              <ClipboardList aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">
              {examTypes.length === 0 ? "No exam types yet. Add one so clients can book it." : "No exam types match these filters."}
            </p>
            {examTypes.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
                className="flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {visible.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-5 py-5 transition-colors hover:bg-[#FAF9F5] sm:px-7 lg:grid-cols-[minmax(0,1fr)_7.5rem_11rem_9.5rem_8.5rem] dark:hover:bg-muted/30",
                  !t.active && "bg-[#FAF9F5]/60 dark:bg-muted/10",
                )}
              >
                {/* Name, category, description */}
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openView(t)}
                      className={cn("truncate text-left text-[15px] font-medium hover:underline", !t.active && "text-muted-foreground")}
                    >
                      {t.name}
                    </button>
                    {t.category ? (
                      <span className="shrink-0 rounded-full bg-[#F3F1EA] px-2 py-0.5 text-xs text-[#3D3929] dark:bg-muted dark:text-foreground">{t.category}</span>
                    ) : null}
                  </div>
                  <p className={cn("mt-1 line-clamp-1 text-[13px]", t.description ? "text-muted-foreground" : "text-muted-foreground/60 italic")} title={t.description || undefined}>
                    {t.description || "No description"}
                  </p>
                </div>

                {/* Actions (mobile: top right) */}
                <div className="flex items-center justify-end gap-1 lg:order-last">
                  <IconButton label={`View ${t.name}`} onClick={() => openView(t)}>
                    <Eye aria-hidden="true" className="size-4" />
                  </IconButton>
                  <IconButton label={`Edit ${t.name}`} onClick={() => openEdit(t)}>
                    <Pencil aria-hidden="true" className="size-4" />
                  </IconButton>
                  <IconButton label={`Delete ${t.name}`} onClick={() => setDeleting(t)} danger>
                    <Trash2 aria-hidden="true" className="size-4" />
                  </IconButton>
                </div>

                {/* Meta row on mobile, columns on desktop */}
                <div className="col-span-2 flex flex-wrap items-center gap-x-8 gap-y-3 lg:contents">
                  <span className="flex items-center gap-1.5 text-sm tabular-nums">
                    <Clock3 aria-hidden="true" className="size-3.5 text-muted-foreground lg:hidden" />
                    {formatDuration(t.duration)}
                  </span>
                  <span className="flex flex-col gap-0.5 text-sm tabular-nums lg:items-end">
                    {showLocal ? (
                      <>
                        <span className="font-medium">{formatMoney(localPrice(t.price ?? 0), orgCurrency)}</span>
                        <span className="text-xs text-muted-foreground">{formatMoney(t.price ?? 0, CATALOG_PRICE_CURRENCY)}</span>
                      </>
                    ) : (
                      <span className="font-medium">{formatMoney(t.price ?? 0, CATALOG_PRICE_CURRENCY)}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <Switch
                      checked={t.active}
                      disabled={togglingId === t.id}
                      onChange={() => void toggleActive(t)}
                      label={t.active ? `Hide ${t.name} from new bookings` : `Make ${t.name} bookable`}
                    />
                    <span className="text-xs text-muted-foreground">{t.active ? "Bookable" : "Hidden"}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* View / add / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-4xl sm:rounded-[28px] dark:bg-card">
          {/* Header */}
          <div className="flex shrink-0 items-start gap-4 border-b border-border/50 px-6 pt-6 pb-5 pr-14 sm:px-8 sm:pt-7">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground">
              <ClipboardList aria-hidden="true" className="size-5" />
            </span>
            <DialogHeader className="min-w-0 gap-1 text-left">
              <DialogTitle className="truncate text-xl font-medium tracking-[-0.01em]">
                {mode === "view" && viewing ? viewing.name : editingId ? "Edit exam type" : "Add exam type"}
              </DialogTitle>
              <DialogDescription className="text-[13px]">
                {mode === "view" && viewing ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {viewing.category ? (
                      <span className="rounded-full bg-[#F3F1EA] px-2 py-0.5 text-xs text-[#3D3929] dark:bg-muted dark:text-foreground">{viewing.category}</span>
                    ) : null}
                    <StatusChip active={viewing.active} />
                  </span>
                ) : (
                  "Changes apply to new bookings and invoices. Existing ones keep their price."
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            {mode === "view" && viewing ? (
              <div className="grid gap-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <ViewTile label="Price">
                    {showLocal ? (
                      <>
                        <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">{formatMoney(localPrice(viewing.price ?? 0), orgCurrency)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">Stored as {formatMoney(viewing.price ?? 0, CATALOG_PRICE_CURRENCY)}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">{formatMoney(viewing.price ?? 0, CATALOG_PRICE_CURRENCY)}</span>
                    )}
                  </ViewTile>
                  <ViewTile label="Duration">
                    <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">{formatDuration(viewing.duration)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{viewing.duration} minutes per session</span>
                  </ViewTile>
                  <ViewTile label="Booking">
                    <span className="text-2xl font-medium tracking-[-0.02em]">{viewing.active ? "Bookable" : "Hidden"}</span>
                    <span className="text-xs text-muted-foreground">{viewing.active ? "Offered on new bookings" : "Not offered on new bookings"}</span>
                  </ViewTile>
                </div>
                <div className="grid gap-2">
                  <h3 className="px-1 text-[13px] font-medium">Description</h3>
                  <p
                    className={cn(
                      "rounded-2xl bg-[#F7F6F1] p-4 text-sm leading-relaxed whitespace-pre-wrap dark:bg-muted/40",
                      !viewing.description && "text-muted-foreground italic",
                    )}
                  >
                    {viewing.description || "No description yet. Add one so staff know when to use this exam type."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-8">
                {/* Left: what it is */}
                <div className="grid content-start gap-5">
                  <Field id="exam-type-name" label="Name">
                    <Input id="exam-type-name" className={FIELD} value={form.name} onChange={(e) => set("name", e.target.value)} />
                  </Field>
                  <Field id="exam-type-category" label="Category" optional>
                    <Input
                      id="exam-type-category"
                      list="exam-type-categories"
                      placeholder="Screening, Legal, Investigation…"
                      className={FIELD}
                      value={form.category}
                      onChange={(e) => set("category", e.target.value)}
                    />
                    <datalist id="exam-type-categories">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </Field>
                  <Field id="exam-type-description" label="Description" optional>
                    <Textarea
                      id="exam-type-description"
                      className="min-h-44 rounded-xl border-0 bg-[#F3F1EA] px-3.5 py-3 text-sm shadow-none dark:bg-muted"
                      placeholder="When staff should use this exam type, what's included, any pricing notes…"
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                    />
                  </Field>
                </div>

                {/* Right: price, duration, availability */}
                <div className="grid content-start gap-5">
                  <div className="grid gap-3 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="exam-type-price" className="text-[13px] font-medium">
                        Price
                      </label>
                      {showLocal ? (
                        <Segmented
                          label="Enter price in"
                          value={priceCurrency}
                          onChange={changePriceCurrency}
                          options={[
                            { value: orgCurrency, label: orgCurrency },
                            { value: CATALOG_PRICE_CURRENCY, label: CATALOG_PRICE_CURRENCY },
                          ]}
                          className="bg-white dark:bg-card [&_button]:h-7 [&_button]:px-3 [&_button]:text-xs"
                        />
                      ) : null}
                    </div>
                    <div className="relative">
                      <Input
                        id="exam-type-price"
                        type="number"
                        min={0}
                        step={priceCurrency === CATALOG_PRICE_CURRENCY ? 0.01 : 1}
                        placeholder="0"
                        className={cn(FIELD, "h-12 bg-white pr-14 text-base tabular-nums dark:bg-card")}
                        value={form.price}
                        onChange={(e) => set("price", e.target.value)}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{priceCurrency}</span>
                    </div>
                    {showLocal && orgSettings && Number.isFinite(usdPrice) ? (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {priceCurrency === CATALOG_PRICE_CURRENCY ? (
                          <>Bills as {formatMoney(localPrice(usdPrice), orgCurrency)}</>
                        ) : (
                          <>
                            Stored as {formatMoney(usdPrice, CATALOG_PRICE_CURRENCY)} · bills as {formatMoney(localPrice(usdPrice), orgCurrency)}
                          </>
                        )}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="exam-type-duration" className="px-1 text-[13px] font-medium">
                      Duration
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {DURATION_PRESETS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => set("duration", String(m))}
                          aria-pressed={Number(form.duration) === m}
                          className={cn(
                            "h-10 rounded-xl text-[13px] tabular-nums transition-colors",
                            Number(form.duration) === m
                              ? "bg-[#30302E] font-medium text-[#FAF9F5] dark:bg-[#ECE9E0] dark:text-[#1A1915]"
                              : "bg-[#F3F1EA] hover:bg-[#E9E6DD] dark:bg-muted dark:hover:bg-muted/70",
                          )}
                        >
                          {formatDuration(m)}
                        </button>
                      ))}
                      <div className="relative">
                        <Input
                          id="exam-type-duration"
                          type="number"
                          min={15}
                          step={15}
                          aria-label="Custom duration in minutes"
                          className={cn(
                            FIELD,
                            "h-10 pr-10 text-[13px] tabular-nums",
                            !DURATION_PRESETS.includes(Number(form.duration)) && "ring-2 ring-[#30302E] dark:ring-[#ECE9E0]",
                          )}
                          value={form.duration}
                          onChange={(e) => set("duration", e.target.value)}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                    <p className="px-1 text-xs text-muted-foreground">Pick a preset or type minutes. Used to block the examiner&apos;s calendar.</p>
                  </div>

                  <div className="flex items-start justify-between gap-4 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Bookable</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">When off, it&apos;s hidden from new bookings. Existing bookings are unaffected.</p>
                    </div>
                    <Switch checked={form.active} onChange={() => set("active", !form.active)} label="Bookable" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            {mode === "view" && viewing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setDeleting(viewing);
                  }}
                  className="flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Delete
                </button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(viewing)}
                    className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] dark:bg-[#ECE9E0] dark:text-[#1A1915] dark:hover:bg-white"
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                    Edit
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="hidden text-xs text-muted-foreground sm:block">{editingId ? "Editing an existing exam type" : "New exam type"}</span>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      // From edit, go back to the read-only view; from add, just close.
                      const original = editingId ? examTypes.find((t) => t.id === editingId) : undefined;
                      if (original) {
                        setViewing(original);
                        setMode("view");
                      } else {
                        setOpen(false);
                      }
                    }}
                    className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || !form.name.trim()}
                    className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-[#ECE9E0] dark:text-[#1A1915] dark:hover:bg-white"
                  >
                    {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                    {saving ? "Saving…" : editingId ? "Save changes" : "Add exam type"}
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent className="rounded-[26px]">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              It will no longer appear anywhere new. If you just want to stop new bookings, turn off Bookable instead — that keeps its history tidy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            {deleting?.active ? (
              <button
                type="button"
                onClick={() => {
                  const target = deleting;
                  setDeleting(null);
                  void toggleActive(target);
                }}
                className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] sm:mr-auto dark:hover:bg-muted"
              >
                Hide instead
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deletingBusy}
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {deletingBusy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Field({ id, label, hint, optional, children }: { id: string; label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="px-1 text-[13px] font-medium">
        {label}
        {optional ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
      </label>
      {children}
      {hint ? <p className="px-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors",
        danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-60",
        checked ? "bg-[#30302E] dark:bg-[#5FA86C]" : "bg-[#D9D5CA] dark:bg-zinc-600",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute top-0.5 left-0.5 block size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0")}
      />
    </button>
  );
}

function ViewTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        active ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" : "bg-[#ECE9E0] text-[#3D3929] dark:bg-muted dark:text-foreground",
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", active ? "bg-[#3F7A37] dark:bg-emerald-400" : "bg-[#8B887E]")} />
      {active ? "Bookable" : "Hidden"}
    </span>
  );
}
