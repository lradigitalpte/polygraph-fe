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
  Filter,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  fetchAppointments,
  updateAppointmentPayment,
  type AppointmentRecord,
} from "@/lib/exam-booking";
import { fetchExaminers, type UserRecord } from "@/lib/users";

type LedgerRow = {
  id: number;
  code: string;
  clientId: number;
  client: string;
  examiner: string;
  examinerInitials: string;
  examinerColor: string;
  type: string;
  dateLabel: string;
  timeLabel: string;
  amount: number;
  payment: string;
  status: string;
  reason: string;
};

const examinerColors = ["bg-blue-600", "bg-emerald-600", "bg-amber-600", "bg-purple-600", "bg-rose-600", "bg-cyan-600"];

export default function ExamsPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<LedgerRow[]>([]);
  const [selectedExam, setSelectedExam] = React.useState<LedgerRow | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [paymentStatus, setPaymentStatus] = React.useState("");
  const [examFee, setExamFee] = React.useState("");
  const [savingPayment, setSavingPayment] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [appointments, examiners] = await Promise.all([fetchAppointments(), fetchExaminers()]);
        if (cancelled) {
          return;
        }
        const mapped = mapRows(appointments, examiners);
        setRows(mapped);
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
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.client.toLowerCase().includes(q) ||
      row.code.toLowerCase().includes(q) ||
      row.examiner.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

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
    setPaymentStatus(row.payment);
    setExamFee(String(row.amount));
    setIsSheetOpen(true);
  };

  const handleSavePayment = async () => {
    if (!selectedExam) return;
    const amount = Number(examFee);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Amount must be zero or greater");
      return;
    }

    setSavingPayment(true);
    try {
      await updateAppointmentPayment(selectedExam.id, {
        payment_status: paymentStatus,
        exam_fee: amount,
      });

      setRows((current) =>
        current.map((row) =>
          row.id === selectedExam.id
            ? {
                ...row,
                payment: paymentStatus,
                amount,
              }
            : row,
        ),
      );

      setSelectedExam((current) =>
        current
          ? {
              ...current,
              payment: paymentStatus,
              amount,
            }
          : null,
      );

      toast.success("Payment updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update payment");
    } finally {
      setSavingPayment(false);
    }
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
          <Button variant="outline" className="h-10 px-4 rounded-xl border-border/50 hover:bg-muted/50 transition-all font-semibold">
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
          { label: "Accounts Receivable", value: `$${stats.receivable.toFixed(2)}`, icon: CreditCard, color: "text-rose-500" },
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96 group">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search by ID, client, or expert..."
              className="h-11 pl-10 pr-4 rounded-xl bg-card border-border/50 focus:border-primary/50 focus:ring-primary/10 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 px-4 rounded-xl border-border/50 bg-card hover:bg-muted/50 gap-2 flex-1 sm:flex-none" disabled>
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Filter Results</span>
          </Button>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden shadow-xl shadow-foreground/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">
                    <div className="flex items-center gap-2">
                      Exam ID / Client
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </th>
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Assigned Expert</th>
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Type / Schedule</th>
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Payment</th>
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-muted-foreground" colSpan={6}>Loading appointments...</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-muted-foreground" colSpan={6}>No appointments found.</td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-primary/[0.02] transition-colors group relative">
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black text-primary uppercase tracking-tighter">{row.code}</span>
                          <span className="font-extrabold text-foreground text-sm">{row.client}</span>
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
                          {row.payment} • ${row.amount.toFixed(2)}
                        </Badge>
                      </td>
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

          <div className="flex items-center justify-between px-6 py-5 bg-muted/10 border-t border-border/50">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Showing <span className="text-foreground">{filteredRows.length}</span> of {rows.length}
            </p>
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
                  <p className="text-xs font-bold text-white/60">{selectedExam.code} • {selectedExam.type}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Schedule</p>
                  <p className="mt-1 text-sm font-bold">{selectedExam.dateLabel} • {selectedExam.timeLabel}</p>
                </div>

                <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Clinical Summary</p>
                  <p className="mt-1 text-sm italic text-foreground/80">"{selectedExam.reason}"</p>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Collect / Edit Payment</p>

                  <div className="grid gap-2">
                    <Label>Payment Status</Label>
                    <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(String(value ?? ""))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Partial">Partial</SelectItem>
                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Amount</Label>
                    <Input type="number" min={0} step={0.01} value={examFee} onChange={(event) => setExamFee(event.target.value)} />
                  </div>

                  <Button className="w-full gap-2" onClick={() => void handleSavePayment()} disabled={savingPayment || !paymentStatus}>
                    <Wallet className="h-4 w-4" />
                    {savingPayment ? "Saving..." : "Save Payment"}
                  </Button>

                  <Button variant="outline" className="w-full" render={<Link href={`/dashboard/clients/${selectedExam.clientId}`} />}>
                    Open Client Page
                  </Button>
                </div>
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

    return {
      id: appointment.id,
      code: `EX-${String(appointment.id).padStart(4, "0")}`,
      clientId: appointment.client_id,
      client: appointment.client?.name || `Client #${appointment.client_id}`,
      examiner: examiner?.name || `Examiner #${appointment.examiner_id}`,
      examinerInitials: initials(examiner?.name || `E${appointment.examiner_id}`),
      examinerColor: examiner?.color || "bg-slate-600",
      type: parsed.title,
      dateLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      timeLabel: date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      amount: Number(appointment.exam_fee || 0),
      payment: normalizePaymentStatus(appointment.payment_status),
      status: normalizeStatus(appointment.status),
      reason: parsed.reason,
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
