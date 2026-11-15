"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar as CalendarIcon,
  ChevronRight,
  CircleDot,
  Clock,
  CreditCard,
  Download,
  FileText,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isOrganizationClient } from "@/lib/client-types";
import {
  deleteAppointment,
  fetchAppointments,
  fetchExamTypes,
  updateAppointment,
  type AppointmentRecord,
  type ExamTypeRecord,
} from "@/lib/exam-booking";
import { formatSubjectName } from "@/lib/subjects";
import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { GHOST_FIELD, GlassStat, GlowPanel, PaymentPill, PropertyRow, Segmented, StatusPicker, StatusPill } from "@/components/dashboard/ui-kit";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { formatMoney, catalogPriceInCurrency, CATALOG_PRICE_CURRENCY } from "@/lib/client-account";
import {
  clinicDateKey,
  clinicDateTimeToISO,
  formatClinicClock,
  formatClinicDateLabel,
  parseClinicDateTimeFields,
} from "@/lib/clinic-time";
import { fetchOrganizationSettings, type OrganizationSettings } from "@/lib/settings";

type LedgerRow = {
  id: number;
  code: string;
  clientId: number;
  subjectId?: number;
  /** Primary name shown in the table — examinee when billed to an organization. */
  client: string;
  /** Organization or billing account name, when different from client. */
  accountName?: string;
  examinerId: number;
  examiner: string;
  examinerInitials: string;
  examinerColor: string;
  type: string;
  dateLabel: string;
  timeLabel: string;
  amount: number;
  collected: number;
  payment: string;
  status: string;
  reason: string;
  scheduledAt: string;
  duration: number;
  /** Raw appointment notes as stored (first line = exam type label). */
  notes: string;
  examTypeId?: number;
  /** Booking draws on a bulk (prepaid) invoice, which owns its fee. */
  prepaid: boolean;
};

type DatePreset = "all" | "today" | "week" | "month" | "custom";
type StatusFilter = "all" | "Pending" | "Confirmed" | "Completed" | "Cancelled";

/* Date ranges are clinic (Dubai) calendar days as YYYY-MM-DD keys, so filters
   match what the clinic sees regardless of the viewer's own time zone.
   Weeks run Monday–Sunday, as on the dashboard. */
function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function presetKeyRange(preset: DatePreset, dateFrom: string, dateTo: string): { from?: string; to?: string } {
  if (preset === "all") return {};
  if (preset === "custom") return { from: dateFrom || undefined, to: dateTo || undefined };
  const today = clinicDateKey(new Date());
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const from = shiftDateKey(today, -((weekday + 6) % 7));
    return { from, to: shiftDateKey(from, 6) };
  }
  const from = `${today.slice(0, 8)}01`;
  const [year, month] = today.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { from, to: shiftDateKey(nextMonth, -1) };
}

const examinerColors = ["bg-blue-600", "bg-emerald-600", "bg-amber-600", "bg-purple-600", "bg-rose-600", "bg-cyan-600"];

const APPOINTMENT_STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;

function buildAppointmentNotes(examTypeName: string, reason: string): string {
  const trimmedReason = reason.trim();
  if (!trimmedReason) return examTypeName;
  return `${examTypeName}\n\n${trimmedReason}`;
}

function examinerDisplay(examiners: UserRecord[], examinerId: number, index?: number) {
  const examiner = examiners.find((item) => item.id === examinerId);
  const colorIndex = index ?? examiners.findIndex((item) => item.id === examinerId);
  return {
    name: examiner?.name || `Examiner #${examinerId}`,
    initials: initials(examiner?.name || `E${examinerId}`),
    color: examinerColors[Math.max(0, colorIndex) % examinerColors.length],
  };
}

