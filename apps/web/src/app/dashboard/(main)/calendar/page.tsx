"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Calendar as CalendarIcon,
  Clock,
  User,
  Filter,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Users,
  FileText,
  Info,
  ShieldCheck,
  CreditCard,
  DollarSign,
  Wallet,
  Mail,
  Download,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";
import { toast } from "sonner";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import { fetchQuotations, type QuotationRecord } from "@/lib/quotations";
import { fetchExaminers, type UserRecord } from "@/lib/users";

const timeSlots = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

type CalendarDay = {
  name: string;
  date: string;
  dateObj: Date;
};

type CalendarExaminer = {
  id: string;
  name: string;
  specialty: string;
  color: string;
};

type CalendarAppointment = {
  id: number;
  clientId: number;
  client: string;
  examinerId: string;
  time: string;
  duration: string;
  type: string;
  status: string;
  paymentStatus: string;
  examFee: number;
  dayNum: number;
  dayName: string;
  color: string;
  dot: string;
  reason: string;
  scheduledAt: Date;
};

const examinerColors = ["bg-blue-600", "bg-emerald-600", "bg-purple-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600"];

export default function CalendarPage() {
  const [view, setView] = React.useState<"month" | "week" | "day">("week");
  const [cursorDate, setCursorDate] = React.useState<Date>(() => startOfDay(new Date()));
  const [selectedExaminers, setSelectedExaminers] = React.useState<string[]>([]);
  const [selectedAppointment, setSelectedAppointment] = React.useState<CalendarAppointment | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [paymentStep, setPaymentStep] = React.useState<'billing' | 'collection' | 'confirmed'>('billing');
  const [examiners, setExaminers] = React.useState<CalendarExaminer[]>([]);
  const [appointments, setAppointments] = React.useState<CalendarAppointment[]>([]);
  const [quotations, setQuotations] = React.useState<QuotationRecord[]>([]);
  const weekDays = React.useMemo(() => buildWeekDays(cursorDate), [cursorDate]);
  const dayViewDay = React.useMemo(() => {
    return {
      name: cursorDate.toLocaleDateString(undefined, { weekday: "short" }),
      date: cursorDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      dateObj: cursorDate,
    };
  }, [cursorDate]);
  const monthCells = React.useMemo(() => buildMonthCells(cursorDate), [cursorDate]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCalendarData() {
      try {
        const [examinerRows, appointmentRows, quotationRows] = await Promise.all([
          fetchExaminers(),
          fetchAppointments(),
          fetchQuotations(),
        ]);
        if (cancelled) {
          return;
        }

        const mappedExaminers = mapExaminers(examinerRows);
        const mappedAppointments = mapAppointments(appointmentRows);

        setExaminers(mappedExaminers);
        setAppointments(mappedAppointments);
        setQuotations(quotationRows);
        setSelectedExaminers(mappedExaminers.map((item) => item.id));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load calendar data");
      }
    }

    void loadCalendarData();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExaminer = (id: string) => {
    setSelectedExaminers(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const filteredAppointments = React.useMemo(() =>
    appointments.filter(app => selectedExaminers.includes(app.examinerId)),
    [appointments, selectedExaminers]
  );

  const appointmentsToday = React.useMemo(() => {
    const today = new Date();
    return filteredAppointments.filter((item) => isSameDay(item.scheduledAt, today)).length;
  }, [filteredAppointments]);

  const capacity = React.useMemo(() => {
    if (examiners.length === 0) {
      return 0;
    }
    return Math.min(100, Math.round((appointmentsToday / (examiners.length * 4)) * 100));
  }, [appointmentsToday, examiners.length]);

  const visiblePeriodLabel = React.useMemo(() => {
    if (view === "month") {
      return cursorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    if (view === "week") {
      const start = weekDays[0]?.dateObj;
      const end = weekDays[6]?.dateObj;
      if (!start || !end) {
        return "";
      }
      const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
      if (sameMonth) {
        return `${start.toLocaleDateString(undefined, { month: "short" })} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return cursorDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [cursorDate, view, weekDays]);

  const billingSummary = React.useMemo(() => {
    if (!selectedAppointment) {
      return { total: 0, paid: 0, balance: 0, hasQuotation: false };
    }

    const quotation =
      quotations.find((item) => item.appointment_id === selectedAppointment.id) ||
      quotations.find((item) => item.client_id === selectedAppointment.clientId && Number(item.amount || 0) > 0);

    if (quotation) {
      const total = Number(quotation.amount || 0);
      const paid = Number(quotation.collected_amount || 0);
      return {
        total,
        paid,
        balance: Math.max(0, total - paid),
        hasQuotation: true,
      };
    }

    const total = Number(selectedAppointment.examFee || 0);
    const status = selectedAppointment.paymentStatus.toLowerCase();
    const paid = status === "paid" || status === "full" || status === "completed" ? total : 0;
    return {
      total,
      paid,
      balance: Math.max(0, total - paid),
      hasQuotation: false,
    };
  }, [quotations, selectedAppointment]);

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto pb-10 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/30 p-6 rounded-3xl border border-border/50 backdrop-blur-md shadow-sm shrink-0">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-primary" />
            Polygraph Scheduler
          </h1>
          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              {appointmentsToday} Appointments Today
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              {capacity}% Capacity
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/60 p-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCursorDate((prev) => shiftDateByView(prev, view, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[220px] text-center text-xs font-bold text-foreground">{visiblePeriodLabel}</div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCursorDate((prev) => shiftDateByView(prev, view, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="ml-1 h-8 px-3 text-[10px] font-black uppercase tracking-widest"
              onClick={() => {
                setCursorDate(startOfDay(new Date()));
                setView("day");
              }}
            >
              Today
            </Button>
          </div>
          <div className="flex border border-border/50 rounded-xl bg-background/50 p-1 shadow-inner">
            {(["month", "week", "day"] as const).map((v) => (
              <Button
                key={v}
                variant={view === v ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "rounded-lg h-9 px-4 font-bold text-xs capitalize transition-all",
                  view === v && "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                )}
                onClick={() => setView(v)}
              >
                {v}
              </Button>
            ))}
          </div>
          <Button
            className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold shadow-lg shadow-primary/30 transition-all gap-2"
            render={<Link href="/dashboard/calendar/book" />}
          >
            <Plus className="h-4 w-4" />
            Book New
          </Button>
        </div>
      </div>

      <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-[32px] p-4 shadow-2xl overflow-hidden shrink-0">
        <div className="flex items-center w-full">
          <div className="flex items-center gap-3 shrink-0 pr-8 border-r border-border/50 mr-6">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
              <Users className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1">Experts</span>
              <span className="text-sm font-black text-foreground whitespace-nowrap">Clinical Team</span>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1">
            <div className="flex items-center gap-4 min-w-max">
              <Button
                variant="outline"
                className={cn(
                  "h-14 px-8 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shrink-0 border-2",
                  selectedExaminers.length === examiners.length
                    ? "bg-primary border-primary text-primary-foreground shadow-xl shadow-primary/20"
                    : "bg-card border-border/50 text-muted-foreground hover:bg-muted/50"
                )}
                onClick={() => setSelectedExaminers(examiners.map(e => e.id))}
              >
                All Experts
              </Button>

              <div className="h-10 w-px bg-border/50 shrink-0 mx-2" />

              {examiners.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => toggleExaminer(ex.id)}
                  className={cn(
                    "flex items-center gap-4 pl-3 pr-6 h-14 rounded-2xl border-2 transition-all shrink-0 group relative overflow-hidden w-[240px]",
                    selectedExaminers.includes(ex.id)
                      ? "border-primary/40 bg-primary/[0.04] shadow-xl ring-2 ring-primary/5"
                      : "border-border/30 bg-card/50 opacity-60 hover:opacity-100 hover:border-border/60 shadow-sm"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xs text-white font-black shadow-lg transition-transform group-hover:scale-110 shrink-0", ex.color)}>
                    {ex.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex flex-col items-start overflow-hidden text-left min-w-0">
                    <span className={cn("text-[13px] font-black whitespace-nowrap truncate w-full", selectedExaminers.includes(ex.id) ? "text-primary" : "text-foreground")}>
                      {ex.name}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest truncate w-full">
                      {ex.specialty}
                    </span>
                  </div>
                  {selectedExaminers.includes(ex.id) && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-primary rounded-full p-0.5 shadow-sm">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border/50 shadow-2xl bg-card/30 backdrop-blur-xl rounded-3xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar p-6">
          {view === "month" && (
            <div className="grid grid-cols-7 gap-4 min-w-[1100px]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 pb-4">
                  {day}
                </div>
              ))}
              {monthCells.map((cell) => {
                const isToday = isSameDay(cell.dateObj, startOfDay(new Date()));
                const isCurrentMonth = cell.dateObj.getMonth() === cursorDate.getMonth();
                const dayAppointments = filteredAppointments.filter((app) => isSameDay(app.scheduledAt, cell.dateObj));
                return (
                  <div
                    key={cell.dateObj.toISOString()}
                    onClick={() => {
                      if (!isCurrentMonth) {
                        return;
                      }
                      setCursorDate(startOfDay(cell.dateObj));
                      setView("day");
                    }}
                    className={cn(
                      "min-h-[140px] rounded-2xl p-3 border transition-all flex flex-col gap-2 relative",
                      isToday ? "bg-primary/[0.03] border-primary/40 ring-1 ring-primary/10 shadow-[inset_0_0_20px_rgba(var(--primary),0.02)]" : "bg-muted/5 border-border/30 hover:border-border/60",
                      !isCurrentMonth ? "opacity-30 grayscale border-dashed" : "cursor-pointer"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-xs font-black",
                        isToday ? "text-primary bg-primary/10 w-6 h-6 rounded-lg flex items-center justify-center" : "text-muted-foreground"
                      )}>
                        {cell.dateObj.getDate()}
                      </span>
                      {isToday && (
                        <div className="flex items-center gap-1">
                           <span className="text-[8px] font-black text-primary uppercase">Today</span>
                           <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 overflow-hidden flex-1">
                      {dayAppointments
                        .map(app => (
                          <motion.button
                            layoutId={`app-${app.id}`}
                            key={app.id}
                            onClick={() => {
                              setSelectedAppointment(app);
                              setIsSheetOpen(true);
                            }}
                            className={cn(
                              "w-full text-left p-2.5 rounded-xl text-[10px] font-bold border transition-all group relative overflow-hidden",
                              app.color,
                              "border-transparent hover:border-current/30 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                            )}
                          >
                            <div className="relative z-10 flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="truncate pr-1 uppercase tracking-tight">{app.client}</span>
                                <div className="flex items-center gap-1">
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    app.paymentStatus?.toLowerCase() === "paid"
                                      ? "bg-emerald-500"
                                      : app.paymentStatus?.toLowerCase() === "partial"
                                        ? "bg-amber-500"
                                        : "bg-rose-500"
                                  )} />
                                  <span className="opacity-60 text-[8px] font-black">{app.time}</span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </motion.button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(view === "week" || view === "day") && (
            <div className="flex-1 flex flex-col min-h-[600px] border border-border/50 rounded-2xl overflow-hidden bg-muted/5">
              {/** Use real dates for week/day headers and date matching */}
              {(() => {
                const visibleDays = view === "week" ? weekDays : [dayViewDay];
                return (
                  <>
              <div className={cn(
                "grid border-b border-border/50 bg-card/80 backdrop-blur-md shrink-0 sticky top-0 z-20",
                view === "week" ? "grid-cols-[80px_repeat(7,1fr)]" : "grid-cols-[80px_1fr]"
              )}>
                <div className="h-14 flex items-center justify-center border-r border-border/50">
                  <Clock className="h-4 w-4 text-muted-foreground/30" />
                </div>
                {visibleDays.map((day) => (
                  <div
                    key={day.name}
                    className={cn(
                      "h-14 flex flex-col items-center justify-center border-r border-border/50 last:border-r-0 px-2",
                      isSameDay(day.dateObj, new Date()) && "bg-primary/[0.05]"
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{day.name}</span>
                    <span className={cn(
                      "text-sm font-black",
                      isSameDay(day.dateObj, new Date()) ? "text-primary" : "text-foreground"
                    )}>{day.date.split(" ")[1]}</span>
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-background/30">
                {timeSlots.map((time) => (
                  <div key={time} className={cn(
                    "grid",
                    view === "week" ? "grid-cols-[80px_repeat(7,1fr)]" : "grid-cols-[80px_1fr]"
                  )}>
                    <div className="h-24 flex items-start justify-center pt-3 text-[10px] font-black text-muted-foreground/30 border-r border-border/50 bg-muted/10">
                      {time}
                    </div>
                    {(view === "week" ? [0, 1, 2, 3, 4, 5, 6] : [0]).map((i) => (
                      <div
                        key={i}
                        className="h-24 border-r border-border/50 last:border-r-0 border-b border-border/10 relative"
                      />
                    ))}
                  </div>
                ))}

                <div className="absolute inset-0 pointer-events-none">
                  <div className={cn(
                    "grid h-full",
                    view === "week" ? "grid-cols-[80px_repeat(7,1fr)]" : "grid-cols-[80px_1fr]"
                  )}>
                    <div />

                    {visibleDays.map((day) => (
                      <div key={day.dateObj.toISOString()} className="relative h-full">
                        {filteredAppointments
                          .filter(app => isSameDay(app.scheduledAt, day.dateObj))
                          .map(app => {
                            const startHour = parseInt(app.time.split(":")[0]);
                            const startMin = parseInt(app.time.split(":")[1] || "0");
                            const topPos = (startHour - 8) * 96 + (startMin / 60) * 96;
                            const height = app.duration.includes("h") ? parseFloat(app.duration) * 96 : 96;
                            const expert = examiners.find(ex => ex.id === app.examinerId);

                            return (
                              <motion.div
                                key={app.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={() => {
                                  setSelectedAppointment(app);
                                  setIsSheetOpen(true);
                                }}
                                className={cn(
                                  "absolute inset-x-1.5 p-2.5 rounded-xl border shadow-xl pointer-events-auto cursor-pointer transition-all hover:scale-[1.02] hover:z-30 group backdrop-blur-xl border-white/20",
                                  app.color,
                                  "hover:ring-8 hover:ring-primary/5"
                                )}
                                style={{
                                  top: `${topPos + 4}px`,
                                  height: `${height - 8}px`,
                                  zIndex: 10
                                }}
                              >
                                <div className="flex flex-col h-full overflow-hidden">
                                  <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-black opacity-60">{app.time}</span>
                                    <div className={cn(
                                      "w-1 h-1 rounded-full",
                                      app.paymentStatus?.toLowerCase() === "paid"
                                        ? "bg-emerald-500"
                                        : app.paymentStatus?.toLowerCase() === "partial"
                                          ? "bg-amber-500"
                                          : "bg-rose-500"
                                    )} />
                                  </div>
                                  </div>

                                  <h3 className="text-xs font-black truncate text-foreground mb-0.5 leading-tight">{app.client}</h3>
                                  <p className="text-[9px] font-bold opacity-60 line-clamp-1">{app.type}</p>

                                  <div className="mt-auto pt-1.5 border-t border-black/5 flex items-center gap-1.5">
                                    <div className={cn("w-4 h-4 rounded-md flex items-center justify-center text-[7px] text-white font-black", expert?.color)}>
                                      {expert?.name.charAt(0)}
                                    </div>
                                    <span className="text-[9px] font-black truncate opacity-50">{expert?.name}</span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md bg-card/95 backdrop-blur-3xl border-l border-border/50 shadow-2xl p-0 overflow-hidden">
          {selectedAppointment && (
            <div className="h-full flex flex-col">
              <div className="h-40 flex flex-col justify-end p-6 text-white relative bg-neutral-950 shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
                <div className="absolute inset-0 opacity-10 z-0">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_14px]" />
                </div>
                <div className="relative z-20 space-y-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 backdrop-blur-md">
                    {selectedAppointment.status}
                  </Badge>
                  <h2 className="text-3xl font-black tracking-tighter leading-tight">{selectedAppointment.client}</h2>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-white/50">
                    <span className="flex items-center gap-1.5 uppercase">
                      <Clock className="h-3.5 w-3.5" />
                      {selectedAppointment.time}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="uppercase tracking-wider">{selectedAppointment.type}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-card/50">
                <div className="p-5 rounded-2xl bg-primary/[0.03] border border-primary/20 flex items-center justify-between group">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary shadow-inner group-hover:scale-105 transition-transform">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none">Invoice</p>
                        <Badge className={cn(
                          "text-[8px] font-black uppercase tracking-widest px-2 py-0.5",
                          selectedAppointment?.paymentStatus?.toLowerCase() === "paid"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                            : selectedAppointment?.paymentStatus?.toLowerCase() === "partial"
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-700 border-rose-500/20"
                        )}>
                          {selectedAppointment?.paymentStatus || "Unpaid"}
                        </Badge>
                      </div>
                      <p className="text-base font-black text-foreground">${billingSummary.total.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground">
                        Paid ${billingSummary.paid.toFixed(2)} • Balance ${billingSummary.balance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsPaymentOpen(true)}
                    size="sm"
                    className="h-8 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[9px] uppercase tracking-widest shadow-md shadow-primary/10 transition-all shrink-0 ml-2"
                  >
                    Pay Now
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Specialist</p>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-[10px] text-white font-black", examiners.find(ex => ex.id === selectedAppointment.examinerId)?.color)}>
                        {examiners.find(ex => ex.id === selectedAppointment.examinerId)?.name.charAt(0)}
                      </div>
                      <p className="text-xs font-black truncate">{examiners.find(ex => ex.id === selectedAppointment.examinerId)?.name}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Session</p>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary/60" />
                      <p className="text-xs font-black">{selectedAppointment.duration} Exam</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <FileText className="h-3 w-3" /> Objective
                    </p>
                    <p className="text-xs font-bold text-foreground/80 leading-snug italic tracking-tight">
                      "{selectedAppointment.reason}"
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Timeline</p>
                    <div className="space-y-3 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border/30">
                      {[
                        { time: "09:42 AM", event: "Biometric prep", icon: CheckCircle2, color: "text-emerald-500" },
                        { time: "09:15 AM", event: "Pre-test interview", icon: Info, color: "text-blue-500" },
                        { time: "08:55 AM", event: "Check-in", icon: User, color: "text-muted-foreground" }
                      ].map((item, idx) => (
                        <div key={idx} className="flex gap-3 relative z-10">
                          <div className={cn("mt-1 p-0.5 rounded-full bg-card border border-border shadow-xs", item.color)}>
                            <item.icon className="h-2.5 w-2.5" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-foreground/90">{item.event}</p>
                            <p className="text-[8px] font-bold text-muted-foreground/60 uppercase">{item.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2 pb-6">
                  <Button className="w-full h-12 rounded-xl font-black text-xs shadow-lg shadow-primary/10 transition-all hover:scale-[1.01] bg-primary text-primary-foreground">
                    Case Console
                  </Button>
                  <Button variant="ghost" className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted/50">
                    Modify Schedule
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-xl bg-card/95 backdrop-blur-3xl border border-border/50 shadow-2xl p-0 overflow-hidden rounded-[2.5rem]">
          <DialogHeader className="p-10 pb-0 shrink-0 relative overflow-hidden bg-neutral-950 text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-transparent z-10" />
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <CreditCard className="h-32 w-32" />
            </div>
            <div className="relative z-20 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary border-none px-2 py-0.5 font-black text-[9px] uppercase tracking-[0.2em]">
                  Billing Step {paymentStep === 'billing' ? '1' : paymentStep === 'collection' ? '2' : '3'}
                </Badge>
                {paymentStep === 'confirmed' && <CheckCircle2 className="h-4 w-4 text-emerald-500 animate-in zoom-in" />}
              </div>
              <DialogTitle className="text-4xl font-black tracking-tighter">
                {paymentStep === 'billing' ? "Invoice Console" : paymentStep === 'collection' ? "Authorize Charge" : "Billing Success"}
              </DialogTitle>
              <DialogDescription className="text-white/60 font-bold text-sm">
                {paymentStep === 'billing' ? "Dispatch forensic billing documents." :
                 paymentStep === 'collection' ? "Finalize clinical transaction." :
                 "Transaction #TXN-9021 recorded."}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-10 pt-8 space-y-8 bg-card/50">
            {paymentStep === 'billing' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between p-7 rounded-[2rem] bg-primary/[0.03] border border-primary/20 shadow-inner group">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Examination Fee</p>
                    <p className="text-4xl font-black text-foreground tracking-tighter">${billingSummary.total.toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-muted-foreground">Collected ${billingSummary.paid.toFixed(2)} • Balance ${billingSummary.balance.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Button variant="ghost" size="sm" className="h-7 rounded-lg font-black text-[8px] uppercase tracking-widest text-primary hover:bg-primary/10">
                      Edit Line Items
                    </Button>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-none px-3 py-1 font-black text-[9px] uppercase tracking-widest">
                      Tax Exempt
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-24 rounded-[2rem] border-border/50 bg-card/50 hover:border-primary/30 hover:bg-primary/[0.02] flex flex-col gap-2 group transition-all shadow-sm"
                  >
                    <div className="p-2 rounded-xl bg-muted/20 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Mail className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Email Invoice</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 rounded-[2rem] border-border/50 bg-card/50 hover:border-primary/30 hover:bg-primary/[0.02] flex flex-col gap-2 group transition-all shadow-sm"
                  >
                    <div className="p-2 rounded-xl bg-muted/20 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Download className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Download PDF</span>
                  </Button>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => setPaymentStep('collection')}
                    className="w-full h-16 rounded-[2rem] font-black text-sm shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:scale-[1.01] transition-all"
                  >
                    Proceed to Collection
                  </Button>
                </div>
              </div>
            )}

            {paymentStep === 'collection' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Secure Channel</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: "Credit Card", icon: CreditCard },
                      { name: "Bank Wire", icon: DollarSign },
                      { name: "Direct Bill", icon: Zap }
                    ].map((method) => (
                      <button
                        key={method.name}
                        className="flex flex-col items-center justify-center gap-4 p-6 rounded-[2rem] border-2 border-border/50 hover:border-primary/50 hover:bg-primary/[0.02] transition-all group shadow-sm bg-card/30"
                      >
                        <method.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-[9px] font-black text-center leading-tight group-hover:text-primary transition-colors uppercase tracking-[0.1em]">{method.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-4">
                  <Button
                    onClick={() => setPaymentStep('confirmed')}
                    className="w-full h-16 rounded-[2rem] font-black text-sm shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:scale-[1.01] transition-all"
                  >
                    Capture ${billingSummary.balance.toFixed(2)} Charge
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPaymentStep('billing')}
                    className="w-full h-10 font-black text-[9px] uppercase tracking-[0.2em] text-muted-foreground hover:bg-muted/50 rounded-xl"
                  >
                    ← Review Billing Console
                  </Button>
                </div>
              </div>
            )}

            {paymentStep === 'confirmed' && (
              <div className="space-y-8 py-6 animate-in fade-in zoom-in-95 duration-500 text-center">
                <div className="flex flex-col items-center gap-6">
                  <div className="h-28 w-28 rounded-full bg-emerald-500/10 flex items-center justify-center border-8 border-emerald-500/5 shadow-2xl shadow-emerald-500/10">
                    <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black text-foreground tracking-tighter leading-none">Charge Captured</p>
                    <p className="text-xs font-bold text-muted-foreground max-w-[300px] mx-auto leading-relaxed">
                      Transaction authorized successfully. Forensic data has been updated in the master ledger.
                    </p>
                  </div>
                </div>

                <div className="p-6 rounded-[2rem] bg-blue-500/[0.03] border border-blue-500/20 space-y-4 shadow-inner">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 shadow-sm">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-foreground uppercase tracking-widest">Confirmation Dispatched</p>
                      <p className="text-[10px] font-bold text-muted-foreground leading-snug">The "Payment Confirmed" automated template has been sent to the client's email.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => {
                      setIsPaymentOpen(false);
                      setTimeout(() => setPaymentStep('billing'), 500);
                    }}
                    className="w-full h-14 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border border-border/50 shadow-sm hover:bg-muted/50 transition-all"
                  >
                    Close Billing Console
                  </Button>
                </div>
              </div>
            )}

            {paymentStep !== 'confirmed' && (
              <p className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 flex items-center justify-center gap-2">
                <ShieldCheck className="h-3 w-3" />
                PCI-DSS L1 Secure
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mapExaminers(examiners: UserRecord[]): CalendarExaminer[] {
  return examiners.map((examiner, index) => ({
    id: String(examiner.id),
    name: examiner.name,
    specialty: examiner.role?.name || "Examiner",
    color: examinerColors[index % examinerColors.length],
  }));
}

function mapAppointments(appointments: AppointmentRecord[]): CalendarAppointment[] {
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return appointments.map((appointment) => {
    const scheduledAt = new Date(appointment.scheduled_at);
    const hours = scheduledAt.getHours().toString().padStart(2, "0");
    const minutes = scheduledAt.getMinutes().toString().padStart(2, "0");
    const durationHours = appointment.duration / 60;
    const parsedNotes = parseNotes(appointment.notes);
    const tone = getStatusTone(appointment.status);

    return {
      id: appointment.id,
      clientId: appointment.client_id,
      client: appointment.client?.name || `Client #${appointment.client_id}`,
      examinerId: String(appointment.examiner_id),
      time: `${hours}:${minutes}`,
      duration: `${durationHours % 1 === 0 ? durationHours.toFixed(0) : durationHours.toFixed(1)}h`,
      type: parsedNotes.title,
      status: getStatusLabel(appointment.status),
      paymentStatus: String(appointment.payment_status || ""),
      examFee: Number(appointment.exam_fee || 0),
      dayNum: scheduledAt.getDate(),
      dayName: weekdayNames[scheduledAt.getDay()],
      color: tone.color,
      dot: tone.dot,
      reason: parsedNotes.reason,
      scheduledAt,
    };
  });
}

function parseNotes(notes: string): { title: string; reason: string } {
  const lines = (notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { title: "Appointment", reason: "No details provided." };
  }

  if (lines.length === 1) {
    return { title: lines[0], reason: lines[0] };
  }

  return {
    title: lines[0],
    reason: lines.slice(1).join(" "),
  };
}

function getStatusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "confirmed") return "Confirmed";
  if (normalized === "completed") return "Completed";
  if (normalized === "cancelled") return "Cancelled";
  return "Pending";
}

function getStatusTone(status: string): { color: string; dot: string } {
  const normalized = status.toLowerCase();
  if (normalized === "confirmed") {
    return { color: "bg-blue-500/10 border-blue-500/20 text-blue-700", dot: "bg-blue-500" };
  }
  if (normalized === "completed") {
    return { color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700", dot: "bg-emerald-500" };
  }
  if (normalized === "cancelled") {
    return { color: "bg-rose-500/10 border-rose-500/20 text-rose-700", dot: "bg-rose-500" };
  }
  return { color: "bg-amber-500/10 border-amber-500/20 text-amber-700", dot: "bg-amber-500" };
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDateByView(date: Date, view: "month" | "week" | "day", direction: -1 | 1): Date {
  const shifted = new Date(date);
  if (view === "month") {
    shifted.setMonth(shifted.getMonth() + direction);
  } else if (view === "week") {
    shifted.setDate(shifted.getDate() + direction * 7);
  } else {
    shifted.setDate(shifted.getDate() + direction);
  }
  return startOfDay(shifted);
}

function buildMonthCells(referenceDate: Date): Array<{ dateObj: Date }> {
  const firstOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }).map((_, index) => {
    const dateObj = new Date(gridStart);
    dateObj.setDate(gridStart.getDate() + index);
    return { dateObj };
  });
}

function buildWeekDays(referenceDate: Date): CalendarDay[] {
  const start = new Date(referenceDate);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);

  return Array.from({ length: 7 }).map((_, index) => {
    const dateObj = new Date(start);
    dateObj.setDate(start.getDate() + index);
    return {
      name: dateObj.toLocaleDateString(undefined, { weekday: "short" }),
      date: dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      dateObj,
    };
  });
}
