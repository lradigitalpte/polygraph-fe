"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/dashboard/ui-kit";
import {
  createReportTemplate,
  deactivateReportTemplate,
  fetchReportTemplates,
  parseTemplateEditorContent,
  templateContentToJSON,
  updateReportTemplate,
  type ReportTemplateInput,
} from "@/lib/report-templates";
import type { ReportContent, ReportQuestion, ReportTemplateRecord } from "@/lib/report-template";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const AREA = "rounded-xl border-0 bg-[#F3F1EA] px-3.5 py-3 text-sm leading-relaxed shadow-none dark:bg-muted";
const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const PRIMARY_BTN =
  "flex h-10 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-[#ECE9E0] dark:text-[#1A1915] dark:hover:bg-white";
const GHOST_BTN =
  "flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted";

type TextKey =
  | "pre_test_phase_text"
  | "pre_test_notes"
  | "exam_phase_text"
  | "limestone_notes"
  | "opinion_phase_text"
  | "section_4_follow_up";

/** The written sections of a report, in the order they appear in the PDF. */
const SECTIONS: { key: TextKey; group: string; title: string; hint: string; short?: boolean }[] = [
  { key: "pre_test_phase_text", group: "Section 1 · Pre-test", title: "Introduction", hint: "Opens the pre-test phase: who was examined, for whom, and how identity was checked." },
  { key: "pre_test_notes", group: "Section 1 · Pre-test", title: "Notes", hint: "Anything discussed with the examinee before the exam." },
  { key: "exam_phase_text", group: "Section 2 · Examination", title: "Introduction", hint: "Describes how the examination was run." },
  { key: "limestone_notes", group: "Section 2 · Examination", title: "Instrument paragraph", hint: "The instrument and technique used." },
  { key: "opinion_phase_text", group: "Section 3 · Opinion", title: "Opinion", hint: "The examiner's conclusion. {{verdict_label}} fills in the result." },
  { key: "section_4_follow_up", group: "Section 4 · Follow-up", title: "Follow-up", hint: "Default follow-up line, usually “Nil”.", short: true },
];

const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{{subject_name}}", label: "Examinee name" },
  { token: "{{client_name}}", label: "Client name" },
  { token: "{{exam_date}}", label: "Exam date" },
  { token: "{{report_date}}", label: "Report date" },
  { token: "{{reference_no}}", label: "Reference no." },
  { token: "{{exam_start_time}}", label: "Start time" },
  { token: "{{exam_end_time}}", label: "End time" },
  { token: "{{pronoun_subject}}", label: "He / she" },
  { token: "{{pronoun_possessive}}", label: "His / her" },
  { token: "{{identity_sentence}}", label: "Identity sentence" },
  { token: "{{cooperation_sentence}}", label: "Cooperation sentence" },
  { token: "{{verdict_label}}", label: "Verdict" },
  { token: "{{pre_exam_question_count_text}}", label: "Question count" },
];
const PLACEHOLDER_LABEL = new Map(PLACEHOLDERS.map((p) => [p.token, p.label]));

type EditorState = {
  slug: string;
  name: string;
  category: string;
  description: string;
  isDefault: boolean;
  active: boolean;
  content: ReportContent;
};

type EditorTab = "details" | "wording" | "questions";

const emptyContent = (): ReportContent => ({
  purpose: "",
  instrument: "",
  pre_test_notes: "",
  questions: [],
  post_test_notes: "",
  reference_no: "",
  exam_date: "",
  report_date: "",
  section_4_follow_up: "Nil",
  limestone_notes: "",
  pre_test_phase_text: "",
  exam_phase_text: "",
  opinion_phase_text: "",
  identity_document_type: "passport",
  identity_verification_text: "{{identity_sentence}}",
  exam_start_time: "14:00",
  exam_end_time: "15:45",
  cooperation_mode: "cooperated",
  pre_exam_question_count_text: "4 relevant and 3 comparison questions",
  response_legend_text: "",
});

function parseContent(raw: string): ReportContent {
  try {
    const parsed = parseTemplateEditorContent(raw);
    return { ...emptyContent(), ...parsed, questions: Array.isArray(parsed?.questions) ? parsed.questions : [] };
  } catch {
    return emptyContent();
  }
}

