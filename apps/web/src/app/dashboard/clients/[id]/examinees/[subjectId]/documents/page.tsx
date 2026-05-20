"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DocumentVaultTabs } from "@/components/dashboard/document-vault-tabs";
import { FormRequestsPanel } from "@/components/dashboard/form-requests-panel";
import { SendFormDialog } from "@/components/dashboard/send-form-dialog";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { fetchSubjectFormRequests, type FormRequestRecord } from "@/lib/forms";
import {
  fetchSubjectDocuments,
  formatSubjectName,
  uploadSubjectDocument,
} from "@/lib/subjects";
import { Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";

export default function ExamineeDocumentsPage() {
  const { subject, subjectId, clientId, loading, error } = useSubjectDetail();
  const [formRequests, setFormRequests] = React.useState<FormRequestRecord[]>([]);
  const [requestsLoading, setRequestsLoading] = React.useState(true);
  const [documents, setDocuments] = React.useState<
    import("@/components/dashboard/document-vault-tabs").VaultDocument[]
  >([]);
  const [docsLoading, setDocsLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [uploadType, setUploadType] = React.useState("test_chart");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  React.useEffect(() => {
    void loadDocuments();
    void loadFormRequests();
  }, [loadDocuments, loadFormRequests]);

  const handleFormSent = async () => {
    await Promise.all([loadDocuments(), loadFormRequests()]);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadSubjectDocument(subjectId, file, uploadType);
      toast.success("File saved");
      await loadDocuments();
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
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
      </div>
    );
  }

  if (error || !subject) {
    return <p className="text-destructive">{error || "Examinee not found"}</p>;
  }

  const displayName = formatSubjectName(subject);
  const pendingForms = formRequests.filter(
    (r) => r.status === "sent" || r.status === "opened"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          Forms and files for {displayName}. Send consent or prep forms to their email; completed
          answers appear under Received.
        </p>
      </div>

      <DocumentVaultTabs
        clientName={displayName}
        documents={documents}
        pendingCount={pendingForms}
        showManualTab={false}
        sendTab={
          <div className="space-y-4">
            <SendFormDialog
              clientId={clientId}
              clientName={displayName}
              defaultEmail={subject.email}
              subjectId={subjectId}
              subjectName={displayName}
              audience="examinee"
              onSent={() => void handleFormSent()}
              trigger={
                <Button size="lg" className="gap-2">
                  <Send className="h-4 w-4" />
                  Send form link to examinee
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload chart or file</CardTitle>
              <CardDescription>Test charts, traces, reports, or scans.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={uploadType} onValueChange={(value) => setUploadType(String(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test_chart">Test chart</SelectItem>
                    <SelectItem value="biometric_trace">Biometric trace</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="consent_form">Consent</SelectItem>
                    <SelectItem value="upload">General file</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
              <Button
                className="w-full"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Choose file
              </Button>
            </CardContent>
          </Card>
        }
        manualTab={null}
      />
    </div>
  );
}
