"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  Hash,
  Hourglass,
  Loader2,
  MapPin,
  Package,
  PenLine,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { GlassStat, GlowPanel, Highlight, Segmented } from "@/components/dashboard/ui-kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createInventoryItem,
  deleteInventoryItem,
  fetchInventoryItems,
  updateInventoryItem,
  type InventoryItem,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Equipment", "Sensor", "Computer", "Supply", "Other"] as const;
const STATUSES = ["Active", "Maintenance", "Expired", "Retired"] as const;
type StatusFilter = "All" | (typeof STATUSES)[number];

/** Dates within this many days count as "due soon". */
const SOON_DAYS = 30;

type DateState = "none" | "ok" | "soon" | "late";

type FormState = {
  name: string;
  serial_number: string;
  category: string;
  status: string;
  quantity: number;
  location: string;
  purchase_date: string;
  warranty_expiry: string;
  calibration_due: string;
  expiration_date: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  serial_number: "",
  category: "Equipment",
  status: "Active",
  quantity: 1,
  location: "",
  purchase_date: "",
  warranty_expiry: "",
  calibration_due: "",
  expiration_date: "",
  notes: "",
};

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function dateState(dateStr?: string): DateState {
  const days = daysUntil(dateStr);
  if (days === null) return "none";
  if (days < 0) return "late";
  if (days <= SOON_DAYS) return "soon";
  return "ok";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "In 12 days", "Today", "3 days ago". */
function relativeDays(dateStr?: string, lateWord = "overdue"): string {
  const days = daysUntil(dateStr);
  if (days === null) return "Not tracked";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  const ago = Math.abs(days);
  return `${ago} day${ago === 1 ? "" : "s"} ${lateWord}`;
}

const toInputDate = (iso?: string) => (iso ? iso.split("T")[0] : "");
const toIso = (value: string) => (value ? new Date(value).toISOString() : undefined);

function formToPayload(form: FormState) {
  return {
    name: form.name.trim(),
    serial_number: form.serial_number.trim(),
    category: form.category,
    status: form.status,
    quantity: form.quantity,
    location: form.location.trim(),
    purchase_date: toIso(form.purchase_date),
    warranty_expiry: toIso(form.warranty_expiry),
    calibration_due: toIso(form.calibration_due),
    expiration_date: toIso(form.expiration_date),
    notes: form.notes.trim(),
  };
}

/**
 * The API's PATCH replaces every field (omitted ones are cleared), so quick
 * actions must resend the whole item with only their change applied.
 */
function itemPayload(item: InventoryItem, changes: Partial<FormState> = {}) {
  return {
    name: item.name,
    serial_number: item.serial_number || "",
    category: item.category,
    status: item.status,
    quantity: item.quantity,
    location: item.location || "",
    purchase_date: item.purchase_date,
    warranty_expiry: item.warranty_expiry,
    calibration_due: item.calibration_due,
    expiration_date: item.expiration_date,
    notes: item.notes || "",
    ...changes,
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function InventoryPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();

  React.useEffect(() => {
    if (!userLoading && !can("user:view")) {
      toast.error("You don't have permission to access this page.");
      router.replace("/dashboard");
    }
  }, [userLoading, can, router]);

  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  // Skeletons only on the first load; a refresh keeps the current data on screen.
  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const firstLoad = loading && !loadedOnce;
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("All");
  const [status, setStatus] = React.useState<StatusFilter>("All");

  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [formMode, setFormMode] = React.useState<"new" | "edit" | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);

  // The catalogue is small: load it once and filter in the browser, so the
  // stats always describe the whole inventory and typing doesn't refetch.
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchInventoryItems());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selected = React.useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  const stats = React.useMemo(() => {
    let units = 0;
    let calibration = 0;
    let calibrationLate = 0;
    let expiring = 0;
    let expired = 0;
    let maintenance = 0;
    for (const item of items) {
      units += item.quantity;
      if (item.status === "Maintenance") maintenance += 1;
      const cal = dateState(item.calibration_due);
      if (cal === "soon" || cal === "late") calibration += 1;
      if (cal === "late") calibrationLate += 1;
      const exp = dateState(item.expiration_date);
      if (exp === "soon" || exp === "late") expiring += 1;
      if (exp === "late") expired += 1;
    }
    return { units, calibration, calibrationLate, expiring, expired, maintenance };
  }, [items]);

  const needle = search.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      items.filter((item) => {
        if (category !== "All" && item.category !== category) return false;
        if (status !== "All" && item.status !== status) return false;
        if (!needle) return true;
        return [item.name, item.serial_number, item.location, item.category].some((v) => v?.toLowerCase().includes(needle));
      }),
    [items, category, status, needle],
  );

  const statusOptions = React.useMemo(
    () => [
      { value: "All" as StatusFilter, label: "All", count: items.length },
      ...STATUSES.map((s) => ({ value: s as StatusFilter, label: s, count: items.filter((i) => i.status === s).length })),
    ],
    [items],
  );

  /* ---------------- actions ---------------- */

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormMode("new");
  };

  const openEdit = (item: InventoryItem) => {
    setForm({
      name: item.name,
      serial_number: item.serial_number || "",
      category: item.category || "Equipment",
      status: item.status || "Active",
      quantity: item.quantity,
      location: item.location || "",
      purchase_date: toInputDate(item.purchase_date),
      warranty_expiry: toInputDate(item.warranty_expiry),
      calibration_due: toInputDate(item.calibration_due),
      expiration_date: toInputDate(item.expiration_date),
      notes: item.notes || "",
    });
    setFormMode("edit");
  };

  const replaceItem = (updated: InventoryItem) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Give the asset a name");
      return;
    }
    setSaving(true);
    try {
      if (formMode === "edit" && selected) {
        replaceItem(await updateInventoryItem(selected.id, formToPayload(form)));
        toast.success("Asset updated");
      } else {
        const created = await createInventoryItem(formToPayload(form));
        setItems((prev) => [created, ...prev]);
        toast.success("Asset added");
      }
      setFormMode(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the asset");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    try {
      await deleteInventoryItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedId(null);
      toast.success(`${item.name} deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the asset");
      throw err;
    }
  };

  const logCalibration = async (item: InventoryItem) => {
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);
    setBusyAction("calibration");
    try {
      replaceItem(await updateInventoryItem(item.id, itemPayload(item, { calibration_due: next.toISOString() })));
      toast.success(`Calibration logged · next due ${formatDate(next.toISOString())}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log the calibration");
    } finally {
      setBusyAction(null);
    }
  };

  const changeStatus = async (item: InventoryItem, next: string) => {
    setBusyAction("status");
    try {
      replaceItem(await updateInventoryItem(item.id, itemPayload(item, { status: next })));
      toast.success(next === "Maintenance" ? `${item.name} sent for service` : `${item.name} marked ${next.toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the status");
    } finally {
      setBusyAction(null);
    }
  };

  if (userLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 aria-hidden="true" className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const filtersActive = needle !== "" || category !== "All" || status !== "All";

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-10">
      {/* Hero */}
      <GlowPanel tone="sage" orb="70%" lineTop={40} className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 pt-6 sm:gap-8 sm:pt-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
                <Package aria-hidden="true" className="size-4" />
                Inventory
              </span>
              <h1 className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] sm:text-[44px]">
                Equipment &amp; <span className="font-semibold">supplies</span>
              </h1>
              <p className="max-w-xl text-[15px] text-[#C9C6BC]">
                Track instrument calibration, warranties and the shelf life of consumables, so nothing lapses before an exam.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                aria-label="Refresh"
                title="Refresh"
                className="flex size-11 items-center justify-center rounded-full bg-white/[0.07] text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:opacity-50"
              >
                <RefreshCcw aria-hidden="true" className={cn("size-4", loading && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={openNew}
                className="flex h-11 items-center gap-2 rounded-full bg-[#FAF9F5] px-5 text-sm font-semibold text-[#1E1D1B] transition-colors hover:bg-white"
              >
                <Plus aria-hidden="true" className="size-4" />
                Add asset
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GlassStat
              label="Assets"
              value={items.length}
              hint={`${stats.units.toLocaleString()} unit${stats.units === 1 ? "" : "s"} in stock`}
              icon={Package}
              accent="ink"
              loading={firstLoad}
            />
            <GlassStat
              label="Calibration due"
              value={stats.calibration}
              hint={stats.calibrationLate ? `${stats.calibrationLate} overdue` : `Next ${SOON_DAYS} days`}
              icon={CalendarClock}
              accent={stats.calibrationLate ? "terracotta" : "amber"}
              loading={firstLoad}
            />
            <GlassStat
              label="Supplies expiring"
              value={stats.expiring}
              hint={stats.expired ? `${stats.expired} already expired` : `Next ${SOON_DAYS} days`}
              icon={Hourglass}
              accent={stats.expired ? "terracotta" : "amber"}
              loading={firstLoad}
            />
            <GlassStat label="In service" value={stats.maintenance} hint="Out for maintenance" icon={Wrench} accent="lavender" loading={firstLoad} />
          </div>
        </div>
      </GlowPanel>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-3 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-4 lg:flex-row lg:items-center lg:justify-between dark:bg-card">
        <Segmented label="Status" value={status} onChange={setStatus} options={statusOptions} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={category} onValueChange={(v) => setCategory(v as string)}>
            <SelectTrigger aria-label="Category" className="h-11 w-full min-w-40 rounded-full border-0 bg-[#F3F1EA] px-4 text-sm shadow-none sm:w-auto dark:bg-muted">
              <SelectValue>{category === "All" ? "All categories" : category}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-80">
            <label htmlFor="inventory-search" className="sr-only">
              Search assets
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="inventory-search"
              placeholder="Search name, serial or location…"
              className="h-11 rounded-full border-0 bg-[#F3F1EA] pr-10 pl-11 text-sm shadow-none dark:bg-muted"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[#F6E3E1] px-4 py-3 text-sm text-[#8A2C22] dark:bg-red-950 dark:text-red-300">
          <span className="flex items-center gap-2">
            <AlertCircle aria-hidden="true" className="size-4" />
            {error}
          </span>
          <button type="button" onClick={() => void load()} className="font-medium underline-offset-4 hover:underline">
            Try again
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/50 text-[13px] text-muted-foreground">
                {["Asset", "Location", "Status", "Calibration", "Shelf life", "Warranty"].map((c) => (
                  <th key={c} className="px-6 pt-5 pb-3 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {firstLoad ? (
                [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-3.5">
                      <div className="h-10 animate-pulse rounded-xl bg-muted" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    {filtersActive ? (
                      <>
                        <p className="text-[15px] font-medium">No assets match these filters</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setCategory("All");
                            setStatus("All");
                          }}
                          className="mt-2 text-sm text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary"
                        >
                          Clear filters
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-[15px] font-medium">No assets yet</p>
                        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                          Add your polygraph instruments, sensors and consumables to get calibration and expiry warnings.
                        </p>
                        <button type="button" onClick={openNew} className="mt-2 text-sm text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary">
                          Add the first asset
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    aria-label={`Open ${item.name}`}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(item.id);
                      }
                    }}
                    className="cursor-pointer transition-colors outline-none hover:bg-[#FAF9F5] focus-visible:bg-[#FAF9F5] dark:hover:bg-muted/40 dark:focus-visible:bg-muted/40"
                  >
                    <td className="max-w-[320px] px-6 py-4">
                      <span className="flex items-center gap-3">
                        <CategoryBadge category={item.category} />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium">
                            <Highlight text={item.name} query={search} />
                          </span>
                          <span className="truncate text-[13px] text-muted-foreground">
                            {item.category}
                            {item.serial_number ? (
                              <>
                                {" · "}
                                <span className="font-mono text-xs">
                                  <Highlight text={item.serial_number} query={search} />
                                </span>
                              </>
                            ) : null}
                            {" · "}
                            <QuantityText quantity={item.quantity} />
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.location ? (
                        <Highlight text={item.location} query={search} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <AssetStatusPill status={item.status} />
                    </td>
                    <td className="px-6 py-4">
                      <DateCell date={item.calibration_due} lateWord="overdue" />
                    </td>
                    <td className="px-6 py-4">
                      <DateCell date={item.expiration_date} lateWord="past expiry" />
                    </td>
                    <td className="px-6 py-4">
                      <DateCell date={item.warranty_expiry} lateWord="ago" soonIsCalm />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!firstLoad && items.length > 0 ? (
          <div className="border-t border-border/50 px-6 py-3.5 text-[13px] text-muted-foreground">
            {filtered.length} of {items.length} assets
          </div>
        ) : null}
      </div>

      {/* Asset detail */}
      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full gap-0 overflow-hidden border-l border-border/50 bg-white p-0 shadow-2xl sm:max-w-[520px] dark:bg-card [&_[data-slot=sheet-close]]:top-5 [&_[data-slot=sheet-close]]:right-5 [&_[data-slot=sheet-close]]:z-30 [&_[data-slot=sheet-close]]:flex [&_[data-slot=sheet-close]]:size-9 [&_[data-slot=sheet-close]]:items-center [&_[data-slot=sheet-close]]:justify-center [&_[data-slot=sheet-close]]:rounded-full [&_[data-slot=sheet-close]]:bg-white/10! [&_[data-slot=sheet-close]]:text-[#FAF9F5] [&_[data-slot=sheet-close]]:opacity-100 [&_[data-slot=sheet-close]]:ring-1 [&_[data-slot=sheet-close]]:ring-white/15">
          {selected ? (
            <div className="flex h-full flex-col">
              <GlowPanel tone="sage" orb="65%" lineTop={0} className="shrink-0 rounded-none px-6 pt-6 pb-5 shadow-none ring-0 sm:px-7">
                <div className="flex flex-col gap-3 pr-12">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-[#ECE9E0] ring-1 ring-white/15">{selected.category}</span>
                    <AssetStatusPill status={selected.status} onDark />
                  </div>
                  <SheetTitle className="text-2xl leading-tight font-medium tracking-[-0.02em] text-[#FAF9F5]">{selected.name}</SheetTitle>
                  <SheetDescription className="text-sm text-[#C9C6BC]">
                    {selected.serial_number ? <span className="font-mono">S/N {selected.serial_number}</span> : "No serial number"}
                    {" · "}
                    <QuantityText quantity={selected.quantity} />
                  </SheetDescription>
                </div>
              </GlowPanel>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
                  {/* Dates that need attention */}
                  <section className="flex flex-col gap-2">
                    <h3 className="px-1 text-[13px] font-medium text-muted-foreground">Tracking</h3>
                    <div className="divide-y divide-border/50 overflow-hidden rounded-2xl ring-1 ring-border/60">
                      <TrackingRow icon={CalendarClock} label="Calibration due" date={selected.calibration_due} lateWord="overdue" />
                      <TrackingRow icon={Hourglass} label="Shelf life" date={selected.expiration_date} lateWord="past expiry" />
                      <TrackingRow icon={ShieldCheck} label="Warranty ends" date={selected.warranty_expiry} lateWord="ago" soonIsCalm />
                    </div>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h3 className="px-1 text-[13px] font-medium text-muted-foreground">Details</h3>
                    <dl className="grid grid-cols-[132px_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-2xl bg-[#F7F6F1] p-4 text-sm dark:bg-muted/40">
                      <DetailTerm icon={MapPin} label="Location" />
                      <dd className={cn(!selected.location && "text-muted-foreground")}>{selected.location || "Not set"}</dd>
                      <DetailTerm icon={Hash} label="Quantity" />
                      <dd>
                        <QuantityText quantity={selected.quantity} />
                      </dd>
                      <DetailTerm icon={CalendarCheck} label="Purchased" />
                      <dd className={cn(!selected.purchase_date && "text-muted-foreground")}>{formatDate(selected.purchase_date)}</dd>
                    </dl>
                  </section>

                  {selected.notes ? (
                    <section className="flex flex-col gap-2">
                      <h3 className="px-1 text-[13px] font-medium text-muted-foreground">Notes</h3>
                      <p className="rounded-2xl bg-[#F7F6F1] p-4 text-sm leading-relaxed whitespace-pre-wrap dark:bg-muted/40">{selected.notes}</p>
                    </section>
                  ) : null}

                  <section className="flex flex-col gap-2">
                    <h3 className="px-1 text-[13px] font-medium text-muted-foreground">Quick actions</h3>
                    <div className="flex flex-wrap gap-2">
                      {selected.calibration_due ? (
                        <QuickAction
                          icon={CalendarCheck}
                          label="Log calibration done"
                          hint="Next due in 1 year"
                          busy={busyAction === "calibration"}
                          onClick={() => void logCalibration(selected)}
                        />
                      ) : null}
                      {selected.status !== "Maintenance" ? (
                        <QuickAction icon={Wrench} label="Send for service" busy={busyAction === "status"} onClick={() => void changeStatus(selected, "Maintenance")} />
                      ) : (
                        <QuickAction icon={ShieldCheck} label="Back in use" busy={busyAction === "status"} onClick={() => void changeStatus(selected, "Active")} />
                      )}
                    </div>
                  </section>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-4 sm:px-6">
                <DeleteConfirmDialog
                  title={`Delete ${selected.name}?`}
                  description="This permanently removes the asset and its tracking dates."
                  confirmLabel="Delete asset"
                  triggerLabel=""
                  trigger={
                    <button
                      type="button"
                      className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-[#8A2C22] transition-colors hover:bg-[#F6E3E1] dark:text-red-300 dark:hover:bg-red-950"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      Delete
                    </button>
                  }
                  onConfirm={async () => handleDelete(selected)}
                />
                <button
                  type="button"
                  onClick={() => openEdit(selected)}
                  className="flex h-11 items-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] dark:bg-secondary dark:text-secondary-foreground"
                >
                  <PenLine aria-hidden="true" className="size-4" />
                  Edit asset
                </button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Add / edit */}
      <Dialog open={formMode !== null} onOpenChange={(open) => !open && !saving && setFormMode(null)}>
        <DialogContent className="gap-0 overflow-hidden rounded-[24px] p-0 sm:max-w-xl">
          <div className="border-b border-border/60 px-6 pt-6 pb-4">
            <DialogTitle className="text-xl font-medium tracking-[-0.02em]">{formMode === "edit" ? "Edit asset" : "Add asset"}</DialogTitle>
            <DialogDescription className="mt-1 text-[13px]">Only the name is required. Add dates to get warnings before they lapse.</DialogDescription>
          </div>
          <form
            className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            id="asset-form"
          >
            <Field id="asset-name" label="Name">
              <Input
                id="asset-name"
                autoFocus
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Lafayette LX6 polygraph system"
                className={FIELD}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="asset-category" label="Category">
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as string }))}>
                  <SelectTrigger id="asset-category" className={cn(FIELD, "w-full")}>
                    <SelectValue>{form.category}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="asset-status" label="Status">
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as string }))}>
                  <SelectTrigger id="asset-status" className={cn(FIELD, "w-full")}>
                    <SelectValue>{form.status}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="asset-serial" label="Serial number">
                <Input
                  id="asset-serial"
                  value={form.serial_number}
                  onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                  placeholder="e.g. SN-98741-A"
                  className={cn(FIELD, "font-mono")}
                />
              </Field>
              <Field id="asset-quantity" label="Quantity" hint="Use 0 for out of stock">
                <Input
                  id="asset-quantity"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  className={cn(FIELD, "tabular-nums")}
                />
              </Field>
            </div>

            <Field id="asset-location" label="Location">
              <Input
                id="asset-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Cabinet A, Room 102"
                className={FIELD}
              />
            </Field>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 px-1 text-[13px] font-medium text-muted-foreground">Dates</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DateField id="asset-calibration" label="Calibration due" value={form.calibration_due} onChange={(v) => setForm((f) => ({ ...f, calibration_due: v }))} />
                <DateField id="asset-expiry" label="Shelf life ends" value={form.expiration_date} onChange={(v) => setForm((f) => ({ ...f, expiration_date: v }))} />
                <DateField id="asset-warranty" label="Warranty ends" value={form.warranty_expiry} onChange={(v) => setForm((f) => ({ ...f, warranty_expiry: v }))} />
                <DateField id="asset-purchase" label="Purchased" value={form.purchase_date} onChange={(v) => setForm((f) => ({ ...f, purchase_date: v }))} />
              </div>
            </fieldset>

            <Field id="asset-notes" label="Notes">
              <Textarea
                id="asset-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Supplier, service contact, specs…"
                className="min-h-[96px] resize-y rounded-xl border-0 bg-[#F3F1EA] px-3.5 py-3 text-sm shadow-none dark:bg-muted"
              />
            </Field>
          </form>
          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-6 py-4">
            <button
              type="button"
              onClick={() => setFormMode(null)}
              disabled={saving}
              className="flex h-11 items-center rounded-full px-5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="asset-form"
              disabled={saving}
              className="flex h-11 items-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-60 dark:bg-secondary dark:text-secondary-foreground"
            >
              {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {formMode === "edit" ? "Save changes" : "Add asset"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

const ASSET_STATUS: Record<string, { chip: string; dot: string; darkDot: string }> = {
  active: { chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-[#3F7A37] dark:bg-emerald-400", darkDot: "bg-[#7FBF8A]" },
  maintenance: { chip: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300", dot: "bg-[#E2B35A]", darkDot: "bg-[#E2B35A]" },
  expired: { chip: "bg-[#F6E3E1] text-[#8A2C22] dark:bg-red-950 dark:text-red-300", dot: "bg-[#B94A3E] dark:bg-red-400", darkDot: "bg-[#E58A7E]" },
  retired: { chip: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground", dot: "bg-[#8B887E]", darkDot: "bg-[#ECE9E0]" },
};

function AssetStatusPill({ status, onDark }: { status: string; onDark?: boolean }) {
  const style = ASSET_STATUS[status?.toLowerCase()] ?? ASSET_STATUS.retired;
  const label = status === "Maintenance" ? "In service" : status || "Unknown";
  if (onDark) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-[#FAF9F5] ring-1 ring-white/15">
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.darkDot)} />
        {label}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap", style.chip)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
      {label}
    </span>
  );
}

const CATEGORY_TONE: Record<string, string> = {
  Equipment: "bg-[#30302E] text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground",
  Sensor: "bg-chart-2/20 text-[oklch(0.42_0.14_290)] dark:text-chart-2",
  Computer: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
  Supply: "bg-primary/12 text-[oklch(0.42_0.12_39)] dark:text-primary",
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
        CATEGORY_TONE[category] ?? "bg-[#ECE9E0] text-[#3D3929] dark:bg-muted dark:text-foreground",
      )}
    >
      {(category || "?").slice(0, 2)}
    </span>
  );
}

function QuantityText({ quantity }: { quantity: number }) {
  if (quantity <= 0) return <span className="text-[#8A5A12] dark:text-amber-300">Out of stock</span>;
  return <span className="tabular-nums">Qty {quantity}</span>;
}

/** Warranty lapsing isn't an emergency, so `soonIsCalm` keeps it neutral until it ends. */
function dateTone(state: DateState, soonIsCalm?: boolean) {
  if (state === "late") return { text: "text-[#8A2C22] dark:text-red-300", dot: "bg-[#B94A3E] dark:bg-red-400" };
  if (state === "soon" && !soonIsCalm) return { text: "text-[#8A5A12] dark:text-amber-300", dot: "bg-[#E2B35A]" };
  return { text: "text-muted-foreground", dot: "bg-[#3F7A37] dark:bg-emerald-400" };
}

function DateCell({ date, lateWord, soonIsCalm }: { date?: string; lateWord: string; soonIsCalm?: boolean }) {
  const state = dateState(date);
  if (state === "none") return <span className="text-muted-foreground">—</span>;
  const tone = dateTone(state, soonIsCalm);
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
        {formatDate(date)}
      </span>
      <span className={cn("pl-3 text-xs whitespace-nowrap", tone.text, state !== "ok" && "font-medium")}>{relativeDays(date, lateWord)}</span>
    </span>
  );
}

function TrackingRow({ icon: Icon, label, date, lateWord, soonIsCalm }: { icon: IconType; label: string; date?: string; lateWord: string; soonIsCalm?: boolean }) {
  const state = dateState(date);
  const tone = dateTone(state, soonIsCalm);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="flex items-center gap-2.5 text-sm">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        {label}
      </span>
      {state === "none" ? (
        <span className="text-[13px] text-muted-foreground">Not tracked</span>
      ) : (
        <span className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-sm tabular-nums">{formatDate(date)}</span>
          <span className={cn("text-xs", tone.text, state !== "ok" && "font-medium")}>{relativeDays(date, lateWord)}</span>
        </span>
      )}
    </div>
  );
}

function DetailTerm({ icon: Icon, label }: { icon: IconType; label: string }) {
  return (
    <dt className="flex items-center gap-2 text-muted-foreground">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </dt>
  );
}

function QuickAction({ icon: Icon, label, hint, busy, onClick }: { icon: IconType; label: string; hint?: string; busy?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={hint}
      className="flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted"
    >
      {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Icon aria-hidden="true" className="size-4" />}
      {label}
    </button>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="px-1 text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="px-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, value && "pr-10")} />
        {value ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange("")}
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
    </Field>
  );
}
