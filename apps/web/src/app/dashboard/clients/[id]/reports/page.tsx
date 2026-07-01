"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  FileSignature,
  Mail,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Loader2,
  Lock,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchSecureShares,
  createSecureShare,
  regenerateSecureShare,
  type SecureReportShare,
} from "@/lib/reports";
import { formatSubjectName } from "@/lib/subjects";
import { ReportEditorDialog } from "@/components/dashboard/report-editor-dialog";

export default function ClientReportsPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const { client, appointments, loading: clientLoading } = useClientDetail();

  const [shares, setShares] = React.useState<SecureReportShare[]>([]);
  const [sharesLoading, setSharesLoading] = React.useState(true);
  const [revealedPasswords, setRevealedPasswords] = React.useState<Record<number, boolean>>({});

  // Share modal states
  const [selectedExamId, setSelectedExamId] = React.useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [sharing, setSharing] = React.useState(false);

  // Report builder modal states
  const [reportEditorOpen, setReportEditorOpen] = React.useState(false);
  const [reportEditorExamId, setReportEditorExamId] = React.useState<number | null>(null);
  const [reportEditorSubjectName, setReportEditorSubjectName] = React.useState("");

  const handleOpenReportEditor = (examId: number, subjectName: string) => {
    setReportEditorExamId(examId);
    setReportEditorSubjectName(subjectName);
    setReportEditorOpen(true);
  };

  const loadShares = async () => {
    if (!Number.isFinite(clientId)) return;
    setSharesLoading(true);
    try {
      const data = await fetchSecureShares({ client_id: clientId });
      setShares(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load shares history");
    } finally {
      setSharesLoading(false);
    }
  };

  React.useEffect(() => {
    void loadShares();
  }, [clientId]);

  const handleOpenShare = (examId: number, initialEmail?: string) => {
    setSelectedExamId(examId);
    setRecipientEmail(initialEmail || client?.email || "");
  };

  const handleCreateShare = async () => {
    if (!selectedExamId || !recipientEmail.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSharing(true);
    try {
      await createSecureShare(null, recipientEmail.trim(), selectedExamId);
      toast.success("Secure PDF encrypted and sent successfully!");
      setSelectedExamId(null);
      void loadShares();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate secure share");
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const secureLink = `${origin}/shared/report/${token}`;
    navigator.clipboard.writeText(secureLink);
    toast.success("Secure link copied to clipboard");
  };

  const handleRegenerate = async (id: number) => {
    if (!confirm("Are you sure you want to rotate this link? The previous link and passcode will expire immediately.")) {
      return;
    }
    try {
      const updated = await regenerateSecureShare(id);
      toast.success("Link rotated! A new passcode email has been sent.");
      setShares((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rotate link");
    }
  };

  const togglePasswordReveal = (id: number) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Filter appointments that have a linked exam documentation
  const completedExams = React.useMemo(() => {
    return appointments.filter((appt) => appt.exam_id && appt.exam_id > 0);
  }, [appointments]);

  if (clientLoading) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Secure Forensic Reports</h1>
        <p className="text-sm text-muted-foreground">
          Generate, encrypt, and securely distribute forensic examination reports to client stakeholders.
        </p>
      </div>

      {/* Roster of Completed Sessions */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Sessions Ready for Report Sharing
          </CardTitle>
          <CardDescription>
            Exams that have active documentation records. Sharing will build a password-encrypted PDF and deliver a separate secure link.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Examinee</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {completedExams.length > 0 ? (
                  completedExams.map((appt) => {
                    const examineeName = appt.subject
                      ? formatSubjectName(appt.subject)
                      : `Examinee #${appt.subject_id}`;
                    return (
                      <tr key={appt.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 font-semibold text-foreground">
                          {examineeName}
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {new Date(appt.scheduled_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={appt.status === "completed" ? "default" : "outline"}>
                            {appt.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl text-xs gap-1.5 font-semibold"
                            onClick={() => handleOpenReportEditor(appt.exam_id!, examineeName)}
                          >
                            <FileSignature className="h-3.5 w-3.5" />
                            Write / Edit Report
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-xl text-xs gap-1.5 font-bold"
                            onClick={() => handleOpenShare(appt.exam_id!, appt.subject?.email)}
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Email Secure Report
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">
                      No active sessions found. Ensure session documentation is started or completed.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Shares history */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Shared Reports Log
          </CardTitle>
          <CardDescription>
            History of secure document links issued for this client account.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Examinee</th>
                  <th className="px-6 py-4">Recipient</th>
                  <th className="px-6 py-4">Passcode</th>
                  <th className="px-6 py-4">Expiration</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {sharesLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground italic">
                      Loading shared reports log...
                    </td>
                  </tr>
                ) : shares.length > 0 ? (
                  shares.map((share) => {
                    const isExpired = new Date(share.expires_at).getTime() < Date.now();
                    return (
                      <tr key={share.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 font-semibold text-foreground">
                          {share.subject ? `${share.subject.first_name} ${share.subject.last_name}` : "Unknown"}
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground font-semibold">
                          {share.recipient_email}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm tracking-wider font-bold">
                              {revealedPasswords[share.id] ? (share.password || "—") : "••••••"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => togglePasswordReveal(share.id)}
                            >
                              {revealedPasswords[share.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <Badge variant={isExpired ? "destructive" : "secondary"}>
                            {isExpired ? "Expired" : "Active"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right space-x-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => handleCopyLink(share.token)}
                            title="Copy Secure Link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-amber-500 hover:text-amber-600"
                            onClick={() => void handleRegenerate(share.id)}
                            title="Rotate / Regenerate Link"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground italic">
                      No reports shared yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Share Dialog */}
      <Dialog open={selectedExamId !== null} onOpenChange={(open) => !open && setSelectedExamId(null)}>
        <DialogContent className="rounded-3xl border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              Secure Document Share
            </DialogTitle>
            <DialogDescription>
              Generate a password-encrypted PDF of the forensic report and send it to the recipient.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipient-email">Recipient Email Address</Label>
              <Input
                id="recipient-email"
                type="email"
                placeholder="client@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                An email will be sent containing the encrypted report PDF as an attachment, with a separate secure link they can use to unlock the document.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setSelectedExamId(null)}
              disabled={sharing}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl gap-2 font-bold"
              onClick={() => void handleCreateShare()}
              disabled={sharing}
            >
              {sharing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Generate & Share
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reportEditorExamId && (
        <ReportEditorDialog
          open={reportEditorOpen}
          onOpenChange={setReportEditorOpen}
          examId={reportEditorExamId}
          subjectName={reportEditorSubjectName}
          onSaveSuccess={() => {
            void loadShares();
          }}
        />
      )}
    </div>
  );
}
