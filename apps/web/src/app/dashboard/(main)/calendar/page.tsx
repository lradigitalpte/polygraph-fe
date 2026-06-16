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
import Link from "next/link";
import { toast } from "sonner";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import { resolveAppointmentParties } from "@/lib/appointment-display";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { fetchExamByAppointment, type ExamPhaseRecord } from "@/lib/exam-documentation";

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
  subjectId?: number;
  /** Examinee or client name shown on the grid. */
  client: string;
  /** Billing organization when the session is under a corporate account. */
  accountName?: string;
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
  const [timelinePhases, setTimelinePhases] = React.useState<ExamPhaseRecord[]>([]);
  const [timelineLoading, setTimelineLoading] = React.useState(false);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [examiners, setExaminers] = React.useState<CalendarExaminer[]>([]);
  const [appointments, setAppointments] = React.useState<CalendarAppointment[]>([]);
  // Load the real session timeline (exam phases) for the selected appointment.
  React.useEffect(() => {
    const appointmentId = selectedAppointment?.id;
    if (!appointmentId) {
      setTimelinePhases([]);
      return;
    }
    let cancelled = false;
    setTimelineLoading(true);
    void (async () => {
      try {
        const exam = await fetchExamByAppointment(Number(appointmentId));
        if (!cancelled) setTimelinePhases(exam?.phases ?? []);
      } catch {
        if (!cancelled) setTimelinePhases([]);
      } finally {
        if (!cancelled) setTimelineLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAppointment?.id]);

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
        const [examinerRows, appointmentRows] = await Promise.all([
          fetchExaminers(),
          fetchAppointments(),
        ]);
        if (cancelled) {
          return;
        }

        const mappedExaminers = mapExaminers(examinerRows);
        const mappedAppointments = mapAppointments(appointmentRows);

        setExaminers(mappedExaminers);
        setAppointments(mappedAppointments);
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
                                <span className="truncate pr-1 tracking-tight">{app.client}</span>
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
                              {app.accountName && (
                                <span className="truncate text-[8px] opacity-60">{app.accountName}</span>
                              )}
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
                                  {app.accountName && (
                                    <p className="text-[8px] font-bold opacity-50 truncate leading-tight">{app.accountName}</p>
                                  )}
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
                  {selectedAppointment.accountName && (
                    <p className="text-sm font-semibold text-white/70">{selectedAppointment.accountName}</p>
                  )}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-1.5 col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Examinee</p>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate">{selectedAppointment.client}</p>
                        {selectedAppointment.accountName && (
                          <p className="text-[10px] font-medium text-muted-foreground truncate">
                            Billed to {selectedAppointment.accountName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
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
                    {timelineLoading ? (
                      <p className="text-[10px] text-muted-foreground ml-1">Loading session phases…</p>
                    ) : timelinePhases.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground ml-1">No session phases logged yet.</p>
                    ) : (
                      <div className="space-y-3 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border/30">
                        {timelinePhases.map((phase) => (
                          <div key={phase.id} className="flex gap-3 relative z-10">
                            <div className="mt-1 p-0.5 rounded-full bg-card border border-border shadow-xs text-primary">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-foreground/90">{phase.name}</p>
                              <p className="text-[8px] font-bold text-muted-foreground/60 uppercase">
                                {new Date(phase.start_time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                              </p>
                              {phase.notes && (
                                <p className="text-[9px] text-muted-foreground mt-0.5">{phase.notes}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2 pb-6">
                  <Button
                    className="w-full h-12 rounded-xl font-black text-xs shadow-lg shadow-primary/10 transition-all hover:scale-[1.01] bg-primary text-primary-foreground"
                    render={
                      <Link href={`/dashboard/clients/${selectedAppointment.clientId}/exams/${selectedAppointment.id}`} />
                    }
                  >
                    Open session documentation
                  </Button>
                  {selectedAppointment.subjectId ? (
                    <Button
                      variant="outline"
                      className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"
                      render={
                        <Link
                          href={`/dashboard/clients/${selectedAppointment.clientId}/examinees/${selectedAppointment.subjectId}`}
                        />
                      }
                    >
                      Open examinee profile
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted/50"
                    render={<Link href={`/dashboard/clients/${selectedAppointment.clientId}`} />}
                  >
                    Open billing account
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
    const parties = resolveAppointmentParties(appointment);

    return {
      id: appointment.id,
      clientId: appointment.client_id,
      subjectId: parties.subjectId,
      client: parties.primaryName,
      accountName: parties.accountName,
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
