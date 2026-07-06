import type { BusyPeriodRecord } from "@/lib/exam-booking";
import { clinicDateTimeToISO, clinicNowMinutes, clinicTodayDateString } from "@/lib/clinic-time";

/** First bookable start time (matches calendar day view). */
export const BOOKING_DAY_START_MINUTES = 8 * 60; // 08:00

/** Last allowed end time for an appointment. */
export const BOOKING_DAY_END_MINUTES = 18 * 60; // 18:00

/** Grid step between candidate start times. */
export const BOOKING_SLOT_INTERVAL_MINUTES = 30;

const DEFAULT_EXAM_DURATION_MINUTES = 150;

export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTimeSlot(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function generateBookingTimeSlots(durationMinutes: number): string[] {
  const duration = durationMinutes > 0 ? durationMinutes : DEFAULT_EXAM_DURATION_MINUTES;
  const lastStart = BOOKING_DAY_END_MINUTES - duration;
  if (lastStart < BOOKING_DAY_START_MINUTES) {
    return [];
  }

  const slots: string[] = [];
  for (
    let minutes = BOOKING_DAY_START_MINUTES;
    minutes <= lastStart;
    minutes += BOOKING_SLOT_INTERVAL_MINUTES
  ) {
    slots.push(formatTimeSlot(minutes));
  }
  return slots;
}

function overlapsBusyPeriod(
  slotMinutes: number,
  slotEnd: number,
  period: BusyPeriodRecord,
  date: string,
): boolean {
  if (period.is_full_day) {
    return true;
  }

  if (period.start_at && period.end_at) {
    const slotStart = new Date(clinicDateTimeToISO(date, formatTimeSlot(slotMinutes)));
    const slotEndDate = new Date(slotStart.getTime() + (slotEnd - slotMinutes) * 60_000);
    const periodStart = new Date(period.start_at);
    const periodEnd = new Date(period.end_at);
    return slotStart < periodEnd && slotEndDate > periodStart;
  }

  if (!period.start_time || !period.end_time) {
    return false;
  }

  const periodStart = toMinutes(period.start_time);
  const periodEnd = toMinutes(period.end_time);
  return slotMinutes < periodEnd && slotEnd > periodStart;
}

export function filterAvailableBookingSlots(
  candidateSlots: string[],
  options: {
    date: string;
    durationMinutes: number;
    busyPeriods: BusyPeriodRecord[];
    isToday?: boolean;
    nowMinutes?: number;
  },
): string[] {
  const duration =
    options.durationMinutes > 0 ? options.durationMinutes : DEFAULT_EXAM_DURATION_MINUTES;
  const isToday = options.isToday ?? options.date === clinicTodayDateString();
  const nowMinutes = options.nowMinutes ?? clinicNowMinutes();

  return candidateSlots.filter((slot) => {
    const slotMinutes = toMinutes(slot);
    const slotEnd = slotMinutes + duration;

    if (isToday && slotMinutes <= nowMinutes) {
      return false;
    }

    return !options.busyPeriods.some((period) =>
      overlapsBusyPeriod(slotMinutes, slotEnd, period, options.date),
    );
  });
}
