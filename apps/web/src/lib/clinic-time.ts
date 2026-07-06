/**
 * Polygraph UAE clinic runs on Dubai time (GST).
 * API timestamps are UTC. Dubai is always UTC+4 (no daylight saving).
 * Convert UTC → Dubai display by adding 4 hours.
 */

export const CLINIC_TIMEZONE = "Asia/Dubai";
export const CLINIC_UTC_OFFSET = "+04:00";

/** Dubai is fixed UTC+4 — add this many hours to a UTC instant for clinic wall clock. */
export const DUBAI_UTC_OFFSET_HOURS = 4;
export const DUBAI_UTC_OFFSET_MS = DUBAI_UTC_OFFSET_HOURS * 60 * 60 * 1000;

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type DubaiWallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDate(value: string | Date): Date | null {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/** Core helper: UTC instant → Dubai wall-clock parts (UTC + 4 hours). */
export function utcToDubaiParts(value: string | Date): DubaiWallClock | null {
  const date = toDate(value);
  if (!date) {
    return null;
  }

  const dubai = new Date(date.getTime() + DUBAI_UTC_OFFSET_MS);
  return {
    year: dubai.getUTCFullYear(),
    month: dubai.getUTCMonth() + 1,
    day: dubai.getUTCDate(),
    hour: dubai.getUTCHours(),
    minute: dubai.getUTCMinutes(),
    weekday: dubai.getUTCDay(),
  };
}

/** Dubai wall clock HH:MM from a UTC timestamp. */
export function dubaiClockFromUtc(value: string | Date): string {
  const parts = utcToDubaiParts(value);
  if (!parts) {
    return typeof value === "string" ? value : "";
  }
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** Dubai calendar date YYYY-MM-DD from a UTC timestamp. */
export function dubaiDateKeyFromUtc(value: string | Date = new Date()): string {
  const parts = utcToDubaiParts(value);
  if (!parts) {
    return "";
  }
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** Dubai wall clock → UTC ISO string for the API. */
export function dubaiWallClockToUtcISO(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour - DUBAI_UTC_OFFSET_HOURS, minute, 0),
  ).toISOString();
}

export function clinicDateKey(value: string | Date = new Date()): string {
  return dubaiDateKeyFromUtc(value);
}

export function clinicTodayDateString(): string {
  return clinicDateKey(new Date());
}

export function clinicNowMinutes(date = new Date()): number {
  const parts = utcToDubaiParts(date);
  if (!parts) {
    return 0;
  }
  return parts.hour * 60 + parts.minute;
}

export function clinicDateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00${CLINIC_UTC_OFFSET}`);
}

export function clinicWeekdayIndex(dateKey: string): number {
  const parts = utcToDubaiParts(clinicDateFromKey(dateKey));
  return parts?.weekday ?? 0;
}

export function isClinicSunday(dateKey: string): boolean {
  return clinicWeekdayIndex(dateKey) === 0;
}

export function isSameClinicDay(a: string | Date, b: string | Date): boolean {
  return clinicDateKey(a) === clinicDateKey(b);
}

export function clinicDateTimeToISO(date: string, time: string): string {
  return dubaiWallClockToUtcISO(date, time);
}

export function formatClinicClock(value: string | Date): string {
  return dubaiClockFromUtc(value);
}

export function formatClinicDateTime(value: string | Date): string {
  const parts = utcToDubaiParts(value);
  if (!parts) {
    return typeof value === "string" ? value : "";
  }
  const month = MONTH_SHORT[parts.month - 1] ?? "???";
  const weekday = WEEKDAY_SHORT[parts.weekday] ?? "???";
  return `${weekday}, ${parts.day} ${month} ${parts.year}, ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function formatClinicDateLabel(value: string | Date): string {
  const parts = utcToDubaiParts(value);
  if (!parts) {
    return "";
  }
  const month = MONTH_SHORT[parts.month - 1] ?? "???";
  return `${month} ${parts.day}, ${parts.year}`;
}

export function parseClinicDateTimeFields(value: string | Date): { date: string; time: string } {
  return {
    date: clinicDateKey(value),
    time: formatClinicClock(value),
  };
}

export function clinicWeekdayShort(value: string | Date): string {
  const parts = utcToDubaiParts(value);
  if (!parts) {
    return "";
  }
  return WEEKDAY_SHORT[parts.weekday] ?? "";
}

export function clinicDayOfMonth(value: string | Date): number {
  return utcToDubaiParts(value)?.day ?? 0;
}

export function formatClinicGridDate(value: string | Date): string {
  const parts = utcToDubaiParts(value);
  if (!parts) {
    return "";
  }
  const month = MONTH_SHORT[parts.month - 1] ?? "???";
  return `${month} ${parts.day}`;
}
