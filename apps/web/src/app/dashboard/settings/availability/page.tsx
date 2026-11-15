"use client";

import * as React from "react";
import { CalendarClock, CalendarDays, CalendarOff, ChevronDown, Clock, Loader2, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlassStat, HeroAction, PageHero } from "@/components/dashboard/ui-kit";
import { Input } from "@/components/ui/input";
import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  fetchAvailabilityBlocks,
  updateAvailabilityBlock,
  type AvailabilityBlockRecord,
} from "@/lib/exam-booking";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { cn } from "@/lib/utils";

type FormState = {
  examiner_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_full_day: boolean;
  reason: string;
};

const emptyForm: FormState = {
  examiner_id: "",
  date: "",
  start_time: "09:00",
  end_time: "17:00",
  is_full_day: false,
  reason: "",
};

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const SELECT = cn(FIELD, "w-full appearance-none pr-10 outline-none focus-visible:ring-2 focus-visible:ring-ring");

export default function AvailabilitySettingsPage() {
  const [blocks, setBlocks] = React.useState<AvailabilityBlockRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [selectedExaminerId, setSelectedExaminerId] = React.useState<string>("");
  const [selectedDate, setSelectedDate] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [deleting, setDeleting] = React.useState<AvailabilityBlockRecord | null>(null);
  const [deletingBusy, setDeletingBusy] = React.useState(false);

  const loadPageData = React.useCallback(async (examinerId?: string, date?: string) => {
    try {
      setError(null);
      const [examinerData, blockData] = await Promise.all([
        fetchExaminers(),
        fetchAvailabilityBlocks({
          examiner_id: examinerId ? Number(examinerId) : undefined,
          date: date || undefined,
        }),
      ]);
      setExaminers(examinerData);
      setBlocks([...blockData].sort(compareBlocks));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPageData(selectedExaminerId, selectedDate);
  }, [loadPageData, selectedExaminerId, selectedDate]);

  const examinerName = React.useCallback(
    (id: number) => examiners.find((item) => item.id === id)?.name || `Examiner #${id}`,
    [examiners],
  );

  const resetForm = React.useCallback(() => {
    setEditingId(null);
    setForm({ ...emptyForm, examiner_id: selectedExaminerId, date: selectedDate });
  }, [selectedDate, selectedExaminerId]);

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (block: AvailabilityBlockRecord) => {
    setEditingId(block.id);
    setForm({
      examiner_id: String(block.examiner_id),
      date: block.date.slice(0, 10),
      start_time: block.start_time || "09:00",
      end_time: block.end_time || "17:00",
      is_full_day: block.is_full_day,
      reason: block.reason || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.examiner_id) {
      toast.error("Choose an examiner");
      return;
    }
    if (!form.date) {
      toast.error("Choose a date");
      return;
    }
    if (!form.is_full_day && (!form.start_time || !form.end_time)) {
      toast.error("Partial-day blocks require start and end times");
      return;
    }
    if (!form.is_full_day && form.end_time <= form.start_time) {
      toast.error("End time must be after the start time");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        examiner_id: Number(form.examiner_id),
        date: form.date,
        start_time: form.is_full_day ? undefined : form.start_time,
        end_time: form.is_full_day ? undefined : form.end_time,
        is_full_day: form.is_full_day,
        reason: form.reason.trim() || undefined,
      };

      if (editingId) {
        const updated = await updateAvailabilityBlock(editingId, payload);
        setBlocks((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(compareBlocks));
        toast.success("Availability block updated");
      } else {
        const created = await createAvailabilityBlock(payload);
        setBlocks((current) => [...current, created].sort(compareBlocks));
        toast.success("Availability block created");
      }

      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save availability block");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteAvailabilityBlock(deleting.id);
      setBlocks((current) => current.filter((item) => item.id !== deleting.id));
      toast.success("Availability block deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete availability block");
    } finally {
      setDeletingBusy(false);
    }
  };

  const filtered = selectedExaminerId !== "" || selectedDate !== "";
  const today = localToday();
  const upcoming = blocks.filter((b) => b.date.slice(0, 10) >= today);
  const past = blocks.filter((b) => b.date.slice(0, 10) < today);

  return (
    <div className="space-y-5 pb-10">
      <PageHero
        tone="sage"
        icon={CalendarClock}
        eyebrow="Exams & reports"
        title={<>Examiner <strong className="font-semibold">availability</strong></>}
        description="Create full-day or time-range blocks that the booking page respects immediately."
        actions={
          <HeroAction variant="primary" icon={Plus} onClick={openCreate}>
            Add block
          </HeroAction>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Blocks" value={blocks.length} hint={filtered ? "Matching your filters" : "All scheduled blocks"} icon={CalendarDays} accent="sage" loading={loading} />
          <GlassStat label="Upcoming" value={upcoming.length} hint="Today or later" icon={CalendarClock} accent="lavender" loading={loading} />
          <GlassStat label="Full days" value={blocks.filter((b) => b.is_full_day).length} hint="Whole day unavailable" icon={CalendarOff} accent="amber" loading={loading} />
          <GlassStat label="Examiners" value={new Set(blocks.map((b) => b.examiner_id)).size} hint="With at least one block" icon={UserRound} accent="terracotta" loading={loading} />
        </div>
      </PageHero>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-4 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:flex-row sm:items-end sm:p-5 dark:bg-card">
        <Field id="filter-examiner" label="Examiner" className="sm:w-64">
          <SelectField id="filter-examiner" value={selectedExaminerId} onChange={setSelectedExaminerId}>
            <option value="">All examiners</option>
            {examiners.map((examiner) => (
              <option key={examiner.id} value={examiner.id}>
                {examiner.name}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field id="filter-date" label="Date" className="sm:w-52">
          <Input id="filter-date" type="date" className={FIELD} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </Field>
        {filtered ? (
          <button
            type="button"
            onClick={() => {
              setSelectedExaminerId("");
              setSelectedDate("");
            }}
            className="flex h-11 items-center gap-1.5 self-start rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground sm:self-auto dark:hover:bg-muted"
          >
            <X aria-hidden="true" className="size-4" />
            Clear filters
          </button>
        ) : null}
        {!loading && !error ? (
          <p className="text-sm text-muted-foreground sm:ml-auto sm:pb-3">
            {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
          </p>
        ) : null}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} aria-hidden="true" className="h-40 animate-pulse rounded-[26px] bg-white ring-1 ring-border/50 dark:bg-card" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-[26px] bg-[#F8E4E0] p-5 text-sm text-[#7A2A1E] dark:bg-red-950/60 dark:text-red-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadPageData(selectedExaminerId, selectedDate);
            }}
            className="flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-current/30 transition-colors hover:bg-white/50"
          >
            Try again
          </button>
        </div>
      ) : blocks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[26px] bg-white px-6 py-14 text-center ring-1 ring-border/50 dark:bg-card">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
            <CalendarClock aria-hidden="true" className="size-5 text-muted-foreground" />
          </span>
          <div>
            <p className="font-medium">{filtered ? "No blocks match these filters" : "No availability blocks yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered ? "Try another examiner or date, or clear the filters." : "Block out leave, travel or training so the booking page skips those times."}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="mt-1 flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add block
          </button>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section aria-label="Upcoming blocks" className="grid gap-4 md:grid-cols-2">
              {upcoming.map((block) => (
                <BlockCard key={block.id} block={block} name={examinerName(block.examiner_id)} onEdit={() => openEdit(block)} onDelete={() => setDeleting(block)} />
              ))}
            </section>
          ) : (
            <p className="px-1 text-sm text-muted-foreground">No upcoming blocks.</p>
          )}

          {past.length > 0 ? (
            <section aria-labelledby="past-title" className="space-y-3 pt-2">
              <h2 id="past-title" className="px-1 text-sm font-medium text-muted-foreground">
                Past · {past.length}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {past.map((block) => (
                  <BlockCard key={block.id} block={block} name={examinerName(block.examiner_id)} past onEdit={() => openEdit(block)} onDelete={() => setDeleting(block)} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* Add / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[26px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit availability block" : "Add availability block"}</DialogTitle>
            <DialogDescription>Define a full-day blackout or a specific unavailable time range for an examiner.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field id="block-examiner" label="Examiner">
              <SelectField id="block-examiner" value={form.examiner_id} onChange={(v) => setForm((c) => ({ ...c, examiner_id: v }))}>
                <option value="">Select examiner</option>
                {examiners.map((examiner) => (
                  <option key={examiner.id} value={examiner.id}>
                    {examiner.name}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field id="block-date" label="Date">
              <Input id="block-date" type="date" className={FIELD} value={form.date} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} />
            </Field>

            <SwitchRow
              label="Full day block"
              description="Use this for leave days, travel days, or full clinical closures."
              checked={form.is_full_day}
              onChange={(v) => setForm((c) => ({ ...c, is_full_day: v }))}
            />

            {!form.is_full_day ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="block-start" label="Start time">
                  <Input id="block-start" type="time" className={FIELD} value={form.start_time} onChange={(e) => setForm((c) => ({ ...c, start_time: e.target.value }))} />
                </Field>
                <Field id="block-end" label="End time">
                  <Input id="block-end" type="time" className={FIELD} value={form.end_time} onChange={(e) => setForm((c) => ({ ...c, end_time: e.target.value }))} />
                </Field>
              </div>
            ) : null}

            <Field id="block-reason" label="Reason" optional>
              <Input
                id="block-reason"
                className={FIELD}
                value={form.reason}
                onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))}
                placeholder="Vacation, training, court testimony…"
              />
            </Field>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-secondary dark:text-secondary-foreground"
            >
              {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {saving ? "Saving…" : editingId ? "Save changes" : "Create block"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent className="rounded-[26px]">
          <DialogHeader>
            <DialogTitle>Delete this block?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `${examinerName(deleting.examiner_id)} will become bookable again on ${formatDate(deleting.date)}${deleting.is_full_day ? "" : ` (${formatRange(deleting)})`}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
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

function BlockCard({
  block,
  name,
  past,
  onEdit,
  onDelete,
}: {
  block: AvailabilityBlockRecord;
  name: string;
  past?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[26px] bg-white p-5 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card",
        past && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#30302E] text-[13px] font-semibold tracking-wide text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground">
            {initialsOf(name)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-medium" title={name}>
              {name}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{formatDate(block.date)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label={`Edit block for ${name}`} onClick={onEdit}>
            <Pencil aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label={`Delete block for ${name}`} onClick={onDelete} danger>
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex items-start gap-3">
        {block.is_full_day ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F8EEDB] px-2.5 py-1 text-xs font-medium text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-300">
            <CalendarOff aria-hidden="true" className="size-3.5" />
            Full day
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#ECE9E0] px-2.5 py-1 text-xs font-medium text-[#3D3929] dark:bg-muted dark:text-foreground">
            <Clock aria-hidden="true" className="size-3.5" />
            {formatRange(block)}
          </span>
        )}
        <p className={cn("min-w-0 flex-1 text-sm", block.reason ? "text-foreground" : "text-muted-foreground")}>{block.reason || "No reason provided."}</p>
      </div>
    </article>
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

function Field({ id, label, optional, className, children }: { id: string; label: string; optional?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="px-1 text-[13px] font-medium">
        {label}
        {optional ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
      </label>
      {children}
    </div>
  );
}

function SelectField({ id, value, onChange, children }: { id: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select id={id} className={SELECT} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function SwitchRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
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

function compareBlocks(a: AvailabilityBlockRecord, b: AvailabilityBlockRecord) {
  return `${a.date.slice(0, 10)}-${a.start_time || "00:00"}`.localeCompare(`${b.date.slice(0, 10)}-${b.start_time || "00:00"}`);
}

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRange(block: AvailabilityBlockRecord) {
  return `${(block.start_time || "").slice(0, 5)} – ${(block.end_time || "").slice(0, 5)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
