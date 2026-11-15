"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileSignature,
  Globe,
  Loader2,
  Lock,
  Mail,
  MapPin,
  PenLine,
  Phone,
  Receipt,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { SignaturePad } from "@/components/agreements/signature-pad";
import { CredentialsRichTextContent } from "@/components/dashboard/credentials-rich-text-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  declinePublicAgreement,
  fetchPublicAgreement,
  publicAgreementPdfUrl,
  signPublicAgreement,
  type PublicAgreementView,
} from "@/lib/agreements";
import { formatClinicDateTime } from "@/lib/clinic-time";
import { formatMoney } from "@/lib/client-account";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

export default function PublicAgreementPage() {
  const params = useParams();
  const token = String(params.token ?? "");

  const [view, setView] = React.useState<PublicAgreementView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [agreed, setAgreed] = React.useState<Record<number, boolean>>({});
  // Agreed terms fold away to keep the page short; the client can reopen them.
  const [reopened, setReopened] = React.useState<Record<number, boolean>>({});
  const [signedName, setSignedName] = React.useState("");
  const [signature, setSignature] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");
  const [declining, setDeclining] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchPublicAgreement(token);
        if (!cancelled) {
          setView(data);
          setSignedName(data.recipient_name ?? "");
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Unable to load agreements");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSignature = React.useCallback((dataUrl: string | null) => setSignature(dataUrl), []);

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-32 text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-8 animate-spin" />
          <p className="text-sm">Loading your agreements…</p>
        </div>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <StatusCard tone="error" icon={XCircle} title="This link isn't available" message={loadError ?? "This link could not be opened."} />
      </Shell>
    );
  }

  const org = view.organization;

  if (view.status === "signed") {
    return (
      <Shell org={org}>
        <StatusCard
          tone="success"
          icon={CheckCircle2}
          title="All signed — thank you"
          message={`Signed by ${view.signed_name}${view.signed_at ? ` on ${formatClinicDateTime(view.signed_at)}` : ""}. ${org.name} has been notified, and a PDF copy is on its way to your email.`}
        >
          <ul className="mx-auto w-full max-w-sm divide-y divide-border/50 rounded-2xl bg-[#F7F6F1] text-left dark:bg-muted/50">
            {view.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm font-medium">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </span>
                {item.title}
              </li>
            ))}
          </ul>
          <a
            href={publicAgreementPdfUrl(token)}
            download
            className="mx-auto flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#2B2A27] text-sm font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background"
          >
            <Download aria-hidden="true" className="size-4" /> Download your signed copy
          </a>
        </StatusCard>
      </Shell>
    );
  }

  if (view.status === "declined") {
    return (
      <Shell org={org}>
        <StatusCard
          tone="muted"
          icon={XCircle}
          title="You declined these agreements"
          message={`${org.name} has been notified and will be in touch. If this was a mistake, please contact us using the details below.`}
        />
      </Shell>
    );
  }

  const total = view.items.length;
  const agreedCount = view.items.filter((item) => agreed[item.id]).length;
  const allAgreed = agreedCount === total;
  const nameOk = signedName.trim().length >= 2;
  const canSubmit = allAgreed && nameOk && signature != null && !submitting;
  const outstanding = view.booking ? view.booking.exam_fee - view.booking.collected_amount : 0;
  const firstName = view.recipient_name ? view.recipient_name.split(" ")[0] : "";

  const scrollTo = (id: string) => {
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const nextPendingId = (after?: number) => {
    const ids = view.items.map((i) => i.id);
    const start = after == null ? 0 : ids.indexOf(after) + 1;
    const next = [...ids.slice(start), ...ids.slice(0, start)].find((id) => !agreed[id] && id !== after);
    return next;
  };

  const toggleAgree = (id: number) => {
    const nowAgreed = !agreed[id];
    setAgreed((prev) => ({ ...prev, [id]: nowAgreed }));
    setReopened((prev) => ({ ...prev, [id]: false }));
    if (nowAgreed) {
      const next = nextPendingId(id);
      scrollTo(next != null ? `agreement-${next}` : "sign");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !signature) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await signPublicAgreement(token, {
        signed_name: signedName.trim(),
        signature_data_url: signature,
        accepted_item_ids: view.items.map((item) => item.id),
      });
      setView(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Signing failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      const result = await declinePublicAgreement(token, declineReason);
      setDeclineOpen(false);
      setView(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not decline. Please try again.");
      setDeclineOpen(false);
    } finally {
      setDeclining(false);
    }
  };

  const signHint = !allAgreed
    ? `Agree to ${total - agreedCount === 1 ? "the last agreement" : `the ${total - agreedCount} remaining agreements`} above to unlock signing.`
    : !nameOk
      ? "Type your full legal name."
      : signature == null
        ? "Draw your signature in the box."
        : "Ready to sign.";

  return (
    <Shell org={org} bottomPadding={!allAgreed}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[30px] bg-[#2B2A27] p-6 text-[#FAF9F5] shadow-[0_20px_40px_-24px_rgba(20,20,19,0.6)] sm:p-8 dark:ring-1 dark:ring-white/10">
          <div aria-hidden="true" className="bg-primary/25 pointer-events-none absolute -top-24 -right-16 size-64 rounded-full blur-3xl" />
          <div className="relative">
            <p className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
              <FileSignature aria-hidden="true" className="size-4" /> Agreements to sign
            </p>
            <h1 className="mt-3 text-3xl leading-[1.1] font-normal tracking-[-0.03em] sm:text-4xl">
              {firstName ? (
                <>
                  Hello <span className="font-semibold">{firstName}</span>
                </>
              ) : (
                "Hello"
              )}
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[#C9C6BC]">
              {org.name} needs your agreement to {total === 1 ? "one short agreement" : `${total} short agreements`} before your session. It takes about two minutes.
            </p>

            {view.booking ? (
              <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                <GlassFact icon={FileSignature} label="Session" value={view.booking.exam_type || "Polygraph examination"} />
                <GlassFact icon={CalendarDays} label="Date & time" value={formatClinicDateTime(view.booking.scheduled_at)} />
                {view.booking.exam_fee > 0 ? (
                  <GlassFact
                    icon={Receipt}
                    label={outstanding > 0 && outstanding < view.booking.exam_fee ? "Balance due" : "Fee"}
                    value={formatMoney(outstanding > 0 ? outstanding : view.booking.exam_fee, view.booking.currency)}
                  />
                ) : null}
              </div>
            ) : null}

            {/* Steps */}
            <ol className="mt-6 flex flex-wrap items-center gap-2 text-[13px]">
              <li className={cn("flex items-center gap-2 rounded-full px-3 py-1.5", allAgreed ? "bg-white/10 text-[#C9C6BC]" : "bg-[#FAF9F5] text-[#2B2A27]")}>
                <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-semibold", allAgreed ? "bg-[#5FA86C] text-white" : "bg-[#2B2A27] text-[#FAF9F5]")}>
                  {allAgreed ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : "1"}
                </span>
                Read &amp; agree
                <span className="tabular-nums opacity-70">
                  {agreedCount}/{total}
                </span>
              </li>
              <li aria-hidden="true" className="h-px w-4 bg-white/20" />
              <li className={cn("flex items-center gap-2 rounded-full px-3 py-1.5", allAgreed ? "bg-[#FAF9F5] text-[#2B2A27]" : "bg-white/10 text-[#C9C6BC]")}>
                <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-semibold", allAgreed ? "bg-[#2B2A27] text-[#FAF9F5]" : "bg-white/15")}>2</span>
                Sign
              </li>
            </ol>
          </div>
        </section>

        {/* Agreements */}
        {view.items.map((item, index) => {
          const isAgreed = Boolean(agreed[item.id]);
          const showTerms = !isAgreed || reopened[item.id];
          return (
            <section
              key={item.id}
              id={`agreement-${item.id}`}
              aria-labelledby={`agreement-title-${item.id}`}
              className={cn(CARD, "scroll-mt-4 overflow-hidden transition-shadow", isAgreed && "ring-[#5FA86C]/40")}
            >
              <div className="flex items-center gap-3 px-5 pt-5 pb-4 sm:px-6">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    isAgreed ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" : "bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground",
                  )}
                >
                  {isAgreed ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id={`agreement-title-${item.id}`} className="text-[17px] font-medium tracking-[-0.01em]">
                    {item.title}
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    Agreement {index + 1} of {total}
                  </p>
                </div>
                {isAgreed ? (
                  <span className="shrink-0 rounded-full bg-[#E7F1E4] px-2.5 py-1 text-xs font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">Agreed</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-[#F8EEDB] px-2.5 py-1 text-xs font-medium text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">To read</span>
                )}
              </div>

              {showTerms ? (
                <div className="mx-5 mb-5 max-h-[28rem] overflow-y-auto rounded-2xl bg-[#F7F6F1] px-5 py-4 sm:mx-6 dark:bg-muted/40">
                  <CredentialsRichTextContent
                    html={item.body_html}
                    className="text-[15px] leading-relaxed text-foreground [&_li]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReopened((prev) => ({ ...prev, [item.id]: true }))}
                  className="mx-5 mb-4 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground sm:mx-6"
                >
                  <ChevronDown aria-hidden="true" className="size-4" /> Read the terms again
                </button>
              )}

              <div className="border-t border-border/50 p-3 sm:p-4">
                {isAgreed ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-[#E7F1E4] px-4 py-3 text-sm text-[#2D5A27] dark:bg-emerald-950/60 dark:text-emerald-200">
                    <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
                    <span className="flex-1 font-medium">You agreed to the {item.title}</span>
                    <button type="button" onClick={() => toggleAgree(item.id)} className="shrink-0 text-[13px] font-medium underline-offset-4 hover:underline">
                      Undo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-pressed={false}
                    onClick={() => toggleAgree(item.id)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2B2A27] text-[15px] font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background"
                  >
                    <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
                    I have read and agree
                  </button>
                )}
              </div>
            </section>
          );
        })}

        {/* Sign */}
        <section id="sign" aria-labelledby="sign-title" className={cn(CARD, "scroll-mt-4 overflow-hidden")}>
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 sm:px-6">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", allAgreed ? "bg-primary text-white" : "bg-[#F3F1EA] text-muted-foreground dark:bg-muted")}>
              {allAgreed ? <PenLine aria-hidden="true" className="size-4" /> : <Lock aria-hidden="true" className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="sign-title" className="text-[17px] font-medium tracking-[-0.01em]">
                Sign
              </h2>
              <p className="text-[13px] text-muted-foreground" aria-live="polite">
                {signHint}
              </p>
            </div>
          </div>

          <fieldset disabled={!allAgreed || submitting} className={cn("space-y-4 px-5 pb-5 transition-opacity sm:px-6", !allAgreed && "opacity-50")}>
            <div className="grid gap-1.5">
              <label htmlFor="signed-name" className="px-1 text-[13px] font-medium">
                Full legal name
              </label>
              <input
                id="signed-name"
                autoComplete="name"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                placeholder="e.g. Jane Doe"
                maxLength={255}
                className="h-12 w-full rounded-xl border-0 bg-[#F3F1EA] px-4 text-[15px] ring-primary outline-none focus-visible:ring-2 disabled:cursor-not-allowed dark:bg-muted"
              />
            </div>
            <div className="grid gap-1.5">
              <span className="px-1 text-[13px] font-medium">Signature</span>
              <SignaturePad onChange={handleSignature} disabled={!allAgreed || submitting} />
            </div>
          </fieldset>

          <div className="space-y-4 border-t border-border/50 p-5 sm:px-6">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                By selecting &ldquo;Sign &amp; submit&rdquo; you confirm that you have read and agree to the agreements above and that your electronic signature is the legal
                equivalent of your handwritten signature. The date, time and your IP address are recorded with your signature.
              </span>
            </p>
            {submitError ? (
              <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {submitError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-primary flex h-13 w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(201,100,66,0.8)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Signing…
                </>
              ) : (
                <>
                  <PenLine aria-hidden="true" className="size-4" /> Sign &amp; submit
                </>
              )}
            </button>
            <div className="flex flex-col items-center gap-1 text-center">
              <button
                type="button"
                onClick={() => setDeclineOpen(true)}
                disabled={submitting}
                className="text-[13px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                I don&apos;t agree
              </button>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock aria-hidden="true" className="size-3.5" />
                This link works until {formatClinicDateTime(view.expires_at)}.
              </p>
            </div>
          </div>
        </section>
      </form>

      {/* Progress, always in reach until everything is agreed */}
      {!allAgreed ? (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-full bg-[#2B2A27]/95 py-2 pr-2 pl-5 text-[#FAF9F5] shadow-[0_12px_30px_-10px_rgba(20,20,19,0.5)] backdrop-blur dark:ring-1 dark:ring-white/10">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium tabular-nums">
                {agreedCount} of {total} agreed
              </p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                <div className="h-full rounded-full bg-[#5FA86C] transition-all" style={{ width: `${(agreedCount / total) * 100}%` }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = nextPendingId();
                if (next != null) scrollTo(`agreement-${next}`);
              }}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#FAF9F5] px-4 text-[13px] font-semibold text-[#2B2A27] transition-colors hover:bg-white"
            >
              Next to read <ArrowDown aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="rounded-[26px]">
          <DialogHeader>
            <DialogTitle>Decline these agreements?</DialogTitle>
            <DialogDescription>
              {org.name} will be notified. Your booking may not go ahead until the agreements are signed. You can tell us why below (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={2000}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setDeclineOpen(false)} disabled={declining}>
              Go back
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={() => void handleDecline()} disabled={declining}>
              {declining ? "Declining…" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

type Org = PublicAgreementView["organization"];

function Shell({ org, children, bottomPadding }: { org?: Org; children: React.ReactNode; bottomPadding?: boolean }) {
  const websiteLabel = org?.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="min-h-screen bg-[#F3F1EA] dark:bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 pt-5 pb-1">
        <div className="flex min-w-0 items-center gap-3">
          {org?.logo_data_url ? (
            <span className="flex h-11 items-center rounded-[15px] bg-[#2B2A27] px-3 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- inline data: URL */}
              <img src={org.logo_data_url} alt={org.name} className="h-7 max-w-32 object-contain" />
            </span>
          ) : null}
          {org ? <span className="truncate text-[15px] font-semibold">{org.name}</span> : null}
        </div>
        {org?.website && websiteLabel ? (
          <a
            href={org.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-muted-foreground ring-1 ring-border/60 transition-colors hover:text-foreground dark:bg-card"
          >
            <Globe aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">{websiteLabel}</span>
            <span className="sm:hidden">Website</span>
          </a>
        ) : null}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      <footer className={cn("mx-auto max-w-3xl space-y-3 px-4 text-xs text-muted-foreground", bottomPadding ? "pb-28" : "pb-10")}>
        {org && (org.phone || org.support_email || org.address) ? (
          <div className="flex flex-wrap justify-center gap-2">
            {org.phone ? (
              <a href={`tel:${org.phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 ring-1 ring-border/50 hover:text-foreground dark:bg-card">
                <Phone aria-hidden="true" className="size-3.5" /> {org.phone}
              </a>
            ) : null}
            {org.support_email ? (
              <a href={`mailto:${org.support_email}`} className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 ring-1 ring-border/50 hover:text-foreground dark:bg-card">
                <Mail aria-hidden="true" className="size-3.5" /> {org.support_email}
              </a>
            ) : null}
            {org.address ? (
              <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 ring-1 ring-border/50 dark:bg-card">
                <MapPin aria-hidden="true" className="size-3.5" /> {org.address}
              </span>
            ) : null}
          </div>
        ) : null}
        <p className="flex items-center justify-center gap-1.5">
          <Lock aria-hidden="true" className="size-3.5" />
          Secure, private link — please don&apos;t share it.
        </p>
      </footer>
    </div>
  );
}

function StatusCard({
  tone,
  icon: Icon,
  title,
  message,
  children,
}: {
  tone: "success" | "error" | "muted";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(CARD, "mx-auto flex max-w-lg flex-col gap-5 px-6 py-10 text-center sm:px-10")}>
      <span
        className={cn(
          "mx-auto flex size-16 items-center justify-center rounded-full",
          tone === "success" && "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
          tone === "error" && "bg-destructive/10 text-destructive",
          tone === "muted" && "bg-[#F3F1EA] text-muted-foreground dark:bg-muted",
        )}
      >
        <Icon aria-hidden="true" className="size-8" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-medium tracking-[-0.02em]">{title}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{message}</p>
      </div>
      {children}
    </div>
  );
}

function GlassFact({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10">
      <p className="flex items-center gap-1.5 text-[12px] text-[#C9C6BC]">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 text-[15px] font-medium">{value}</p>
    </div>
  );
}
