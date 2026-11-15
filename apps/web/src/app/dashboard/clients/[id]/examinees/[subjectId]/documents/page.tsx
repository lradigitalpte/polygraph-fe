"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DocumentVaultTabs, VAULT_CARD, type VaultDocument } from "@/components/dashboard/document-vault-tabs";
import { DocumentSharesPanel } from "@/components/dashboard/document-shares-panel";
import { FormRequestsPanel } from "@/components/dashboard/form-requests-panel";
import { SendFormDialog } from "@/components/dashboard/send-form-dialog";
import {
  SendDocumentDialog,
  type SendDocumentTarget,
} from "@/components/dashboard/send-document-dialog";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { fetchSubjectFormRequests, type FormRequestRecord } from "@/lib/forms";
import { fetchDocumentShares, type DocumentShareRecord } from "@/lib/document-shares";
import {
  fetchSubjectDocuments,
  formatSubjectName,
  uploadSubjectDocument,
} from "@/lib/subjects";
import { Check, Loader2, Send, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const UPLOAD_TYPES = [
  { value: "test_chart", label: "Test chart" },
  { value: "biometric_trace", label: "Biometric trace" },
  { value: "report", label: "Report" },
  { value: "consent_form", label: "Consent (scan)" },
  { value: "upload", label: "General file" },
] as const;

const chip = (active: boolean) =>
  cn(
    "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
    active ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background" : "bg-[#F3F1EA] text-[#3D3929] hover:bg-[#ECE9E0] dark:bg-muted dark:text-foreground",
  );
import { toast } from "sonner";

export default function ExamineeDocumentsPage() {
  const { subject, subjectId, clientId, loading, error } = useSubjectDetail();
  const [formRequests, setFormRequests] = React.useState<FormRequestRecord[]>([]);
  const [requestsLoading, setRequestsLoading] = React.useState(true);
  const [documents, setDocuments] = React.useState<VaultDocument[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [docsLoading, setDocsLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [uploadType, setUploadType] = React.useState("test_chart");
  const [shares, setShares] = React.useState<DocumentShareRecord[]>([]);
  const [sharesLoading, setSharesLoading] = React.useState(true);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [sendTarget, setSendTarget] = React.useState<SendDocumentTarget | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const sendAfterUploadRef = React.useRef(false);

  const loadDocuments = React.useCallback(async () => {
    setDocsLoading(true);
    try {
      const docs = await fetchSubjectDocuments(subjectId);
      setDocuments(
        docs.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          source: d.source ?? "upload",
          created_at: d.created_at,
          url: d.url,
          form_data: d.form_data,
        }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load documents");
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, [subjectId]);

  const loadFormRequests = React.useCallback(async () => {
    setRequestsLoading(true);
    try {
      setFormRequests(await fetchSubjectFormRequests(subjectId));
    } catch {
      setFormRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [subjectId]);

  const loadShares = React.useCallback(async () => {
    setSharesLoading(true);
    try {
      setShares(await fetchDocumentShares({ subject_id: subjectId }));
    } catch {
      setShares([]);
    } finally {
      setSharesLoading(false);
    }
  }, [subjectId]);

  React.useEffect(() => {
    void loadDocuments();
    void loadFormRequests();
    void loadShares();
  }, [loadDocuments, loadFormRequests, loadShares]);

  const handleFormSent = async () => {
    await Promise.all([loadDocuments(), loadFormRequests()]);
  };

  const handleSendDocument = (doc: VaultDocument) => {
    setSendTarget({ documentId: doc.id, documentName: doc.name });
    setSendOpen(true);
  };

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
      const created = await uploadSubjectDocument(subjectId, file, uploadType);
      toast.success(`${file.name} saved to the vault`);
      await loadDocuments();
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

  if (loading || docsLoading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading documents…
      </div>
    );
  }

  if (error || !subject) {
    return <div className="rounded-[26px] bg-destructive/5 p-6 text-destructive ring-1 ring-destructive/20">{error || "Examinee not found."}</div>;
  }

  const displayName = formatSubjectName(subject).trim() || "this examinee";
  const pendingForms = formRequests.filter(
    (r) => r.status === "sent" || r.status === "opened"
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Documents</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Forms and files for {displayName}. Send consent or prep forms to their email; completed answers appear under Received.
        </p>
      </div>

      <DocumentVaultTabs
        clientName={displayName}
        documents={documents}
        pendingCount={pendingForms}
        showManualTab={false}
        onSendDocument={handleSendDocument}
        sharesPanel={
          <DocumentSharesPanel
            shares={shares}
            loading={sharesLoading}
            onRefresh={() => void loadShares()}
          />
        }
        sendTab={
          <div className="space-y-5">
            <SendFormDialog
              clientId={clientId}
              clientName={displayName}
              defaultEmail={subject.email}
              subjectId={subjectId}
              subjectName={displayName}
              audience="examinee"
              onSent={() => void handleFormSent()}
              trigger={
                <Button className="h-11 gap-2 rounded-full px-5">
                  <Send className="h-4 w-4" />
                  Send a form link
                </Button>
              }
            />
            <FormRequestsPanel
              requests={formRequests}
              loading={requestsLoading}
              onRefresh={() => void loadFormRequests()}
            />
          </div>
        }
        uploadTab={
          <section className={cn(VAULT_CARD, "space-y-5 p-6")}>
            <div>
              <h3 className="text-[15px] font-medium">Upload a chart or file</h3>
              <p className="text-[13px] text-muted-foreground">Test charts, traces, reports or scans for {displayName}.</p>
            </div>
            <div className="grid gap-1.5">
              <span className="px-1 text-[13px] font-medium">What is it?</span>
              <div role="radiogroup" aria-label="Document type" className="flex flex-wrap gap-1.5">
                {UPLOAD_TYPES.map((t) => (
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
                if (file && !uploading) {
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
              className="flex h-10 w-fit items-center gap-1.5 rounded-full px-4 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-60 dark:hover:bg-muted"
            >
              <Send aria-hidden="true" className="size-3.5" /> Upload, then send it to the examinee
            </button>
          </section>
        }
        manualTab={null}
      />

      <SendDocumentDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        scope="subject"
        clientId={clientId}
        subjectId={subjectId}
        target={sendTarget}
        defaultEmail={subject.email}
        defaultName={displayName}
        onSent={() => void loadShares()}
      />
    </div>
  );
}