function templateToEditor(template?: ReportTemplateRecord): EditorState {
  if (!template) {
    return { slug: "", name: "", category: "generic", description: "", isDefault: false, active: true, content: emptyContent() };
  }
  return {
    slug: template.slug,
    name: template.name,
    category: template.category,
    description: template.description || "",
    isDefault: template.is_default,
    active: template.active,
    content: parseContent(template.content_json),
  };
}

/** The backend update overwrites description/active/default, so quick actions always send the whole record. */
function recordToPayload(t: ReportTemplateRecord, patch: Partial<ReportTemplateInput> = {}): ReportTemplateInput {
  return {
    slug: t.slug,
    name: t.name,
    category: t.category,
    description: t.description || "",
    content_json: t.content_json,
    is_default: t.is_default,
    active: t.active,
    ...patch,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function categoryLabel(category: string) {
  if (!category) return "Generic";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatUpdated(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function templateStats(t: ReportTemplateRecord) {
  const content = parseContent(t.content_json);
  const written = SECTIONS.filter((s) => (content[s.key] ?? "").toString().trim()).length;
  return { questions: content.questions.length, written, content };
}

/** Renders text with {{placeholders}} shown as readable tags. */
function WithPlaceholders({ text }: { text: string }) {
  const parts = text.split(/(\{\{[a-z_]+\}\})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\{\{[a-z_]+\}\}$/.test(part) ? (
          <span
            key={i}
            title={part}
            className="mx-0.5 inline-flex items-center rounded-md bg-primary/12 px-1.5 py-px align-baseline text-[0.85em] font-medium text-[oklch(0.45_0.12_39)] dark:bg-primary/20 dark:text-primary"
          >
            {PLACEHOLDER_LABEL.get(part) ?? part.slice(2, -2).replaceAll("_", " ")}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type Confirm = { kind: "deactivate" | "default"; template: ReportTemplateRecord } | null;

export default function ReportTemplatesSettingsPage() {
  const [templates, setTemplates] = React.useState<ReportTemplateRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");

  // Dialog
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"view" | "edit">("view");
  const [viewing, setViewing] = React.useState<ReportTemplateRecord | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<EditorState>(templateToEditor());
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [tab, setTab] = React.useState<EditorTab>("details");
  const [saving, setSaving] = React.useState(false);

  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const loadTemplates = React.useCallback(async () => {
    try {
      setError(null);
      const data = await fetchReportTemplates(true);
      setTemplates(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  /* ---------------- derived ---------------- */

  const categories = React.useMemo(() => {
    const set = new Set(["generic", "eva", ...templates.map((t) => t.category || "generic")]);
    return [...set].sort((a, b) => (a === "generic" ? -1 : b === "generic" ? 1 : a.localeCompare(b)));
  }, [templates]);

  const needle = search.trim().toLowerCase();
  const matches = React.useCallback(
    (t: ReportTemplateRecord) =>
      (category === "all" || (t.category || "generic") === category) &&
      (!needle || [t.name, t.slug, t.description ?? "", t.category].some((v) => v.toLowerCase().includes(needle))),
    [category, needle],
  );

  const active = React.useMemo(
    () =>
      templates
        .filter((t) => t.active && matches(t))
        .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name)),
    [templates, matches],
  );
  const inactive = React.useMemo(() => templates.filter((t) => !t.active && matches(t)).sort((a, b) => a.name.localeCompare(b.name)), [templates, matches]);

  const countFor = (c: string) => templates.filter((t) => t.active && (c === "all" || (t.category || "generic") === c)).length;

  /* ---------------- dialog actions ---------------- */

  const openView = (t: ReportTemplateRecord) => {
    setViewing(t);
    setMode("view");
    setOpen(true);
  };

  const openEdit = (t: ReportTemplateRecord) => {
    setViewing(t);
    setEditingId(t.id);
    setForm(templateToEditor(t));
    setSlugTouched(true);
    setTab("details");
    setMode("edit");
    setOpen(true);
  };

  const openCreate = (from?: ReportTemplateRecord) => {
    setViewing(null);
    setEditingId(null);
    if (from) {
      const base = templateToEditor(from);
      const name = `${from.name} (copy)`;
      setForm({ ...base, name, slug: slugify(name), isDefault: false, active: true });
    } else {
      setForm(templateToEditor());
    }
    setSlugTouched(false);
    setTab("details");
    setMode("edit");
    setOpen(true);
  };

  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) =>
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugify(String(value));
      return next;
    });

  const setContent = (key: keyof ReportContent, value: unknown) =>
    setForm((prev) => ({ ...prev, content: { ...prev.content, [key]: value } }));

  const setQuestions = (fn: (q: ReportQuestion[]) => ReportQuestion[]) =>
    setForm((prev) => ({ ...prev, content: { ...prev.content, questions: fn(prev.content.questions) } }));

  const slugTaken = React.useMemo(() => {
    const s = form.slug.trim().toLowerCase();
    return !!s && templates.some((t) => t.slug === s && t.id !== editingId);
  }, [form.slug, templates, editingId]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Give the template a name");
      setTab("details");
      return;
    }
    if (!form.slug.trim() || slugTaken) {
      toast.error(slugTaken ? "Another template already uses that ID" : "Template ID is required");
      setTab("details");
      return;
    }
    setSaving(true);
    try {
      const payload: ReportTemplateInput = {
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        content_json: templateContentToJSON({
          ...form.content,
          questions: form.content.questions.filter((q) => q.text.trim()),
        }),
        is_default: form.isDefault,
        active: form.isDefault ? true : form.active,
      };
      const saved = editingId ? await updateReportTemplate(editingId, payload) : await createReportTemplate(payload);
      toast.success(editingId ? "Template saved" : "Template created");
      const data = await loadTemplates();
      const fresh = data?.find((t) => t.id === saved?.id) ?? saved;
      if (fresh) {
        setViewing(fresh);
        setEditingId(null);
        setMode("view");
      } else {
        setOpen(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    const original = editingId ? templates.find((t) => t.id === editingId) : undefined;
    if (original) {
      setViewing(original);
      setEditingId(null);
      setMode("view");
    } else {
      setOpen(false);
    }
  };

  /* ---------------- quick actions ---------------- */

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, template } = confirm;
    setBusyId(template.id);
    try {
      if (kind === "deactivate") {
        await deactivateReportTemplate(template.id);
        toast.success(`“${template.name}” turned off`);
      } else {
        await updateReportTemplate(template.id, recordToPayload(template, { is_default: true, active: true }));
        toast.success(`“${template.name}” is now the default`);
      }
      setConfirm(null);
      const data = await loadTemplates();
      if (viewing?.id === template.id) setViewing(data?.find((t) => t.id === template.id) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const reactivate = async (template: ReportTemplateRecord) => {
    setBusyId(template.id);
    try {
      await updateReportTemplate(template.id, recordToPayload(template, { active: true }));
      toast.success(`“${template.name}” turned back on`);
      const data = await loadTemplates();
      if (viewing?.id === template.id) setViewing(data?.find((t) => t.id === template.id) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to turn template on");
    } finally {
      setBusyId(null);
    }
  };

  /* ---------------- render ---------------- */

  const defaultTemplate = templates.find((t) => t.is_default && t.active);

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">Report templates</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The starting wording and questions for new reports. Editing a template never changes reports that were already written from it.
          </p>
        </div>
        <button type="button" onClick={() => openCreate()} className={cn(PRIMARY_BTN, "self-start sm:self-auto")}>
          <Plus aria-hidden="true" className="size-4" />
          New template
        </button>
      </div>

      {/* Toolbar */}
      <div className={cn(CARD, "flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between")}>
        <Segmented
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "All", count: countFor("all") },
            ...categories.map((c) => ({ value: c, label: categoryLabel(c), count: countFor(c) })),
          ]}
        />
        <div className="relative w-full lg:w-80">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search templates"
            placeholder="Search name or description"
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

      {!loading && !error && !defaultTemplate ? (
        <div className="rounded-2xl bg-[#FBF1E6] px-4 py-3 text-sm text-[#7A4A14] dark:bg-amber-950/40 dark:text-amber-200">
          No organization default is set. Walk-in reports will start from the oldest active template. Open a template and choose “Make default”.
        </div>
      ) : null}

      {/* Grid */}
      {loading ? (
        <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={cn(CARD, "space-y-3 p-5")}>
              <div className="h-10 w-10 animate-pulse rounded-2xl bg-[#F3F1EA] dark:bg-muted" />
              <div className="h-4 w-40 animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
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
      ) : active.length === 0 && inactive.length === 0 ? (
        <div className={cn(CARD, "flex flex-col items-center gap-3 px-6 py-14 text-center")}>
          <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
            <FileText aria-hidden="true" className="size-5 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">{templates.length === 0 ? "No templates yet." : "No templates match these filters."}</p>
          {templates.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("all");
              }}
              className={cn(GHOST_BTN, "h-9")}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {active.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onView={() => openView(t)}
                  onEdit={() => openEdit(t)}
                  onDuplicate={() => openCreate(t)}
                  onMakeDefault={() => setConfirm({ kind: "default", template: t })}
                  onDeactivate={() => setConfirm({ kind: "deactivate", template: t })}
                />
              ))}
            </div>
          ) : (
            <p className="px-1 text-sm text-muted-foreground">No active templates match.</p>
          )}

          {inactive.length > 0 ? (
            <section className="space-y-3 pt-2">
              <h2 className="px-1 text-[13px] font-medium text-muted-foreground">Turned off · {inactive.length}</h2>
              <ul className={cn(CARD, "divide-y divide-border/50 overflow-hidden")}>
                {inactive.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <button type="button" onClick={() => openView(t)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium text-muted-foreground hover:underline">{t.name}</span>
                      <span className="block truncate text-xs text-muted-foreground/80">{t.description || "No description"}</span>
                    </button>
                    <CategoryChip category={t.category} />
                    <button type="button" disabled={busyId === t.id} onClick={() => void reactivate(t)} className={cn(GHOST_BTN, "h-9")}>
                      {busyId === t.id ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Power aria-hidden="true" className="size-4" />}
                      Turn on
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {/* View / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-5xl sm:rounded-[28px] dark:bg-card">
          {/* Header */}
          <div className="flex shrink-0 flex-col gap-4 border-b border-border/50 px-6 pt-6 pb-4 pr-14 sm:px-8 sm:pt-7">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground">
                <FileText aria-hidden="true" className="size-5" />
              </span>
              <DialogHeader className="min-w-0 gap-1 text-left">
                <DialogTitle className="truncate text-xl font-medium tracking-[-0.01em]">
                  {mode === "view" && viewing ? viewing.name : editingId ? "Edit template" : "New template"}
                </DialogTitle>
                <DialogDescription className="text-[13px]">
                  {mode === "view" && viewing ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <CategoryChip category={viewing.category} />
                      {viewing.is_default ? <DefaultPill /> : null}
                      {!viewing.active ? <span className="rounded-full bg-[#ECE9E0] px-2 py-0.5 text-xs dark:bg-muted">Turned off</span> : null}
                      {formatUpdated(viewing.updated_at) ? <span className="text-xs">Updated {formatUpdated(viewing.updated_at)}</span> : null}
                    </span>
                  ) : (
                    "Changes apply to reports started after you save. Existing reports keep their wording."
                  )}
                </DialogDescription>
              </DialogHeader>
            </div>
            {mode === "edit" ? (
              <Segmented
                label="Template section"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "details", label: "Details" },
                  { value: "wording", label: "Report wording" },
                  { value: "questions", label: "Questions", count: form.content.questions.length },
                ]}
                className="self-start"
              />
            ) : null}
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            {mode === "view" && viewing ? (
              <TemplateView template={viewing} />
            ) : tab === "details" ? (
              <DetailsTab
                form={form}
                set={set}
                setContent={setContent}
                categories={categories}
                slugTaken={slugTaken}
                onSlugChange={(v) => {
                  setSlugTouched(true);
                  setForm((prev) => ({ ...prev, slug: slugify(v) }));
                }}
                wasDefault={!!(editingId && templates.find((t) => t.id === editingId)?.is_default)}
              />
            ) : tab === "wording" ? (
              <WordingTab content={form.content} setContent={setContent} />
            ) : (
              <QuestionsTab questions={form.content.questions} setQuestions={setQuestions} />
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            {mode === "view" && viewing ? (
              <>
                <div className="flex flex-wrap gap-1">
                  {viewing.active && !viewing.is_default ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "default", template: viewing })}
                        className="flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                      >
                        <Star aria-hidden="true" className="size-4" />
                        Make default
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "deactivate", template: viewing })}
                        className="flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                        Turn off
                      </button>
                    </>
                  ) : null}
                  {!viewing.active ? (
                    <button type="button" disabled={busyId === viewing.id} onClick={() => void reactivate(viewing)} className="flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted">
                      <Power aria-hidden="true" className="size-4" />
                      Turn on
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openCreate(viewing);
                    }}
                    className={GHOST_BTN}
                  >
                    <Copy aria-hidden="true" className="size-4" />
                    Duplicate
                  </button>
                  <button type="button" onClick={() => openEdit(viewing)} className={PRIMARY_BTN}>
                    <Pencil aria-hidden="true" className="size-4" />
                    Edit
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {form.content.questions.length} {form.content.questions.length === 1 ? "question" : "questions"} ·{" "}
                  {SECTIONS.filter((s) => (form.content[s.key] ?? "").toString().trim()).length} of {SECTIONS.length} sections written
                </span>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button type="button" onClick={cancelEdit} className={GHOST_BTN}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => void handleSave()} disabled={saving || !form.name.trim()} className={PRIMARY_BTN}>
                    {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                    {saving ? "Saving…" : editingId ? "Save changes" : "Create template"}
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={!!confirm} onOpenChange={(o) => (!o ? setConfirm(null) : null)}>
        <DialogContent className="max-w-md rounded-[28px] p-7 sm:rounded-[28px] dark:bg-card">
          <DialogHeader className="gap-2 text-left">
            <DialogTitle className="text-lg font-medium">
              {confirm?.kind === "default" ? `Make “${confirm.template.name}” the default?` : `Turn off “${confirm?.template.name}”?`}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {confirm?.kind === "default" ? (
                <>
                  New reports for walk-in clients, and for clients without their own template, will start from this one
                  {defaultTemplate ? <> instead of “{defaultTemplate.name}”</> : null}.
                </>
              ) : (
                <>It won&apos;t be offered for new reports. Reports already written from it are unchanged, and you can turn it back on any time.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirm(null)} className={GHOST_BTN}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => void runConfirm()}
              className={cn(
                PRIMARY_BTN,
                confirm?.kind === "deactivate" && "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:text-white dark:hover:bg-destructive/90",
              )}
            >
              {busyId !== null ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {confirm?.kind === "default" ? "Make default" : "Turn off"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function TemplateCard({
  template,
  onView,
  onEdit,
  onDuplicate,
  onMakeDefault,
  onDeactivate,
}: {
  template: ReportTemplateRecord;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMakeDefault: () => void;
  onDeactivate: () => void;
}) {
  const { questions, written } = React.useMemo(() => templateStats(template), [template]);
  const updated = formatUpdated(template.updated_at);

  return (
    <div
      className={cn(
        CARD,
        "group flex flex-col gap-4 p-5 transition-shadow hover:shadow-[0_6px_24px_rgba(40,36,20,0.08)]",
        template.is_default && "ring-2 ring-[#30302E]/80 dark:ring-[#ECE9E0]/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground">
          <FileText aria-hidden="true" className="size-[18px]" />
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {template.is_default ? <DefaultPill /> : null}
          <CategoryChip category={template.category} />
        </div>
      </div>

      <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
        <h3 className="truncate text-[15px] font-medium group-hover:underline">{template.name}</h3>
        <p className={cn("mt-1 line-clamp-2 text-[13px]", template.description ? "text-muted-foreground" : "text-muted-foreground/60 italic")}>
          {template.description || "No description"}
        </p>
      </button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
        <span>
          {questions} {questions === 1 ? "question" : "questions"}
        </span>
        <span aria-hidden="true">·</span>
        <span className={cn(written < SECTIONS.length && "text-[#9A5B12] dark:text-amber-300")}>
          {written}/{SECTIONS.length} sections
        </span>
        {updated ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{updated}</span>
          </>
        ) : null}
      </div>

      <div className="-mx-1 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center">
          <IconButton label="View" onClick={onView}>
            <Eye aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label="Edit" onClick={onEdit}>
            <Pencil aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label="Duplicate" onClick={onDuplicate}>
            <Copy aria-hidden="true" className="size-4" />
          </IconButton>
          {!template.is_default ? (
            <IconButton label="Make default" onClick={onMakeDefault}>
              <Star aria-hidden="true" className="size-4" />
            </IconButton>
          ) : null}
        </div>
        {!template.is_default ? (
          <IconButton label="Turn off" onClick={onDeactivate} danger>
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        ) : (
          <span className="pr-2 text-xs text-muted-foreground">Used for walk-ins</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

function TemplateView({ template }: { template: ReportTemplateRecord }) {
  const { content, written, questions } = React.useMemo(() => templateStats(template), [template]);
  const groups = [...new Set(SECTIONS.map((s) => s.group))];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      {/* Document */}
      <div className="grid content-start gap-6">
        {template.description ? <p className="text-sm text-muted-foreground">{template.description}</p> : null}
        {groups.map((group) => (
          <section key={group} className="grid gap-3">
            <h3 className="px-1 text-[13px] font-medium">{group}</h3>
            {SECTIONS.filter((s) => s.group === group).map((s) => {
              const text = (content[s.key] ?? "").toString();
              return (
                <div key={s.key} className="rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
                  {SECTIONS.filter((x) => x.group === group).length > 1 ? (
                    <p className="mb-1.5 text-xs text-muted-foreground">{s.title}</p>
                  ) : null}
                  {text.trim() ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      <WithPlaceholders text={text} />
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not written — the examiner starts from a blank box.</p>
                  )}
                </div>
              );
            })}
          </section>
        ))}

        <section className="grid gap-3">
          <h3 className="px-1 text-[13px] font-medium">Default questions</h3>
          {content.questions.length ? (
            <ol className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-[#F7F6F1] dark:bg-muted/40">
              {content.questions.map((q, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <p className="min-w-0 flex-1 text-sm leading-relaxed">
                    <WithPlaceholders text={q.text} />
                  </p>
                  {q.answer ? (
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium ring-1 ring-border/60 dark:bg-card">{q.answer}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl bg-[#F7F6F1] p-4 text-sm text-muted-foreground italic dark:bg-muted/40">
              No default questions. Reports use the questions recorded during the exam.
            </p>
          )}
        </section>
      </div>

      {/* Facts */}
      <aside className="grid content-start gap-3 lg:sticky lg:top-0">
        <ViewTile label="Questions">
          <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">{questions}</span>
        </ViewTile>
        <ViewTile label="Sections written">
          <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">
            {written}
            <span className="text-base text-muted-foreground">/{SECTIONS.length}</span>
          </span>
        </ViewTile>
        <ViewTile label="Session defaults">
          <dl className="grid gap-1.5 text-sm">
            <Fact label="Identity">{content.identity_document_type === "emirates_id" ? "Emirates ID" : content.identity_document_type ? "Passport" : "—"}</Fact>
            <Fact label="Cooperation">{content.cooperation_mode === "counter_measures" ? "Counter-measures" : "Cooperated"}</Fact>
            <Fact label="Time">
              {content.exam_start_time || "—"} – {content.exam_end_time || "—"}
            </Fact>
          </dl>
        </ViewTile>
        <ViewTile label="Template ID">
          <code className="truncate text-xs">{template.slug}</code>
        </ViewTile>
      </aside>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit tabs                                                           */
/* ------------------------------------------------------------------ */

function DetailsTab({
  form,
  set,
  setContent,
  categories,
  slugTaken,
  onSlugChange,
  wasDefault,
}: {
  form: EditorState;
  set: <K extends keyof EditorState>(key: K, value: EditorState[K]) => void;
  setContent: (key: keyof ReportContent, value: unknown) => void;
  categories: string[];
  slugTaken: boolean;
  onSlugChange: (value: string) => void;
  wasDefault: boolean;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-8">
      <div className="grid content-start gap-5">
        <Field id="tpl-name" label="Name">
          <Input id="tpl-name" className={FIELD} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Pre-employment screening" />
        </Field>
        <Field id="tpl-description" label="Description" optional hint="Helps staff pick the right template.">
          <Textarea
            id="tpl-description"
            className={cn(AREA, "min-h-24")}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Who this template is for and when to use it"
          />
        </Field>
        <div className="grid gap-1.5">
          <span className="px-1 text-[13px] font-medium">Category</span>
          <Segmented
            label="Category"
            value={form.category}
            onChange={(v) => set("category", v)}
            options={categories.map((c) => ({ value: c, label: categoryLabel(c) }))}
            className="self-start"
          />
        </div>
        <Field
          id="tpl-slug"
          label="Template ID"
          hint={slugTaken ? undefined : "Generated from the name. Used internally and must be unique."}
        >
          <Input
            id="tpl-slug"
            className={cn(FIELD, "font-mono text-[13px]", slugTaken && "ring-2 ring-destructive")}
            value={form.slug}
            onChange={(e) => onSlugChange(e.target.value)}
          />
          {slugTaken ? <p className="px-1 text-xs text-destructive">Another template already uses this ID.</p> : null}
        </Field>
      </div>

      <div className="grid content-start gap-4">
        <ToggleRow
          title="Organization default"
          body={
            wasDefault
              ? "This is the default. To change it, make another template the default."
              : "Used for walk-in clients and clients without their own template."
          }
          checked={form.isDefault}
          disabled={wasDefault}
          onChange={() => set("isDefault", !form.isDefault)}
        />
        <ToggleRow
          title="Active"
          body={form.isDefault ? "The default template is always active." : "When off, it isn't offered for new reports."}
          checked={form.isDefault || form.active}
          disabled={form.isDefault}
          onChange={() => set("active", !form.active)}
        />

        <div className="grid gap-4 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
          <div>
            <p className="text-sm font-medium">Session defaults</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Prefilled on new reports; the examiner can change them.</p>
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Identity document</span>
            <Segmented
              label="Identity document"
              value={(form.content.identity_document_type || "passport") as "passport" | "emirates_id"}
              onChange={(v) => setContent("identity_document_type", v)}
              options={[
                { value: "passport", label: "Passport" },
                { value: "emirates_id", label: "Emirates ID" },
              ]}
              className="self-start bg-white dark:bg-card [&_button]:h-8 [&_button]:text-xs"
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Cooperation</span>
            <Segmented
              label="Cooperation"
              value={(form.content.cooperation_mode || "cooperated") as "cooperated" | "counter_measures"}
              onChange={(v) => setContent("cooperation_mode", v)}
              options={[
                { value: "cooperated", label: "Cooperated" },
                { value: "counter_measures", label: "Counter-measures" },
              ]}
              className="self-start bg-white dark:bg-card [&_button]:h-8 [&_button]:text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Start time</span>
              <Input type="time" className={cn(FIELD, "h-10 bg-white dark:bg-card")} value={form.content.exam_start_time ?? ""} onChange={(e) => setContent("exam_start_time", e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">End time</span>
              <Input type="time" className={cn(FIELD, "h-10 bg-white dark:bg-card")} value={form.content.exam_end_time ?? ""} onChange={(e) => setContent("exam_end_time", e.target.value)} />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Question count sentence</span>
            <Input
              className={cn(FIELD, "h-10 bg-white dark:bg-card")}
              value={form.content.pre_exam_question_count_text ?? ""}
              onChange={(e) => setContent("pre_exam_question_count_text", e.target.value)}
              placeholder="4 relevant and 3 comparison questions"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function WordingTab({ content, setContent }: { content: ReportContent; setContent: (key: keyof ReportContent, value: unknown) => void }) {
  const refs = React.useRef<Partial<Record<TextKey, HTMLTextAreaElement | HTMLInputElement | null>>>({});
  const [focused, setFocused] = React.useState<TextKey>("pre_test_phase_text");
  const groups = [...new Set(SECTIONS.map((s) => s.group))];

  const insert = (token: string) => {
    const el = refs.current[focused];
    const current = (content[focused] ?? "").toString();
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    setContent(focused, next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const focusedSection = SECTIONS.find((s) => s.key === focused);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-8">
      <div className="grid content-start gap-7">
        {groups.map((group) => (
          <section key={group} className="grid gap-4">
            <h3 className="px-1 text-sm font-medium">{group}</h3>
            {SECTIONS.filter((s) => s.group === group).map((s) => (
              <div key={s.key} className="grid gap-1.5">
                <label htmlFor={`tpl-${s.key}`} className="flex items-center justify-between gap-2 px-1 text-[13px] font-medium">
                  {s.title}
                  {focused === s.key ? <span className="text-[11px] font-normal text-muted-foreground">Placeholders insert here</span> : null}
                </label>
                {s.short ? (
                  <Input
                    id={`tpl-${s.key}`}
                    ref={(el) => {
                      refs.current[s.key] = el;
                    }}
                    className={FIELD}
                    value={(content[s.key] ?? "").toString()}
                    onFocus={() => setFocused(s.key)}
                    onChange={(e) => setContent(s.key, e.target.value)}
                  />
                ) : (
                  <Textarea
                    id={`tpl-${s.key}`}
                    ref={(el) => {
                      refs.current[s.key] = el;
                    }}
                    className={cn(AREA, "min-h-32")}
                    value={(content[s.key] ?? "").toString()}
                    onFocus={() => setFocused(s.key)}
                    onChange={(e) => setContent(s.key, e.target.value)}
                  />
                )}
                <p className="px-1 text-xs text-muted-foreground">{s.hint}</p>
              </div>
            ))}
          </section>
        ))}
      </div>

      <aside className="lg:sticky lg:top-0 lg:self-start">
        <div className="grid gap-3 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
          <div>
            <p className="text-sm font-medium">Insert placeholder</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Into <span className="font-medium text-foreground">{focusedSection ? `${focusedSection.group.split(" · ")[1]} — ${focusedSection.title}` : "the selected box"}</span>. Filled in when a report is created.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((p) => (
              <button
                key={p.token}
                type="button"
                title={p.token}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(p.token)}
                className="flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-xs font-medium ring-1 ring-border/60 transition-colors hover:bg-[#30302E] hover:text-[#FAF9F5] dark:bg-card dark:hover:bg-[#ECE9E0] dark:hover:text-[#1A1915]"
              >
                <Plus aria-hidden="true" className="size-3" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function QuestionsTab({ questions, setQuestions }: { questions: ReportQuestion[]; setQuestions: (fn: (q: ReportQuestion[]) => ReportQuestion[]) => void }) {
  const lastRef = React.useRef<HTMLInputElement | null>(null);
  const [focusNew, setFocusNew] = React.useState(false);

  React.useEffect(() => {
    if (focusNew) {
      lastRef.current?.focus();
      setFocusNew(false);
    }
  }, [focusNew, questions.length]);

  const update = (index: number, patch: Partial<ReportQuestion>) =>
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  const move = (index: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const target = index + dir;
      if (target < 0 || target >= qs.length) return qs;
      const next = [...qs];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const add = () => {
    setQuestions((qs) => [...qs, { text: "", answer: "No", evaluation: "No Reaction" }]);
    setFocusNew(true);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Default questions</p>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            Used when a report is started without questions recorded during the exam. Empty rows are dropped when you save.
          </p>
        </div>
        <button type="button" onClick={add} className={cn(GHOST_BTN, "h-9")}>
          <Plus aria-hidden="true" className="size-4" />
          Add question
        </button>
      </div>

      {questions.length === 0 ? (
        <button
          type="button"
          onClick={add}
          className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40"
        >
          <Plus aria-hidden="true" className="size-5" />
          No default questions yet. Add the first one.
        </button>
      ) : (
        <ol className="grid gap-2">
          {questions.map((q, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#F7F6F1] p-2 pl-4 sm:flex-nowrap dark:bg-muted/40">
              <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <Input
                ref={i === questions.length - 1 ? lastRef : undefined}
                aria-label={`Question ${i + 1}`}
                className={cn(FIELD, "h-10 min-w-0 flex-1 basis-[calc(100%-2.5rem)] bg-white sm:basis-auto dark:bg-card")}
                value={q.text}
                placeholder="Did you…?"
                onChange={(e) => update(i, { text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && i === questions.length - 1 && q.text.trim()) {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <Segmented
                label={`Default answer for question ${i + 1}`}
                value={q.answer === "Yes" ? "Yes" : "No"}
                onChange={(v) => update(i, { answer: v })}
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
                className="bg-white dark:bg-card [&_button]:h-8 [&_button]:px-3 [&_button]:text-xs"
              />
              <div className="flex shrink-0 items-center">
                <IconButton label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp aria-hidden="true" className="size-4" />
                </IconButton>
                <IconButton label="Move down" onClick={() => move(i, 1)} disabled={i === questions.length - 1}>
                  <ArrowDown aria-hidden="true" className="size-4" />
                </IconButton>
                <IconButton label="Remove question" danger onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}>
                  <Trash2 aria-hidden="true" className="size-4" />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      )}
      {questions.length > 0 ? <p className="px-1 text-xs text-muted-foreground">Press Enter in the last question to add another.</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
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

function ToggleRow({ title, body, checked, disabled, onChange }: { title: string; body: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onChange={onChange} label={title} />
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
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
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
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function CategoryChip({ category }: { category: string }) {
  const eva = category === "eva";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        eva ? "bg-[#ECE8F8] text-[#4B3F8F] dark:bg-[#2E2A45] dark:text-[#C9C0F2]" : "bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground",
      )}
    >
      {categoryLabel(category)}
    </span>
  );
}

function DefaultPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#30302E] px-2 py-0.5 text-xs font-medium text-[#FAF9F5] dark:bg-[#ECE9E0] dark:text-[#1A1915]">
      <Star aria-hidden="true" className="size-3 fill-current" />
      Default
    </span>
  );
}
