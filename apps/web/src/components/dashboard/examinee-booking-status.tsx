import { CalendarCheck, CalendarX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExamineeRosterEntry } from "@/lib/clients";
import { formatClinicDateTime } from "@/lib/clinic-time";

function formatSessionDateTime(iso: string): string {
  return formatClinicDateTime(iso);
}

function formatStatusLabel(status?: string): string | undefined {
  if (!status) return undefined;
  const normalized = status.trim().toLowerCase();
  if (normalized === "pending") return "Pending";
  if (normalized === "confirmed") return "Confirmed";
  if (normalized === "completed") return "Completed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type ExamineeBookingStatusProps = {
  entry: Pick<
    ExamineeRosterEntry,
    | "upcoming_count"
    | "next_scheduled_at"
    | "next_appointment_status"
    | "next_examiner_name"
    | "session_count"
    | "last_scheduled_at"
  >;
  compact?: boolean;
  className?: string;
};

export function ExamineeBookingStatus({ entry, compact = false, className }: ExamineeBookingStatusProps) {
  const hasUpcoming = Boolean(entry.next_scheduled_at) || (entry.upcoming_count ?? 0) > 0;
  const statusLabel = formatStatusLabel(entry.next_appointment_status);

  if (hasUpcoming && entry.next_scheduled_at) {
    const when = formatSessionDateTime(entry.next_scheduled_at);
    const examiner = entry.next_examiner_name?.trim();

    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Badge
          variant="default"
          className="text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-600 text-white border-0"
        >
          <CalendarCheck className="h-3 w-3" />
          Exam booked
        </Badge>
        {!compact && (
          <>
            <span className="text-[10px] text-muted-foreground">{when}</span>
            {statusLabel && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {statusLabel}
              </Badge>
            )}
            {examiner && (
              <span className="text-[10px] text-muted-foreground">with {examiner}</span>
            )}
          </>
        )}
        {compact && (
          <span className="text-[10px] text-muted-foreground truncate">
            {when}
            {examiner ? ` · ${examiner}` : ""}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
        <CalendarX className="h-3 w-3" />
        No exam booked
      </Badge>
      {!compact && entry.session_count > 0 && entry.last_scheduled_at && (
        <span className="text-[10px] text-muted-foreground">
          Last session: {new Date(entry.last_scheduled_at).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}
