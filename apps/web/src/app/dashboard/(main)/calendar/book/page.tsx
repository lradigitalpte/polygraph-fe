"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  CreditCard,
  Info,
  Loader2,
  Search,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchClients, type ClientRecord } from "@/lib/clients";
import { isOrganizationClient } from "@/lib/client-types";
import {
  createAppointment,
  fetchExaminerAvailability,
  fetchExamTypes,
  type BusyPeriodRecord,
  type ExamTypeRecord,
} from "@/lib/exam-booking";
import { createSubject, fetchSubjects, type SubjectRecord } from "@/lib/subjects";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { cn } from "@/lib/utils";

const paymentTypes = [
  "Corporate Account",
  "Private Pay (Credit/Debit)",
  "Insurance Claim",
  "Government Contract",
  "Retainer Balance",
];

const baseTimeSlots = ["08:30", "10:00", "11:30", "13:00", "14:30", "16:00"];

const STEP_LABELS = ["Who & exam", "Examiner & time", "Payment", "Review"];

function BookAppointmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetClientId = searchParams.get("clientId");
  const presetSubjectId = searchParams.get("subjectId");
  const [step, setStep] = React.useState(1);
  const [isBooking, setIsBooking] = React.useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = React.useState(true);
  const [clientSearch, setClientSearch] = React.useState("");
  const [subjectSearch, setSubjectSearch] = React.useState("");
  const [examinerSearch, setExaminerSearch] = React.useState("");
  const [showClientResults, setShowClientResults] = React.useState(false);
  const [showSubjectResults, setShowSubjectResults] = React.useState(false);
  const [useClientAsSubject, setUseClientAsSubject] = React.useState(true);
  const [selectedClientRecord, setSelectedClientRecord] = React.useState<ClientRecord | null>(null);
  const [clients, setClients] = React.useState<ClientRecord[]>([]);
  const [subjects, setSubjects] = React.useState<SubjectRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [busyPeriods, setBusyPeriods] = React.useState<BusyPeriodRecord[]>([]);
  const [isDateBlocked, setIsDateBlocked] = React.useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = React.useState(false);

  const [formData, setFormData] = React.useState({
    clientName: "",
    clientId: "",
    subjectName: "",
    subjectId: "",
    examinerId: "",
    examTypeId: "",
    date: "",
    time: "",
    paymentType: "",
    collectedAmount: "",
    reason: "",
  });

  const clientSearchRef = React.useRef<HTMLDivElement>(null);
  const subjectSearchRef = React.useRef<HTMLDivElement>(null);

  const deferredClientSearch = React.useDeferredValue(clientSearch);
  const deferredSubjectSearch = React.useDeferredValue(subjectSearch);
  const deferredExaminerSearch = React.useDeferredValue(examinerSearch);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setShowClientResults(false);
      }
      if (subjectSearchRef.current && !subjectSearchRef.current.contains(event.target as Node)) {
        setShowSubjectResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setIsLoadingInitialData(true);
      try {
        const [initialClients, initialSubjects, initialExaminers, initialExamTypes] = await Promise.all([
          fetchClients(),
          fetchSubjects(),
          fetchExaminers(),
          fetchExamTypes(),
        ]);
        if (cancelled) {
          return;
        }
        setClients(initialClients);
        setSubjects(initialSubjects);
        setExaminers(initialExaminers);
        setExamTypes(initialExamTypes.filter((item) => item.active));

        if (presetClientId) {
          const match = initialClients.find((c) => c.id === Number(presetClientId));
          if (match) {
            const org = isOrganizationClient(match);
            setSelectedClientRecord(match);
            setClientSearch(match.name);
            setFormData((prev) => ({
              ...prev,
              clientId: String(match.id),
              clientName: match.name,
              ...(org ? { subjectId: presetSubjectId ?? "", subjectName: "" } : {}),
            }));
            setUseClientAsSubject(!org);
            if (org) {
              const rosterSubjects = await fetchSubjects("", match.id);
              if (!cancelled) setSubjects(rosterSubjects);
              if (presetSubjectId) {
                const sub = rosterSubjects.find((s) => s.id === Number(presetSubjectId));
                if (sub) {
                  const fullName = `${sub.first_name} ${sub.last_name}`.trim();
                  setSubjectSearch(fullName);
                  setFormData((prev) => ({
                    ...prev,
                    subjectId: String(sub.id),
                    subjectName: fullName,
                  }));
                }
              }
            }
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load booking data");
      } finally {
        if (!cancelled) {
          setIsLoadingInitialData(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function runClientSearch() {
      try {
        const results = await fetchClients(deferredClientSearch);
        if (!cancelled) {
          setClients(results);
        }
      } catch {
        if (!cancelled) {
          setClients([]);
        }
      }
    }

    void runClientSearch();
    return () => {
      cancelled = true;
    };
  }, [deferredClientSearch]);

  const isOrgBooking = isOrganizationClient(selectedClientRecord);

  React.useEffect(() => {
    if (isOrgBooking) {
      setUseClientAsSubject(false);
    }
  }, [isOrgBooking]);

  React.useEffect(() => {
    let cancelled = false;

    async function runSubjectSearch() {
      try {
        const results = await fetchSubjects(
          deferredSubjectSearch,
          isOrgBooking && selectedClientRecord?.id ? selectedClientRecord.id : undefined
        );
        if (!cancelled) {
          setSubjects(results);
        }
      } catch {
        if (!cancelled) {
          setSubjects([]);
        }
      }
    }

    void runSubjectSearch();
    return () => {
      cancelled = true;
    };
  }, [deferredSubjectSearch, selectedClientRecord?.id, isOrgBooking]);

  React.useEffect(() => {
    let cancelled = false;

    async function runExaminerSearch() {
      try {
        const results = await fetchExaminers(deferredExaminerSearch);
        if (!cancelled) {
          setExaminers(results);
        }
      } catch {
        if (!cancelled) {
          setExaminers([]);
        }
      }
    }

    void runExaminerSearch();
    return () => {
      cancelled = true;
    };
  }, [deferredExaminerSearch]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      if (!formData.examinerId || !formData.date) {
        setBusyPeriods([]);
        setIsDateBlocked(false);
        setIsLoadingAvailability(false);
        return;
      }

      const selectedDate = new Date(`${formData.date}T00:00:00`);
      if (selectedDate.getDay() === 0) {
        setBusyPeriods([]);
        setIsDateBlocked(true);
        setIsLoadingAvailability(false);
        return;
      }

      setIsLoadingAvailability(true);
      try {
        const availability = await fetchExaminerAvailability(Number(formData.examinerId), formData.date);
        if (!cancelled) {
          setBusyPeriods(availability.busy_periods ?? []);
          setIsDateBlocked(availability.is_blocked);
        }
      } catch (error) {
        if (!cancelled) {
          setBusyPeriods([]);
          setIsDateBlocked(false);
          toast.error(error instanceof Error ? error.message : "Failed to load availability");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAvailability(false);
        }
      }
    }

    void loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [formData.examinerId, formData.date]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectClient = (client: ClientRecord) => {
    const org = isOrganizationClient(client);
    setSelectedClientRecord(client);
    setUseClientAsSubject(!org);
    setFormData((prev) => ({
      ...prev,
      clientName: client.name,
      clientId: String(client.id),
      subjectName: org ? "" : client.name,
      subjectId: org ? "" : prev.subjectId,
    }));
    setClientSearch(client.name);
    if (org) {
      setSubjectSearch("");
    }
    setShowClientResults(false);
  };

  const handleSelectSubject = (subject: SubjectRecord) => {
    const fullName = [subject.first_name, subject.last_name].filter(Boolean).join(" ");
    setFormData((prev) => ({ ...prev, subjectName: fullName, subjectId: String(subject.id) }));
    setSubjectSearch(fullName);
    setUseClientAsSubject(false);
    setShowSubjectResults(false);
  };

  const selectedExaminer = examiners.find((item) => item.id === Number(formData.examinerId));
  const selectedExamType = examTypes.find((item) => item.id === Number(formData.examTypeId));
  const isContinueLoading = isLoadingInitialData || (step === 2 && isLoadingAvailability);

  const availableSlots = React.useMemo(() => {
    if (!formData.date || !formData.examinerId || isDateBlocked) {
      return [];
    }

    const isToday = formData.date === localDateString();
    const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 0;

    return baseTimeSlots.filter((slot) => {
      const slotMinutes = toMinutes(slot);
      const duration = selectedExamType?.duration ?? 150;
      const slotEnd = slotMinutes + duration;

      if (isToday && slotMinutes <= nowMinutes) {
        return false;
      }

      return !busyPeriods.some((period) => {
        if (period.is_full_day) {
          return true;
        }
        if (!period.start_time || !period.end_time) {
          return false;
        }
        const periodStart = toMinutes(period.start_time);
        const periodEnd = toMinutes(period.end_time);
        return slotMinutes < periodEnd && slotEnd > periodStart;
      });
    });
  }, [busyPeriods, formData.date, formData.examinerId, isDateBlocked, selectedExamType?.duration]);

  const isStepValid = () => {
    if (step === 1) {
      return Boolean(formData.clientId && formData.examTypeId && (useClientAsSubject || formData.subjectId));
    }
    if (step === 2) {
      return Boolean(formData.examinerId && formData.date && formData.time && !isDateBlocked);
    }
    if (step === 3) {
      return Boolean(formData.paymentType && formData.reason.trim());
    }
    return true;
  };

  const dayStatus = React.useMemo(() => {
    if (!formData.date) {
      return null;
    }
    const selectedDate = new Date(`${formData.date}T00:00:00`);
    if (selectedDate.getDay() === 0) {
      return { label: "Clinic closed on Sundays", type: "error" as const };
    }
    if (isDateBlocked) {
      return { label: "Examiner blocked for this date", type: "warning" as const };
    }
    if (formData.examinerId && !isLoadingAvailability) {
      if (availableSlots.length === 0) {
        return { label: "No open slots (booked, blocked, or past)", type: "warning" as const };
      }
      return {
        label: `${availableSlots.length} open slot${availableSlots.length === 1 ? "" : "s"}`,
        type: "success" as const,
      };
    }
    return { label: "Select examiner to see slots", type: "success" as const };
  }, [formData.date, formData.examinerId, isDateBlocked, isLoadingAvailability, availableSlots.length]);

  const handleComplete = async () => {
    if (!selectedExamType) {
      toast.error("Please select an examination type");
      return;
    }

    setIsBooking(true);
    try {
      let subjectID = Number(formData.subjectId);
      if (useClientAsSubject) {
        const existingMatch = subjects.find((subject) => {
          const fullName = `${subject.first_name} ${subject.last_name}`.trim().toLowerCase();
          return fullName === formData.clientName.trim().toLowerCase();
        });

        if (existingMatch) {
          subjectID = existingMatch.id;
        } else {
          const nameParts = formData.clientName.trim().split(/\s+/).filter(Boolean);
          const firstName = nameParts[0] || "Client";
          const lastName = nameParts.slice(1).join(" ") || "Record";
          const createdSubject = await createSubject({
            client_id: selectedClientRecord?.id,
            first_name: firstName,
            last_name: lastName,
          });
          subjectID = createdSubject.id;
        }
      }

      if (!subjectID) {
        toast.error("Please select a subject");
        return;
      }

      // Calculate payment status based on collected amount
      const collectedAmount = Number(formData.collectedAmount) || 0;
      let paymentStatus = "Unpaid";
      if (collectedAmount >= selectedExamType.price) {
        paymentStatus = "Paid";
      } else if (collectedAmount > 0) {
        paymentStatus = "Partial";
      }

      await createAppointment({
        client_id: Number(formData.clientId),
        subject_id: subjectID,
        examiner_id: Number(formData.examinerId),
        scheduled_at: new Date(`${formData.date}T${formData.time}:00`).toISOString(),
        duration: selectedExamType.duration,
        exam_fee: selectedExamType.price,
        collected_amount: collectedAmount,
        payment_status: paymentStatus,
        payment_mode: formData.paymentType,
        notes: `${selectedExamType.name}\n\n${formData.reason}`,
        status: "pending",
      });

      toast.success("Appointment booked", {
        description: `Invoice for $${selectedExamType.price.toFixed(2)} added to Financial Hub.`,
      });
      router.push("/dashboard/payments");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create appointment");
    } finally {
      setIsBooking(false);
    }
  };

  const selectedSubjectLabel = useClientAsSubject ? formData.clientName || "Not selected" : formData.subjectName || "Not selected";

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 pb-12 sm:space-y-6 sm:px-4 sm:pb-20 lg:px-0">
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-muted/50 sm:h-10 sm:w-10" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Book New Exam</h1>
            <p className="text-sm text-muted-foreground">Clinical scheduling & intake.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Step {step} of 4 — {STEP_LABELS[step - 1]}
          </p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  step === item ? "w-8 bg-primary" : "w-2 bg-muted-foreground/20",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {isOrgBooking && formData.clientId && (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Organization booking</p>
              <p className="text-sm font-semibold">{formData.clientName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Billing stays on this account. Step 1: pick the examinee. Step 2: examiner must be
                available at the time you choose.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/dashboard/clients/${formData.clientId}/roster`} />}
            >
              Manage roster
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          {isLoadingInitialData ? (
            <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-md">
              <CardContent className="p-5 text-sm text-muted-foreground sm:p-8">Loading booking data...</CardContent>
            </Card>
          ) : (
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/50 shadow-sm backdrop-blur-md">
                    <CardHeader className="border-b border-border/50 bg-muted/30 pb-3 sm:pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <User className="h-5 w-5 text-primary" />
                        Client & Exam Selection
                      </CardTitle>
                      <CardDescription>Search the requesting client, confirm who is being tested, and attach a real exam protocol.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
                      <div className="space-y-2">
                        <Label htmlFor="client-search">
                          {isOrgBooking && formData.clientId ? "Account (organization)" : "Search client"}
                        </Label>
                        {isOrgBooking && formData.clientId ? (
                          <div className="h-11 sm:h-12 rounded-xl border border-primary/30 bg-muted/20 px-4 flex items-center font-semibold text-sm">
                            {formData.clientName}
                          </div>
                        ) : (
                        <div className="relative" ref={clientSearchRef}>
                          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="client-search"
                            placeholder="Search organization or individual..."
                            className="h-10 rounded-xl border-border/50 bg-muted/20 pl-10 sm:h-12"
                            value={clientSearch}
                            onFocus={() => setShowClientResults(true)}
                            onChange={(event) => setClientSearch(event.target.value)}
                          />
                          {showClientResults && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl backdrop-blur-xl">
                              {clients.length > 0 ? (
                                clients.map((client) => (
                                  <button
                                    key={client.id}
                                    className="flex w-full flex-col gap-0.5 border-b border-border/30 px-4 py-3 text-left transition-colors last:border-0 hover:bg-primary/5"
                                    onClick={() => handleSelectClient(client)}
                                  >
                                    <span className="text-sm font-bold text-foreground">{client.name}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{client.email}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="p-4 text-center text-sm italic text-muted-foreground">No clients found.</div>
                              )}
                            </div>
                          )}
                        </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Examinee (person being tested)</Label>
                        {isOrgBooking && !formData.subjectId ? (
                          <p className="text-xs text-amber-700 dark:text-amber-400 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                            Required: search and select an examinee from {formData.clientName || "this account"}&apos;s roster.
                            <Link
                              href={`/dashboard/clients/${formData.clientId}/roster`}
                              className="block mt-2 font-semibold underline"
                            >
                              Add examinees on roster first
                            </Link>
                          </p>
                        ) : null}
                        {isOrgBooking && formData.subjectId ? (
                          <p className="text-xs text-muted-foreground rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                            Examinee: <span className="font-semibold text-foreground">{formData.subjectName}</span>
                            <span className="block mt-1">
                              One examinee per booking. Book again for each additional person (fee is per session).
                            </span>
                          </p>
                        ) : !isOrgBooking ? (
                          <label className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 text-sm">
                            <Checkbox
                              checked={useClientAsSubject}
                              onCheckedChange={(checked) => {
                                const enabled = Boolean(checked);
                                setUseClientAsSubject(enabled);
                                if (enabled) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    subjectName: prev.clientName,
                                    subjectId: "",
                                  }));
                                  setSubjectSearch("");
                                  setShowSubjectResults(false);
                                }
                              }}
                            />
                            Use selected client as subject
                          </label>
                        ) : null}

                        {!isOrgBooking && useClientAsSubject ? (
                          <p className="text-xs text-muted-foreground">
                            Subject will be set to <span className="font-semibold text-foreground">{formData.clientName || "selected client"}</span>.
                          </p>
                        ) : !useClientAsSubject || isOrgBooking ? (
                          <div className="space-y-2">
                            <Label htmlFor="subject-search">Search examinee</Label>
                            <div className="relative" ref={subjectSearchRef}>
                              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="subject-search"
                                placeholder="Search an existing subject..."
                                className="h-10 rounded-xl border-border/50 bg-muted/20 pl-10 sm:h-12"
                                value={subjectSearch}
                                onFocus={() => setShowSubjectResults(true)}
                                onChange={(event) => setSubjectSearch(event.target.value)}
                              />
                              {showSubjectResults && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl backdrop-blur-xl">
                                  {subjects.length > 0 ? (
                                    subjects.map((subject) => {
                                      const label = `${subject.first_name} ${subject.last_name}`.trim();
                                      return (
                                        <button
                                          key={subject.id}
                                          className="flex w-full flex-col gap-0.5 border-b border-border/30 px-4 py-3 text-left transition-colors last:border-0 hover:bg-primary/5"
                                          onClick={() => handleSelectSubject(subject)}
                                        >
                                          <span className="text-sm font-bold text-foreground">{label}</span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {[subject.email, subject.phone].filter(Boolean).join(" · ") ||
                                              subject.employee_ref ||
                                              "Examinee"}
                                          </span>
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <div className="p-4 text-center text-sm italic text-muted-foreground">No subjects found.</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label>Examination Protocol</Label>
                        <Select value={formData.examTypeId} onValueChange={(value) => handleInputChange("examTypeId", value as string)}>
                          <SelectTrigger className="h-10 rounded-xl border-border/50 bg-muted/20 sm:h-12">
                            <SelectValue placeholder="Select examination type">{selectedExamType?.name}</SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/50 bg-card/95 backdrop-blur-lg">
                            {examTypes.map((examType) => (
                              <SelectItem key={examType.id} value={String(examType.id)} className="rounded-lg">
                                {examType.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedExamType && (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>{selectedExamType.description} Estimated duration: {(selectedExamType.duration / 60).toFixed(1)} hours.</p>
                            <p className="font-semibold text-foreground">Base price: ${selectedExamType.price.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/50 shadow-sm backdrop-blur-md">
                    <CardHeader className="border-b border-border/50 bg-muted/30 pb-3 sm:pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Shield className="h-5 w-5 text-primary" />
                        Examiner Availability
                      </CardTitle>
                      <CardDescription>
                        Pick an examiner, then a date. Slots already booked, blocked on the examiner
                        calendar, or in the past are hidden.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-4 sm:space-y-8 sm:p-6">
                      <div className="space-y-3">
                        <Label htmlFor="examiner-search" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                          Search Examiner
                        </Label>
                        <div className="relative">
                          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="examiner-search"
                            className="h-10 rounded-xl border-border/50 bg-muted/20 pl-10 sm:h-12"
                            placeholder="Search active or pending examiners..."
                            value={examinerSearch}
                            onChange={(event) => setExaminerSearch(event.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {examiners.map((examiner) => (
                            <button
                              key={examiner.id}
                              onClick={() => {
                                handleInputChange("examinerId", String(examiner.id));
                                handleInputChange("time", "");
                              }}
                              className={cn(
                                "rounded-xl border p-3 text-left transition-all",
                                formData.examinerId === String(examiner.id)
                                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                  : "border-border/50 bg-muted/10 hover:border-primary/30 hover:bg-muted/20",
                              )}
                            >
                              <p className="text-sm font-bold text-foreground">{examiner.name}</p>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{examiner.email}</p>
                              <Badge variant="outline" className="mt-2 text-[10px] uppercase">
                                {examiner.status}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8">
                        <div className="space-y-3">
                          <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Examination Date</Label>
                          <div className="relative">
                            <CalendarIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="date"
                              className={cn(
                                "h-10 rounded-xl border-border/50 bg-muted/20 pl-10 sm:h-12",
                                isDateBlocked && "border-destructive/50 ring-1 ring-destructive/20",
                              )}
                              value={formData.date}
                              min={localDateString()}
                              onChange={(event) => {
                                handleInputChange("date", event.target.value);
                                handleInputChange("time", "");
                              }}
                            />
                          </div>

                          {dayStatus && (
                            <div
                              className={cn(
                                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold",
                                dayStatus.type === "error"
                                  ? "border border-destructive/20 bg-destructive/10 text-destructive"
                                  : dayStatus.type === "warning"
                                    ? "border border-amber-500/20 bg-amber-500/10 text-amber-700"
                                    : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
                              )}
                            >
                              {dayStatus.type === "error" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {dayStatus.label}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Available Slots</Label>
                          {!formData.date || !formData.examinerId || isDateBlocked ? (
                            <div className="flex h-30 items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/5 p-4 text-center">
                              <p className="text-[10px] leading-relaxed text-muted-foreground">
                                {!formData.examinerId
                                  ? "Select an examiner first."
                                  : !formData.date
                                    ? "Select a date to load open slots."
                                    : "No slots available for this date."}
                              </p>
                            </div>
                          ) : (
                            <div className="grid max-h-35 grid-cols-2 gap-2 overflow-y-auto pr-2">
                              {availableSlots.length > 0 ? (
                                availableSlots.map((slot) => (
                                  <button
                                    key={slot}
                                    onClick={() => handleInputChange("time", slot)}
                                    className={cn(
                                      "rounded-lg border py-2 text-xs font-bold transition-all",
                                      formData.time === slot
                                        ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                        : "border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-primary/5",
                                    )}
                                  >
                                    {slot}
                                  </button>
                                ))
                              ) : (
                                <div className="col-span-2 rounded-xl border border-dashed border-border/50 bg-muted/5 p-4 text-center text-xs text-muted-foreground">
                                  No open slots — this examiner is fully booked, blocked, or remaining times are in the past.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/50 shadow-sm backdrop-blur-md">
                    <CardHeader className="bg-muted/30 pb-3 sm:pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Payment & Background
                      </CardTitle>
                      <CardDescription>Capture payment mode and the case context that will be handed to the examiner.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={formData.paymentType} onValueChange={(value) => handleInputChange("paymentType", value as string)}>
                          <SelectTrigger className="h-10 rounded-xl bg-muted/20 sm:h-12">
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {paymentTypes.map((type) => (
                              <SelectItem key={type} value={type} className="rounded-lg">
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-primary/20 bg-primary/3 p-4 sm:gap-6 sm:p-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Base Exam Fee</Label>
                            <span className="text-sm font-black text-primary">${selectedExamType?.price.toFixed(2) || "0.00"}</span>
                          </div>
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-muted-foreground">
                            From {selectedExamType?.name || "selected exam type"}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="collected-amount">Amount Collected</Label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                            <Input
                              id="collected-amount"
                              type="number"
                              step="0.01"
                              min="0"
                              max={selectedExamType?.price}
                              placeholder="0.00"
                              className="h-10 rounded-xl border-border/50 bg-muted/20 pl-8 sm:h-12"
                              value={formData.collectedAmount}
                              onChange={(event) => handleInputChange("collectedAmount", event.target.value)}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {formData.collectedAmount && selectedExamType
                              ? `${((Number(formData.collectedAmount) / selectedExamType.price) * 100).toFixed(0)}% of total`
                              : "Enter collected amount"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Background Information / Reason for Exam</Label>
                        <Textarea
                          placeholder="Provide clinical or case context, including incidents or case numbers when relevant."
                          className="min-h-28 rounded-xl bg-muted/20 p-3 sm:min-h-30 sm:p-4"
                          value={formData.reason}
                          onChange={(event) => handleInputChange("reason", event.target.value)}
                        />
                        <p className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                          <Info className="h-3 w-3" /> This note is stored with the appointment and shared with the examiner.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card className="rounded-3xl border-border/50 bg-card/50 shadow-xl backdrop-blur-md">
                    <CardHeader className="pb-4 sm:pb-6">
                      <CardTitle className="text-xl sm:text-2xl">Review Appointment</CardTitle>
                      <CardDescription>Confirm the booking before it is written to the backend.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 px-4 pb-4 sm:space-y-6 sm:px-6 sm:pb-6">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <ReviewItem label="Client" value={formData.clientName || "Not selected"} />
                        <ReviewItem label="Subject" value={selectedSubjectLabel} />
                        <ReviewItem label="Exam Type" value={selectedExamType?.name || "Not selected"} />
                        <ReviewItem label="Price" value={selectedExamType ? `$${selectedExamType.price.toFixed(2)}` : "Not set"} />
                        <ReviewItem label="Examiner" value={selectedExaminer?.name || "Not assigned"} />
                        <ReviewItem label="Time Slot" value={formData.date && formData.time ? `${formData.date} @ ${formData.time}` : "Not scheduled"} />
                        <ReviewItem label="Payment Method" value={formData.paymentType || "Not selected"} />
                        <ReviewItem label="Collected Amount" value={formData.collectedAmount ? `$${Number(formData.collectedAmount).toFixed(2)}` : "$0.00"} />
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Background</p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">{formData.reason || "No background provided."}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        <div className="space-y-4 sm:space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg">Booking Summary</CardTitle>
              <CardDescription>Quick summary of your current booking details.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <SummaryRow label="Client" value={formData.clientName || "Not selected"} />
              <SummaryRow label="Subject" value={selectedSubjectLabel} />
              <SummaryRow label="Type" value={selectedExamType?.name || "Not selected"} />
              <SummaryRow label="Price" value={selectedExamType ? `$${selectedExamType.price.toFixed(2)}` : "Not set"} />
              <SummaryRow label="Examiner" value={selectedExaminer?.name || "Not assigned"} />
              <SummaryRow label="Time Slot" value={formData.date && formData.time ? `${formData.date} @ ${formData.time}` : "Not scheduled"} />
              <SummaryRow
                label="Estimated duration"
                value={selectedExamType ? `${(selectedExamType.duration / 60).toFixed(1)} hours` : "2.5 hours"}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="w-full" disabled={step === 1 || isBooking} onClick={() => setStep((current) => Math.max(1, current - 1))}>
              Back
            </Button>
            {step < 4 ? (
              <Button className="w-full" disabled={!isStepValid() || isContinueLoading} aria-busy={isContinueLoading} onClick={() => setStep((current) => Math.min(4, current + 1))}>
                {isContinueLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={isBooking || !isStepValid()}
                aria-busy={isBooking}
                onClick={() => void handleComplete()}
              >
                {isBooking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function BookAppointmentPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading booking wizard...
        </div>
      }
    >
      <BookAppointmentPageContent />
    </React.Suspense>
  );
}

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
