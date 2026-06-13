"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Copy, Eye, FileText, Loader2, Mail, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { authenticatedFetch } from "@/lib/api-client";

type IntakeRequest = {
  id: number;
  token: string;
  recipient_email: string;
  recipient_name: string;
  status: string;
  expires_at: string;
  created_at: string;
  submitted_at?: string;
  agreed_at?: string;
};

type SubmittedSubject = {
  id?: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  employee_ref?: string;
  nationality?: string;
  gender?: string;
};

type IntakeSubmission = {
  id: number;
  client_id: number;
  client_name: string;
  status: string;
  submitted_at?: string;
  agreed_at?: string;
  subjects: SubmittedSubject[];
};

async function sendIntakeRequest(input: {
  client_id: number;
  recipient_email: string;
  recipient_name: string;
  message: string;
  expiry_days: number;
}): Promise<IntakeRequest> {
  const res = await authenticatedFetch("/api/intake-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return (data.intake_request ?? data) as IntakeRequest;
}

async function fetchIntakeRequests(clientId: number): Promise<IntakeRequest[]> {
  const res = await authenticatedFetch(`/api/intake-requests?client_id=${clientId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load intake requests");
  return data as IntakeRequest[];
}

async function resendIntakeRequest(id: number): Promise<void> {
  const res = await authenticatedFetch(`/api/intake-requests/${id}/resend`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Failed to resend (${res.status})`);
  }
}

