"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, FileCheck2, ShieldCheck, TriangleAlert, Upload } from "lucide-react";
import { fetchReportVerification, verifyReportPDF, type ReportVerificationResult } from "@/lib/reports";

export default function VerifyReportPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code || "").toUpperCase();
  const [record, setRecord] = React.useState<ReportVerificationResult | null>(null);
  const [result, setResult] = React.useState<ReportVerificationResult | null>(null);
  const [error, setError] = React.useState("");
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    if (!code) return;
    fetchReportVerification(code).then(setRecord).catch((err) => setError(err instanceof Error ? err.message : "Verification record not found"));
  }, [code]);

  async function handleFile(file?: File) {
    if (!file) return;
    setChecking(true);
    setError("");
    setResult(null);
    try {
      setResult(await verifyReportPDF(code, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify this PDF");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <img src="/logo.png" alt="Polygraph UAE" className="h-12 w-auto rounded bg-white p-2" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-400">Official verification</p>
            <h1 className="text-2xl font-black">Verify a forensic report</h1>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
          {record ? (
            <div className="mb-6 flex gap-3 rounded-xl border border-emerald-800 bg-emerald-950/50 p-4">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
              <div>
                <p className="font-bold text-emerald-300">Verification record found</p>
                <p className="mt-1 font-mono text-sm text-slate-300">{record.verification_code}</p>
                {record.issued_at && <p className="mt-1 text-xs text-slate-400">Issued {new Date(record.issued_at).toLocaleString()}</p>}
              </div>
            </div>
          ) : !error ? (
            <p className="mb-6 text-sm text-slate-400">Checking verification record…</p>
          ) : null}

          <div className="rounded-xl border border-dashed border-slate-600 p-7 text-center">
            <Upload className="mx-auto mb-3 h-9 w-9 text-slate-400" />
            <p className="font-semibold">Upload the received PDF</p>
            <p className="mt-1 text-sm text-slate-400">We compare its SHA-256 fingerprint with the originally issued file.</p>
            <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold hover:bg-red-500">
              <FileCheck2 className="h-4 w-4" />
              {checking ? "Verifying…" : "Choose PDF"}
              <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={checking || !record} onChange={(event) => void handleFile(event.target.files?.[0])} />
            </label>
          </div>

          {result && (
            <div className={`mt-6 flex gap-3 rounded-xl border p-4 ${result.valid ? "border-emerald-700 bg-emerald-950/50" : "border-red-700 bg-red-950/50"}`}>
              {result.valid ? <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-400" /> : <TriangleAlert className="h-7 w-7 shrink-0 text-red-400" />}
              <div>
                <p className={`font-black ${result.valid ? "text-emerald-300" : "text-red-300"}`}>{result.valid ? "AUTHENTIC REPORT" : "VERIFICATION FAILED"}</p>
                <p className="mt-1 text-sm text-slate-300">{result.message}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 flex gap-3 rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">
              <TriangleAlert className="h-5 w-5 shrink-0" /> {error}
            </div>
          )}
        </section>
        <p className="mt-5 text-center text-xs text-slate-500">The uploaded file is processed only to calculate its cryptographic fingerprint.</p>
      </div>
    </main>
  );
}
