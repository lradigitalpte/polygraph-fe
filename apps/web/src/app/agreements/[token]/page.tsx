"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileSignature,
  Globe,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  XCircle,
} from "lucide-react";

import { SignaturePad } from "@/components/agreements/signature-pad";
import { CredentialsRichTextContent } from "@/components/dashboard/credentials-rich-text-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function PublicAgreementPage() {
  const params = useParams();
  const token = String(params.token ?? "");

  const [view, setView] = React.useState<PublicAgreementView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [agreed, setAgreed] = React.useState<Record<number, boolean>>({});
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
        <div className="flex justify-center py-32 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <StatusCard
          icon={<XCircle className="h-12 w-12 text-destructive" />}
          title="Agreement unavailable"
          message={loadError ?? "This link could not be opened."}
        />
      </Shell>
    );
  }

  const org = view.organization;

  if (view.status === "signed") {
    return (
      <Shell org={org}>
        <StatusCard
          icon={<CheckCircle2 className="h-12 w-12 text-emerald-600" />}
          title="Thank you — you're all signed"
          message={`Signed by ${view.signed_name} on ${view.signed_at ? formatClinicDateTime(view.signed_at) : ""}. ${org.name} has been notified, and a PDF copy has been emailed to you.`}
        >
          <ul className="mx-auto max-w-sm space-y-1 text-left text-sm">
            {view.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item.title}</span>
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <Button size="lg" className="h-11 gap-2" render={<a href={publicAgreementPdfUrl(token)} download />}>
              <Download className="h-4 w-4" /> Download PDF copy
            </Button>
          </div>
        </StatusCard>
      </Shell>
    );
  }

  if (view.status === "declined") {
    return (
      <Shell org={org}>
        <StatusCard
          icon={<XCircle className="h-12 w-12 text-muted-foreground" />}
          title="You declined these agreements"
          message={`${org.name} has been notified and will be in touch. If this was a mistake, please contact us.`}
        />
      </Shell>
    );
  }

  const agreedCount = view.items.filter((item) => agreed[item.id]).length;
  const allAgreed = agreedCount === view.items.length;
  const nameOk = signedName.trim().length >= 2;
  const canSubmit = allAgreed && nameOk && signature != null && !submitting;
  const outstanding = view.booking ? view.booking.exam_fee - view.booking.collected_amount : 0;

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

  return (
    <Shell org={org}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <FileSignature className="h-4 w-4" /> Agreements to sign
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {view.recipient_name ? `Hello ${view.recipient_name.split(" ")[0]},` : "Hello,"}
          </h1>
          <p className="text-muted-foreground">
            Please read the {view.items.length === 1 ? "agreement" : `${view.items.length} agreements`} below from{" "}
            {org.name}, tick to confirm you agree, then sign at the bottom.
          </p>
        </section>

        {view.booking ? (
          <section className="grid gap-4 rounded-2xl border bg-background p-5 sm:grid-cols-3">
            <Fact label="Session" value={view.booking.exam_type || "Polygraph examination"} />
            <Fact
              label="Date & time"
              value={formatClinicDateTime(view.booking.scheduled_at)}
              icon={<CalendarDays className="h-4 w-4" />}
            />
            {view.booking.exam_fee > 0 ? (
              <Fact
                label={outstanding > 0 && outstanding < view.booking.exam_fee ? "Balance due" : "Fee"}
                value={formatMoney(outstanding > 0 ? outstanding : view.booking.exam_fee, view.booking.currency)}
              />
            ) : null}
          </section>
        ) : null}

        {view.items.map((item, index) => (
          <section key={item.id} className="rounded-2xl border bg-background">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <h2 className="font-semibold">
                <span className="text-muted-foreground mr-2">{index + 1}.</span>
                {item.title}
              </h2>
              {agreed[item.id] ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : null}
            </div>
            <div className="max-h-96 overflow-y-auto px-5 py-4">
              <CredentialsRichTextContent html={item.body_html} className="text-sm leading-relaxed text-foreground" />
            </div>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 border-t px-5 py-4 text-sm font-medium transition-colors",
                agreed[item.id] ? "bg-emerald-500/10" : "hover:bg-muted/50",
              )}
            >
              <Checkbox
                checked={Boolean(agreed[item.id])}
                onCheckedChange={(checked) => setAgreed((prev) => ({ ...prev, [item.id]: Boolean(checked) }))}
              />
              I have read and agree to the {item.title}
            </label>
          </section>
        ))}

        <section className="space-y-5 rounded-2xl border bg-background p-5">
          <div>
            <h2 className="font-semibold">Sign</h2>
            <p className="text-sm text-muted-foreground">
              {allAgreed
                ? "Type your full legal name and draw your signature."
                : `Please agree to all agreements first (${agreedCount} of ${view.items.length} done).`}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signed-name">Full legal name</Label>
            <Input
              id="signed-name"
              autoComplete="name"
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
              placeholder="e.g. Jane Doe"
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label>Signature</Label>
            <SignaturePad onChange={handleSignature} disabled={submitting} />
          </div>
          <p className="text-xs text-muted-foreground">
            By selecting &ldquo;Sign &amp; submit&rdquo; you confirm that you have read and agree to the agreements
            above and that your electronic signature is the legal equivalent of your handwritten signature. The date,
            time and your IP address are recorded with your signature.
          </p>
          {submitError ? (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setDeclineOpen(true)}
              disabled={submitting}
            >
              I don&apos;t agree
            </Button>
            <Button type="submit" size="lg" className="h-12 sm:min-w-52" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing...
                </>
              ) : (
                "Sign & submit"
              )}
            </Button>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          This link expires on {formatClinicDateTime(view.expires_at)}.
        </p>
      </form>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Decline these agreements?</DialogTitle>
            <DialogDescription>
              {org.name} will be notified. Your booking may not go ahead until the agreements are signed. You can
              tell us why below (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={2000}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={declining}>
              Go back
            </Button>
            <Button variant="destructive" onClick={() => void handleDecline()} disabled={declining}>
              {declining ? "Declining..." : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

type Org = PublicAgreementView["organization"];

function Shell({ org, children }: { org?: Org; children: React.ReactNode }) {
  const websiteLabel = org?.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {org?.logo_data_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- inline data: URL
              <img src={org.logo_data_url} alt={org.name} className="h-10 max-w-36 object-contain" />
            ) : null}
            {org ? <span className="truncate font-semibold">{org.name}</span> : null}
          </div>
          {org?.website && websiteLabel ? (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">{websiteLabel}</span>
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>

      <footer className="mx-auto max-w-3xl space-y-3 px-4 pb-10 text-xs text-muted-foreground">
        {org && (org.phone || org.support_email || org.address) ? (
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            {org.phone ? (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {org.phone}
              </span>
            ) : null}
            {org.support_email ? (
              <a href={`mailto:${org.support_email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="h-3.5 w-3.5" /> {org.support_email}
              </a>
            ) : null}
            {org.address ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {org.address}
              </span>
            ) : null}
          </div>
        ) : null}
        <p className="flex items-center justify-center gap-1">
          <Lock className="h-3.5 w-3.5" />
          <span>Secure, private link. Please don&apos;t share it.</span>
        </p>
      </footer>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  message,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-background px-6 py-10 text-center">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{message}</p>
      {children}
    </div>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1.5 font-medium">
        {icon}
        {value}
      </p>
    </div>
  );
}
