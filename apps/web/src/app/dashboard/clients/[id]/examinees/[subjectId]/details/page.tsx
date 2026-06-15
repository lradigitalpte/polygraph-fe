"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
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
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { ENGLISH_PROFICIENCY_LEVELS, formatSubjectCode, updateSubject } from "@/lib/subjects";

const labelClass = "text-xs font-bold uppercase tracking-wider text-muted-foreground";

export default function ExamineeDetailsPage() {
  const { subject, loading, error, refresh, setSubjectRecord } = useSubjectDetail();
  const [saving, setSaving] = React.useState(false);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [nationality, setNationality] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [employeeRef, setEmployeeRef] = React.useState("");
  const [spokenLanguage, setSpokenLanguage] = React.useState("");
  const [writtenLanguage, setWrittenLanguage] = React.useState("");
  const [englishProficiency, setEnglishProficiency] = React.useState("");
  const [interpreterRequired, setInterpreterRequired] = React.useState(false);

  React.useEffect(() => {
    if (!subject) return;
    setFirstName(subject.first_name);
    setLastName(subject.last_name);
    setGender(subject.gender ?? "");
    setEmail(subject.email ?? "");
    setPhone(subject.phone ?? "");
    setEmployeeRef(subject.employee_ref ?? "");
    setNationality(subject.nationality ?? "");
    setSpokenLanguage(subject.spoken_language ?? "");
    setWrittenLanguage(subject.written_language ?? "");
    setEnglishProficiency(subject.english_proficiency ?? "");
    setInterpreterRequired(subject.interpreter_required ?? false);
  }, [subject]);

  const handleSave = async () => {
    if (!subject) return;
    setSaving(true);
    try {
      const updated = await updateSubject(subject.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        employee_ref: employeeRef,
        gender,
        nationality,
        spoken_language: spokenLanguage,
        written_language: writtenLanguage,
        english_proficiency: englishProficiency,
        interpreter_required: interpreterRequired,
      });
      setSubjectRecord(updated);
      toast.success("Examinee profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
      </div>
    );
  }

  if (error || !subject) {
    return <p className="text-destructive">{error || "Examinee not found"}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Personal details</h2>
        <p className="text-sm text-muted-foreground">
          Examinee {formatSubjectCode(subject.id)} — identification for forensic records.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
          <CardDescription>Information for this person being tested.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className={labelClass}>First name</Label>
            <Input className="h-11 rounded-xl" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Last name</Label>
            <Input className="h-11 rounded-xl" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className={labelClass}>Email</Label>
            <Input className="h-11 rounded-xl" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Phone</Label>
            <Input className="h-11 rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Employee / ref ID</Label>
            <Input className="h-11 rounded-xl" value={employeeRef} onChange={(e) => setEmployeeRef(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Gender</Label>
            <Select value={gender || "unset"} onValueChange={(v) => setGender(v === "unset" ? "" : String(v))}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Not specified</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Nationality</Label>
            <Input className="h-11 rounded-xl" value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Spoken language</Label>
            <Input className="h-11 rounded-xl" value={spokenLanguage} onChange={(e) => setSpokenLanguage(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Written language</Label>
            <Input className="h-11 rounded-xl" value={writtenLanguage} onChange={(e) => setWrittenLanguage(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Language &amp; communication</CardTitle>
          <CardDescription>
            How well the examinee speaks and understands English — examiners use this to decide
            whether the test runs in English or needs an interpreter.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className={labelClass}>English proficiency</Label>
            <Select
              value={englishProficiency || "unset"}
              onValueChange={(v) => setEnglishProficiency(v === "unset" ? "" : String(v))}
            >
              <SelectTrigger className="h-11 rounded-xl">
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
          <div className="space-y-2 sm:col-span-2">
            <Label
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 cursor-pointer"
            >
              <Checkbox
                checked={interpreterRequired}
                onCheckedChange={(checked) => setInterpreterRequired(checked === true)}
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-semibold normal-case tracking-normal text-foreground">
                  Interpreter required
                </span>
                <span className="block text-xs font-normal normal-case tracking-normal text-muted-foreground">
                  Flag if a translator must be booked for this examinee&apos;s session.
                </span>
              </span>
            </Label>
          </div>
        </CardContent>
      </Card>

      <Button className="gap-2 rounded-xl" onClick={() => void handleSave()} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save examinee
      </Button>
    </div>
  );
}
