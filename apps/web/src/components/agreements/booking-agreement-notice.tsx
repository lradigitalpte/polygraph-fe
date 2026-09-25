"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, FileWarning } from "lucide-react";

import { useCurrentUser } from "@/components/dashboard/use-current-user";
import {
  fetchBookingAgreementStatuses,
  needsAgreementWarning,
  type BookingAgreementState,
  type BookingAgreementStatus,
} from "@/lib/agreements";
import { formatClinicDateTime } from "@/lib/clinic-time";
import { cn } from "@/lib/utils";

const WARNING_TEXT: Record<Exclude<BookingAgreementState, "signed">, { title: string; body: string }> = {
  not_sent: {
    title: "Agreements not sent",
    body: "The client hasn't been sent the payment, reschedule and cancellation agreements for this booking.",
  },
  awaiting: {
    title: "Agreements awaiting signature",
    body: "The client has been sent the agreements but hasn't signed them yet.",
  },
  declined: {
    title: "Agreements declined",
    body: "The client declined the agreements for this booking. Follow up before the session.",
  },
};

/**
 * Loads the agreement state for a single booking. Returns undefined while loading, when
 * the user can't view agreements, or for corporate bookings (which don't sign online).
 */
export function useBookingAgreementStatus(appointmentId: number | null | undefined) {
  const { can, loading: userLoading } = useCurrentUser();
  const allowed = !userLoading && can("agreement:view");
  const [status, setStatus] = React.useState<BookingAgreementStatus | undefined>();

  React.useEffect(() => {
    setStatus(undefined);
    if (!allowed || !appointmentId) return;
    let cancelled = false;
    fetchBookingAgreementStatuses([appointmentId])
      .then((map) => {
        if (!cancelled) setStatus(map[appointmentId]);
      })
      .catch(() => {
        // Warnings are advisory; a failed lookup just shows nothing.
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, appointmentId]);

  return status;
}

/**
 * Advisory callout for a booking whose agreements aren't signed. Never blocks anything.
 * Renders a small "signed" confirmation when `showSigned` is set and the client has signed.
 */
export function BookingAgreementNotice({
  status,
  booking,
  clientId,
  showSigned = false,
  className,
}: {
  status: BookingAgreementStatus | undefined;
  booking: { status?: string; scheduled_at: string | Date };
  clientId: number;
  showSigned?: boolean;
  className?: string;
}) {
  if (!status) return null;
  const approvalsHref = `/dashboard/clients/${clientId}/approvals` as Route;

  if (status.state === "signed") {
    if (!showSigned) return null;
    return (
      <p className={cn("flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400", className)}>
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        Agreements signed{status.signed_at ? ` ${formatClinicDateTime(status.signed_at)}` : ""}
      </p>
    );
  }
  if (!needsAgreementWarning(status, booking)) return null;

  const text = WARNING_TEXT[status.state];
  const declined = status.state === "declined";
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-sm",
        declined
          ? "border-destructive/30 bg-destructive/10"
          : "border-amber-500/30 bg-amber-500/10",
        className,
      )}
    >
      <FileWarning className={cn("mt-0.5 h-4 w-4 shrink-0", declined ? "text-destructive" : "text-amber-600")} />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold leading-tight">{text.title}</p>
        <p className="text-xs text-muted-foreground">{text.body}</p>
        <Link href={approvalsHref} className="inline-block text-xs font-semibold text-primary hover:underline">
          {status.state === "not_sent" ? "Send agreements" : "Open Approvals"} →
        </Link>
      </div>
    </div>
  );
}
