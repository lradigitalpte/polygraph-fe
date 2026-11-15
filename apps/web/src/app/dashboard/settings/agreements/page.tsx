"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Copy,
  Eye,
  FileSignature,
  FileText,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  CredentialsRichTextContent,
  CredentialsRichTextEditor,
} from "@/components/dashboard/credentials-rich-text-editor";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Segmented } from "@/components/dashboard/ui-kit";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AGREEMENT_KIND_LABELS,
  createAgreementTemplate,
  deleteAgreementTemplate,
  fetchAgreementTemplates,
  setAgreementTemplateActive,
  updateAgreementTemplate,
  type AgreementKind,
  type AgreementTemplate,
} from "@/lib/agreements";
import { isCredentialsEmpty } from "@/lib/credentials-rich-text";
import { fetchOrganizationSettings, type OrganizationSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const PRIMARY_BTN =
  "flex h-10 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-[#ECE9E0] dark:text-[#1A1915] dark:hover:bg-white";
const GHOST_BTN =
  "flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted";

const KIND_ORDER: AgreementKind[] = ["payment", "reschedule", "cancellation", "custom"];

const KIND_STYLE: Record<AgreementKind, { icon: LucideIcon; tile: string; chip: string }> = {
  payment: {
    icon: Wallet,
    tile: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
    chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
  },
  reschedule: {
    icon: CalendarClock,
    tile: "bg-[#ECE8F8] text-[#4B3F8F] dark:bg-[#2E2A45] dark:text-[#C9C0F2]",
    chip: "bg-[#ECE8F8] text-[#4B3F8F] dark:bg-[#2E2A45] dark:text-[#C9C0F2]",
  },
  cancellation: {
    icon: XCircle,
    tile: "bg-primary/12 text-[oklch(0.45_0.12_39)] dark:bg-primary/20 dark:text-primary",
    chip: "bg-primary/12 text-[oklch(0.45_0.12_39)] dark:bg-primary/20 dark:text-primary",
  },
  custom: {
    icon: FileText,
    tile: "bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground",
    chip: "bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground",
  },
};

const kindStyle = (kind: AgreementKind) => KIND_STYLE[kind] ?? KIND_STYLE.custom;

type EditorState = { title: string; kind: AgreementKind; bodyHtml: string; active: boolean };
const emptyEditor: EditorState = { title: "", kind: "custom", bodyHtml: "", active: true };

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Plain-text excerpt of the stored HTML, for the list. */
function excerpt(html: string, max = 220) {
  if (typeof window === "undefined") return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = (div.textContent || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function wordCount(html: string) {
  if (typeof window === "undefined") return 0;
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").trim().split(/\s+/).filter(Boolean).length;
}

function payloadFor(t: AgreementTemplate, patch: { active?: boolean; sort_order?: number } = {}) {
  return { title: t.title, kind: t.kind, body_html: t.body_html, active: t.active, sort_order: t.sort_order, ...patch };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AgreementsSettingsPage() {
  const { can } = useCurrentUser();
  const canManage = can("agreement:manage");

  const [templates, setTemplates] = React.useState<AgreementTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [org, setOrg] = React.useState<OrganizationSettings | null>(null);
  const [status, setStatus] = React.useState<"all" | "active" | "inactive">("all");

  // View / edit dialog
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"view" | "edit">("view");
  const [viewing, setViewing] = React.useState<AgreementTemplate | null>(null);
  const [editing, setEditing] = React.useState<AgreementTemplate | null>(null);
  const [form, setForm] = React.useState<EditorState>(emptyEditor);
  const [pane, setPane] = React.useState<"write" | "preview">("write");
  const [saving, setSaving] = React.useState(false);

  const [deleting, setDeleting] = React.useState<AgreementTemplate | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [reordering, setReordering] = React.useState(false);

  const loadTemplates = React.useCallback(async () => {
    try {
      setError(null);
      const data = await fetchAgreementTemplates(true);
      setTemplates(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agreements");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTemplates();
    // Branding is only used by the preview, so a failure here is not worth a toast.
    fetchOrganizationSettings().then(setOrg).catch(() => setOrg(null));
  }, [loadTemplates]);

  const ordered = React.useMemo(
    () => [...templates].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [templates],
  );
  const counts = {
    all: templates.length,
    active: templates.filter((t) => t.active).length,
    inactive: templates.filter((t) => !t.active).length,
  };
  const visible = ordered.filter((t) => (status === "all" ? true : status === "active" ? t.active : !t.active));

  /* ---------------- dialog ---------------- */

  const openView = (t: AgreementTemplate) => {
    setViewing(t);
    setMode("view");
    setOpen(true);
  };

  const openEdit = (t: AgreementTemplate) => {
    setViewing(t);
    setEditing(t);
    setForm({ title: t.title, kind: t.kind, bodyHtml: t.body_html, active: t.active });
    setPane("write");
    setMode("edit");
    setOpen(true);
  };

  const openCreate = (from?: AgreementTemplate) => {
    setViewing(null);
    setEditing(null);
    setForm(from ? { title: `${from.title} (copy)`, kind: from.kind, bodyHtml: from.body_html, active: true } : emptyEditor);
    setPane("write");
    setMode("edit");
    setOpen(true);
  };

  const cancelEdit = () => {
    if (editing) {
      setViewing(templates.find((t) => t.id === editing.id) ?? editing);
      setEditing(null);
      setMode("view");
    } else {
      setOpen(false);
    }
  };

  const wordingChanged = editing != null && (form.title.trim() !== editing.title || form.bodyHtml !== editing.body_html);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Give the agreement a title");
      return;
    }
    if (isCredentialsEmpty(form.bodyHtml)) {
      toast.error("Write the terms first");
      setPane("write");
      return;
    }
    setSaving(true);
    try {
      const payload = { title: form.title.trim(), kind: form.kind, body_html: form.bodyHtml, active: form.active };
      let saved: AgreementTemplate;
      if (editing) {
        saved = await updateAgreementTemplate(editing.id, { ...payload, sort_order: editing.sort_order });
        toast.success(saved.version > editing.version ? `Saved as version ${saved.version}` : "Agreement saved");
      } else {
        saved = await createAgreementTemplate(payload);
        toast.success("Agreement created");
      }
      const data = await loadTemplates();
      setViewing(data?.find((t) => t.id === saved.id) ?? saved);
      setEditing(null);
      setMode("view");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save agreement");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- quick actions ---------------- */

  const toggleActive = async (t: AgreementTemplate) => {
    setBusyId(t.id);
    // Optimistic: the switch moves immediately.
    setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: !t.active } : x)));
    try {
      const saved = await setAgreementTemplateActive(t.id, !t.active);
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? saved : x)));
      if (viewing?.id === t.id) setViewing(saved);
      toast.success(saved.active ? `“${t.title}” will be offered` : `“${t.title}” turned off`);
    } catch (err) {
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? t : x)));
      toast.error(err instanceof Error ? err.message : "Failed to update agreement");
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    // Renumber 1..n and only save rows whose position changed (same wording, so no new version).
    const changed = next.map((t, i) => ({ t, order: i + 1 })).filter(({ t, order }) => t.sort_order !== order);
    setTemplates(next.map((t, i) => ({ ...t, sort_order: i + 1 })));
    setReordering(true);
    try {
      await Promise.all(changed.map(({ t, order }) => updateAgreementTemplate(t.id, payloadFor(t, { sort_order: order }))));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the new order");
      await loadTemplates();
    } finally {
      setReordering(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await deleteAgreementTemplate(deleting.id);
      toast.success(`“${deleting.title}” deleted`);
      if (viewing?.id === deleting.id) setOpen(false);
      setDeleting(null);
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete agreement");
    } finally {
      setBusyId(null);
    }
  };

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">Agreements</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Terms clients read and sign online before their session. Changing the wording saves a new version; clients who already
            signed keep the exact text they agreed to.
          </p>
        </div>
        {canManage ? (
          <button type="button" onClick={() => openCreate()} className={cn(PRIMARY_BTN, "self-start sm:self-auto")}>
            <Plus aria-hidden="true" className="size-4" />
            New agreement
          </button>
        ) : null}
      </div>

      {/* Toolbar */}
      <div className={cn(CARD, "flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between")}>
        <Segmented
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "active", label: "Offered", count: counts.active },
            { value: "inactive", label: "Turned off", count: counts.inactive },
          ]}
        />
        <p className="px-1 text-[13px] text-muted-foreground">
          Clients see offered agreements in this order and sign them together at the end.
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div aria-hidden="true" className={cn(CARD, "divide-y divide-border/50 overflow-hidden")}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-5">
              <div className="size-11 animate-pulse rounded-2xl bg-[#F3F1EA] dark:bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
                <div className="h-3 w-full max-w-md animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={cn(CARD, "flex flex-col items-center gap-3 px-6 py-12 text-center")}>
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadTemplates();
            }}
            className={cn(GHOST_BTN, "h-9")}
          >
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className={cn(CARD, "flex flex-col items-center gap-3 px-6 py-14 text-center")}>
          <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
            <FileSignature aria-hidden="true" className="size-5 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">
            {templates.length === 0 ? "No agreements yet." : status === "inactive" ? "No turned-off agreements." : "No agreements are offered right now."}
          </p>
          {canManage && templates.length === 0 ? (
            <button type="button" onClick={() => openCreate()} className={cn(GHOST_BTN, "h-9")}>
              <Plus aria-hidden="true" className="size-4" />
              Create your first agreement
            </button>
          ) : null}
        </div>
      ) : (
        <ul className={cn(CARD, "divide-y divide-border/50 overflow-hidden")}>
          {visible.map((t) => {
            const style = kindStyle(t.kind);
            const Icon = style.icon;
            const index = ordered.findIndex((x) => x.id === t.id);
            return (
              <li
                key={t.id}
                className={cn(
                  "group flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-[#FAF9F5] sm:flex-row sm:items-center sm:gap-5 sm:px-7 dark:hover:bg-muted/30",
                  !t.active && "bg-[#FAF9F5]/60 dark:bg-muted/10",
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", style.tile, !t.active && "opacity-50")}>
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <button type="button" onClick={() => openView(t)} className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-[15px] font-medium group-hover:underline", !t.active && "text-muted-foreground")}>{t.title}</span>
                      <KindChip kind={t.kind} />
                      <VersionPill version={t.version} />
                      {!t.active ? <span className="rounded-full bg-[#ECE9E0] px-2 py-0.5 text-xs dark:bg-muted">Turned off</span> : null}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[13px] text-muted-foreground">{excerpt(t.body_html) || "No wording yet"}</span>
                    <span className="mt-1.5 block text-xs text-muted-foreground/80">
                      Updated {formatDate(t.updated_at)}
                      {t.updated_by ? ` by ${t.updated_by}` : ""}
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pl-15 sm:justify-end sm:pl-0">
                  {canManage ? (
                    <label className="flex items-center gap-2.5 text-xs text-muted-foreground sm:mr-2">
                      <span className="sm:hidden lg:inline">{t.active ? "Offered" : "Off"}</span>
                      <Switch checked={t.active} disabled={busyId === t.id} onChange={() => void toggleActive(t)} label={`Offer ${t.title}`} />
                    </label>
                  ) : null}
                  <div className="flex items-center">
                    {canManage && status === "all" ? (
                      <>
                        <IconButton label="Move up" onClick={() => void move(index, -1)} disabled={index === 0 || reordering}>
                          <ArrowUp aria-hidden="true" className="size-4" />
                        </IconButton>
                        <IconButton label="Move down" onClick={() => void move(index, 1)} disabled={index === ordered.length - 1 || reordering}>
                          <ArrowDown aria-hidden="true" className="size-4" />
                        </IconButton>
                        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border/70" />
                      </>
                    ) : null}
                    <IconButton label="View" onClick={() => openView(t)}>
                      <Eye aria-hidden="true" className="size-4" />
                    </IconButton>
                    {canManage ? (
                      <>
                        <IconButton label="Edit" onClick={() => openEdit(t)}>
                          <Pencil aria-hidden="true" className="size-4" />
                        </IconButton>
                        <IconButton label="Delete" danger onClick={() => setDeleting(t)}>
                          <Trash2 aria-hidden="true" className="size-4" />
                        </IconButton>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* View / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-5xl sm:rounded-[28px] dark:bg-card">
          {/* Header */}
          <div className="flex shrink-0 flex-col gap-4 border-b border-border/50 px-6 pt-6 pb-4 pr-14 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pt-7">
            <div className="flex min-w-0 items-start gap-4">
              {(() => {
                const style = kindStyle(mode === "view" && viewing ? viewing.kind : form.kind);
                const Icon = style.icon;
                return (
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", style.tile)}>
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                );
              })()}
              <DialogHeader className="min-w-0 gap-1 text-left">
                <DialogTitle className="truncate text-xl font-medium tracking-[-0.01em]">
                  {mode === "view" && viewing ? viewing.title : editing ? "Edit agreement" : "New agreement"}
                </DialogTitle>
                <DialogDescription className="text-[13px]">
                  {mode === "view" && viewing ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <KindChip kind={viewing.kind} />
                      <VersionPill version={viewing.version} />
                      <StatusChip active={viewing.active} />
                    </span>
                  ) : (
                    "Write the terms exactly as the client should read them. Use headings and numbered lists for clauses."
                  )}
                </DialogDescription>
              </DialogHeader>
            </div>
            {mode === "edit" ? (
              <Segmented
                label="Editor view"
                value={pane}
                onChange={setPane}
                options={[
                  { value: "write", label: "Write" },
                  { value: "preview", label: "Client preview", disabled: isCredentialsEmpty(form.bodyHtml) },
                ]}
                className="self-start sm:self-auto"
              />
            ) : null}
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {mode === "view" && viewing ? (
              <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="min-w-0 border-border/50 lg:border-r">
                  <ClientPreview org={org} title={viewing.title} bodyHtml={viewing.body_html} />
                </div>
                <aside className="grid content-start gap-3 p-6 sm:px-8 lg:px-6">
                  <ViewTile label="Version">
                    <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">v{viewing.version}</span>
                    <span className="text-xs text-muted-foreground">
                      {viewing.version > 1 ? `Reworded ${viewing.version - 1} ${viewing.version === 2 ? "time" : "times"}` : "Original wording"}
                    </span>
                  </ViewTile>
                  <ViewTile label="Status">
                    <span className="text-base font-medium">{viewing.active ? "Offered to clients" : "Turned off"}</span>
                    <span className="text-xs text-muted-foreground">
                      {viewing.active ? "Included when you send agreements" : "Not included in new requests"}
                    </span>
                  </ViewTile>
                  <ViewTile label="Last updated">
                    <span className="text-base font-medium">{formatDate(viewing.updated_at)}</span>
                    {viewing.updated_by ? <span className="truncate text-xs text-muted-foreground">by {viewing.updated_by}</span> : null}
                  </ViewTile>
                  <ViewTile label="Length">
                    <span className="text-base font-medium tabular-nums">{wordCount(viewing.body_html).toLocaleString()} words</span>
                    <span className="text-xs text-muted-foreground">About {Math.max(1, Math.round(wordCount(viewing.body_html) / 200))} min to read</span>
                  </ViewTile>
                </aside>
              </div>
            ) : pane === "preview" ? (
              <ClientPreview org={org} title={form.title.trim() || "Untitled agreement"} bodyHtml={form.bodyHtml} />
            ) : (
              <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8">
                <div className="grid min-w-0 content-start gap-5">
                  <div className="grid gap-1.5">
                    <label htmlFor="agreement-title" className="px-1 text-[13px] font-medium">
                      Title
                    </label>
                    <Input
                      id="agreement-title"
                      placeholder="e.g. Cancellation Policy"
                      className={FIELD}
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <span className="px-1 text-[13px] font-medium">Terms</span>
                    <CredentialsRichTextEditor
                      value={form.bodyHtml}
                      onChange={(html) => setForm((prev) => ({ ...prev, bodyHtml: html }))}
                      className="rounded-2xl border-border/60"
                    />
                  </div>
                </div>

                <aside className="grid content-start gap-4">
                  <div className="grid gap-2">
                    <span className="px-1 text-[13px] font-medium">Type</span>
                    <div className="grid grid-cols-2 gap-2">
                      {KIND_ORDER.map((kind) => {
                        const style = kindStyle(kind);
                        const Icon = style.icon;
                        const selected = form.kind === kind;
                        return (
                          <button
                            key={kind}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setForm((prev) => ({ ...prev, kind }))}
                            className={cn(
                              "flex flex-col items-start gap-2 rounded-2xl p-3 text-left text-[13px] font-medium ring-1 transition-colors",
                              selected
                                ? "bg-white ring-2 ring-[#30302E] dark:bg-card dark:ring-[#ECE9E0]"
                                : "bg-[#F7F6F1] ring-transparent hover:bg-[#F0EEE7] dark:bg-muted/40 dark:hover:bg-muted/60",
                            )}
                          >
                            <span className={cn("flex size-8 items-center justify-center rounded-xl", style.tile)}>
                              <Icon aria-hidden="true" className="size-4" />
                            </span>
                            {AGREEMENT_KIND_LABELS[kind]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-4 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Offer to clients</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Included when you send agreements to a client.</p>
                    </div>
                    <Switch checked={form.active} onChange={() => setForm((prev) => ({ ...prev, active: !prev.active }))} label="Offer to clients" />
                  </div>

                  {editing ? (
                    <div
                      className={cn(
                        "rounded-2xl p-4 text-xs leading-relaxed",
                        wordingChanged
                          ? "bg-[#FBF1E6] text-[#7A4A14] dark:bg-amber-950/40 dark:text-amber-200"
                          : "bg-[#F7F6F1] text-muted-foreground dark:bg-muted/40",
                      )}
                    >
                      {wordingChanged ? (
                        <>
                          <p className="font-medium">Saves as version {editing.version + 1}</p>
                          <p className="mt-1">Clients who already received version {editing.version} keep that wording.</p>
                        </>
                      ) : (
                        <p>Version {editing.version}. Changing the title or terms creates a new version; type and status don&apos;t.</p>
                      )}
                    </div>
                  ) : null}
                </aside>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            {mode === "view" && viewing ? (
              <>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setDeleting(viewing)}
                    className="flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Delete
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  {canManage ? (
                    <>
                      <button type="button" onClick={() => openCreate(viewing)} className={GHOST_BTN}>
                        <Copy aria-hidden="true" className="size-4" />
                        Duplicate
                      </button>
                      <button type="button" onClick={() => openEdit(viewing)} className={PRIMARY_BTN}>
                        <Pencil aria-hidden="true" className="size-4" />
                        Edit
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setOpen(false)} className={GHOST_BTN}>
                      Close
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="hidden text-xs text-muted-foreground sm:block tabular-nums">
                  {wordCount(form.bodyHtml).toLocaleString()} words
                </span>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button type="button" onClick={cancelEdit} className={GHOST_BTN}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || !form.title.trim() || isCredentialsEmpty(form.bodyHtml)}
                    className={PRIMARY_BTN}
                  >
                    {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                    {saving ? "Saving…" : editing ? (wordingChanged ? `Save as v${editing.version + 1}` : "Save changes") : "Create agreement"}
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => (!o ? setDeleting(null) : null)}>
        <DialogContent className="max-w-md rounded-[28px] p-7 sm:rounded-[28px] dark:bg-card">
          <DialogHeader className="gap-2 text-left">
            <DialogTitle className="text-lg font-medium">Delete “{deleting?.title}”?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              It won&apos;t be available to send any more. Agreements already sent or signed keep their wording.
              {deleting?.active ? " If you might need it again, turn it off instead." : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setDeleting(null)} className={GHOST_BTN}>
              Cancel
            </button>
            {deleting?.active ? (
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => {
                  const t = deleting;
                  setDeleting(null);
                  void toggleActive(t);
                }}
                className={GHOST_BTN}
              >
                Turn off instead
              </button>
            ) : null}
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => void confirmDelete()}
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {busyId !== null ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Client preview                                                      */
/* ------------------------------------------------------------------ */

/** Mirrors the layout of the public signing page so staff can check wording and branding. */
function ClientPreview({ org, title, bodyHtml }: { org: OrganizationSettings | null; title: string; bodyHtml: string }) {
  const websiteLabel = org?.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="bg-[#F3F1EA] p-4 sm:p-6 dark:bg-muted/30">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(40,36,20,0.08)] ring-1 ring-border/50 dark:bg-background">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {org?.logo_data_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- inline data: URL
              <img src={org.logo_data_url} alt="" className="h-9 max-w-28 object-contain" />
            ) : null}
            <span className="truncate text-sm font-semibold">{org?.name || "Your organization"}</span>
          </div>
          {websiteLabel ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Globe aria-hidden="true" className="size-3.5" /> {websiteLabel}
            </span>
          ) : null}
        </div>
        <div className="space-y-4 p-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="max-h-[26rem] overflow-y-auto rounded-xl bg-[#FAF9F5] p-4 ring-1 ring-border/50 dark:bg-muted/20">
            <CredentialsRichTextContent html={bodyHtml} className="text-sm text-foreground" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox disabled /> I have read and agree to the {title}
          </label>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Preview of the signing page. Clients sign all agreements together at the bottom.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function KindChip({ kind }: { kind: AgreementKind }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", kindStyle(kind).chip)}>
      {AGREEMENT_KIND_LABELS[kind] ?? kind}
    </span>
  );
}

function VersionPill({ version }: { version: number }) {
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] text-muted-foreground ring-1 ring-border">v{version}</span>
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
      {active ? "Offered" : "Turned off"}
    </span>
  );
}

function ViewTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-30",
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