export default function ExamsPage() {
  const { can } = useCurrentUser();
  const canViewPayments = can("payment:view");
  const canManageAppointments = can("appointment:manage");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [datePreset, setDatePreset] = React.useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<LedgerRow[]>([]);
  const [selectedExam, setSelectedExam] = React.useState<LedgerRow | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [editDate, setEditDate] = React.useState("");
  const [editTime, setEditTime] = React.useState("");
  const [editExaminerId, setEditExaminerId] = React.useState("");
  const [editReason, setEditReason] = React.useState("");
  const [editStatus, setEditStatus] = React.useState("pending");
  const [deleting, setDeleting] = React.useState(false);

  // Org settings for currency display
  const [orgSettings, setOrgSettings] = React.useState<Partial<OrganizationSettings>>({ currency: "AED" });
  const orgCurrency = orgSettings.currency || "AED";

  // Pagination & Edit states
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [editExamType, setEditExamType] = React.useState<ExamTypeRecord | null>(null);
  const [editPrice, setEditPrice] = React.useState("");
  const [savingFields, setSavingFields] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [appointments, examiners, examTypesList, org] = await Promise.all([
          fetchAppointments(),
          fetchExaminers(),
          fetchExamTypes(),
          fetchOrganizationSettings().catch(() => ({ currency: "AED" })),
        ]);
        if (cancelled) {
          return;
        }
        if (org) setOrgSettings(org);
        setExaminers(examiners);
        const mapped = mapRows(appointments, examiners, examTypesList);
        setRows(mapped);
        setExamTypes(examTypesList);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load ledger");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = React.useMemo(() => {
    let result = rows;

    if (datePreset !== "all") {
      const { from, to } = presetKeyRange(datePreset, dateFrom, dateTo);
      result = result.filter((row) => {
        const key = clinicDateKey(row.scheduledAt);
        if (!key) return false;
        if (from && key < from) return false;
        if (to && key > to) return false;
        return true;
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((row) => row.status === statusFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return result;
    return result.filter(
      (row) =>
        row.client.toLowerCase().includes(q) ||
        (row.accountName?.toLowerCase().includes(q) ?? false) ||
        row.code.toLowerCase().includes(q) ||
        row.examiner.toLowerCase().includes(q) ||
        row.type.toLowerCase().includes(q),
    );
  }, [rows, searchQuery, statusFilter, datePreset, dateFrom, dateTo]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, datePreset, dateFrom, dateTo]);

  const totalPages = React.useMemo(() => {
    return Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  }, [filteredRows.length, itemsPerPage]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedRows = React.useMemo(() => {
    return filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredRows, currentPage, itemsPerPage]);

  const stats = React.useMemo(() => {
    const todayKey = clinicDateKey(new Date());
    const monthPrefix = todayKey.slice(0, 7);
    const pending = rows.filter((row) => row.status === "Pending").length;
    const confirmedToday = rows.filter(
      (row) => row.status === "Confirmed" && clinicDateKey(row.scheduledAt) === todayKey,
    ).length;
    // Outstanding balance only: what is still owed on live bookings, net of
    // anything already collected. Cancelled and fully paid bookings owe nothing.
    const receivable = rows
      .filter((row) => row.status !== "Cancelled" && row.payment !== "Paid" && !row.prepaid)
      .reduce((total, row) => total + Math.max(0, row.amount - row.collected), 0);
    const completedMtd = rows.filter(
      (row) => row.status === "Completed" && clinicDateKey(row.scheduledAt).startsWith(monthPrefix),
    ).length;

    return { pending, confirmedToday, receivable, completedMtd };
  }, [rows]);

  const openDetails = (row: LedgerRow) => {
    setSelectedExam(row);
    const matchedType =
      (row.examTypeId ? examTypes.find((et) => et.id === row.examTypeId) : undefined) ??
      examTypes.find((et) => et.name === row.type);
    setEditExamType(matchedType || null);
    setEditPrice(String(row.amount));
    setEditExaminerId(String(row.examinerId));
    setEditReason(row.reason === "No case background provided." ? "" : row.reason);
    setEditStatus(row.status.toLowerCase());
    const { date, time } = parseClinicDateTimeFields(row.scheduledAt);
    setEditDate(date);
    setEditTime(time);
    setIsSheetOpen(true);
  };

  const handleExamTypeChange = (examTypeId: string) => {
    const examType = examTypes.find((item) => item.id === Number(examTypeId));
    if (!examType) return;
    setEditExamType(examType);
    // Suggest the catalog price for a new type, but never on a bulk-invoice booking
    // (its fee is owned by that invoice) or below what has already been collected.
    if (selectedExam && !selectedExam.prepaid) {
      const catalog = catalogPriceInCurrency(examType.price, orgCurrency, orgSettings);
      setEditPrice(String(Math.max(catalog, selectedExam.collected)));
    }
  };

  /** Only the fields that differ from the saved booking, plus any validation error. */
  const pendingChanges = React.useMemo(() => {
    if (!selectedExam) return { changes: {}, error: null as string | null, count: 0 };
    const changes: Parameters<typeof updateAppointment>[1] = {};
    let error: string | null = null;

    if (!editExamType) error = "Select an exam type";
    else if (!editExaminerId) error = "Select an examiner";
    else if (!editDate || !editTime) error = "Pick a date and time";

    const typeChanged = Boolean(editExamType && editExamType.name !== selectedExam.type);
    if (editExamType && typeChanged) {
      changes.exam_type_id = editExamType.id;
      if (editExamType.duration && editExamType.duration !== selectedExam.duration) {
        changes.duration = editExamType.duration;
      }
    }

    if (editExaminerId && Number(editExaminerId) !== selectedExam.examinerId) {
      changes.examiner_id = Number(editExaminerId);
    }

    if (editDate && editTime) {
      const scheduledAt = clinicDateTimeToISO(editDate, editTime);
      if (new Date(scheduledAt).getTime() !== new Date(selectedExam.scheduledAt).getTime()) {
        changes.scheduled_at = scheduledAt;
      }
    }

    // Notes hold "<exam type>\n\n<case notes>"; rewrite them only when either part
    // the user can see actually changed (never just to reformat legacy notes).
    const savedReason = selectedExam.reason === "No case background provided." ? "" : selectedExam.reason;
    if (editExamType && (typeChanged || editReason.trim() !== savedReason.trim())) {
      changes.notes = buildAppointmentNotes(editExamType.name, editReason);
    }

    const fee = parseFloat(editPrice);
    if (Number.isNaN(fee) || fee < 0) {
      error = error ?? "Enter a valid fee";
    } else if (Math.abs(fee - selectedExam.amount) > 0.004) {
      if (selectedExam.prepaid) error = error ?? "This exam is covered by a bulk invoice; change the fee on that invoice";
      else if (fee + 0.005 < selectedExam.collected)
        error = error ?? `The fee can't be lower than the ${formatMoney(selectedExam.collected, orgCurrency)} already collected`;
      else changes.exam_fee = fee;
    }

    if (editStatus !== selectedExam.status.toLowerCase()) {
      const start = changes.scheduled_at ?? selectedExam.scheduledAt;
      if (editStatus === "completed" && new Date(start).getTime() > Date.now()) {
        error = error ?? "An exam can't be marked completed before its scheduled start";
      } else {
        changes.status = editStatus;
      }
    }

    const count = Object.keys(changes).length;
    // Legacy bookings matched by name only: record the type id alongside a real
    // save so reports and the dashboard see the right type from then on.
    if (count > 0 && editExamType && !selectedExam.examTypeId && changes.exam_type_id === undefined) {
      changes.exam_type_id = editExamType.id;
    }
    return { changes, error, count };
  }, [selectedExam, editExamType, editExaminerId, editDate, editTime, editReason, editPrice, editStatus, orgCurrency]);

  const handleSaveExam = async () => {
    if (!selectedExam) return;
    const { changes, error, count } = pendingChanges;
    if (error) {
      toast.error(error);
      return;
    }
    if (count === 0) {
      toast.message("No changes to save");
      return;
    }

    setSavingFields(true);
    try {
      const saved = await updateAppointment(selectedExam.id, changes);
      // Merge what the server decided (money, payment status, schedule) into the row;
      // the response omits the examinee, so keep the display names we already have.
      const examinerInfo = examinerDisplay(examiners, saved.examiner_id ?? selectedExam.examinerId);
      const scheduledAt = saved.scheduled_at || changes.scheduled_at || selectedExam.scheduledAt;
      const notes = saved.notes ?? changes.notes ?? selectedExam.notes;
      const typeId = saved.exam_type_id ?? changes.exam_type_id ?? selectedExam.examTypeId;
      const updatedRow: LedgerRow = {
        ...selectedExam,
        examinerId: saved.examiner_id ?? selectedExam.examinerId,
        examiner: examinerInfo.name,
        examinerInitials: examinerInfo.initials,
        examinerColor: examinerInfo.color,
        examTypeId: typeId ?? undefined,
        type: (typeId && examTypes.find((et) => et.id === typeId)?.name) || parseNotes(notes).title,
        amount: Number(saved.exam_fee ?? selectedExam.amount),
        collected: Number(saved.collected_amount ?? selectedExam.collected),
        payment: normalizePaymentStatus(saved.payment_status ?? selectedExam.payment),
        status: normalizeStatus(saved.status ?? editStatus),
        notes,
        reason: parseNotes(notes).reason,
        scheduledAt,
        dateLabel: formatClinicDateLabel(scheduledAt),
        timeLabel: formatClinicClock(scheduledAt),
        duration: Number(saved.duration || selectedExam.duration),
      };

      setRows((current) => current.map((row) => (row.id === selectedExam.id ? updatedRow : row)));
      setSelectedExam(updatedRow);
      setEditPrice(String(updatedRow.amount));
      setEditStatus(updatedRow.status.toLowerCase());
      toast.success(count === 1 ? "Change saved" : `${count} changes saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update exam");
    } finally {
      setSavingFields(false);
    }
  };

  const resetEdits = () => {
    if (selectedExam) openDetails(selectedExam);
  };

  const handleDelete = async () => {
    if (!selectedExam) return;
    setDeleting(true);
    try {
      await deleteAppointment(selectedExam.id);
      setRows((current) => current.filter((row) => row.id !== selectedExam.id));
      toast.success("Appointment deleted");
      setIsSheetOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete appointment");
    } finally {
      setDeleting(false);
    }
  };

  const selectedEditExaminer = examiners.find((item) => item.id === Number(editExaminerId));

  const handleExportCSV = () => {
    const headers = [
      "Exam ID",
      "Examinee / Client",
      "Billing Account",
      "Assigned Expert",
      "Type",
      "Date",
      "Time",
      `Fee Amount (${orgCurrency})`,
      `Paid Amount (${orgCurrency})`,
      "Payment Status",
      "Appointment Status"
    ];
    const exportRows = filteredRows.map((row) => [
      row.code,
      row.client,
      row.accountName || "—",
      row.examiner,
      row.type,
      row.dateLabel,
      row.timeLabel,
      row.amount.toFixed(2),
      row.collected.toFixed(2),
      row.payment,
      row.status
    ]);

    const csvContent = [headers.join(","), ...exportRows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Polygraph_Exams_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exams list exported to CSV");
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-10">
      <GlowPanel tone="terracotta" orb="72%" lineTop={40} className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 pt-6 sm:gap-8 sm:pt-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
                <FileText aria-hidden="true" className="size-4" />
                Exams
              </span>
              <h1 className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] sm:text-[44px]">
                Polygraph <span className="font-semibold">Ledger</span>
              </h1>
              <p className="max-w-xl text-[15px] text-[#C9C6BC]">
                Master record of every scheduled and historical polygraph examination.
              </p>
            </div>
            <div className="flex w-full items-center gap-2.5 sm:w-auto">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.07] px-5 text-sm font-medium text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] sm:flex-initial"
              >
                <Download aria-hidden="true" className="size-4" />
                Export CSV
              </button>
              <Link
                href="/dashboard/calendar/book"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#FAF9F5] pr-5 pl-2.5 text-sm font-semibold text-[#1A1915] transition-colors hover:bg-white sm:flex-initial"
              >
                <span className="bg-primary flex size-6 items-center justify-center rounded-full">
                  <Plus aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </span>
                New record
              </Link>
            </div>
          </div>

          <div className={cn("grid grid-cols-2 gap-3", canViewPayments ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
            <GlassStat label="Pending tests" value={stats.pending} hint="Awaiting confirmation" icon={Clock} accent="lavender" loading={loading} />
            <GlassStat label="Confirmed today" value={stats.confirmedToday} hint="On today's calendar" icon={UserCheck} accent="sage" loading={loading} />
            {canViewPayments ? (
              <GlassStat
                label="Accounts receivable"
                value={formatMoney(stats.receivable, orgCurrency)}
                hint="Outstanding balance"
                icon={CreditCard}
                accent="amber"
                loading={loading}
              />
            ) : null}
            <GlassStat label="Completed this month" value={stats.completedMtd} hint="Month to date" icon={ShieldCheck} accent="terracotta" loading={loading} />
          </div>
        </div>
      </GlowPanel>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[26px] bg-white p-3 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-4 dark:bg-card">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <label htmlFor="exam-search" className="sr-only">
                Search exams
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="exam-search"
                placeholder="Search by ID, examinee, organisation or examiner…"
                className="h-11 rounded-full border-0 bg-[#F3F1EA] pr-4 pl-11 text-sm shadow-none dark:bg-muted"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Segmented
                label="Date range"
                value={datePreset}
                onChange={setDatePreset}
                options={[
                  { value: "all", label: "All dates" },
                  { value: "today", label: "Today" },
                  { value: "week", label: "This week" },
                  { value: "month", label: "This month" },
                  { value: "custom", label: "Custom" },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/50 pt-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-[13px] text-muted-foreground">Status</span>
              <Segmented
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "Pending", label: "Pending" },
                  { value: "Confirmed", label: "Confirmed" },
                  { value: "Completed", label: "Completed" },
                  { value: "Cancelled", label: "Cancelled" },
                ]}
              />
            </div>
            {(datePreset !== "all" || dateFrom || dateTo || statusFilter !== "all" || searchQuery) && (
              <button
                type="button"
                className="flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full px-3 text-sm font-medium text-[oklch(0.45_0.12_39)] transition-colors hover:bg-primary/10 lg:self-auto dark:text-primary"
                onClick={() => {
                  setDatePreset("all");
                  setDateFrom("");
                  setDateTo("");
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
              >
                <X aria-hidden="true" className="size-3.5" />
                Clear filters
              </button>
            )}
          </div>

          {datePreset === "custom" && (
            <div className="flex flex-wrap items-end gap-3 rounded-[18px] bg-[#F7F6F1] p-3 dark:bg-muted/50">
              <div className="grid flex-1 gap-1.5 sm:flex-initial">
                <Label htmlFor="exam-date-from" className="text-xs text-muted-foreground">From</Label>
                <Input
                  id="exam-date-from"
                  type="date"
                  className="h-10 w-full rounded-full bg-white px-4 text-sm sm:w-44 dark:bg-card"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="grid flex-1 gap-1.5 sm:flex-initial">
                <Label htmlFor="exam-date-to" className="text-xs text-muted-foreground">To</Label>
                <Input
                  id="exam-date-to"
                  type="date"
                  className="h-10 w-full rounded-full bg-white px-4 text-sm sm:w-44 dark:bg-card"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[13px] text-muted-foreground">
                  <th className="px-6 pt-5 pb-3 font-medium">Exam / Examinee</th>
                  <th className="px-6 pt-5 pb-3 font-medium">Examiner</th>
                  <th className="px-6 pt-5 pb-3 font-medium">Type &amp; schedule</th>
                  {canViewPayments && <th className="px-6 pt-5 pb-3 font-medium">Payment</th>}
                  <th className="px-6 pt-5 pb-3 font-medium">Status</th>
                  <th className="relative px-6 pt-5 pb-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-muted-foreground" colSpan={canViewPayments ? 6 : 5}>Loading appointments...</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-muted-foreground" colSpan={canViewPayments ? 6 : 5}>No appointments found.</td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr
                      key={row.id}
                      className="group cursor-pointer transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40"
                      onClick={() => openDetails(row)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
                          <span className="text-[15px] font-medium text-foreground">{row.client}</span>
                          {row.accountName && <span className="text-[13px] text-muted-foreground">{row.accountName}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", row.examinerColor)}>
                            {row.examinerInitials}
                          </span>
                          <span className="text-sm">{row.examiner}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{row.type}</span>
                          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                            <CalendarIcon aria-hidden="true" className="size-3.5" />
                            {row.dateLabel} · <span className="font-mono">{row.timeLabel}</span>
                          </span>
                        </div>
                      </td>
                      {canViewPayments && (
                        <td className="px-6 py-4">
                          <PaymentPill payment={row.payment} amount={formatMoney(row.amount, orgCurrency)} />
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          aria-label={`Open ${row.code} details`}
                          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-[#30302E] group-hover:text-[#FAF9F5] dark:group-hover:bg-foreground dark:group-hover:text-background"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetails(row);
                          }}
                        >
                          <ChevronRight aria-hidden="true" className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="block md:hidden divide-y divide-border/20">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm italic">
                Loading appointments...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs italic">
                No appointments found.
              </div>
            ) : (
              paginatedRows.map((row) => (
                <div key={row.id} className="space-y-3 p-4 transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block font-mono text-xs text-muted-foreground">{row.code}</span>
                      <h4 className="text-base leading-tight font-medium text-foreground">{row.client}</h4>
                      {row.accountName && <p className="mt-0.5 text-[13px] text-muted-foreground">{row.accountName}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                      <StatusPill status={row.status} />
                      {canViewPayments && (
                        <span className="text-xs text-muted-foreground">
                          <span className="font-mono text-foreground">{formatMoney(row.amount, orgCurrency)}</span> · {row.payment}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-[#F7F6F1] p-3 text-xs text-muted-foreground dark:bg-muted/40">
                    <div className="min-w-0">
                      <span className="block">Examiner</span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white", row.examinerColor)}>
                          {row.examinerInitials}
                        </span>
                        <span className="truncate text-[13px] text-foreground">{row.examiner}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="block">Schedule</span>
                      <span className="mt-1 block truncate text-[13px] text-foreground">
                        {row.dateLabel} · <span className="font-mono">{row.timeLabel}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="flex h-11 w-full items-center justify-between rounded-full bg-[#30302E] px-5 text-sm font-medium text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] dark:bg-secondary dark:text-secondary-foreground"
                    onClick={() => openDetails(row)}
                  >
                    <span>View &amp; manage</span>
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-border/50 px-4 py-4 sm:flex-row sm:px-6">
            <p className="text-[13px] text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground tabular-nums">
                {filteredRows.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–{Math.min(currentPage * itemsPerPage, filteredRows.length)}
              </span>{" "}
              of <span className="tabular-nums">{filteredRows.length}</span> exams
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-10 rounded-full bg-[#F3F1EA] px-4 text-sm font-medium transition-colors hover:bg-[#E9E6DD] disabled:pointer-events-none disabled:opacity-40 dark:bg-muted"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="px-2 text-[13px] text-muted-foreground tabular-nums">
                {currentPage} / {Math.max(1, totalPages)}
              </span>
              <button
                type="button"
                className="h-10 rounded-full bg-[#30302E] px-4 text-sm font-medium text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:pointer-events-none disabled:opacity-40 dark:bg-secondary dark:text-secondary-foreground"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full gap-0 overflow-hidden border-l border-border/50 bg-white p-0 shadow-2xl sm:max-w-[720px] dark:bg-card [&_[data-slot=sheet-close]]:top-5 [&_[data-slot=sheet-close]]:right-5 [&_[data-slot=sheet-close]]:z-30 [&_[data-slot=sheet-close]]:flex [&_[data-slot=sheet-close]]:size-9 [&_[data-slot=sheet-close]]:items-center [&_[data-slot=sheet-close]]:justify-center [&_[data-slot=sheet-close]]:rounded-full [&_[data-slot=sheet-close]]:bg-white/10! [&_[data-slot=sheet-close]]:text-[#FAF9F5] [&_[data-slot=sheet-close]]:opacity-100 [&_[data-slot=sheet-close]]:ring-1 [&_[data-slot=sheet-close]]:ring-white/15 [&_[data-slot=sheet-close]]:backdrop-blur-md">
          {selectedExam && (() => {
            const settled = selectedExam.payment === "Paid";
            const collected = settled ? selectedExam.amount : selectedExam.collected;
            const balance = settled ? 0 : Math.max(0, selectedExam.amount - selectedExam.collected);
            const paidShare = selectedExam.amount > 0 ? Math.min(100, (collected / selectedExam.amount) * 100) : 0;
            const plannedStart = pendingChanges.changes.scheduled_at ?? selectedExam.scheduledAt;
            const startsInFuture = new Date(plannedStart).getTime() > Date.now();
            const { count: changeCount, error: changeError } = pendingChanges;
            const showSaveBar = canManageAppointments && (changeCount > 0 || Boolean(changeError));
            const sectionTitle = "px-1 text-[13px] font-medium text-foreground";
            const linkRow =
              "group flex h-12 items-center justify-between gap-3 rounded-xl px-3 text-sm transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/60";

            return (
              <div className="relative flex h-full flex-col">
                {/* Header */}
                <GlowPanel
                  tone={selectedExam.status === "Cancelled" ? "ink" : selectedExam.status === "Pending" ? "lavender" : "terracotta"}
                  orb="62%"
                  lineTop={0}
                  className="shrink-0 rounded-none px-6 pt-6 pb-5 shadow-none ring-0 sm:px-7"
                >
                  <div key={`head-${selectedExam.id}`} className="flex flex-col gap-3 pr-12 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:delay-75 motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={selectedExam.status} onDark />
                      <span className="font-mono text-xs text-[#B5B2A8]">{selectedExam.code}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h2 className="text-2xl leading-tight font-medium tracking-[-0.02em]">{selectedExam.client}</h2>
                      <p className="text-sm text-[#C9C6BC]">
                        {selectedExam.type}
                        {selectedExam.accountName ? <span className="text-[#8E8B82]"> · {selectedExam.accountName}</span> : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#C9C6BC]">
                      <span className="flex items-center gap-1.5">
                        <CalendarIcon aria-hidden="true" className="size-3.5" />
                        {selectedExam.dateLabel}
                        <span className="font-mono text-[#FAF9F5]">{selectedExam.timeLabel}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock aria-hidden="true" className="size-3.5" />
                        {selectedExam.duration} min
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={cn("flex size-5 items-center justify-center rounded-full text-[9px] font-semibold text-white", selectedExam.examinerColor)}>
                          {selectedExam.examinerInitials}
                        </span>
                        {selectedExam.examiner}
                      </span>
                    </div>
                  </div>
                </GlowPanel>

                {/* Body */}
                <div className={cn("min-h-0 flex-1 overflow-y-auto", showSaveBar && "pb-24")}>
                  <div key={`body-${selectedExam.id}`} className="flex flex-col gap-7 px-4 py-5 sm:px-6">
                    {/* Payment strip */}
                    {canViewPayments && (
                      <section aria-label="Payment" className="flex flex-col gap-3 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/50 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] motion-safe:delay-100">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-xl tabular-nums">{formatMoney(collected, orgCurrency)}</span>
                            <span className="text-[13px] text-muted-foreground">of {formatMoney(selectedExam.amount, orgCurrency)} collected</span>
                          </div>
                          <span
                            className={cn(
                              "text-[13px] font-medium",
                              balance > 0 ? "text-[#8A2C22] dark:text-red-300" : "text-[#2D5A27] dark:text-emerald-300",
                            )}
                          >
                            {balance > 0 ? `${formatMoney(balance, orgCurrency)} due` : "Settled"}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#E9E6DD] dark:bg-background">
                          <div
                            className={cn("h-full rounded-full transition-all", balance > 0 ? "bg-primary" : "bg-[#3F7A37] dark:bg-emerald-400")}
                            style={{ width: `${paidShare}%` }}
                          />
                        </div>
                        {selectedExam.prepaid && (
                          <p className="text-xs text-muted-foreground">Covered by a bulk invoice. Its fee and payments are managed there.</p>
                        )}
                      </section>
                    )}

                    {/* Properties */}
                    {canManageAppointments ? (
                      <section className="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] motion-safe:delay-150">
                        <h3 className={cn(sectionTitle, "mb-1")}>Details</h3>
                        <PropertyRow icon={CalendarIcon} label="Date" htmlFor="edit-date">
                          <Input id="edit-date" type="date" className={GHOST_FIELD} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                        </PropertyRow>
                        <PropertyRow icon={Clock} label="Start time" htmlFor="edit-time">
                          <Input id="edit-time" type="time" className={cn(GHOST_FIELD, "font-mono")} value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                        </PropertyRow>
                        <PropertyRow icon={UserRound} label="Examiner">
                          <Select value={editExaminerId} onValueChange={(value) => setEditExaminerId(String(value))}>
                            <SelectTrigger className={GHOST_FIELD} aria-label="Examiner">
                              <SelectValue placeholder="Select examiner">
                                {selectedEditExaminer ? (
                                  <span className="flex items-center gap-2">
                                    <span className={cn("flex size-5 items-center justify-center rounded-full text-[9px] font-semibold text-white", examinerDisplay(examiners, selectedEditExaminer.id).color)}>
                                      {examinerDisplay(examiners, selectedEditExaminer.id).initials}
                                    </span>
                                    {selectedEditExaminer.name}
                                  </span>
                                ) : undefined}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {examiners.map((examiner) => (
                                <SelectItem key={examiner.id} value={String(examiner.id)}>
                                  {examiner.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </PropertyRow>
                        <PropertyRow icon={Tag} label="Exam type">
                          <Select value={editExamType ? String(editExamType.id) : ""} onValueChange={(value) => handleExamTypeChange(String(value))}>
                            <SelectTrigger className={GHOST_FIELD} aria-label="Exam type">
                              <SelectValue placeholder="Select exam type">{editExamType?.name}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {examTypes.map((examType) => (
                                <SelectItem key={examType.id} value={String(examType.id)}>
                                  {examType.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </PropertyRow>
                        <PropertyRow
                          icon={CreditCard}
                          label={`Fee (${orgCurrency})`}
                          htmlFor="edit-fee"
                          hint={
                            selectedExam.prepaid
                              ? "Locked: set by the bulk invoice"
                              : selectedExam.collected > 0
                                ? `Can't go below the ${formatMoney(selectedExam.collected, orgCurrency)} already collected`
                                : undefined
                          }
                        >
                          {selectedExam.prepaid ? (
                            <div className="flex h-10 items-center gap-2 px-3 font-mono text-sm text-muted-foreground">
                              <Lock aria-hidden="true" className="size-3.5" />
                              {formatMoney(selectedExam.amount, orgCurrency)}
                            </div>
                          ) : (
                            <Input
                              id="edit-fee"
                              type="number"
                              min={selectedExam.collected || 0}
                              step="0.01"
                              inputMode="decimal"
                              className={cn(GHOST_FIELD, "font-mono")}
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                            />
                          )}
                        </PropertyRow>
                        <PropertyRow
                          icon={CircleDot}
                          label="Status"
                          hint={
                            editStatus === "cancelled" && selectedExam.status !== "Cancelled"
                              ? "Cancelling frees the slot; prepaid credit returns unless the booking was charged."
                              : startsInFuture && selectedExam.status !== "Completed"
                                ? "Completed becomes available once the exam has started."
                                : undefined
                          }
                        >
                          <StatusPicker
                            label="Appointment status"
                            value={editStatus as (typeof APPOINTMENT_STATUSES)[number]}
                            onChange={(value) => setEditStatus(value)}
                            options={APPOINTMENT_STATUSES.map((status) => ({
                              value: status,
                              label: status.charAt(0).toUpperCase() + status.slice(1),
                              disabled: status === "completed" && startsInFuture && selectedExam.status !== "Completed",
                            }))}
                          />
                        </PropertyRow>
                      </section>
                    ) : null}

                    {/* Notes */}
                    <section className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] motion-safe:delay-200">
                      <label htmlFor="edit-notes" className={sectionTitle}>
                        Case notes
                      </label>
                      {canManageAppointments ? (
                        <Textarea
                          id="edit-notes"
                          className="min-h-24 resize-y rounded-xl border border-transparent bg-[#F7F6F1] px-3.5 py-3 text-sm leading-relaxed shadow-none transition-colors hover:bg-[#F3F1EA] focus-visible:border-border focus-visible:bg-white focus-visible:ring-0 dark:bg-muted/50 dark:focus-visible:bg-card"
                          placeholder="Reason for the exam, position applied for, referral context…"
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                        />
                      ) : (
                        <p className="rounded-xl bg-[#F7F6F1] px-3.5 py-3 text-sm leading-relaxed text-foreground/80 dark:bg-muted/50">
                          {selectedExam.reason || "No case notes recorded."}
                        </p>
                      )}
                    </section>

                    {/* Links */}
                    <section className="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] motion-safe:delay-[250ms]">
                      <h3 className={cn(sectionTitle, "mb-1")}>Related</h3>
                      <div className="flex flex-col divide-y divide-border/50 rounded-2xl ring-1 ring-border/60">
                        {selectedExam.subjectId ? (
                          <Link href={`/dashboard/clients/${selectedExam.clientId}/examinees/${selectedExam.subjectId}`} className={linkRow}>
                            <span className="flex items-center gap-3">
                              <UserRound aria-hidden="true" className="size-4 text-muted-foreground" />
                              Examinee profile
                            </span>
                            <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </Link>
                        ) : null}
                        <Link href={`/dashboard/clients/${selectedExam.clientId}`} className={linkRow}>
                          <span className="flex min-w-0 items-center gap-3">
                            <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">Billing account{selectedExam.accountName ? ` · ${selectedExam.accountName}` : ""}</span>
                          </span>
                          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Link>
                        {canViewPayments && (
                          <Link href="/dashboard/payments" className={linkRow}>
                            <span className="flex items-center gap-3">
                              <CreditCard aria-hidden="true" className="size-4 text-muted-foreground" />
                              Payments
                            </span>
                            <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </Link>
                        )}
                      </div>
                    </section>

                    {canManageAppointments && (
                      <div className="flex justify-start motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] motion-safe:delay-300">
                        <DeleteConfirmDialog
                          title={`Delete ${selectedExam.code}`}
                          description="This permanently removes the appointment and frees its schedule slot. Prepaid credit is returned. This cannot be undone."
                          confirmLabel="Confirmation"
                          triggerLabel={deleting ? "Deleting..." : "Delete appointment"}
                          onConfirm={handleDelete}
                          trigger={
                            <button
                              type="button"
                              className="flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-[#8A2C22] transition-colors hover:bg-[#F6E3E1] dark:text-red-300 dark:hover:bg-red-950"
                            >
                              <Trash2 aria-hidden="true" className="size-3.5" />
                              {deleting ? "Deleting…" : "Delete appointment"}
                            </button>
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Floating save bar — only when there is something to save */}
                <div
                  aria-hidden={!showSaveBar}
                  className={cn(
                    "pointer-events-none absolute inset-x-4 bottom-4 z-20 origin-bottom transition-[transform,opacity] sm:inset-x-6 motion-reduce:transition-none",
                    showSaveBar
                      ? "translate-y-0 scale-100 opacity-100 duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]"
                      : "translate-y-6 scale-[0.96] opacity-0 duration-200 ease-in",
                  )}
                >
                  <div className={cn("flex items-center justify-between gap-3 rounded-full bg-[#1E1D1B] py-2 pr-2 pl-5 text-[#FAF9F5] shadow-[0_16px_40px_-12px_rgba(20,20,19,0.55)] ring-1 ring-white/10", showSaveBar && "pointer-events-auto")}>
                    <span aria-live="polite" className="min-w-0 truncate text-[13px]">
                      {changeError ? (
                        <span className="text-[#F2B8AE]">{changeError}</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                          {changeCount} unsaved change{changeCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        tabIndex={showSaveBar ? 0 : -1}
                        onClick={resetEdits}
                        disabled={savingFields}
                        className="h-9 rounded-full px-4 text-sm text-[#C9C6BC] transition-colors hover:bg-white/10 hover:text-[#FAF9F5]"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        tabIndex={showSaveBar ? 0 : -1}
                        onClick={() => void handleSaveExam()}
                        disabled={changeCount === 0 || Boolean(changeError) || savingFields}
                        className="h-9 rounded-full bg-[#FAF9F5] px-5 text-sm font-semibold text-[#1A1915] transition-colors hover:bg-white disabled:opacity-40"
                      >
                        {savingFields ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function mapRows(appointments: AppointmentRecord[], examiners: UserRecord[], examTypes: ExamTypeRecord[] = []): LedgerRow[] {
  const typeNames = new Map(examTypes.map((type) => [type.id, type.name]));
  const examinerMap = new Map<number, { name: string; color: string }>();
  examiners.forEach((examiner, index) => {
    examinerMap.set(examiner.id, {
      name: examiner.name,
      color: examinerColors[index % examinerColors.length],
    });
  });

  return appointments.map((appointment) => {
    const examiner = examinerMap.get(appointment.examiner_id);
    const date = new Date(appointment.scheduled_at);
    const parsed = parseNotes(appointment.notes);
    const accountName = appointment.client?.name || `Client #${appointment.client_id}`;
    const examineeName = appointment.subject
      ? formatSubjectName(appointment.subject)
      : undefined;
    const isOrg = isOrganizationClient(
      appointment.client
        ? {
            id: appointment.client.id,
            name: appointment.client.name,
            client_type: appointment.client.client_type ?? "Individual",
            email: appointment.client.email ?? "",
            created_at: "",
            updated_at: "",
          }
        : null,
    );

    let displayName = accountName;
    let billingAccount: string | undefined;
    if (isOrg && examineeName) {
      displayName = examineeName;
      billingAccount = accountName;
    } else if (examineeName) {
      displayName = examineeName;
    }

    return {
      id: appointment.id,
      code: `EX-${String(appointment.id).padStart(4, "0")}`,
      clientId: appointment.client_id,
      subjectId: appointment.subject?.id ?? appointment.subject_id,
      client: displayName,
      accountName: billingAccount,
      examinerId: appointment.examiner_id,
      examiner: examiner?.name || `Examiner #${appointment.examiner_id}`,
      examinerInitials: initials(examiner?.name || `E${appointment.examiner_id}`),
      examinerColor: examiner?.color || "bg-slate-600",
      // The booked exam type is the source of truth; the notes' first line is a legacy label.
      type: (appointment.exam_type_id && typeNames.get(appointment.exam_type_id)) || parsed.title,
      examTypeId: appointment.exam_type_id ?? undefined,
      prepaid: Boolean(appointment.prepaid_slot_id),
      notes: appointment.notes || "",
      dateLabel: formatClinicDateLabel(date),
      timeLabel: formatClinicClock(date),
      amount: Number(appointment.exam_fee || 0),
      collected: Number(appointment.collected_amount || 0),
      payment: normalizePaymentStatus(appointment.payment_status),
      status: normalizeStatus(appointment.status),
      reason: parsed.reason,
      scheduledAt: appointment.scheduled_at,
      duration: Number(appointment.duration || 150),
    };
  });
}

function parseNotes(notes: string): { title: string; reason: string } {
  const lines = (notes || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { title: "Appointment", reason: "No case background provided." };
  }
  if (lines.length === 1) {
    // A single line is just the exam-type label: there are no case notes.
    return { title: lines[0], reason: "" };
  }
  return { title: lines[0], reason: lines.slice(1).join(" ") };
}

function normalizeStatus(value?: string): string {
  const status = (value || "pending").toLowerCase();
  if (status === "confirmed") return "Confirmed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function normalizePaymentStatus(value?: string): string {
  const payment = (value || "Unpaid").toLowerCase();
  if (payment === "paid") return "Paid";
  if (payment === "partial" || payment === "deposit") return "Partial";
  return "Unpaid";
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
