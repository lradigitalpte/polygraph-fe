"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeadAPI, type LeadRecord, type LeadSource } from "@/lib/leads";
import { fetchExamTypes, type ExamTypeRecord } from "@/lib/exam-booking";
import { 
  ArrowLeft, 
  Target, 
  User, 
  Phone, 
  Mail, 
  CheckCircle2,
  Zap,
  Info,
  DollarSign,
  Clock3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const sourceOptions: LeadSource[] = ["Instagram", "Facebook", "LinkedIn", "Referral", "Website", "Phone", "Walk-in"];

const fallbackInterestOptions = [
  "Pre-employment Polygraph",
  "Specific Issue Investigation",
  "Relationship Testing",
  "Periodic Testing",
  "Corporate Investigation",
  "General Inquiry",
] as const;

type LeadFormState = {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  interest: string;
  notes: string;
  estimatedValue: string;
  preferredContact: LeadRecord["preferredContact"];
  priority: LeadRecord["priority"];
  nextStep: string;
};

const initialFormState: LeadFormState = {
  name: "",
  phone: "",
  email: "",
  source: "Instagram",
  interest: fallbackInterestOptions[0],
  notes: "",
  estimatedValue: "450",
  preferredContact: "Phone",
  priority: "Standard",
  nextStep: "Contact lead and confirm intake details.",
};

export default function NewLeadPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<LeadFormState>(initialFormState);
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [isExamTypesLoading, setIsExamTypesLoading] = React.useState(true);
  const [examTypesError, setExamTypesError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadExamTypes() {
      setIsExamTypesLoading(true);
      setExamTypesError(null);
      try {
        const records = await fetchExamTypes();
        const activeTypes = records.filter((record) => record.active);

        if (cancelled) {
          return;
        }

        setExamTypes(activeTypes);

        if (activeTypes.length > 0) {
          setForm((current) => {
            const selectedType = activeTypes.find((item) => item.name === current.interest);
            const defaultType = selectedType ?? activeTypes[0];

            return {
              ...current,
              interest: defaultType.name,
              estimatedValue: String(Math.round(defaultType.price ?? 0)),
            };
          });
        }
      } catch (error) {
        if (!cancelled) {
          setExamTypesError(error instanceof Error ? error.message : "Failed to load exam types.");
        }
      } finally {
        if (!cancelled) {
          setIsExamTypesLoading(false);
        }
      }
    }

    void loadExamTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  const completion = React.useMemo(() => {
    const requiredFields = [form.name, form.email, form.phone, form.interest, form.notes, form.nextStep];
    const completedFields = requiredFields.filter((field) => field.trim().length > 0).length;
    return Math.round((completedFields / requiredFields.length) * 100);
  }, [form]);

  const updateField = <K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const availableInterestOptions = React.useMemo(() => {
    if (examTypes.length > 0) {
      return examTypes.map((item) => item.name);
    }

    return [...fallbackInterestOptions];
  }, [examTypes]);

  const selectedExamType = React.useMemo(
    () => examTypes.find((item) => item.name === form.interest),
    [examTypes, form.interest]
  );

  const handleInterestChange = (value: unknown) => {
    const selectedValue = String(value ?? "");
    const match = examTypes.find((item) => item.name === selectedValue);
    if (match) {
      setForm((current) => ({
        ...current,
        interest: match.name,
        estimatedValue: String(Math.round(match.price ?? 0)),
      }));
      return;
    }

    updateField("interest", selectedValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitError(null);

    try {
      await createLeadAPI({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        source: form.source,
        interest: form.interest.trim(),
        notes: form.notes.trim(),
        estimatedValue: Number(form.estimatedValue) || 0,
        preferredContact: form.preferredContact,
        priority: form.priority,
        nextStep: form.nextStep.trim(),
      });

      router.push("/dashboard/leads?created=1");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save lead. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 pb-20">
      {/* Navigation Header */}
      <div className="flex items-center justify-between gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.back()}
          className="rounded-xl font-bold text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all group"
        >
          <ArrowLeft className="mr-2 h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
          Back to Pipeline
        </Button>
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary/60">
          <Zap className="h-3 w-3" />
          Secure Intake Console
        </div>
      </div>

      <div className="space-y-2 text-center sm:text-left">
        <h1 className="flex items-center justify-center gap-4 text-4xl font-black tracking-tighter text-foreground sm:justify-start">
          Manual Lead Intake
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        </h1>
        <p className="text-muted-foreground font-medium text-sm">
          Capture direct inquiries, assign value, and push qualified prospects into the lead pipeline.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 xl:grid-cols-[1.3fr_0.8fr]">
        <div className="space-y-6">
          <Card className="border-border/50 shadow-2xl bg-card/30 backdrop-blur-xl rounded-[2rem] overflow-hidden border-t-primary/20">
            <CardHeader className="pb-4 border-b border-border/30 bg-muted/10">
              <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label htmlFor="full-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                  <Input 
                    id="full-name" 
                    placeholder="e.g. Victor Frankenstein" 
                    className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary focus:ring-primary/10 transition-all font-semibold"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Direct Phone</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    placeholder="+1 (555) 000-0000" 
                    className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary focus:ring-primary/10 transition-all font-semibold"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="v.frankenstein@ingolstadt.edu" 
                    className="h-12 pl-12 rounded-xl bg-background/50 border-border/50 focus:border-primary focus:ring-primary/10 transition-all font-semibold"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-6 pt-2 md:grid-cols-2">
                <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Initial Inquiry Source</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
                  {sourceOptions.map((source) => (
                    <div key={source} className="relative group">
                      <input 
                        type="radio" 
                        name="source" 
                        id={source} 
                        value={source} 
                        className="peer sr-only"
                        checked={form.source === source}
                        onChange={() => updateField("source", source)}
                      />
                      <label 
                        htmlFor={source}
                        className="flex flex-col items-center justify-center p-4 rounded-2xl bg-muted/20 border border-border/50 peer-checked:border-primary peer-checked:bg-primary/5 cursor-pointer transition-all hover:bg-muted/40"
                      >
                        <span className="text-[11px] font-black text-foreground/70 peer-checked:text-primary">{source}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                  <div className="space-y-2.5">
                    <Label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preferred Contact</Label>
                    <Select value={form.preferredContact} onValueChange={(value) => updateField("preferredContact", value as LeadRecord["preferredContact"])}>
                      <SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/50">
                        <SelectValue placeholder="Choose contact method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Phone">Phone</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="SMS">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2.5">
                    <Label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Priority</Label>
                    <Select value={form.priority} onValueChange={(value) => updateField("priority", value as LeadRecord["priority"])}>
                      <SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/50">
                        <SelectValue placeholder="Choose priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Priority">Priority</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-2xl bg-card/30 backdrop-blur-xl rounded-[2rem] overflow-hidden border-t-primary/20">
            <CardHeader className="pb-4 border-b border-border/30 bg-muted/10">
              <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Examination Interest
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <div className="space-y-2.5">
                <Label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type of Exam Requested</Label>
                <Select value={form.interest} onValueChange={handleInterestChange}>
                  <SelectTrigger className="h-12 rounded-xl bg-background/50 border-border/50">
                    <SelectValue placeholder="Select exam type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInterestOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isExamTypesLoading ? (
                  <p className="text-[10px] font-semibold text-muted-foreground">Loading exam types from backend...</p>
                ) : null}
                {!isExamTypesLoading && examTypes.length > 0 ? (
                  <p className="text-[10px] font-semibold text-muted-foreground">Pricing is synced from exam type configuration.</p>
                ) : null}
                {examTypesError ? (
                  <p className="text-[10px] font-semibold text-amber-600">{examTypesError} Using fallback exam list.</p>
                ) : null}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="estimated-value" className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estimated Value</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      id="estimated-value"
                      inputMode="numeric"
                      className="h-12 rounded-xl border-border/50 bg-background/50 pl-12 font-semibold transition-all focus:border-primary focus:ring-primary/10"
                      value={form.estimatedValue}
                      onChange={(e) => updateField("estimatedValue", e.target.value)}
                      readOnly={examTypes.length > 0}
                    />
                  </div>
                  {selectedExamType ? (
                    <p className="text-[10px] font-semibold text-muted-foreground">
                      {selectedExamType.duration} min • {selectedExamType.category || "General"}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="next-step" className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Immediate Next Step</Label>
                  <Input
                    id="next-step"
                    placeholder="Confirm budget and scheduling window"
                    className="h-12 rounded-xl border-border/50 bg-background/50 font-semibold transition-all focus:border-primary focus:ring-primary/10"
                    value={form.nextStep}
                    onChange={(e) => updateField("nextStep", e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Case Notes / Context</Label>
                <textarea 
                  id="notes"
                  className="w-full min-h-[120px] p-4 rounded-2xl bg-background/50 border border-border/50 focus:border-primary focus:ring-primary/10 focus:outline-none transition-all font-medium text-sm resize-none"
                  placeholder="Describe the context of the inquiry..."
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden rounded-[2rem] border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-2xl">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/70">Pipeline Preview</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">{form.name || "Unnamed Lead"}</h2>
                </div>
                <div className="rounded-full border border-primary/20 bg-background/70 px-3 py-2 text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Readiness</p>
                  <p className="text-lg font-black text-primary">{completion}%</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completion}%` }} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-border/50 bg-background/75 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Service</p>
                  <p className="mt-2 text-sm font-bold text-foreground">{form.interest}</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/75 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Projected Value</p>
                  <p className="mt-2 text-sm font-bold text-foreground">${Number(form.estimatedValue || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/75 p-4">
                  <Clock3 className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Next Move</p>
                    <p className="mt-1 text-xs font-bold text-foreground">{form.nextStep}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/75 p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Preferred Contact</p>
                    <p className="mt-1 text-xs font-bold text-foreground">{form.preferredContact}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/75 p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 text-amber-500" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Priority</p>
                    <p className="mt-1 text-xs font-bold text-foreground">{form.priority}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-2xl bg-primary/[0.02] backdrop-blur-xl rounded-[2rem] overflow-hidden sticky top-6">
            <CardHeader className="pb-4 bg-primary/5 border-b border-primary/10">
              <p className="text-[9px] font-black uppercase tracking-widest text-primary/60 mb-1">Actions</p>
              <CardTitle className="text-base font-black tracking-tight">Intake Completion</CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Save the lead, route it back to the dashboard, and keep the first follow-up attached to the record.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-background/50 border border-border/50">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-foreground">Verified Entry</p>
                    <p className="text-[9px] font-bold text-muted-foreground">{completion >= 100 ? "Required intake fields completed." : "Finish all required fields before routing to pipeline."}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-background/50 border border-border/50">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                    <Info className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-foreground">Next Action</p>
                    <p className="text-[9px] font-bold text-muted-foreground">Lead will appear at the top of the active pipeline with status set to New.</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-2 pb-8">
              {submitError && (
                <p className="w-full rounded-xl bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 border border-rose-500/20">
                  {submitError}
                </p>
              )}
              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]"
              >
                {isLoading ? "Recording Entry..." : "Record Lead Entry"}
              </Button>
              <Button 
                type="button"
                variant="ghost" 
                onClick={() => router.back()}
                className="w-full h-12 rounded-xl font-bold text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted/50"
              >
                Cancel
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