async function fetchIntakeSubmission(id: number): Promise<IntakeSubmission> {
  const res = await authenticatedFetch(`/api/intake-requests/${id}/submission`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load submission");
  return data as IntakeSubmission;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
function intakeLink(token: string) {
  // The public intake page lives on the frontend, not the API.
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/intake/${token}`;
}

export default function SendIntakePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const { client } = useClientDetail();

  const [email, setEmail] = React.useState(client?.email ?? "");
  const [name, setName] = React.useState(client?.contact_person ?? "");
  const [message, setMessage] = React.useState("");
  const [expiryDays, setExpiryDays] = React.useState("7");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState<IntakeRequest | null>(null);
  const [history, setHistory] = React.useState<IntakeRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [resendingId, setResendingId] = React.useState<number | null>(null);
  const [viewing, setViewing] = React.useState<IntakeSubmission | null>(null);
  const [loadingSubmissionId, setLoadingSubmissionId] = React.useState<number | null>(null);

  // Pre-fill from client once loaded
  React.useEffect(() => {
    if (client) {
      if (!email) setEmail(client.email ?? "");
      if (!name) setName(client.contact_person ?? "");
    }
  }, [client]);

  React.useEffect(() => {
    fetchIntakeRequests(clientId)
      .then(setHistory)
      .catch(() => {/* silent */})
      .finally(() => setLoadingHistory(false));
  }, [clientId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { toast.error("Recipient email is required"); return; }

    setSending(true);
    try {
      const req = await sendIntakeRequest({
        client_id: clientId,
        recipient_email: email.trim(),
        recipient_name: name.trim(),
        message: message.trim(),
        expiry_days: Number(expiryDays) || 7,
      });
      setSent(req);
      toast.success("Roster request sent!");
      setHistory((prev) => [req, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send roster request");
    } finally {
      setSending(false);
    }
  }

  function copyLink(token: string) {
    void navigator.clipboard.writeText(intakeLink(token));
    toast.success("Link copied to clipboard");
  }

  async function handleResend(id: number) {
    setResendingId(id);
    try {
      await resendIntakeRequest(id);
      toast.success("Reminder email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResendingId(null);
    }
  }

  async function handleView(id: number) {
    setLoadingSubmissionId(id);
    try {
      const sub = await fetchIntakeSubmission(id);
      setViewing(sub);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load submission");
    } finally {
      setLoadingSubmissionId(null);
    }
  }

  const statusColor: Record<string, string> = {
    pending: "text-amber-600 bg-amber-50",
    submitted: "text-green-700 bg-green-50",
    expired: "text-muted-foreground bg-muted",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href={`/dashboard/clients/${clientId}/roster`}
          className="mt-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Request examinee roster</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Email a secure link to <strong>{client?.name ?? "this organisation"}</strong> so they
            can submit their list of people to be examined — without logging in.
          </p>
        </div>
      </div>

      {/* Pointer to the separate form-template sender */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
        <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          Looking to send a <strong>consent, privacy, or intake questionnaire</strong> form? Those
          are sent from the{" "}
          <Link
            href={`/dashboard/clients/${clientId}/documents`}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Document Vault
          </Link>{" "}
          using <strong>Send form link</strong>. This page only collects the examinee roster.
        </span>
      </div>

      {/* Success banner */}
      {sent && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              Form sent to {sent.recipient_email}
            </div>
            <p className="text-sm text-green-800">
              You can also copy the link below to share it manually.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={intakeLink(sent.token)}
                className="font-mono text-xs bg-white"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyLink(sent.token)}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> New intake request
          </CardTitle>
          <CardDescription>
            An email with the form link will be sent to the address below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">Recipient email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="hr@organisation.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Recipient name</Label>
                <Input
                  id="name"
                  placeholder="HR Manager"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message">Custom message (optional)</Label>
              <Textarea
                id="message"
                rows={3}
                placeholder="Please fill in the details of all employees scheduled for examination on 20 June…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 w-40">
              <Label htmlFor="expiry">Link expires after (days)</Label>
              <Input
                id="expiry"
                type="number"
                min={1}
                max={30}
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={sending} className="gap-2">
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="h-4 w-4" /> Send roster request</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previous requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No intake requests sent yet.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {history.map((req) => (
                <li key={req.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{req.recipient_email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {new Date(req.created_at).toLocaleDateString("en-GB")} · Expires{" "}
                      {new Date(req.expires_at).toLocaleDateString("en-GB")}
                    </p>
                    {req.status === "submitted" && req.agreed_at && (
                      <p
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-700"
                        title={`Declaration accepted ${new Date(req.agreed_at).toLocaleString("en-GB")}`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Signed off {new Date(req.agreed_at).toLocaleDateString("en-GB")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[req.status] ?? "text-muted-foreground"}`}
                    >
                      {req.status}
                    </span>
                    {req.status === "pending" && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyLink(req.token)}
                          title="Copy link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => void handleResend(req.id)}
                          disabled={resendingId === req.id}
                          title="Resend email"
                        >
                          {resendingId === req.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                    {req.status === "submitted" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5"
                        onClick={() => void handleView(req.id)}
                        disabled={loadingSubmissionId === req.id}
                        title="View submitted details"
                      >
                        {loadingSubmissionId === req.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        View
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Submitted details dialog */}
      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submitted examinees</DialogTitle>
            <DialogDescription>
              {viewing?.subjects.length ?? 0} examinee
              {(viewing?.subjects.length ?? 0) === 1 ? "" : "s"} submitted for{" "}
              {viewing?.client_name}.
            </DialogDescription>
          </DialogHeader>

          {viewing && (
            <div className="space-y-4">
              {/* Consent banner */}
              <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                <div className="text-green-800">
                  {viewing.agreed_at ? (
                    <>
                      Declaration accepted on{" "}
                      <strong>
                        {new Date(viewing.agreed_at).toLocaleString("en-GB")}
                      </strong>{" "}
                      — the submitter confirmed the details are accurate and consented to the data
                      being used for examinations.
                    </>
                  ) : (
                    <>
                      Submitted on{" "}
                      <strong>
                        {viewing.submitted_at
                          ? new Date(viewing.submitted_at).toLocaleString("en-GB")
                          : "—"}
                      </strong>
                      . No declaration timestamp was recorded for this submission.
                    </>
                  )}
                </div>
              </div>

              {/* Examinees table */}
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Phone</th>
                      <th className="px-3 py-2 font-semibold">Ref / ID</th>
                      <th className="px-3 py-2 font-semibold">Nationality</th>
                      <th className="px-3 py-2 font-semibold">Gender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {viewing.subjects.map((s, i) => (
                      <tr key={s.id ?? i}>
                        <td className="px-3 py-2 font-medium">
                          {`${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{s.email || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.phone || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.employee_ref || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.nationality || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.gender || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
