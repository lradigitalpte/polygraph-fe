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
  History,
  Info,
  Languages,
  Loader2,
  Plus,
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
import {
  ENGLISH_PROFICIENCY_LEVELS,
  createSubject,
  fetchSubjects,
  updateSubject,
  type SubjectRecord,
} from "@/lib/subjects";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { convertQuotation } from "@/lib/quotations";
import { fetchOrganizationSettings, type OrganizationSettings } from "@/lib/settings";
import { catalogPriceInCurrency, convertCurrency, formatMoney } from "@/lib/client-account";
import {
  clinicDateTimeToISO,
  clinicTodayDateString,
  isClinicDateTimePast,
  isClinicSunday,
} from "@/lib/clinic-time";
import {
  filterAvailableBookingSlots,
  generateBookingTimeSlots,
} from "@/lib/scheduling";
import { cn } from "@/lib/utils";

const paymentTypes = ["Bank Transfer", "Credit Card"];

const STEP_LABELS = ["Who & exam", "Examiner & time", "Payment", "Review"];

function BookAppointmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetClientId = searchParams.get("clientId");
  const presetSubjectId = searchParams.get("subjectId");
  const presetExamTypeId = searchParams.get("examTypeId");
  const presetExaminerId = searchParams.get("examinerId");
  const presetDate = searchParams.get("date");
  const presetTime = searchParams.get("time");
  const returnTo = searchParams.get("returnTo");
  const convertQuotationId = searchParams.get("quotationId");
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
  const [selectedSubjectRecord, setSelectedSubjectRecord] = React.useState<SubjectRecord | null>(null);
  const [englishProficiency, setEnglishProficiency] = React.useState("");
  const [interpreterRequired, setInterpreterRequired] = React.useState(false);
  const [clients, setClients] = React.useState<ClientRecord[]>([]);
  const [subjects, setSubjects] = React.useState<SubjectRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [busyPeriods, setBusyPeriods] = React.useState<BusyPeriodRecord[]>([]);
  const [isDateBlocked, setIsDateBlocked] = React.useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = React.useState(false);
  const [orgSettings, setOrgSettings] = React.useState<OrganizationSettings | null>(null);

  const orgCurrency = orgSettings?.currency || "AED";

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
    void fetchOrganizationSettings()
      .then(setOrgSettings)
      .catch(() => setOrgSettings(null));
  }, []);

  const examPriceInOrg = React.useCallback(
    (usdPrice: number) => catalogPriceInCurrency(usdPrice, orgCurrency, orgSettings ?? {}),
    [orgCurrency, orgSettings],
  );

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

        // Prefill from the pending-appointments handoff (exam type / examiner / date).
        // The requested time is shown as a hint in step 2 rather than force-selected, so
        // the admin still picks a slot the examiner is actually free for.
        if (presetExamTypeId || presetExaminerId || presetDate) {
          setFormData((prev) => ({
            ...prev,
            ...(presetExamTypeId ? { examTypeId: presetExamTypeId } : {}),
            ...(presetExaminerId ? { examinerId: presetExaminerId } : {}),
            ...(presetDate ? { date: presetDate } : {}),
          }));
        }

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
                  setSelectedSubjectRecord(sub);
                  setEnglishProficiency(sub.english_proficiency ?? "");
                  setInterpreterRequired(sub.interpreter_required ?? false);
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

      if (isClinicSunday(formData.date) && !orgSettings?.sunday_bookings_enabled) {
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
  }, [formData.examinerId, formData.date, orgSettings?.sunday_bookings_enabled]);

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
    setSelectedSubjectRecord(null);
    setEnglishProficiency("");
    setInterpreterRequired(false);
    setShowClientResults(false);
  };

  const resetLanguageFields = () => {
    setSelectedSubjectRecord(null);
    setEnglishProficiency("");
    setInterpreterRequired(false);
  };

  const handleClearClient = () => {
    setSelectedClientRecord(null);
    setClientSearch("");
    setShowClientResults(false);
    setSubjectSearch("");
    setShowSubjectResults(false);
    setUseClientAsSubject(true);
    resetLanguageFields();
    setFormData((prev) => ({
      ...prev,
      clientId: "",
      clientName: "",
      subjectId: "",
      subjectName: "",
    }));
  };

  const handleSelectSubject = (subject: SubjectRecord) => {
    const fullName = [subject.first_name, subject.last_name].filter(Boolean).join(" ");
    setFormData((prev) => ({ ...prev, subjectName: fullName, subjectId: String(subject.id) }));
    setSubjectSearch(fullName);
    setUseClientAsSubject(false);
    setShowSubjectResults(false);
    setSelectedSubjectRecord(subject);
    setEnglishProficiency(subject.english_proficiency ?? "");
    setInterpreterRequired(subject.interpreter_required ?? false);
  };

  const selectedExaminer = examiners.find((item) => item.id === Number(formData.examinerId));
  const selectedExamType = examTypes.find((item) => item.id === Number(formData.examTypeId));
  const isContinueLoading = isLoadingInitialData || (step === 2 && isLoadingAvailability);

  const availableSlots = React.useMemo(() => {
    if (!formData.date || !formData.examinerId || isDateBlocked) {
      return [];
    }

    const duration = selectedExamType?.duration ?? 150;
    const candidateSlots = generateBookingTimeSlots(duration);

    return filterAvailableBookingSlots(candidateSlots, {
      date: formData.date,
      durationMinutes: duration,
      busyPeriods,
      allowPastSlots: true,
    });
  }, [busyPeriods, formData.date, formData.examinerId, isDateBlocked, selectedExamType?.duration]);

  const isBackdatedBooking = React.useMemo(() => {
    if (!formData.date || !formData.time) {
      return false;
    }
    return isClinicDateTimePast(formData.date, formData.time);
  }, [formData.date, formData.time]);

  const isPastDateSelected = Boolean(formData.date && formData.date < clinicTodayDateString());

  const isStepValid = () => {
    if (step === 1) {
      const hasSubject =
        useClientAsSubject || Boolean(formData.subjectId) || Boolean(formData.subjectName.trim());
      return Boolean(formData.clientId && formData.examTypeId && hasSubject);
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
    if (isClinicSunday(formData.date) && !orgSettings?.sunday_bookings_enabled) {
      return { label: "Clinic closed on Sundays", type: "error" as const };
    }
    if (isDateBlocked) {
      return { label: "Examiner blocked for this date", type: "warning" as const };
    }
    if (formData.examinerId && !isLoadingAvailability) {
      if (availableSlots.length === 0) {
        return { label: "No open slots (booked or blocked)", type: "warning" as const };
      }
      return {
        label: `${availableSlots.length} open slot${availableSlots.length === 1 ? "" : "s"}`,
        type: "success" as const,
      };
    }
    return { label: "Select examiner to see slots", type: "success" as const };
  }, [
    formData.date,
    formData.examinerId,
    isDateBlocked,
    isLoadingAvailability,
    availableSlots.length,
    orgSettings?.sunday_bookings_enabled,
  ]);

  const handleComplete = async () => {
    if (!selectedExamType) {
      toast.error("Please select an examination type");
      return;
    }

    setIsBooking(true);
    try {
      let subjectID = Number(formData.subjectId);
      let createdNewSubject = false;
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
            client_id: selectedClientRecord?.id || (formData.clientId ? Number(formData.clientId) : undefined),
            first_name: firstName,
            last_name: lastName,
            english_proficiency: englishProficiency || undefined,
            interpreter_required: interpreterRequired,
          });
          subjectID = createdSubject.id;
          createdNewSubject = true;
        }
      } else if (!subjectID && formData.subjectName.trim()) {
        const trimmedName = formData.subjectName.trim().toLowerCase();
        const existingMatch = subjects.find((subject) => {
          const fullName = `${subject.first_name} ${subject.last_name}`.trim().toLowerCase();
          return fullName === trimmedName;
        });

        if (existingMatch) {
          subjectID = existingMatch.id;
        } else {
          const nameParts = formData.subjectName.trim().split(/\s+/).filter(Boolean);
          const firstName = nameParts[0] || "Examinee";
          const lastName = nameParts.slice(1).join(" ") || "(Subject)";
          const createdSubject = await createSubject({
            client_id: selectedClientRecord?.id || (formData.clientId ? Number(formData.clientId) : undefined),
            first_name: firstName,
            last_name: lastName,
            english_proficiency: englishProficiency || undefined,
            interpreter_required: interpreterRequired,
          });
          subjectID = createdSubject.id;
          createdNewSubject = true;
        }
      }

      if (!subjectID) {
        toast.error("Please enter or select an examinee");
        return;
      }

      // Persist the language/interpreter info onto the examinee so it travels with the
      // person and the examiner can see it. New subjects already carry it from createSubject;
      // for existing ones, send the full record so the partial update doesn't clear other fields.
      if (!createdNewSubject && (englishProficiency || interpreterRequired)) {
        const rec =
          subjects.find((s) => s.id === subjectID) ??
          (selectedSubjectRecord?.id === subjectID ? selectedSubjectRecord : null);
        if (rec) {
          await updateSubject(subjectID, {
            first_name: rec.first_name,
            last_name: rec.last_name,
            email: rec.email,
            phone: rec.phone,
            employee_ref: rec.employee_ref,
            gender: rec.gender,
            nationality: rec.nationality,
            spoken_language: rec.spoken_language,
            written_language: rec.written_language,
            english_proficiency: englishProficiency,
            interpreter_required: interpreterRequired,
          });
        }
      }

      const orgExamPrice = examPriceInOrg(selectedExamType.price);
      const collectedInOrg = Number(formData.collectedAmount) || 0;
      const collectedUSD =
        collectedInOrg > 0
          ? convertCurrency(collectedInOrg, orgCurrency, "USD", orgSettings ?? {})
          : 0;

      let paymentStatus = "Unpaid";
      if (collectedInOrg >= orgExamPrice) {
        paymentStatus = "Paid";
      } else if (collectedInOrg > 0) {
        paymentStatus = "Partial";
      }

      const scheduledAt = clinicDateTimeToISO(formData.date, formData.time);

      if (convertQuotationId) {
        // Converting an existing quotation into a booking — the quote's amount carries
        // over and the quotation becomes this booking's invoice (no new invoice).
        await convertQuotation(Number(convertQuotationId), {
          subject_id: subjectID,
          examiner_id: Number(formData.examinerId),
          scheduled_at: scheduledAt,
          duration: selectedExamType.duration,
        });
        toast.success("Quotation converted to a booking");
      } else {
        await createAppointment({
          client_id: Number(formData.clientId),
          subject_id: subjectID,
          examiner_id: Number(formData.examinerId),
          scheduled_at: scheduledAt,
          duration: selectedExamType.duration,
          exam_fee: selectedExamType.price,
          collected_amount: collectedUSD,
          payment_status: paymentStatus,
          payment_mode: formData.paymentType,
          notes: `${selectedExamType.name}\n\n${formData.reason}`,
          status: "pending",
        });
        toast.success(isBackdatedBooking ? "Backdated appointment logged" : "Appointment booked", {
          description: isBackdatedBooking
            ? `Logged for ${formData.date} @ ${formData.time} (Dubai). Invoice for ${formatMoney(orgExamPrice, orgCurrency)} added to Financial Hub.`
            : `Invoice for ${formatMoney(orgExamPrice, orgCurrency)} added to Financial Hub.`,
        });
      }
      // Return to the originating page (e.g. pending appointments) when provided, so the
      // admin can keep booking the rest of the list; otherwise go to Payments as before.
      const safeReturn = returnTo && returnTo.startsWith("/dashboard/") ? returnTo : "/dashboard/payments";
      router.push(safeReturn);
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
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {convertQuotationId ? "Convert Quotation to Booking" : "Book New Exam"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {convertQuotationId
                ? "Schedule this quoted service — the quote becomes its invoice."
                : "Clinical scheduling & intake."}
            </p>
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
                          <div className="h-11 sm:h-12 rounded-xl border border-primary/30 bg-muted/20 pl-4 pr-2 flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm truncate">{formData.clientName}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 shrink-0 text-xs text-muted-foreground hover:text-foreground"
                              onClick={handleClearClient}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Change
                            </Button>
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
                            <Label htmlFor="subject-search">Search or type examinee name</Label>
                            <div className="relative" ref={subjectSearchRef}>
                              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="subject-search"
                                placeholder="Type examinee name (e.g. spouse, relative) or search existing..."
                                className="h-10 rounded-xl border-border/50 bg-muted/20 pl-10 sm:h-12"
                                value={subjectSearch}
                                onFocus={() => setShowSubjectResults(true)}
                                onChange={(event) => {
                                  const val = event.target.value;
                                  setSubjectSearch(val);
                                  setFormData((prev) => ({
                                    ...prev,
                                    subjectName: val,
                                    subjectId: "",
                                  }));
                                  setSelectedSubjectRecord(null);
                                  setShowSubjectResults(true);
                                }}
                              />
                              {showSubjectResults && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl backdrop-blur-xl">
                                  {subjects.length > 0 && (
                                    subjects.map((subject) => {
                                      const label = `${subject.first_name} ${subject.last_name}`.trim();
                                      return (
                                        <button
                                          key={subject.id}
                                          type="button"
                                          className="flex w-full flex-col gap-0.5 border-b border-border/30 px-4 py-3 text-left transition-colors last:border-0 hover:bg-primary/5"
                                          onClick={() => handleSelectSubject(subject)}
                                        >
                                          <span className="text-sm font-bold text-foreground">{label}</span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {[subject.email, subject.phone].filter(Boolean).join(" · ") ||
                                              subject.employee_ref ||
                                              "Existing Examinee"}
                                          </span>
                                        </button>
                                      );
                                    })
                                  )}
                                  {subjectSearch.trim().length > 0 && (
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2 border-t border-border/30 px-4 py-3 text-left transition-colors hover:bg-primary/10 text-primary font-semibold text-sm"
                                      onClick={() => {
                                        setFormData((prev) => ({
                                          ...prev,
                                          subjectName: subjectSearch.trim(),
                                          subjectId: "",
                                        }));
                                        setShowSubjectResults(false);
                                      }}
                                    >
                                      <Plus className="h-4 w-4 shrink-0" />
                                      <span>Use &quot;{subjectSearch.trim()}&quot; as new examinee linked to this client</span>
                                    </button>
                                  )}
                                  {subjects.length === 0 && !subjectSearch.trim() && (
                                    <div className="p-4 text-center text-sm italic text-muted-foreground">
                                      Type examinee name (e.g. spouse&apos;s name)...
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {!useClientAsSubject && formData.subjectName.trim() && !formData.subjectId && (
                              <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                                <div>
                                  <span className="font-bold text-primary uppercase tracking-wider text-[10px] block">New Examinee</span>
                                  <span className="font-semibold text-foreground text-sm">{formData.subjectName}</span>
                                  <p className="text-muted-foreground mt-0.5">
                                    Will be registered as a new examinee linked to client <strong className="text-foreground">{formData.clientName || "selected client"}</strong> upon booking.
                                  </p>
                                </div>
                                <Badge variant="outline" className="border-primary/40 text-primary shrink-0">
                                  New Record
                                </Badge>
                              </div>
                            )}

                            {!useClientAsSubject && formData.subjectId && (
                              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                                <div>
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[10px] block">Selected Existing Examinee</span>
                                  <span className="font-semibold text-foreground text-sm">{formData.subjectName}</span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, subjectId: "", subjectName: "" }));
                                    setSubjectSearch("");
                                    setSelectedSubjectRecord(null);
                                  }}
                                >
                                  Change
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {formData.clientId && (useClientAsSubject || formData.subjectId || formData.subjectName.trim()) && (
                        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:p-4">
                          <div className="flex items-center gap-2">
                            <Languages className="h-4 w-4 text-primary" />
                            <Label className="text-xs font-semibold">
                              Language &amp; interpreter
                              <span className="ml-1 font-normal text-muted-foreground">
                                — shown to the examiner for this appointment
                              </span>
                            </Label>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                English proficiency
                              </Label>
                              <Select
                                value={englishProficiency || "unset"}
                                onValueChange={(v) =>
                                  setEnglishProficiency(v === "unset" ? "" : String(v))
                                }
                              >
                                <SelectTrigger className="h-10 rounded-xl border-border/50 bg-muted/20 sm:h-11">
                                  <SelectValue placeholder="Not assessed" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unset">Not assessed</SelectItem>
                                  {ENGLISH_PROFICIENCY_LEVELS.map((level) => (
                                    <SelectItem key={level} value={level}>
                                      {level}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <label className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 cursor-pointer self-end">
                              <Checkbox
                                checked={interpreterRequired}
                                onCheckedChange={(checked) =>
                                  setInterpreterRequired(checked === true)
                                }
                              />
                              <span className="text-sm">Interpreter required</span>
                            </label>
                          </div>
                        </div>
                      )}

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
                            <p className="font-semibold text-foreground">
                              Base price: {formatMoney(examPriceInOrg(selectedExamType.price), orgCurrency)}
                            </p>
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
                        Pick an examiner, then a date and time. Booked or blocked slots are hidden.
                        Past times stay available when you need to log an exam that already happened.
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
                                isPastDateSelected && !isDateBlocked && "border-amber-500/40 ring-1 ring-amber-500/20",
                              )}
                              value={formData.date}
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
                                    ? "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                    : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                              )}
                            >
                              {dayStatus.type === "error" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {dayStatus.label}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                            Available Slots (Dubai time)
                          </Label>
                          {presetTime && (
                            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary">
                              <Clock className="h-3 w-3" />
                              Client requested {presetTime} — pick the closest open slot.
                            </div>
                          )}
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
                            <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto pr-2 sm:grid-cols-4">
                              {availableSlots.length > 0 ? (
                                availableSlots.map((slot) => {
                                  const slotIsPast = isClinicDateTimePast(formData.date, slot);
                                  return (
                                    <button
                                      key={slot}
                                      onClick={() => handleInputChange("time", slot)}
                                      className={cn(
                                        "rounded-lg border py-2 text-xs font-bold transition-all",
                                        formData.time === slot
                                          ? slotIsPast
                                            ? "border-amber-600 bg-amber-600 text-white shadow-md shadow-amber-600/20"
                                            : "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                          : slotIsPast
                                            ? "border-amber-500/30 bg-amber-500/5 text-amber-800 hover:border-amber-500/50 hover:bg-amber-500/10 dark:text-amber-300"
                                            : "border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-primary/5",
                                      )}
                                    >
                                      {slot}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="col-span-2 rounded-xl border border-dashed border-border/50 bg-muted/5 p-4 text-center text-xs text-muted-foreground">
                                  No open slots — this examiner is fully booked or blocked for the day.
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
                            <span className="text-sm font-black text-primary">
                              {selectedExamType
                                ? formatMoney(examPriceInOrg(selectedExamType.price), orgCurrency)
                                : formatMoney(0, orgCurrency)}
                            </span>
                          </div>
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-muted-foreground">
                            From {selectedExamType?.name || "selected exam type"}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="collected-amount">Amount Collected</Label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-[10px]">
                              {orgCurrency}
                            </span>
                            <Input
                              id="collected-amount"
                              type="number"
                              step="0.01"
                              min="0"
                              max={selectedExamType ? examPriceInOrg(selectedExamType.price) : undefined}
                              placeholder="0.00"
                              className="h-10 rounded-xl border-border/50 bg-muted/20 pl-8 sm:h-12"
                              value={formData.collectedAmount}
                              onChange={(event) => handleInputChange("collectedAmount", event.target.value)}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {formData.collectedAmount && selectedExamType
                              ? `${((Number(formData.collectedAmount) / examPriceInOrg(selectedExamType.price)) * 100).toFixed(0)}% of total`
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
                        <ReviewItem
                          label="Price"
                          value={
                            selectedExamType
                              ? formatMoney(examPriceInOrg(selectedExamType.price), orgCurrency)
                              : "Not set"
                          }
                        />
                        <ReviewItem label="Examiner" value={selectedExaminer?.name || "Not assigned"} />
                        <ReviewItem
                          label="Time Slot"
                          value={
                            formData.date && formData.time
                              ? `${formData.date} @ ${formData.time}${isBackdatedBooking ? " (backdated)" : ""}`
                              : "Not scheduled"
                          }
                        />
                        <ReviewItem label="Payment Method" value={formData.paymentType || "Not selected"} />
                        <ReviewItem
                          label="Collected Amount"
                          value={
                            formData.collectedAmount
                              ? formatMoney(Number(formData.collectedAmount), orgCurrency)
                              : formatMoney(0, orgCurrency)
                          }
                        />
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
              <SummaryRow
                label="Price"
                value={
                  selectedExamType
                    ? formatMoney(examPriceInOrg(selectedExamType.price), orgCurrency)
                    : "Not set"
                }
              />
              <SummaryRow label="Examiner" value={selectedExaminer?.name || "Not assigned"} />
              <SummaryRow
                label="Time Slot"
                value={
                  formData.date && formData.time
                    ? `${formData.date} @ ${formData.time}${isBackdatedBooking ? " (backdated)" : ""}`
                    : "Not scheduled"
                }
              />
              {isBackdatedBooking && (
                <div className="col-span-full flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-amber-900 dark:text-amber-100">
                  <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                  <p className="text-[11px] leading-relaxed">
                    Backdated time — this logs an exam that already happened.
                  </p>
                </div>
              )}
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
                ) : isBackdatedBooking ? (
                  "Confirm Backdated Booking"
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
    <div className="min-w-0 space-y-0.5">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="block text-sm font-semibold text-foreground wrap-break-word">{value}</span>
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
