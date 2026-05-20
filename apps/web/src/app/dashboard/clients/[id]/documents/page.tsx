"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DocumentVaultTabs } from "@/components/dashboard/document-vault-tabs";
import { FormRequestsPanel } from "@/components/dashboard/form-requests-panel";
import { SendFormDialog } from "@/components/dashboard/send-form-dialog";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { isOrganizationClient } from "@/lib/client-types";
import { fetchClientFormRequests, type FormRequestRecord } from "@/lib/forms";
import { submitClientFormDocument, uploadClientDocument } from "@/lib/clients";
import { Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";

export default function ClientDocumentsPage() {
  const { client, documents, loading, error, clientId, refreshDocuments } = useClientDetail();
  const [formRequests, setFormRequests] = React.useState<FormRequestRecord[]>([]);
  const [requestsLoading, setRequestsLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [savingForm, setSavingForm] = React.useState(false);
  const [uploadType, setUploadType] = React.useState("upload");
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

  React.useEffect(() => {
    void loadFormRequests();
  }, [loadFormRequests]);

  const handleFormSent = async () => {
    await Promise.all([refreshDocuments(), loadFormRequests()]);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadClientDocument(clientId, file, uploadType);
      toast.success("File saved to vault");
      await refreshDocuments();
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Document Vault</h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          Send forms by email, collect completed answers, or upload files for {client.name}. Use the
          tabs below — each step is separate so nothing overlaps.
        </p>
      </div>

      <DocumentVaultTabs
        clientName={client.name}
        documents={vaultDocs}
        pendingCount={pendingForms}
        sendTab={
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <SendFormDialog
                clientId={clientId}
                clientName={client.name}
                defaultEmail={client.email}
                audience={isOrganizationClient(client) ? "corporate" : "individual"}
                onSent={() => void handleFormSent()}
                trigger={
                  <Button size="lg" className="gap-2">
                    <Send className="h-4 w-4" />
                    Send form link by email
                  </Button>
                }
              />
            </div>
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
              <CardTitle className="text-base">Upload a file</CardTitle>
              <CardDescription>
                PDFs, scans, reports, or any document you already have on disk.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>Document type</Label>
                <Select value={uploadType} onValueChange={(value) => setUploadType(String(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upload">General file</SelectItem>
                    <SelectItem value="consent_form">Consent (scan)</SelectItem>
                    <SelectItem value="intake_form">Intake (scan)</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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
                Choose file to upload
              </Button>
            </CardContent>
          </Card>
        }
        manualTab={
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger render={<Button variant="outline" />}>Open staff entry form</DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={handleFormSubmit}>
                <DialogHeader>
                  <DialogTitle>Staff entry — paper form</DialogTitle>
                  <DialogDescription>
                    Type what is on a signed paper form. This does not email the client.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="form-name">Title on file</Label>
                    <Input
                      id="form-name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formType} onValueChange={(value) => setFormType(String(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="intake_form">Intake</SelectItem>
                        <SelectItem value="consent_form">Consent</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full name</Label>
                    <Input
                      id="full-name"
                      value={formFields.full_name}
                      onChange={(e) =>
                        setFormFields((f) => ({ ...f, full_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="id-number">ID number</Label>
                    <Input
                      id="id-number"
                      value={formFields.id_number}
                      onChange={(e) =>
                        setFormFields((f) => ({ ...f, id_number: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for exam</Label>
                    <Textarea
                      id="reason"
                      value={formFields.reason_for_exam}
                      onChange={(e) =>
                        setFormFields((f) => ({ ...f, reason_for_exam: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formFields.additional_notes}
                      onChange={(e) =>
                        setFormFields((f) => ({ ...f, additional_notes: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={savingForm}>
                    {savingForm && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save to Received
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
    </div>
  );
}
