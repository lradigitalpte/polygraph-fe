"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createReportTemplate,
  deactivateReportTemplate,
  fetchReportTemplates,
  parseTemplateEditorContent,
  templateContentToJSON,
  updateReportTemplate,
  type ReportTemplateInput,
} from "@/lib/report-templates";
import type { ReportContent, ReportTemplateRecord } from "@/lib/report-template";

type EditorState = {
  slug: string;
  name: string;
  category: string;
  description: string;
  isDefault: boolean;
  active: boolean;
  content: ReportContent;
};

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

function templateToEditor(template?: ReportTemplateRecord): EditorState {
  if (!template) {
    return {
      slug: "",
      name: "",
      category: "generic",
      description: "",
      isDefault: false,
      active: true,
      content: emptyContent(),
    };
  }
  return {
    slug: template.slug,
    name: template.name,
    category: template.category,
    description: template.description || "",
    isDefault: template.is_default,
    active: template.active,
    content: parseTemplateEditorContent(template.content_json),
  };
}

export default function ReportTemplatesSettingsPage() {
  const [templates, setTemplates] = React.useState<ReportTemplateRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<EditorState>(templateToEditor());

  const loadTemplates = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchReportTemplates(true);
      setTemplates(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const openCreate = () => {
    setEditingId(null);
    setForm(templateToEditor());
    setOpen(true);
  };

  const openEdit = (template: ReportTemplateRecord) => {
    setEditingId(template.id);
    setForm(templateToEditor(template));
    setOpen(true);
  };

  const updateContent = (field: keyof ReportContent, value: string) => {
    setForm((prev) => ({
      ...prev,
      content: { ...prev.content, [field]: value },
    }));
  };

  const updateQuestion = (index: number, field: "text" | "answer" | "evaluation", value: string) => {
    setForm((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        questions: prev.content.questions.map((item, idx) =>
          idx === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.name.trim()) {
      toast.error("Slug and name are required");
      return;
    }
    setSaving(true);
    try {
      const payload: ReportTemplateInput = {
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        content_json: templateContentToJSON(form.content),
        is_default: form.isDefault,
        active: form.active,
      };
      if (editingId) {
        await updateReportTemplate(editingId, payload);
        toast.success("Template updated");
      } else {
        await createReportTemplate(payload);
        toast.success("Template created");
      }
      setOpen(false);
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (template: ReportTemplateRecord) => {
    if (!window.confirm(`Deactivate template "${template.name}"?`)) return;
    try {
      await deactivateReportTemplate(template.id);
      toast.success("Template deactivated");
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate template");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Report Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage editable report presets for walk-in clients, Eva role templates, and other corporate clients.
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> New template
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Template library</CardTitle>
          <CardDescription>Templates seed new reports. Saved exam reports remain independent snapshots.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates found.</p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{template.name}</p>
                    <Badge variant="outline">{template.category}</Badge>
                    {template.is_default ? <Badge>Org default</Badge> : null}
                    {!template.active ? <Badge variant="secondary">Inactive</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{template.description || template.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openEdit(template)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  {template.active && !template.is_default ? (
                    <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => void handleDeactivate(template)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Deactivate
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit report template" : "Create report template"}</DialogTitle>
            <DialogDescription>
              Use placeholders like {"{{subject_name}}"}, {"{{client_name}}"}, {"{{exam_date}}"}, {"{{pronoun_possessive}}"}, {"{{identity_sentence}}"}, and {"{{cooperation_sentence}}"}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: String(value) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">Generic</SelectItem>
                    <SelectItem value="eva">Eva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.isDefault} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isDefault: Boolean(checked) }))} />
                Set as organization default
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: Boolean(checked) }))} />
                Active
              </label>
            </div>

            <div className="space-y-2">
              <Label>Section 1 intro</Label>
              <Textarea rows={3} value={form.content.pre_test_phase_text} onChange={(e) => updateContent("pre_test_phase_text", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Section 1 notes</Label>
              <Textarea rows={3} value={form.content.pre_test_notes} onChange={(e) => updateContent("pre_test_notes", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Section 2 intro</Label>
              <Textarea rows={3} value={form.content.exam_phase_text} onChange={(e) => updateContent("exam_phase_text", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Instrument paragraph</Label>
              <Textarea rows={3} value={form.content.limestone_notes} onChange={(e) => updateContent("limestone_notes", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Section 3 opinion skeleton</Label>
              <Textarea rows={3} value={form.content.opinion_phase_text} onChange={(e) => updateContent("opinion_phase_text", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Section 4 follow-up default</Label>
              <Input value={form.content.section_4_follow_up} onChange={(e) => updateContent("section_4_follow_up", e.target.value)} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Default questions</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      content: {
                        ...prev.content,
                        questions: [...prev.content.questions, { text: "", answer: "No", evaluation: "No Reaction" }],
                      },
                    }))
                  }
                >
                  Add question
                </Button>
              </div>
              {form.content.questions.map((question, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-border/50 p-3">
                  <Input value={question.text} onChange={(e) => updateQuestion(index, "text", e.target.value)} placeholder="Question text" />
                  <Input value={question.answer} onChange={(e) => updateQuestion(index, "answer", e.target.value)} placeholder="Default answer" />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
