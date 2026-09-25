"use client";

import * as React from "react";
import { Eye, FileSignature, Globe, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  CredentialsRichTextContent,
  CredentialsRichTextEditor,
} from "@/components/dashboard/credentials-rich-text-editor";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type EditorState = {
  title: string;
  kind: AgreementKind;
  bodyHtml: string;
  active: boolean;
};

const emptyEditor: EditorState = { title: "", kind: "custom", bodyHtml: "", active: true };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function AgreementsSettingsPage() {
  const { can } = useCurrentUser();
  const canManage = can("agreement:manage");

  const [templates, setTemplates] = React.useState<AgreementTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [org, setOrg] = React.useState<OrganizationSettings | null>(null);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AgreementTemplate | null>(null);
  const [form, setForm] = React.useState<EditorState>(emptyEditor);
  const [saving, setSaving] = React.useState(false);

  const [preview, setPreview] = React.useState<{ title: string; bodyHtml: string } | null>(null);

  const loadTemplates = React.useCallback(async () => {
    try {
      setLoading(true);
      setTemplates(await fetchAgreementTemplates(true));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load agreements");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTemplates();
    // Branding is only used by the preview, so a failure here is not worth a toast.
    fetchOrganizationSettings().then(setOrg).catch(() => setOrg(null));
  }, [loadTemplates]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyEditor);
    setEditorOpen(true);
  };

  const openEdit = (template: AgreementTemplate) => {
    setEditing(template);
    setForm({
      title: template.title,
      kind: template.kind,
      bodyHtml: template.body_html,
      active: template.active,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (isCredentialsEmpty(form.bodyHtml)) {
      toast.error("Terms are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        kind: form.kind,
        body_html: form.bodyHtml,
        active: form.active,
      };
      if (editing) {
        const saved = await updateAgreementTemplate(editing.id, payload);
        toast.success(
          saved.version > editing.version
            ? `Saved as version ${saved.version}`
            : "Agreement saved",
        );
      } else {
        await createAgreementTemplate(payload);
        toast.success("Agreement created");
      }
      setEditorOpen(false);
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save agreement");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (template: AgreementTemplate) => {
    try {
      await setAgreementTemplateActive(template.id, !template.active);
      toast.success(template.active ? "Agreement deactivated" : "Agreement activated");
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update agreement");
    }
  };

  const handleDelete = async (template: AgreementTemplate) => {
    if (
      !window.confirm(
        `Delete "${template.title}"? It will no longer be available to send. Agreements already sent or signed are not affected.`,
      )
    ) {
      return;
    }
    try {
      await deleteAgreementTemplate(template.id);
      toast.success("Agreement deleted");
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete agreement");
    }
  };

  const wordingChanged =
    editing != null && (form.title.trim() !== editing.title || form.bodyHtml !== editing.body_html);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agreements</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Terms clients read and sign online before their session: payment, rescheduling, cancellation, or anything
            else you add.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" /> New agreement
          </Button>
        ) : null}
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Agreement library</CardTitle>
          <CardDescription>
            Active agreements are offered when you send agreements to a client. Editing the wording creates a new
            version — clients who already signed keep the exact text they agreed to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading agreements...</p>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
              <FileSignature className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No agreements yet.</p>
              {canManage ? (
                <Button variant="outline" size="sm" onClick={openCreate}>
                  Create your first agreement
                </Button>
              ) : null}
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{template.title}</p>
                    <Badge variant="outline">{AGREEMENT_KIND_LABELS[template.kind] ?? template.kind}</Badge>
                    <Badge variant="secondary">v{template.version}</Badge>
                    {!template.active ? <Badge variant="secondary">Inactive</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDate(template.updated_at)}
                    {template.updated_by ? ` by ${template.updated_by}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setPreview({ title: template.title, bodyHtml: template.body_html })}
                  >
                    <Eye className="h-4 w-4 mr-1" /> Preview
                  </Button>
                  {canManage ? (
                    <>
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openEdit(template)}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => void handleToggleActive(template)}
                      >
                        <Power className="h-4 w-4 mr-1" /> {template.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-destructive"
                        onClick={() => void handleDelete(template)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit agreement" : "New agreement"}</DialogTitle>
            <DialogDescription>
              Write the terms exactly as the client should read them. Use headings and numbered lists for clauses.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <div className="space-y-2">
                <Label htmlFor="agreement-title">Title</Label>
                <Input
                  id="agreement-title"
                  placeholder="e.g. Cancellation Policy"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.kind}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, kind: String(value) as AgreementKind }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AGREEMENT_KIND_LABELS) as AgreementKind[]).map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {AGREEMENT_KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Terms</Label>
              <CredentialsRichTextEditor
                value={form.bodyHtml}
                onChange={(html) => setForm((prev) => ({ ...prev, bodyHtml: html }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: Boolean(checked) }))}
              />
              Active — offer this agreement when sending to clients
            </label>

            {wordingChanged ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Saving will create version {editing.version + 1}. Clients who already received version{" "}
                {editing.version} keep that wording.
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setPreview({ title: form.title.trim() || "Untitled agreement", bodyHtml: form.bodyHtml })}
              disabled={isCredentialsEmpty(form.bodyHtml)}
            >
              <Eye className="h-4 w-4 mr-1" /> Preview
            </Button>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save agreement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={preview != null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Client preview</DialogTitle>
            <DialogDescription>How this agreement appears on the client signing page.</DialogDescription>
          </DialogHeader>
          {preview ? <ClientPreview org={org} title={preview.title} bodyHtml={preview.bodyHtml} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Mirrors the layout of the public signing page so staff can check wording and branding. */
function ClientPreview({
  org,
  title,
  bodyHtml,
}: {
  org: OrganizationSettings | null;
  title: string;
  bodyHtml: string;
}) {
  const websiteLabel = org?.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="bg-muted/40">
      <div className="flex items-center justify-between gap-4 border-b bg-background px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {org?.logo_data_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- inline data: URL
            <img src={org.logo_data_url} alt="" className="h-10 max-w-32 object-contain" />
          ) : null}
          <span className="font-semibold truncate">{org?.name || "Your organization"}</span>
        </div>
        {websiteLabel ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Globe className="h-3.5 w-3.5" /> {websiteLabel}
          </span>
        ) : null}
      </div>
      <div className="p-6">
        <div className="rounded-2xl border bg-background p-5 space-y-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="max-h-80 overflow-y-auto rounded-xl border bg-muted/20 p-4">
            <CredentialsRichTextContent html={bodyHtml} className="text-sm text-foreground" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox disabled /> I have read and agree to the {title}
          </label>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Preview only. Clients sign all agreements together at the bottom of the page.
        </p>
      </div>
    </div>
  );
}
