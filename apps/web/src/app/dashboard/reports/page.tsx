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
  XCircle,
  HelpCircle,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  fetchSecureShares,
  regenerateSecureShare,
  fetchConsolidatedStats,
  type SecureReportShare,
  type ConsolidatedReportStats,
} from "@/lib/reports";

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
  const [stats, setStats] = React.useState<ConsolidatedReportStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [revealedPasswords, setRevealedPasswords] = React.useState<Record<number, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [sharesData, statsData] = await Promise.all([
        fetchSecureShares({ search }),
        fetchConsolidatedStats(),
      ]);
      setShares(sharesData);
      setStats(statsData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load report shares");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadData();
  }, [search]);

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
      // Reload stats
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
                            <RefreshCw className="h-4 w-4 animate-spin-hover" />
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
    </div>
  );
}
