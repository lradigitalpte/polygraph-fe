"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  ShieldAlert,
  Loader2,
  FileSignature,
  KeyRound,
  Download,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchPublicSharedReport, type SecureReportShare } from "@/lib/reports";

export default function PublicReportUnlockPage() {
  const params = useParams();
  const token = params.token as string;

  const [share, setShare] = React.useState<SecureReportShare | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revealPin, setRevealPin] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    fetchPublicSharedReport(token)
      .then((data) => {
        setShare(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load document details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    toast.success("PIN copied to clipboard");
  };

  const formattedExpiry = share
    ? new Date(share.expires_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="min-h-screen bg-neutral-950 py-16 px-4 text-white relative flex flex-col justify-between">
      {/* Background aesthetics */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/5 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="max-w-md mx-auto w-full z-10 space-y-8 my-auto">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img src="/logo.png" alt="Polygraph UAE" className="h-14 w-auto object-contain" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            Polygraph Forensic System
          </p>
          <h2 className="text-sm font-black text-white/50 uppercase tracking-[0.1em]">
            Secure Verification Vault
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error || !share ? (
          <Card className="border-white/10 bg-neutral-900/60 backdrop-blur-xl rounded-md shadow-2xl p-4">
            <CardHeader className="text-center">
              <div className="mx-auto h-12 w-12 rounded-md bg-white/5 text-white flex items-center justify-center mb-2 border border-white/10">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg font-black tracking-tight text-white">Share Link Unavailable</CardTitle>
              <CardDescription className="text-white/60 pt-2 leading-relaxed">
                {error || "This document share link is invalid, has expired, or was rotated."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="border-white/10 bg-neutral-900/60 backdrop-blur-xl rounded-md shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 inset-x-0 h-px bg-white/15" />
            <CardHeader className="p-8">
              <div className="flex items-center gap-2 text-primary mb-3">
                <FileSignature className="h-5 w-5" />
                <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-md border border-white/10 text-white/80">
                  Forensic Verification
                </span>
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-white leading-snug">
                Unlock Forensic Report
              </CardTitle>
              <CardDescription className="text-white/60">
                Issued for: <span className="font-bold text-white">{share.subject ? `${share.subject.first_name} ${share.subject.last_name}` : "Subject"}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              {/* Document details list */}
              <div className="space-y-4 rounded-md border border-white/10 bg-white/[0.02] p-5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40 uppercase font-black tracking-wider">Document Name</span>
                  <span className="font-bold truncate max-w-[200px] text-white">Forensic_Report_{share.subject?.last_name || "Examinee"}.pdf</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40 uppercase font-black tracking-wider">Verification Link Expiry</span>
                  <span className="font-bold inline-flex items-center gap-1 text-white">
                    <Clock className="h-3 w-3 text-white/70" />
                    {formattedExpiry}
                  </span>
                </div>
              </div>

              {/* Passcode disclosure area */}
              {share.protection_mode !== "secure_link" ? <div className="p-6 rounded-md border border-white/10 bg-white/[0.02] text-center space-y-4 relative">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">PDF Decryption PIN</p>
                  <p className="text-[10px] text-white/50 max-w-xs mx-auto leading-relaxed">
                    Use this passcode to decrypt and open the PDF report document attached to your email.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-4 bg-neutral-950/80 rounded-md border border-white/10 p-4 max-w-xs mx-auto">
                  <span className="font-mono text-2xl font-black tracking-[0.3em] text-white pl-2">
                    {revealPin ? (share.password || "—") : "••••••"}
                  </span>
                  <div className="flex gap-1 border-l border-white/10 pl-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/60 hover:text-white"
                      onClick={() => setRevealPin(!revealPin)}
                    >
                      {revealPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    {revealPin && share.password && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/60 hover:text-white"
                        onClick={() => handleCopyPin(share.password!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div> : <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-5 text-center"><p className="text-sm font-black text-emerald-300">No PDF password required</p><p className="mt-1 text-xs leading-relaxed text-white/50">This delivery was authorized for password-free download through the expiring secure link.</p></div>}

              {/* PDF download direct button */}
              {share.pdf_url && (
                <div className="pt-2">
                  <a href={share.pdf_url} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full h-13 rounded-md bg-white hover:bg-neutral-200 text-black font-black uppercase tracking-widest text-xs gap-2">
                      <Download className="h-4 w-4" /> {share.protection_mode === "secure_link" ? "Download PDF" : "Download Protected PDF"}
                    </Button>
                  </a>
                </div>
              )}

              {/* Explanation notes */}
              <div className="flex gap-2.5 items-start text-xs text-white/40 leading-relaxed rounded-md border border-white/10 p-4 bg-white/[0.01]">
                <AlertCircle className="h-4 w-4 text-white/70 shrink-0 mt-0.5" />
                <p>{share.protection_mode === "secure_link" ? "This download link is time-limited. After downloading, the PDF can be opened and forwarded without a password. Verify its QR code or verification code to confirm authenticity." : "This forensic PDF is password-protected. Open it in a PDF viewer and enter the six-digit PIN shown above when prompted."}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="text-center text-xs text-white/30 z-10 pt-8">
        © {new Date().getFullYear()} Polygraph Forensic System. All rights reserved.
      </div>
    </div>
  );
}
