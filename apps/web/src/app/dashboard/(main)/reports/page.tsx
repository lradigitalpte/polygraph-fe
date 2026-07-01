"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileSignature,
  Search,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Calendar,
  Mail,
  ShieldAlert,
  Loader2,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ClipboardList,
  Lock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  fetchSecureShares,
  createSecureShare,
  regenerateSecureShare,
  fetchConsolidatedStats,
  type SecureReportShare,
  type ConsolidatedReportStats,
} from "@/lib/reports";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import { formatSubjectName } from "@/lib/subjects";

export default function ReportsDashboard() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();

  React.useEffect(() => {
    if (!userLoading && !can("exam:view")) {
      toast.error("You don't have permission to access reports.");
      router.replace("/dashboard");
    }
  }, [userLoading, can, router]);

  const [shares, setShares] = React.useState<SecureReportShare[]>([]);
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([]);
  const [stats, setStats] = React.useState<ConsolidatedReportStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [revealedPasswords, setRevealedPasswords] = React.useState<Record<number, boolean>>({});

  // Share Dialog states
  const [selectedExamId, setSelectedExamId] = React.useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [sharing, setSharing] = React.useState(false);


  const loadData = async () => {
    setLoading(true);
    try {
      const [sharesData, statsData, apptsData] = await Promise.all([
        fetchSecureShares({ search }),
        fetchConsolidatedStats(),
        fetchAppointments(),
      ]);
      setShares(sharesData);
      setStats(statsData);
      setAppointments(apptsData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadData();
  }, [search]);

  const handleOpenShare = (examId: number, initialEmail?: string) => {
    setSelectedExamId(examId);
    setRecipientEmail(initialEmail || "");
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
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate secure share");
    } finally {
      setSharing(false);
    }
  };

  const handleOpenReportEditor = (examId: number, subjectName: string) => {
    router.push(`/dashboard/reports/${examId}?subject=${encodeURIComponent(subjectName)}`);
  };

  const handleCopyLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const secureLink = `${origin}/shared/report/${token}`;
    navigator.clipboard.writeText(secureLink);
    toast.success("Secure link copied to clipboard");
  };

  const handleRegenerate = async (id: number) => {
    if (!confirm("Are you sure you want to regenerate this link and password? Previous links and passwords will expire immediately.")) {
      return;
    }
    try {
      const updated = await regenerateSecureShare(id);
      toast.success("Secure share link rotated successfully! A new notification email was sent.");
      setShares((prev) => prev.map((s) => (s.id === id ? updated : s)));
      const statsData = await fetchConsolidatedStats();
      setStats(statsData);
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

  // Filter appointments that have active exams
  const completedExams = React.useMemo(() => {
    return appointments.filter((appt) => appt.exam_id && appt.exam_id > 0);
  }, [appointments]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Gradients */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-[2.5rem] bg-card/40 border border-border/50 backdrop-blur-xl shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <FileSignature className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Forensic Reports</h1>
          </div>
          <p className="text-muted-foreground text-sm font-bold opacity-70 uppercase tracking-widest text-[10px] pl-1 pt-1">
            Consolidated Corporate Secure Document shares
          </p>
          <p className="text-xs text-muted-foreground pl-1 pt-2 max-w-2xl">
            Audit, view, and rotate secure report links generated for subjects and clients. Reports are sent as password-encrypted PDFs with temporary self-unlock tokens.
          </p>
        </div>
      </div>

      {/* Statistics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Reports Issued", value: stats?.total_reports ?? 0, icon: FileSignature, color: "bg-primary/10 text-primary" },
          {
            label: "No Deception Indicated (NDI)",
            value: stats?.ndi_count ?? 0,
            icon: CheckCircle,
            color: "bg-emerald-500/10 text-emerald-500",
          },
          {
            label: "Deception Indicated (DI)",
            value: stats?.di_count ?? 0,
            icon: AlertTriangle,
            color: "bg-rose-500/10 text-rose-500",
          },
          {
            label: "Inconclusive Findings",
            value: stats?.inconclusive_count ?? 0,
            icon: HelpCircle,
            color: "bg-neutral-500/10 text-neutral-500",
          },
        ].map((stat, i) => (
          <Card key={i} className="border-border/40 bg-card/30 backdrop-blur-md shadow-xl overflow-hidden group hover:border-primary/30 transition-all hover:scale-[1.02]">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className={cn("p-2.5 rounded-xl shadow-inner", stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60">{stat.label}</p>
              </div>
              <p className="text-3xl font-black tracking-tighter">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sessions Ready for Report Building */}
      <Card className="border-border/40 bg-card/30 backdrop-blur-md rounded-[2.5rem] overflow-hidden shadow-xl">
        <CardHeader className="px-8 pt-8">
          <CardTitle className="text-base flex items-center gap-2 font-bold">
            <ClipboardList className="h-5 w-5 text-primary" />
            Sessions Ready for Report Customization
          </CardTitle>
          <CardDescription>
            Exams that have active documentation records. Build their detailed template reports before secure sharing.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-8 py-4">Examinee</th>
                  <th className="px-8 py-4">Requesting Client</th>
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-8 text-center text-muted-foreground italic">
                      Loading sessions...
                    </td>
                  </tr>
                ) : completedExams.length > 0 ? (
                  completedExams.map((appt) => {
                    const examineeName = appt.subject
                      ? formatSubjectName(appt.subject)
                      : `Examinee #${appt.subject_id}`;
                    return (
                      <tr key={appt.id} className="hover:bg-primary/[0.02] transition-colors">
                        <td className="px-8 py-4 font-semibold text-foreground">
                          {examineeName}
                        </td>
                        <td className="px-8 py-4 text-xs font-medium text-foreground/80">
                          {appt.client?.name || "Corporate"}
                        </td>
                        <td className="px-8 py-4 text-xs text-muted-foreground">
                          {new Date(appt.scheduled_at).toLocaleDateString()}
                        </td>
                        <td className="px-8 py-4">
                          <Badge variant={appt.status === "completed" ? "default" : "outline"}>
                            {appt.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-8 py-4 text-right space-x-2">
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
                    <td colSpan={5} className="px-8 py-12 text-center text-muted-foreground italic">
                      No active sessions found. Ensure session documentation is started or completed.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Table */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-all" />
            <Input
              placeholder="Search by examinee or email..."
              className="h-12 pl-12 rounded-2xl bg-card border-border/50 focus:border-primary/50 transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-border/40 bg-card/20 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Examinee</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Recipient Email</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Passcode</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Status / Expiration</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                      Loading reports list...
                    </td>
                  </tr>
                ) : shares.length > 0 ? (
                  shares.map((share) => {
                    const isExpired = new Date(share.expires_at).getTime() < Date.now();
                    const formattedExpiry = new Date(share.expires_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                    return (
                      <tr key={share.id} className="hover:bg-primary/[0.03] transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-base leading-none text-foreground">
                              {share.subject ? `${share.subject.first_name} ${share.subject.last_name}` : "Unknown Subject"}
                            </span>
                            <span className="flex items-center gap-2">
                              {share.exam_report && (
                                <Badge
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-[0.1em]",
                                    share.exam_report.verdict === "NDI" ? "bg-emerald-500/10 text-emerald-600 border-none" :
                                    share.exam_report.verdict === "DI" ? "bg-rose-500/10 text-rose-600 border-none" :
                                    "bg-neutral-500/10 text-neutral-600 border-none"
                                  )}
                                >
                                  {share.exam_report.verdict}
                                </Badge>
                              )}
                              <span className="text-[9px] text-muted-foreground/80 font-normal">
                                Sent: {new Date(share.created_at).toLocaleDateString()}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6 font-semibold text-xs text-foreground/80">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-4 w-4 text-primary/70 shrink-0" />
                            {share.recipient_email}
                          </div>
                        </td>
                        <td className="px-8 py-6">
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
                        <td className="px-8 py-6 space-y-1">
                          <Badge
                            className={cn(
                              "rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                              isExpired ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
                            )}
                          >
                            {isExpired ? "Expired" : "Active"}
                          </Badge>
                          <div className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {isExpired ? `Expired ${formattedExpiry}` : `Expires ${formattedExpiry}`}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                            onClick={() => handleCopyLink(share.token)}
                            title="Copy Secure Link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl hover:bg-amber-500/10 hover:text-amber-600 transition-all"
                            onClick={() => void handleRegenerate(share.id)}
                            title="Regenerate / Rotate Link"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <a
                            href={`/shared/report/${share.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-blue-500/10 hover:text-blue-600 transition-all"
                              title="Visit Shared Portal"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                      No report shares found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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

    </div>
  );
}
