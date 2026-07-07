"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VerificationEntryPage() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const normalized = code.trim().toUpperCase();

  function continueToVerification(event: React.FormEvent) {
    event.preventDefault();
    if (!normalized) return;
    router.push(`/verify/${encodeURIComponent(normalized)}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center gap-4">
          <img src="/logo.png" alt="Polygraph UAE" className="h-12 w-auto object-contain" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-400">Official verification</p>
            <h1 className="text-2xl font-black">Verify a forensic report</h1>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
          <div className="mb-6 flex gap-3">
            <ShieldCheck className="h-7 w-7 shrink-0 text-emerald-400" />
            <div>
              <h2 className="font-bold">Enter the report verification code</h2>
              <p className="mt-1 text-sm text-slate-400">The code is printed beside the QR code on the issued PDF.</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={continueToVerification}>
            <div className="space-y-2">
              <Label htmlFor="verification-code" className="text-slate-200">Verification code</Label>
              <Input
                id="verification-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="ABCDE-FGHIJ-KLMNO-PQRST"
                autoComplete="off"
                className="h-12 border-slate-700 bg-slate-950 font-mono uppercase text-white"
              />
            </div>
            <Button type="submit" disabled={!normalized} className="h-12 w-full gap-2 bg-red-600 font-bold hover:bg-red-500">
              <FileCheck2 className="h-4 w-4" /> Continue to PDF Verification
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
