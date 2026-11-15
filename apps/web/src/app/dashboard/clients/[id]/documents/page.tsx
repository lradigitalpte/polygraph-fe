"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DocumentVaultTabs, VAULT_CARD, type VaultDocument } from "@/components/dashboard/document-vault-tabs";
import { cn } from "@/lib/utils";
import { DocumentSharesPanel } from "@/components/dashboard/document-shares-panel";
import { FormRequestsPanel } from "@/components/dashboard/form-requests-panel";
import { SendFormDialog } from "@/components/dashboard/send-form-dialog";
import {
  SendDocumentDialog,
  type SendDocumentTarget,
} from "@/components/dashboard/send-document-dialog";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { isOrganizationClient } from "@/lib/client-types";
import { fetchClientFormRequests, type FormRequestRecord } from "@/lib/forms";
import { fetchDocumentShares, type DocumentShareRecord } from "@/lib/document-shares";
import { submitClientFormDocument, uploadClientDocument } from "@/lib/clients";
import { Check, Loader2, PenLine, Send, Upload } from "lucide-react";
import { toast } from "sonner";

export default function ClientDocumentsPage() {
  const { client, documents, loading, error, clientId, refreshDocuments } = useClientDetail();
  const [formRequests, setFormRequests] = React.useState<FormRequestRecord[]>([]);
  const [requestsLoading, setRequestsLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [savingForm, setSavingForm] = React.useState(false);
  const [uploadType, setUploadType] = React.useState("upload");
  const [shares, setShares] = React.useState<DocumentShareRecord[]>([]);
  const [sharesLoading, setSharesLoading] = React.useState(true);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [sendTarget, setSendTarget] = React.useState<SendDocumentTarget | null>(null);
  const sendAfterUploadRef = React.useRef(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formName, setFormName] = React.useState("Client intake form");
  const [formType, setFormType] = React.useState("intake_form");
  const [formFields, setFormFields] = React.useState({
    full_name: "",
    id_number: "",
    reason_for_exam: "",
    consent_acknowledged: "yes",
    additional_notes: "",
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadFormRequests = React.useCallback(async () => {
    setRequestsLoading(true);
    try {
      setFormRequests(await fetchClientFormRequests(clientId));
    } catch {
      setFormRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [clientId]);

  const loadShares = React.useCallback(async () => {
    setSharesLoading(true);
    try {
      setShares(await fetchDocumentShares({ client_id: clientId }));
    } catch {
      setShares([]);
    } finally {
      setSharesLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void loadFormRequests();
    void loadShares();
  }, [loadFormRequests, loadShares]);

  const handleFormSent = async () => {
    await Promise.all([refreshDocuments(), loadFormRequests()]);
  };

  const handleSendDocument = (doc: VaultDocument) => {
    setSendTarget({ documentId: doc.id, documentName: doc.name });
    setSendOpen(true);
  };

  const [dragging, setDragging] = React.useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    const thenSend = sendAfterUploadRef.current;
    sendAfterUploadRef.current = false;
    setUploading(true);
    try {
      const created = await uploadClientDocument(clientId, file, uploadType);
      toast.success(`${file.name} saved to the vault`);
      await refreshDocuments();
      if (thenSend) {
        setSendTarget({ documentId: created.id, documentName: created.name });
        setSendOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingForm(true);
    try {
      await submitClientFormDocument(clientId, {
        name: formName,
        type: formType,
        form_data: formFields,
      });
      toast.success("Form recorded in vault");
      setFormOpen(false);
      await refreshDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingForm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading document vault...
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
        {error || "Client record not found."}
      </div>
    );
  }

  const pendingForms = formRequests.filter(
    (r) => r.status === "sent" || r.status === "opened"
  ).length;

  const vaultDocs = documents.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    source: d.source,
    created_at: d.created_at,
    url: d.url,
    form_data: d.form_data,
  }));

  const chip = (active: boolean) =>
    cn(
      "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
      active ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background" : "bg-[#F3F1EA] text-[#3D3929] hover:bg-[#ECE9E0] dark:bg-muted dark:text-foreground",
    );
  const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Document vault</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Everything on file for {client.name}: forms they filled in, signed agreements and files your team uploaded.</p>
      </div>

      <DocumentVaultTabs
        clientName={client.name}
        documents={vaultDocs}
        pendingCount={pendingForms}
        onSendDocument={handleSendDocument}
        sharesPanel={<DocumentSharesPanel shares={shares} loading={sharesLoading} onRefresh={() => void loadShares()} />}
        sendTab={
          <div className="space-y-5">
            <SendFormDialog
              clientId={clientId}
              clientName={client.name}
              defaultEmail={client.email}
              audience={isOrganizationClient(client) ? "corporate" : "individual"}
              onSent={() => void handleFormSent()}
              trigger={
                <Button className="h-11 gap-2 rounded-full px-5">
                  <Send className="h-4 w-4" />
                  Send a form link
                </Button>
              }
            />
            <FormRequestsPanel requests={formRequests} loading={requestsLoading} onRefresh={() => void loadFormRequests()} />
          </div>
        }
        uploadTab={
          <section className={cn(VAULT_CARD, "space-y-5 p-6")}>
            <div>
              <h3 className="text-[15px] font-medium">Upload a file</h3>
              <p className="text-[13px] text-muted-foreground">PDFs, scans, photos or reports you already have.</p>
            </div>
            <div className="grid gap-1.5">
              <span className="px-1 text-[13px] font-medium">What is it?</span>
              <div role="radiogroup" aria-label="Document type" className="flex flex-wrap gap-1.5">
                {[
                  { value: "upload", label: "General file" },
                  { value: "consent_form", label: "Consent (scan)" },
                  { value: "intake_form", label: "Intake (scan)" },
                  { value: "report", label: "Report" },
                  { value: "other", label: "Other" },
                ].map((t) => (
                  <button key={t.value} type="button" role="radio" aria-checked={uploadType === t.value} onClick={() => setUploadType(t.value)} className={chip(uploadType === t.value)}>
                    {uploadType === t.value ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                sendAfterUploadRef.current = false;
                fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  sendAfterUploadRef.current = false;
                  void uploadFile(file);
                }
              }}
              className={cn(
                "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors disabled:opacity-60",
                dragging ? "border-primary bg-primary/5" : "border-border bg-[#F7F6F1] hover:bg-[#F3F1EA] dark:bg-muted/40 dark:hover:bg-muted",
              )}
            >
              {uploading ? <Loader2 aria-hidden="true" className="size-7 animate-spin text-muted-foreground" /> : <Upload aria-hidden="true" className="size-7 text-muted-foreground" />}
              <span className="text-sm font-medium">{uploading ? "Uploading…" : dragging ? "Drop to upload" : "Drop a file here, or click to choose"}</span>
              <span className="text-xs text-muted-foreground">It&apos;s saved to the vault straight away.</span>
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                sendAfterUploadRef.current = true;
                fileInputRef.current?.click();
              }}
              className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-60 dark:hover:bg-muted"
            >
              <Send aria-hidden="true" className="size-3.5" /> Upload, then send it to the client
            </button>
          </section>
        }
        manualTab={
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger render={<Button className="h-11 gap-2 rounded-full px-5" />}>
              <PenLine className="h-4 w-4" /> Type in a paper form
            </DialogTrigger>
            <DialogContent className="max-w-lg rounded-[26px]">
              <form onSubmit={handleFormSubmit}>
                <DialogHeader>
                  <DialogTitle>Paper form</DialogTitle>
                  <DialogDescription>Type what&apos;s on the signed paper form. Nothing is emailed to the client.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="form-name" className="px-1 text-[13px] font-medium">Title on file</Label>
                    <Input id="form-name" className={FIELD} value={formName} onChange={(e) => setFormName(e.target.value)} required />
                  </div>
                  <div className="grid gap-1.5">
                    <span className="px-1 text-[13px] font-medium">Category</span>
                    <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-1.5">
                      {[
                        { value: "intake_form", label: "Intake" },
                        { value: "consent_form", label: "Consent" },
                        { value: "other", label: "Other" },
                      ].map((t) => (
                        <button key={t.value} type="button" role="radio" aria-checked={formType === t.value} onClick={() => setFormType(t.value)} className={chip(formType === t.value)}>
                          {formType === t.value ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="full-name" className="px-1 text-[13px] font-medium">Full name</Label>
                      <Input id="full-name" className={FIELD} value={formFields.full_name} onChange={(e) => setFormFields((f) => ({ ...f, full_name: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="id-number" className="px-1 text-[13px] font-medium">ID number</Label>
                      <Input id="id-number" className={FIELD} value={formFields.id_number} onChange={(e) => setFormFields((f) => ({ ...f, id_number: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reason" className="px-1 text-[13px] font-medium">Reason for exam</Label>
                    <Textarea id="reason" className="rounded-xl border-0 bg-[#F3F1EA] shadow-none dark:bg-muted" value={formFields.reason_for_exam} onChange={(e) => setFormFields((f) => ({ ...f, reason_for_exam: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="notes" className="px-1 text-[13px] font-medium">Notes</Label>
                    <Textarea id="notes" className="rounded-xl border-0 bg-[#F3F1EA] shadow-none dark:bg-muted" value={formFields.additional_notes} onChange={(e) => setFormFields((f) => ({ ...f, additional_notes: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="rounded-full" disabled={savingForm}>
                    {savingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save to vault
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <SendDocumentDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        scope="client"
        clientId={clientId}
        target={sendTarget}
        defaultEmail={client.email}
        defaultName={client.name}
        onSent={() => void loadShares()}
      />
    </div>
  );
}
