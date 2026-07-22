"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Calendar as CalendarIcon,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { formatMoney, catalogPriceInCurrency, CATALOG_PRICE_CURRENCY } from "@/lib/client-account";
import {
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
};

type DatePreset = "all" | "today" | "week" | "month" | "custom";
type StatusFilter = "all" | "Pending" | "Confirmed" | "Completed" | "Cancelled";

function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function presetRange(preset: DatePreset): { from?: Date; to?: Date } {
  if (preset === "all") return {};
  const now = new Date();
  const from = startOfDay(now);
  const to = endOfDay(now);
  if (preset === "today") return { from, to };
  if (preset === "week") {
    const weekStart = new Date(from);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return { from: weekStart, to: endOfDay(weekEnd) };
  }
  if (preset === "month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: monthStart, to: endOfDay(monthEnd) };
  }
  return {};
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
        const mapped = mapRows(appointments, examiners);
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
      let from: Date | undefined;
      let to: Date | undefined;
      if (datePreset === "custom") {
        const parsedFrom = parseLocalDate(dateFrom);
        if (parsedFrom) from = startOfDay(parsedFrom);
        const parsedTo = parseLocalDate(dateTo);
        if (parsedTo) to = endOfDay(parsedTo);
      } else {
        const range = presetRange(datePreset);
        from = range.from;
        to = range.to;
      }
      result = result.filter((row) => {
        const when = new Date(row.scheduledAt);
        if (Number.isNaN(when.getTime())) return false;
        if (from && when < from) return false;
        if (to && when > to) return false;
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
    const pending = rows.filter((row) => row.status === "Pending").length;
    const today = new Date().toDateString();
    const confirmedToday = rows.filter((row) => row.status === "Confirmed" && new Date(`${row.dateLabel} ${row.timeLabel}`).toDateString() === today).length;
    const receivable = rows
      .filter((row) => row.payment !== "Paid")
      .reduce((total, row) => total + row.amount, 0);
    const completedMtd = rows.filter((row) => row.status === "Completed").length;

    return { pending, confirmedToday, receivable, completedMtd };
  }, [rows]);

  const openDetails = (row: LedgerRow) => {
    setSelectedExam(row);
    const matchedType = examTypes.find((et) => et.name === row.type);
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
    setEditPrice(String(catalogPriceInCurrency(examType.price, orgCurrency, orgSettings)));
  };

  const handleSaveExam = async () => {
    if (!selectedExam) return;
    if (!editExamType) {
      toast.error("Please select an exam type");
      return;
    }
    if (!editExaminerId) {
      toast.error("Please select an examiner");
      return;
    }
    if (!editDate || !editTime) {
      toast.error("Pick a date and time");
      return;
    }
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    const scheduledAt = clinicDateTimeToISO(editDate, editTime);
    const notes = buildAppointmentNotes(editExamType.name, editReason);
    setSavingFields(true);
    try {
      await updateAppointment(selectedExam.id, {
        scheduled_at: scheduledAt,
        duration: editExamType.duration,
        examiner_id: Number(editExaminerId),
        notes,
        exam_fee: newPrice,
        status: editStatus,
      });

      const examinerInfo = examinerDisplay(examiners, Number(editExaminerId));
      const dateLabel = formatClinicDateLabel(scheduledAt);
      const timeLabel = formatClinicClock(scheduledAt);
      const parsedReason = parseNotes(notes).reason;

      const updatedRow: LedgerRow = {
        ...selectedExam,
        examinerId: Number(editExaminerId),
        examiner: examinerInfo.name,
        examinerInitials: examinerInfo.initials,
        examinerColor: examinerInfo.color,
        type: editExamType.name,
        amount: newPrice,
        status: normalizeStatus(editStatus),
        reason: parsedReason,
        scheduledAt,
        dateLabel,
        timeLabel,
        duration: editExamType.duration,
      };

      setRows((current) =>
        current.map((row) => (row.id === selectedExam.id ? updatedRow : row)),
      );
      setSelectedExam(updatedRow);
      toast.success("Exam updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update exam");
    } finally {
      setSavingFields(false);
    }
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
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Polygraph Ledger
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Master record of all scheduled and historical polygraph examinations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExportCSV} variant="outline" className="h-10 px-4 rounded-xl border-border/50 hover:bg-muted/50 transition-all font-semibold">
            <Download className="mr-2 h-4 w-4 text-muted-foreground" />
            Export Data
          </Button>
          <Button className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all" render={<Link href="/dashboard/calendar/book" />}>
            <Plus className="mr-2 h-4 w-4" />
            New Record
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending Tests", value: String(stats.pending), icon: Clock, color: "text-amber-500" },
          { label: "Confirmed Today", value: String(stats.confirmedToday), icon: UserCheck, color: "text-emerald-500" },
          ...(canViewPayments
            ? [{ label: "Accounts Receivable", value: formatMoney(stats.receivable, orgCurrency), icon: CreditCard, color: "text-rose-500" }]
            : []),
          { label: "Completed (MTD)", value: String(stats.completedMtd), icon: ShieldCheck, color: "text-blue-500" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/40 shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden group hover:border-primary/30 transition-all">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl bg-background border border-border shadow-inner group-hover:scale-110 transition-transform", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-extrabold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative w-full lg:max-w-md group">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search by ID, examinee, organization, or expert..."
                className="h-11 pl-10 pr-4 rounded-xl bg-card border-border/50 focus:border-primary/50 focus:ring-primary/10 transition-all shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { value: "all", label: "All dates" },
                  { value: "today", label: "Today" },
                  { value: "week", label: "This week" },
                  { value: "month", label: "This month" },
                  { value: "custom", label: "Custom" },
                ] as const
              ).map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant={datePreset === preset.value ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl h-9"
                  onClick={() => setDatePreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
              {(datePreset !== "all" || dateFrom || dateTo) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl h-9 gap-1"
                  onClick={() => {
                    setDatePreset("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          {datePreset === "custom" && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/50 bg-card/50 p-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  className="h-10 w-40 rounded-lg"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  className="h-10 w-40 rounded-lg"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Status</span>
            {(
              [
                { value: "all", label: "All" },
                { value: "Pending", label: "Pending" },
                { value: "Confirmed", label: "Confirmed" },
                { value: "Completed", label: "Completed" },
                { value: "Cancelled", label: "Cancelled" },
              ] as const
            ).map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={statusFilter === option.value ? "default" : "outline"}
                size="sm"
                className="rounded-xl h-9"
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
            {statusFilter !== "all" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl h-9 gap-1"
                onClick={() => setStatusFilter("all")}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden shadow-xl shadow-foreground/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">
                    <div className="flex items-center gap-2">
                      Exam ID / Examinee
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </th>
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Assigned Expert</th>
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Type / Schedule</th>
                  {canViewPayments && (
                    <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Payment</th>
                  )}
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
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
                    <tr key={row.id} className="hover:bg-primary/[0.02] transition-colors group relative">
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black text-primary uppercase tracking-tighter">{row.code}</span>
                          <span className="font-extrabold text-foreground text-sm">{row.client}</span>
                          {row.accountName && (
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {row.accountName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] text-white font-black", row.examinerColor)}>
                            {row.examinerInitials}
                          </div>
                          <span className="font-bold text-sm text-foreground/80">{row.examiner}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-xs">{row.type}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                            <CalendarIcon className="h-3 w-3" />
                            {row.dateLabel} • {row.timeLabel}
                          </div>
                        </div>
                      </td>
                      {canViewPayments && (
                        <td className="px-6 py-5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-lg px-2 py-0.5 font-black uppercase tracking-widest text-[9px] border-none shadow-sm",
                              row.payment === "Paid" ? "bg-emerald-500/10 text-emerald-600" :
                              row.payment === "Partial" ? "bg-amber-500/10 text-amber-600" :
                              "bg-rose-500/10 text-rose-600",
                            )}
                          >
                            {row.payment} • {formatMoney(row.amount, orgCurrency)}
                          </Badge>
                        </td>
                      )}
                      <td className="px-6 py-5">
                        <Badge
                          className={cn(
                            "rounded-lg px-2 py-0.5 font-black uppercase tracking-widest text-[9px] shadow-sm",
                            row.status === "Confirmed" ? "bg-blue-500 text-white" :
                            row.status === "Completed" ? "bg-emerald-500 text-white" :
                            row.status === "Cancelled" ? "bg-rose-500 text-white" :
                            "bg-amber-500 text-white",
                          )}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => openDetails(row)}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-5 bg-muted/10 border-t border-border/50 gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Showing <span className="text-foreground">{filteredRows.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredRows.length)}</span> of {filteredRows.length} Exams
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 rounded-xl border-border/50 bg-card hover:bg-muted transition-all disabled:opacity-30"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 rounded-xl border-border/50 bg-card hover:bg-muted transition-all disabled:opacity-30"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md bg-card/95 backdrop-blur-3xl border-l border-border/50 shadow-2xl p-0 overflow-hidden">
          {selectedExam && (
            <div className="h-full flex flex-col">
              <div className="h-56 flex flex-col justify-end p-8 text-white relative bg-neutral-900">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
                <div className="relative z-20 space-y-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                    {selectedExam.status}
                  </Badge>
                  <h2 className="text-3xl font-black tracking-tighter leading-tight">{selectedExam.client}</h2>
                  {selectedExam.accountName && (
                    <p className="text-sm font-semibold text-white/70">{selectedExam.accountName}</p>
                  )}
                  <p className="text-xs font-bold text-white/60">{selectedExam.code} • {selectedExam.type}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {!canManageAppointments && (
                  <>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Schedule</p>
                      <p className="mt-1 text-sm font-bold">{selectedExam.dateLabel} • {selectedExam.timeLabel}</p>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Clinical Summary</p>
                      <p className="mt-1 text-sm italic text-foreground/80">"{selectedExam.reason}"</p>
                    </div>
                  </>
                )}

                <div className="space-y-2 rounded-2xl border border-border/50 bg-card p-4">
                  {selectedExam.subjectId ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      render={
                        <Link
                          href={`/dashboard/clients/${selectedExam.clientId}/examinees/${selectedExam.subjectId}`}
                        />
                      }
                    >
                      Open examinee profile
                    </Button>
                  ) : null}
                  <Button variant="outline" className="w-full" render={<Link href={`/dashboard/clients/${selectedExam.clientId}`} />}>
                    Open billing account
                  </Button>
                  {canViewPayments && (
                    <Button variant="outline" className="w-full" render={<Link href="/dashboard/payments" />}>
                      Manage payment on Payments
                    </Button>
                  )}
                </div>

                {canManageAppointments && (
                  <div className="space-y-4 rounded-2xl border border-border/50 bg-card p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Edit Exam</p>

                    <div className="grid gap-1.5">
                      <Label className="text-xs">Assigned examiner</Label>
                      <Select value={editExaminerId} onValueChange={(value) => setEditExaminerId(String(value))}>
                        <SelectTrigger className="h-10 rounded-lg">
                          <SelectValue placeholder="Select examiner">
                            {selectedEditExaminer?.name}
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
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs">Exam type</Label>
                      <Select
                        value={editExamType ? String(editExamType.id) : ""}
                        onValueChange={(value) => handleExamTypeChange(String(value))}
                      >
                        <SelectTrigger className="h-10 rounded-lg">
                          <SelectValue placeholder="Select exam type">
                            {editExamType?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {examTypes.map((examType) => (
                            <SelectItem key={examType.id} value={String(examType.id)}>
                              {examType.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs">Fee ({orgCurrency})</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Time</Label>
                        <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select value={editStatus} onValueChange={(value) => setEditStatus(String(value))}>
                        <SelectTrigger className="h-10 rounded-lg">
                          <SelectValue placeholder="Status">
                            {editStatus ? editStatus.charAt(0).toUpperCase() + editStatus.slice(1) : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {APPOINTMENT_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs">Clinical summary</Label>
                      <Textarea
                        className="min-h-[88px] rounded-lg resize-none text-sm"
                        placeholder="Reason for exam, position, referral context..."
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                      />
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={() => void handleSaveExam()}
                      disabled={savingFields}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {savingFields ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}

                {canManageAppointments && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-destructive mb-2">Danger Zone</p>
                    <DeleteConfirmDialog
                      title={`Delete ${selectedExam.code}`}
                      description="This permanently removes the appointment and its schedule slot. This cannot be undone."
                      confirmLabel="Confirmation"
                      triggerLabel={deleting ? "Deleting..." : "Delete Appointment"}
                      onConfirm={handleDelete}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function mapRows(appointments: AppointmentRecord[], examiners: UserRecord[]): LedgerRow[] {
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
      type: parsed.title,
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
    return { title: lines[0], reason: lines[0] };
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
