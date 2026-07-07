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
    <main className="min-h-screen bg-gradient-to-br from-white via-red-50/40 to-neutral-100 px-4 py-12 text-neutral-900">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center gap-4">
          <img src="/logo-print.png" alt="Polygraph UAE" className="h-12 w-auto object-contain" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-600">Official verification</p>
            <h1 className="text-2xl font-black">Verify a forensic report</h1>
          </div>
        </div>

        <section className="rounded-2xl border border-red-100 bg-white p-7 shadow-xl shadow-red-950/5">
          <div className="mb-6 flex gap-3">
            <ShieldCheck className="h-7 w-7 shrink-0 text-red-600" />
            <div>
              <h2 className="font-bold">Enter the report verification code</h2>
              <p className="mt-1 text-sm text-neutral-500">The code is printed beside the QR code on the issued PDF.</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={continueToVerification}>
            <div className="space-y-2">
              <Label htmlFor="verification-code" className="text-neutral-700">Verification code</Label>
              <Input
                id="verification-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="ABCDE-FGHIJ-KLMNO-PQRST"
                autoComplete="off"
                className="h-12 border-neutral-300 bg-neutral-50 font-mono uppercase text-neutral-950 focus-visible:border-red-500 focus-visible:ring-red-500/20"
              />
            </div>
            <Button type="submit" disabled={!normalized} className="h-12 w-full gap-2 bg-red-600 font-bold text-white hover:bg-red-700">
              <FileCheck2 className="h-4 w-4" /> Continue to PDF Verification
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
