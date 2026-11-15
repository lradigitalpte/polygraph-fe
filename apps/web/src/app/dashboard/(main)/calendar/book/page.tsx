"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  Tag,
  UserRound,
  Users,
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
import { fetchPrepaidSlotSummary, type PrepaidSlotSummary } from "@/lib/prepaid-slots";
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
import { addAppointmentQuestionsFromTemplates } from "@/lib/appointment-questions";
import { fetchQuestionTemplates, type QuestionTemplateRecord } from "@/lib/question-templates";
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
import { GlowPanel, SearchResultOption, SearchResults, displayEmail } from "@/components/dashboard/ui-kit";

const paymentTypes = ["Bank Transfer", "Credit Card", "Cash"];

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
  const [prepaidSummary, setPrepaidSummary] = React.useState<PrepaidSlotSummary | null>(null);
  const [usePrepaidSlot, setUsePrepaidSlot] = React.useState(true);

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

  // Optional: questions picked from the library while booking. They are attached
  // to the appointment right after it is created.
  const [questionTemplates, setQuestionTemplates] = React.useState<QuestionTemplateRecord[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = React.useState<number[]>([]);
  const [showQuestionPicker, setShowQuestionPicker] = React.useState(false);

  const clientSearchRef = React.useRef<HTMLDivElement>(null);
  const subjectSearchRef = React.useRef<HTMLDivElement>(null);

  const deferredClientSearch = React.useDeferredValue(clientSearch);
  const deferredSubjectSearch = React.useDeferredValue(subjectSearch);
  const deferredExaminerSearch = React.useDeferredValue(examinerSearch);

  // Reload the library whenever the protocol changes: templates tagged to that
  // exam type, plus untagged ones that apply to any booking.
  React.useEffect(() => {
    if (!showQuestionPicker) return;
    const examTypeId = Number(formData.examTypeId) || undefined;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchQuestionTemplates(examTypeId ? { examTypeId } : {});
        if (!cancelled) setQuestionTemplates(rows);
      } catch {
        if (!cancelled) setQuestionTemplates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showQuestionPicker, formData.examTypeId]);

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
  const willUsePrepaidSlot =
    isOrgBooking && usePrepaidSlot && (prepaidSummary?.available ?? 0) > 0 && !convertQuotationId;

  React.useEffect(() => {
    if (isOrgBooking) {
      setUseClientAsSubject(false);
    }
  }, [isOrgBooking]);

  React.useEffect(() => {
    if (!isOrgBooking || !formData.clientId) {
      setPrepaidSummary(null);
      return;
    }
    let cancelled = false;
    void fetchPrepaidSlotSummary(Number(formData.clientId))
      .then((summary) => {
        if (!cancelled) setPrepaidSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setPrepaidSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOrgBooking, formData.clientId]);

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
          exam_type_id: selectedExamType.id,
        });
        toast.success("Quotation converted to a booking");
      } else {
        const appointment = await createAppointment({
          client_id: Number(formData.clientId),
          subject_id: subjectID,
          examiner_id: Number(formData.examinerId),
          scheduled_at: scheduledAt,
          duration: selectedExamType.duration,
          exam_type_id: selectedExamType.id,
          exam_fee: selectedExamType.price,
          collected_amount: collectedUSD,
          payment_status: paymentStatus,
          payment_mode: formData.paymentType,
          notes: formData.reason,
          status: "pending",
          use_prepaid_slot: willUsePrepaidSlot,
        });

        // Attach any questions picked during booking. A failure here must not
        // lose the booking itself, so it only warns.
        if (selectedTemplateIds.length > 0 && appointment?.id) {
          try {
            await addAppointmentQuestionsFromTemplates(appointment.id, selectedTemplateIds);
          } catch (questionError) {
            toast.warning(
              questionError instanceof Error
                ? `Booking saved, but questions were not attached: ${questionError.message}`
                : "Booking saved, but questions were not attached"
            );
          }
        }
        toast.success(isBackdatedBooking ? "Backdated appointment logged" : "Appointment booked", {
          description: willUsePrepaidSlot
            ? `Used 1 prepaid examination slot (${Math.max(0, (prepaidSummary?.available ?? 1) - 1)} remaining). Billed on the bulk invoice, no separate invoice created.`
            : isBackdatedBooking
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
    <div className="mx-auto max-w-[1280px] space-y-5 pb-12 sm:pb-20">
      <GlowPanel tone="terracotta" orb="78%" lineTop={0} className="px-5 pt-6 pb-5 sm:px-7 sm:pt-7">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <button
              type="button"
              aria-label="Go back"
              onClick={() => router.back()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/15"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </button>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">Calendar</span>
              <h1 className="text-2xl leading-tight font-normal tracking-[-0.03em] sm:text-[34px]">
                {convertQuotationId ? (
                  <>
                    Convert quote to <span className="font-semibold">booking</span>
                  </>
                ) : (
                  <>
                    Book a new <span className="font-semibold">exam</span>
                  </>
                )}
              </h1>
              <p className="text-sm text-[#C9C6BC]">
                {convertQuotationId
                  ? "Schedule this quoted service. The quote becomes its invoice."
                  : "Pick who is being tested, assign an examiner and a time, then confirm."}
              </p>
            </div>
          </div>

          {/* Stepper */}
          <ol aria-label="Booking progress" className="grid grid-cols-4 gap-2">
            {STEP_LABELS.map((label, index) => {
              const number = index + 1;
              const done = step > number;
              const active = step === number;
              return (
                <li key={label} className="min-w-0">
                  <button
                    type="button"
                    disabled={!done || isBooking}
                    onClick={() => setStep(number)}
                    aria-current={active ? "step" : undefined}
                    className="group flex w-full min-w-0 flex-col gap-2.5 text-left disabled:cursor-default"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-1 w-full overflow-hidden rounded-full bg-white/10",
                      )}
                    >
                      <span
                        className={cn(
                          "block h-full rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                          done ? "w-full bg-[#FAF9F5]" : active ? "w-1/2 bg-primary" : "w-0",
                        )}
                      />
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                          done
                            ? "bg-[#FAF9F5] text-[#1A1915] group-hover:bg-white"
                            : active
                              ? "bg-primary text-[#1A1915]"
                              : "bg-white/10 text-[#C9C6BC] ring-1 ring-white/15",
                        )}
                      >
                        {done ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : number}
                      </span>
                      <span
                        className={cn(
                          "hidden truncate text-[13px] sm:inline",
                          active ? "font-medium text-[#FAF9F5]" : done ? "text-[#ECE9E0] group-hover:underline" : "text-[#8E8B82]",
                        )}
                      >
                        {label}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="-mt-3 text-[13px] text-[#C9C6BC] sm:hidden">
            Step {step} of 4 · {STEP_LABELS[step - 1]}
          </p>
        </div>
      </GlowPanel>

      {isOrgBooking && formData.clientId && (
        <Card className="rounded-[24px] border-0 bg-primary/10 shadow-none ring-0">
          <CardContent className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[oklch(0.45_0.12_39)] dark:bg-card dark:text-primary">
                <Users aria-hidden="true" className="size-4" />
              </span>
              <div>
              <p className="text-[13px] font-medium text-[oklch(0.45_0.12_39)] dark:text-primary">Organisation booking</p>
              <p className="text-[15px] font-medium">{formData.clientName}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Billing stays on this account. Step 1: pick the examinee. Step 2: examiner must be
                available at the time you choose.
              </p>
              </div>
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

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <div className="min-w-0 space-y-5">
          {isLoadingInitialData ? (
            <div className="flex flex-col gap-4 rounded-[28px] bg-white p-6 ring-1 ring-border/50 dark:bg-card">
              <div className="h-6 w-48 animate-pulse rounded-lg bg-muted" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
              <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card className="overflow-visible rounded-[28px] border-0 bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
                    <CardHeader className="gap-1.5 border-b border-border/50 px-5 pt-6 pb-5 sm:px-7">
                      <CardTitle className="flex items-center gap-3 text-lg font-medium tracking-[-0.01em]">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[oklch(0.45_0.12_39)] dark:text-primary">
                          <User aria-hidden="true" className="size-4" />
                        </span>
                        Client & Exam Selection
                      </CardTitle>
                      <CardDescription>Search the requesting client, confirm who is being tested, and attach a real exam protocol.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5 sm:space-y-6 sm:p-7">
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
                          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="client-search"
                            placeholder="Search organization or individual..."
                            className="h-12 rounded-xl border-0 bg-[#F3F1EA] pl-11 text-sm shadow-none transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-muted dark:focus-visible:bg-card"
                            value={clientSearch}
                            onFocus={() => setShowClientResults(true)}
                            onChange={(event) => setClientSearch(event.target.value)}
                          />
                          {showClientResults && (
                            <SearchResults label="Clients">
                              {clients.length > 0 ? (
                                clients.map((client) => {
                                  const isOrg = isOrganizationClient(client);
                                  return (
                                    <SearchResultOption
                                      key={client.id}
                                      name={client.name}
                                      secondary={displayEmail(client.email)}
                                      query={clientSearch}
                                      badge={isOrg ? "Organisation" : "Individual"}
                                      avatarTone={isOrg ? "org" : "person"}
                                      selected={formData.clientId === String(client.id)}
                                      onSelect={() => handleSelectClient(client)}
                                    />
                                  );
                                })
                              ) : (
                                <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
                                  <span className="text-sm font-medium">No clients match &ldquo;{clientSearch}&rdquo;</span>
                                  <Link href="/dashboard/clients/new" className="text-[13px] text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary">
                                    Register a new client
                                  </Link>
                                </div>
                              )}
                            </SearchResults>
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
                              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="subject-search"
                                placeholder="Type examinee name (e.g. spouse, relative) or search existing..."
                                className="h-12 rounded-xl border-0 bg-[#F3F1EA] pl-11 text-sm shadow-none transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-muted dark:focus-visible:bg-card"
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
                                <SearchResults
                                  label="Examinees"
                                  footer={
                                    subjectSearch.trim().length > 0 ? (
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-primary/10"
                                      onClick={() => {
                                        setFormData((prev) => ({
                                          ...prev,
                                          subjectName: subjectSearch.trim(),
                                          subjectId: "",
                                        }));
                                        setShowSubjectResults(false);
                                      }}
                                    >
                                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[oklch(0.45_0.12_39)] dark:text-primary">
                                        <Plus aria-hidden="true" className="size-4" />
                                      </span>
                                      <span className="flex min-w-0 flex-col">
                                        <span className="truncate font-medium">Add &ldquo;{subjectSearch.trim()}&rdquo; as a new examinee</span>
                                        <span className="truncate text-[13px] text-muted-foreground">Linked to {formData.clientName || "this client"}</span>
                                      </span>
                                    </button>
                                    ) : undefined
                                  }
                                >
                                  {subjects.map((subject) => {
                                    const label = `${subject.first_name} ${subject.last_name}`.trim();
                                    const detail =
                                      [displayEmail(subject.email), subject.phone].filter(Boolean).join(" · ") ||
                                      (subject.employee_ref ? `Ref ${subject.employee_ref}` : "Existing examinee");
                                    return (
                                      <SearchResultOption
                                        key={subject.id}
                                        name={label}
                                        secondary={detail}
                                        query={subjectSearch}
                                        avatarTone="person"
                                        selected={formData.subjectId === String(subject.id)}
                                        onSelect={() => handleSelectSubject(subject)}
                                      />
                                    );
                                  })}
                                  {subjects.length === 0 && (
                                    <div className="px-4 py-5 text-center text-[13px] text-muted-foreground">
                                      {subjectSearch.trim()
                                        ? "No existing examinee matches. Add them as new below."
                                        : "Start typing a name, e.g. a spouse or relative."}
                                    </div>
                                  )}
                                </SearchResults>
                              )}
                            </div>

                            {!useClientAsSubject && formData.subjectName.trim() && !formData.subjectId && (
                              <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                                <div>
                                  <span className="block text-[13px] font-medium text-[oklch(0.45_0.12_39)] dark:text-primary">New examinee</span>
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
                                  <span className="block text-[13px] font-medium text-emerald-700 dark:text-emerald-400">Existing examinee selected</span>
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
                              <Label className="text-[13px] font-medium text-muted-foreground">
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

                      {/* Optional: pick questions now. They can also be chosen or
                          edited later from the session's Questions tab. */}
                      <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3">
                        <label className="flex cursor-pointer items-start gap-3">
                          <Checkbox
                            checked={showQuestionPicker}
                            onCheckedChange={(checked) => {
                              const next = checked === true;
                              setShowQuestionPicker(next);
                              if (!next) setSelectedTemplateIds([]);
                            }}
                          />
                          <div>
                            <div className="text-sm font-medium">Prepare questions now (optional)</div>
                            <div className="text-xs text-muted-foreground">
                              Pick from the Question Library. You can skip this and choose later from the
                              session&apos;s Questions tab.
                            </div>
                          </div>
                        </label>

                        {showQuestionPicker ? (
                          questionTemplates.length === 0 ? (
                            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                              No questions in the library yet. Add some in Settings → Question Library.
                            </p>
                          ) : (
                            <div className="max-h-64 space-y-2 overflow-y-auto">
                              {questionTemplates.map((template) => {
                                const checked = selectedTemplateIds.includes(template.id);
                                return (
                                  <label
                                    key={template.id}
                                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 bg-background p-2.5"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(value) =>
                                        setSelectedTemplateIds((current) =>
                                          value === true
                                            ? [...current, template.id]
                                            : current.filter((templateId) => templateId !== template.id)
                                        )
                                      }
                                    />
                                    <div className="space-y-1">
                                      <Badge variant="outline" className="capitalize text-[10px]">
                                        {template.category}
                                      </Badge>
                                      <p className="text-xs">{template.text}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )
                        ) : null}

                        {selectedTemplateIds.length > 0 ? (
                          <p className="text-xs font-medium text-foreground">
                            {selectedTemplateIds.length} question
                            {selectedTemplateIds.length === 1 ? "" : "s"} will be prepared for this booking.
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card className="overflow-visible rounded-[28px] border-0 bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
                    <CardHeader className="gap-1.5 border-b border-border/50 px-5 pt-6 pb-5 sm:px-7">
                      <CardTitle className="flex items-center gap-3 text-lg font-medium tracking-[-0.01em]">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[oklch(0.45_0.12_39)] dark:text-primary">
                          <Shield aria-hidden="true" className="size-4" />
                        </span>
                        Examiner Availability
                      </CardTitle>
                      <CardDescription>
                        Pick an examiner, then a date and time. Booked or blocked slots are hidden.
                        Past times stay available when you need to log an exam that already happened.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 p-5 sm:space-y-8 sm:p-7">
                      <div className="space-y-3">
                        <Label htmlFor="examiner-search" className="text-[13px] font-medium text-muted-foreground">
                          Search Examiner
                        </Label>
                        <div className="relative">
                          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="examiner-search"
                            className="h-12 rounded-xl border-0 bg-[#F3F1EA] pl-11 text-sm shadow-none transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-muted dark:focus-visible:bg-card"
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
                              <p className="text-sm font-medium text-foreground">{examiner.name}</p>
                              <p className="truncate text-[13px] text-muted-foreground">{displayEmail(examiner.email)}</p>
                              <Badge variant="outline" className="mt-2 rounded-full text-[11px] capitalize">
                                {examiner.status}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8">
                        <div className="space-y-3">
                          <Label className="text-[13px] font-medium text-muted-foreground">Examination Date</Label>
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
                          <Label className="text-[13px] font-medium text-muted-foreground">
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
                  <Card className="overflow-visible rounded-[28px] border-0 bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
                    <CardHeader className="gap-1.5 border-b border-border/50 px-5 pt-6 pb-5 sm:px-7">
                      <CardTitle className="flex items-center gap-3 text-lg font-medium tracking-[-0.01em]">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[oklch(0.45_0.12_39)] dark:text-primary">
                          <CreditCard aria-hidden="true" className="size-4" />
                        </span>
                        Payment & Background
                      </CardTitle>
                      <CardDescription>Capture payment mode and the case context that will be handed to the examiner.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5 sm:space-y-6 sm:p-7">
                      {isOrgBooking && (prepaidSummary?.available ?? 0) > 0 ? (
                        <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                            {prepaidSummary?.available} prepaid examination
                            {(prepaidSummary?.available ?? 0) === 1 ? "" : "s"} available
                          </p>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="use-prepaid-slot"
                              checked={usePrepaidSlot}
                              onCheckedChange={(checked) => setUsePrepaidSlot(checked === true)}
                            />
                            <Label htmlFor="use-prepaid-slot" className="text-sm font-normal cursor-pointer">
                              Use 1 slot for this booking (billed on the bulk invoice, no separate invoice)
                            </Label>
                          </div>
                          {(prepaidSummary?.awaiting_payment ?? 0) > 0 ? (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              The bulk invoice is not fully paid yet; this exam shows unpaid until it is.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
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
                  <Card className="overflow-visible rounded-[28px] border-0 bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
                    <CardHeader className="gap-1.5 border-b border-border/50 px-5 pt-6 pb-5 sm:px-7">
                      <CardTitle className="flex items-center gap-3 text-lg font-medium tracking-[-0.01em]">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[oklch(0.45_0.12_39)] dark:text-primary">
                          <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
                        </span>
                        Review &amp; confirm
                      </CardTitle>
                      <CardDescription>Check every detail. Nothing is saved until you confirm.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5 sm:p-7">
                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
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
                      <div className="rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/50">
                        <p className="text-[13px] text-muted-foreground">Case notes</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-foreground">{formData.reason || "No case notes provided."}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        <aside className="lg:sticky lg:top-4">
          <GlowPanel tone="ink" orb="80%" lineTop={0} className="p-5 sm:p-6">
            {(() => {
              const timeLabel =
                formData.date && formData.time
                  ? `${formData.date} · ${formData.time}${isBackdatedBooking ? " (backdated)" : ""}`
                  : "";
              const items = [
                { icon: UserRound, label: "Client", value: formData.clientName || "" },
                { icon: User, label: "Examinee", value: selectedSubjectLabel && selectedSubjectLabel !== "Not selected" ? selectedSubjectLabel : "" },
                { icon: Tag, label: "Exam type", value: selectedExamType?.name || "" },
                { icon: Shield, label: "Examiner", value: selectedExaminer?.name || "" },
                { icon: CalendarIcon, label: "Time", value: timeLabel },
                { icon: CreditCard, label: "Payment", value: formData.paymentType || "" },
              ];
              const filled = items.filter((item) => item.value).length;
              const price = selectedExamType ? formatMoney(examPriceInOrg(selectedExamType.price), orgCurrency) : null;
              const duration = selectedExamType ? selectedExamType.duration : 150;
              return (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[13px] font-semibold tracking-[0.1em] uppercase">Summary</h2>
                    <span className="font-mono text-xs text-[#B5B2A8]">
                      {filled}/{items.length} details
                    </span>
                  </div>

                  <ul className="flex flex-col gap-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.label} className="flex items-start gap-3 rounded-xl px-1 py-2">
                          <span
                            className={cn(
                              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                              item.value ? "bg-[#FAF9F5] text-[#1A1915]" : "bg-white/[0.06] text-[#8E8B82] ring-1 ring-white/10",
                            )}
                          >
                            {item.value ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : <Icon aria-hidden="true" className="size-3.5" />}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-xs text-[#B5B2A8]">{item.label}</span>
                            <span className={cn("text-sm wrap-break-word", item.value ? "text-[#FAF9F5]" : "text-[#8E8B82]")}>
                              {item.value || "Not set yet"}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {isBackdatedBooking && (
                    <div className="flex items-start gap-2 rounded-xl bg-[#E2B35A]/15 px-3 py-2.5 text-[#F3D79B] ring-1 ring-[#E2B35A]/30">
                      <History aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                      <p className="text-xs leading-relaxed">Backdated time: this logs an exam that already happened.</p>
                    </div>
                  )}

                  <div className="flex items-end justify-between gap-3 border-t border-white/10 pt-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-[#B5B2A8]">Price</span>
                      <span className="font-mono text-2xl tabular-nums">{price ?? "–"}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-[13px] text-[#C9C6BC]">
                      <Clock aria-hidden="true" className="size-3.5" />
                      {(duration / 60).toFixed(duration % 60 === 0 ? 0 : 1)} h
                    </span>
                  </div>

                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <button
                      type="button"
                      disabled={step === 1 || isBooking}
                      onClick={() => setStep((current) => Math.max(1, current - 1))}
                      className="h-12 rounded-full bg-white/[0.07] px-5 text-sm font-medium text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:pointer-events-none disabled:opacity-35"
                    >
                      Back
                    </button>
                    {step < 4 ? (
                      <button
                        type="button"
                        disabled={!isStepValid() || isContinueLoading}
                        aria-busy={isContinueLoading}
                        onClick={() => setStep((current) => Math.min(4, current + 1))}
                        className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#FAF9F5] px-6 text-sm font-semibold text-[#1A1915] transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-40"
                      >
                        {isContinueLoading ? (
                          <>
                            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                            Checking…
                          </>
                        ) : (
                          <>Continue to {STEP_LABELS[step].toLowerCase()}</>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBooking || !isStepValid()}
                        aria-busy={isBooking}
                        onClick={() => void handleComplete()}
                        className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-[#1A1915] transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
                      >
                        {isBooking ? (
                          <>
                            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                            Booking…
                          </>
                        ) : isBackdatedBooking ? (
                          "Confirm backdated booking"
                        ) : (
                          "Confirm booking"
                        )}
                      </button>
                    )}
                  </div>
                  {step < 4 && !isStepValid() && !isContinueLoading ? (
                    <p className="-mt-2 text-center text-xs text-[#8E8B82]">Complete this step to continue</p>
                  ) : null}
                </div>
              );
            })()}
          </GlowPanel>
        </aside>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-[#F7F6F1] px-4 py-3.5 dark:bg-muted/50">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="text-[15px] font-medium text-foreground">{value}</p>
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
