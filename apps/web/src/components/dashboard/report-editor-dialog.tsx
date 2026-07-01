"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash,
  Loader2,
  FileSignature,
  Activity,
  HeartPulse,
  BrainCircuit,
  AlertCircle,
  Eye,
  FileText,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { fetchReport, saveDetailedReport, type StructuredReportData } from "@/lib/reports";

type ReportEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: number;
  subjectName: string;
  onSaveSuccess: () => void;
};

export function ReportEditorDialog({
  open,
  onOpenChange,
  examId,
  subjectName,
  onSaveSuccess,
}: ReportEditorDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Form states
  const [verdict, setVerdict] = React.useState<string>("NDI");
  const [purpose, setPurpose] = React.useState("");
  const [instrument, setInstrument] = React.useState("Lafayette LX6000");
  const [referenceNo, setReferenceNo] = React.useState("PIN/CONF/2026/001");
  const [examDate, setExamDate] = React.useState("4th May 2026");
  const [preTestPhaseText, setPreTestPhaseText] = React.useState("");
  const [preTestNotes, setPreTestNotes] = React.useState("");
  const [questions, setQuestions] = React.useState<{ text: string; answer: string; evaluation: string }[]>([]);
  const [examPhaseText, setExamPhaseText] = React.useState("During the examination phase, the relevant and comparison questions were administered to subject with a set of 4 relevant questions. His verbal responses to the relevant questions were as indicated:");
  const [limestoneNotes, setLimestoneNotes] = React.useState(
    "The examination was conducted with a Limestone Technologies Computerised Polygraph, recording the blood pressure, pulse rate, galvanic skin response and breathing pattern of the subject.\n\nFour polygrams, including 1 acquaintance and 3 official tests were recorded, and the process ended at about 15:35 hrs (Dubai Time)."
  );
  const [opinionPhaseText, setOpinionPhaseText] = React.useState("");
  const [postTestNotes, setPostTestNotes] = React.useState("");
  const [section4FollowUp, setSection4FollowUp] = React.useState("Nil");
  const [conclusion, setConclusion] = React.useState("");

  // Auto-refresh opinion statement text when subjectName or verdict changes
  React.useEffect(() => {
    if (!opinionPhaseText) {
      setOpinionPhaseText(
        `Based on the diagnostic evaluations and analysis of the polygrams, I am in the opinion that the examination on ${subjectName || "Candidate A"} as ${verdict === "DI" ? "Not Truthful" : "Truthful"}.`
      );
    }
  }, [verdict, subjectName]);

  // Load report on open
  React.useEffect(() => {
    if (!open || !examId) return;

    setLoading(true);
    fetchReport(examId)
      .then((report) => {
        if (report) {
          setVerdict(report.verdict);
          try {
            const parsed = JSON.parse(report.content) as StructuredReportData & {
              reference_no?: string;
              exam_date?: string;
              section_4_follow_up?: string;
              limestone_notes?: string;
              pre_test_phase_text?: string;
              exam_phase_text?: string;
              opinion_phase_text?: string;
            };
            setPurpose(parsed.purpose || "");
            setInstrument(parsed.instrument || "Lafayette LX6000");
            setPreTestNotes(parsed.pre_test_notes || "");
            setQuestions(parsed.questions || []);
            setPostTestNotes(parsed.post_test_notes || "");
            setConclusion(parsed.conclusion || "");
            
            // Set new fields
            setReferenceNo(parsed.reference_no || "PIN/CONF/2026/001");
            setExamDate(parsed.exam_date || "4th May 2026");
            setSection4FollowUp(parsed.section_4_follow_up || "Nil");
            setLimestoneNotes(
              parsed.limestone_notes ||
                "The examination was conducted with a Limestone Technologies Computerised Polygraph, recording the blood pressure, pulse rate, galvanic skin response and breathing pattern of the subject.\n\nFour polygrams, including 1 acquaintance and 3 official tests were recorded, and the process ended at about 15:35 hrs (Dubai Time)."
            );
            setPreTestPhaseText(
              parsed.pre_test_phase_text ||
                `On 04th May 2026 at about 14:00 hrs (Dubai Time), I commenced to administer a polygraph examination to the above subject.\n\nA screening polygraph test was administered as part of a pre-employment test for Company A.`
            );
            setExamPhaseText(
              parsed.exam_phase_text ||
                "During the examination phase, the relevant and comparison questions were administered to subject with a set of 4 relevant questions. His verbal responses to the relevant questions were as indicated:"
            );
            setOpinionPhaseText(
              parsed.opinion_phase_text ||
                `Based on the diagnostic evaluations and analysis of the polygrams, I am in the opinion that the examination on ${subjectName || "Candidate A"} as ${report.verdict === "DI" ? "Not Truthful" : "Truthful"}.`
            );
          } catch (e) {
            // Content was plain text fallback
            setConclusion(report.content || "");
            setPurpose("");
            setPreTestNotes("");
            setQuestions([]);
            setPostTestNotes("");
          }
        } else {
          // Defaults for new report
          setVerdict("NDI");
          setPurpose("Investigation of missing storage vault inventory");
          setInstrument("Lafayette LX6000");
          setReferenceNo("PIN/CONF/2026/001");
          setExamDate("4th May 2026");
          setSection4FollowUp("Nil");
          setPreTestNotes("Examinee physical and mental health assessed as fit for testing. Legal rights and examination consent form explained and signed.");
          setQuestions([
            { text: "Have you ever shared confidential company information with an unauthorized person?", answer: "No", evaluation: "No Reaction" },
            { text: "Have you stolen money, leads or any property from a company you worked for?", answer: "No", evaluation: "No Reaction" },
            { text: "Have you ever used company resources like leads or tools for your own personal gain or for someone else?", answer: "No", evaluation: "No Reaction" },
            { text: "Is your purpose in applying for this position to intentionally damage or undermine the company?", answer: "No", evaluation: "No Reaction" },
          ]);
          setLimestoneNotes(
            "The examination was conducted with a Limestone Technologies Computerised Polygraph, recording the blood pressure, pulse rate, galvanic skin response and breathing pattern of the subject.\n\nFour polygrams, including 1 acquaintance and 3 official tests were recorded, and the process ended at about 15:35 hrs (Dubai Time)."
          );
          setPreTestPhaseText(
            `On 04th May 2026 at about 14:00 hrs (Dubai Time), I commenced to administer a polygraph examination to the above subject.\n\nA screening polygraph test was administered as part of a pre-employment test for Company A.`
          );
          setExamPhaseText(
            "During the examination phase, the relevant and comparison questions were administered to subject with a set of 4 relevant questions. His verbal responses to the relevant questions were as indicated:"
          );
          setOpinionPhaseText(`Based on the diagnostic evaluations and analysis of the polygrams, I am in the opinion that the examination on ${subjectName || "Candidate A"} as Truthful.`);
          setPostTestNotes("Examinee cooperated and the test administration was as per procedure.");
          setConclusion("Analysis of the physiological records indicates no significant emotional or autonomic nervous system reactions to target items.");
        }
      })
      .catch((err) => {
        toast.error("Failed to load report data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, examId, subjectName]);

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, { text: "", answer: "No", evaluation: "No Reaction" }]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: "text" | "answer" | "evaluation", value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  const handleSave = async () => {
    if (!verdict) {
      toast.error("Please select a verdict");
      return;
    }
    if (!conclusion.trim()) {
      toast.error("Please fill in the professional conclusion");
      return;
    }

    setSaving(true);
    try {
      const data: StructuredReportData & {
        reference_no: string;
        exam_date: string;
        section_4_follow_up: string;
        limestone_notes: string;
        pre_test_phase_text: string;
        exam_phase_text: string;
        opinion_phase_text: string;
      } = {
        purpose,
        instrument,
        pre_test_notes: preTestNotes,
        questions,
        post_test_notes: postTestNotes,
        conclusion,
        reference_no: referenceNo,
        exam_date: examDate,
        section_4_follow_up: section4FollowUp,
        limestone_notes: limestoneNotes,
        pre_test_phase_text: preTestPhaseText,
        exam_phase_text: examPhaseText,
        opinion_phase_text: opinionPhaseText,
      };

      await saveDetailedReport(examId, verdict, data);
      toast.success("Detailed report compiled and locked successfully!");
      onSaveSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to compile report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] rounded-[2.5rem] border-border/50 max-h-[90vh] overflow-hidden flex flex-col p-0 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="p-6 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                <FileSignature className="h-6 w-6 text-primary" />
                Polygraph Forensic Report Builder
              </DialogTitle>
              <DialogDescription className="font-semibold text-sm mt-1">
                Configure report sections on the left and preview the official formatted template on the right.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center flex-1 py-32">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* Left Column: Form Editor (Scrollable) */}
            <div className="lg:col-span-5 border-r border-border/40 overflow-y-auto p-6 space-y-6 max-h-[calc(90vh-140px)]">
              <h3 className="text-sm font-black uppercase tracking-wider text-primary border-b border-primary/20 pb-2">
                Report Parameters
              </h3>

              {/* Ref & Date & Verdict */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ref-no" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Our Reference</Label>
                  <Input
                    id="ref-no"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="h-10 rounded-xl bg-card border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exam Date</Label>
                  <Input
                    id="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="h-10 rounded-xl bg-card border-border/50"
                  />
                </div>
              </div>

              {/* Verdict Selector */}
              <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/[0.02] p-4">
                <Label className="font-bold flex items-center gap-1.5 text-primary text-xs uppercase tracking-wider mb-2">
                  <BrainCircuit className="h-4 w-4" /> Final Evaluation Verdict
                </Label>
                <Select value={verdict} onValueChange={(val) => setVerdict(String(val))}>
                  <SelectTrigger className="rounded-xl h-11 bg-background">
                    <SelectValue placeholder="Select verdict..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="NDI">No Deception Indicated (NDI) / Truthful</SelectItem>
                    <SelectItem value="DI">Deception Indicated (DI) / Not Truthful</SelectItem>
                    <SelectItem value="Inconclusive">Inconclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Section 1: Pre-Examination */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Section 1: Pre-Test Details</h4>
                <div className="space-y-2">
                  <Label htmlFor="pretest-intro" className="text-xs text-muted-foreground font-semibold">Introductory Paragraph</Label>
                  <Textarea
                    id="pretest-intro"
                    rows={3}
                    value={preTestPhaseText}
                    onChange={(e) => setPreTestPhaseText(e.target.value)}
                    placeholder="On 04th May 2026 at about 14:00 hrs..."
                    className="rounded-xl text-xs bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pretest-notes" className="text-xs text-muted-foreground font-semibold">Consent & Health Statements</Label>
                  <Textarea
                    id="pretest-notes"
                    rows={2}
                    value={preTestNotes}
                    onChange={(e) => setPreTestNotes(e.target.value)}
                    placeholder="Examinee physical and mental health assessed as fit..."
                    className="rounded-xl text-xs bg-card"
                  />
                </div>
              </div>

              {/* Section 2: Questions Table */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Activity className="h-4 w-4" /> Section 2: Questions asked
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs gap-1.5 h-8"
                    onClick={handleAddQuestion}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Question
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exam-intro" className="text-xs text-muted-foreground font-semibold font-bold">Introductory statement</Label>
                  <Textarea
                    id="exam-intro"
                    rows={2}
                    value={examPhaseText}
                    onChange={(e) => setExamPhaseText(e.target.value)}
                    className="rounded-xl text-xs bg-card"
                  />
                </div>

                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 p-3 rounded-2xl border border-border/40 bg-card relative"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase text-primary">Question #{idx + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg hover:bg-rose-500/10 hover:text-rose-500"
                          onClick={() => handleRemoveQuestion(idx)}
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Type question text..."
                        value={q.text}
                        onChange={(e) => handleQuestionChange(idx, "text", e.target.value)}
                        className="h-9 rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground uppercase font-bold">Answer</Label>
                          <Select
                            value={q.answer}
                            onValueChange={(val) => handleQuestionChange(idx, "answer", String(val))}
                          >
                            <SelectTrigger className="h-8 rounded-lg text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg">
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground uppercase font-bold">Evaluation</Label>
                          <Select
                            value={q.evaluation}
                            onValueChange={(val) => handleQuestionChange(idx, "evaluation", String(val))}
                          >
                            <SelectTrigger className="h-8 rounded-lg text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg">
                              <SelectItem value="No Reaction">No Reaction</SelectItem>
                              <SelectItem value="Reaction / Deceptive">Reaction / Deceptive</SelectItem>
                              <SelectItem value="Inconclusive">Inconclusive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limestone" className="text-xs text-muted-foreground font-semibold">Instrument & Recording statement</Label>
                  <Textarea
                    id="limestone"
                    rows={3}
                    value={limestoneNotes}
                    onChange={(e) => setLimestoneNotes(e.target.value)}
                    className="rounded-xl text-xs bg-card"
                  />
                </div>
              </div>

              {/* Section 3: Opinion */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Section 3: Opinion & Verdict details</h4>
                <div className="space-y-2">
                  <Label htmlFor="opinion-statement" className="text-xs text-muted-foreground font-semibold">Opinion notes</Label>
                  <Textarea
                    id="opinion-statement"
                    rows={3}
                    value={opinionPhaseText}
                    onChange={(e) => setOpinionPhaseText(e.target.value)}
                    placeholder="Based on diagnostic evaluations..."
                    className="rounded-xl text-xs bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-notes" className="text-xs text-muted-foreground font-semibold">Post-Test Statement</Label>
                  <Textarea
                    id="post-notes"
                    rows={2}
                    value={postTestNotes}
                    onChange={(e) => setPostTestNotes(e.target.value)}
                    placeholder="Examinee cooperated..."
                    className="rounded-xl text-xs bg-card"
                  />
                </div>
              </div>

              {/* Section 4: Follow up */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Section 4: Follow Up</h4>
                <div className="space-y-2">
                  <Label htmlFor="follow-up" className="text-xs text-muted-foreground font-semibold">Requesting Agency Follow-up</Label>
                  <Input
                    id="follow-up"
                    value={section4FollowUp}
                    onChange={(e) => setSection4FollowUp(e.target.value)}
                    className="h-10 rounded-xl bg-card border-border/50 text-xs"
                  />
                </div>
              </div>

              {/* Professional Conclusion */}
              <div className="space-y-2">
                <Label htmlFor="conclusion" className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-primary shrink-0" /> Conclusion Text Paragraph
                </Label>
                <Textarea
                  id="conclusion"
                  placeholder="Write the comprehensive conclusion text..."
                  rows={3}
                  className="rounded-xl text-xs bg-card border-primary/20"
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value)}
                />
              </div>
            </div>

            {/* Right Column: Live A4 Document Preview */}
            <div className="lg:col-span-7 bg-zinc-950/40 p-8 overflow-y-auto max-h-[calc(90vh-140px)] flex flex-col items-center">
              <div className="sticky top-0 w-full flex justify-between items-center mb-4 z-10 bg-zinc-900/60 backdrop-blur px-4 py-2.5 rounded-2xl border border-border/40">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary" /> Live Document Preview
                </span>
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">
                  A4 Ratio Print Simulated
                </span>
              </div>

              {/* Visual Preview Template Page 1 */}
              <div className="w-[210mm] min-h-[297mm] bg-white text-zinc-900 p-[20mm] shadow-2xl relative flex flex-col justify-between text-[11px] leading-relaxed select-none mb-8 border border-zinc-200">
                {/* Header */}
                <div>
                  <div className="flex justify-between items-end border-b-2 border-zinc-200 pb-2">
                    <div className="flex items-center gap-2">
                      <img src="/logo.png" alt="Polygraph UAE" className="h-10 object-contain" />
                      <div className="flex flex-col">
                        <span className="text-sm font-black tracking-tight text-red-600">POLYGRAPH UAE</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">STAFF IN CONFIDENCE</span>
                  </div>

                  {/* Examinee info */}
                  <div className="mt-8 space-y-3">
                    <h3 className="font-black text-xs uppercase tracking-wider border-b border-zinc-300 pb-1 text-zinc-800">
                      EXAMINEE INFORMATION
                    </h3>
                    <div className="grid grid-cols-12 text-[10px]">
                      <div className="col-span-3 font-bold text-zinc-500 uppercase">OUR REF</div>
                      <div className="col-span-9 font-semibold text-zinc-900">: {referenceNo}</div>
                    </div>
                    <div className="grid grid-cols-12 text-[10px]">
                      <div className="col-span-3 font-bold text-zinc-500 uppercase">DATE</div>
                      <div className="col-span-9 font-semibold text-zinc-900">: {examDate}</div>
                    </div>
                    <div className="grid grid-cols-12 text-[10px]">
                      <div className="col-span-3 font-bold text-zinc-500 uppercase">EXAMINEE</div>
                      <div className="col-span-9 font-black text-zinc-900">: {subjectName || "Candidate A"}</div>
                    </div>
                  </div>

                  {/* Section 1 */}
                  <div className="mt-8 space-y-3">
                    <h3 className="font-black text-xs uppercase tracking-wider border-b border-zinc-300 pb-1 text-zinc-800">
                      SECTION 1: PRE-EXAMINATION PHASE
                    </h3>
                    <p className="whitespace-pre-line text-zinc-700">
                      {preTestPhaseText || `On ${examDate} at about 14:00 hrs (Dubai Time), I commenced to administer a polygraph examination to the above subject.\n\nA screening polygraph test was administered as part of a pre-employment test for Company A.`}
                    </p>
                    <p className="whitespace-pre-line text-zinc-700 italic">
                      {preTestNotes}
                    </p>
                  </div>

                  {/* Section 2 */}
                  <div className="mt-8 space-y-3">
                    <h3 className="font-black text-xs uppercase tracking-wider border-b border-zinc-300 pb-1 text-zinc-800">
                      SECTION 2: EXAMINATION PHASE
                    </h3>
                    <p className="text-zinc-700 whitespace-pre-line">
                      {examPhaseText}
                    </p>

                    {/* Table */}
                    {questions.length > 0 && (
                      <table className="w-full text-left border-collapse border border-zinc-300 mt-2">
                        <thead>
                          <tr className="bg-zinc-50 text-[8px] font-black uppercase text-zinc-500 tracking-wider border-b border-zinc-300">
                            <th className="border border-zinc-300 px-3 py-1.5 w-12 text-center">S/N</th>
                            <th className="border border-zinc-300 px-3 py-1.5">Questions</th>
                            <th className="border border-zinc-300 px-3 py-1.5 w-36 text-center">Examinee Response</th>
                          </tr>
                        </thead>
                        <tbody>
                          {questions.map((q, idx) => (
                            <tr key={idx} className="border-b border-zinc-200">
                              <td className="border border-zinc-300 px-3 py-2 text-center font-semibold text-zinc-500">{idx + 1}</td>
                              <td className="border border-zinc-300 px-3 py-2 text-zinc-700 italic font-medium">{q.text || "—"}</td>
                              <td className="border border-zinc-300 px-3 py-2 text-center font-black text-zinc-900">{q.answer}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Footer page 1 */}
                <div className="border-t border-zinc-200 pt-6 mt-8 space-y-4">
                  <div className="flex justify-center items-center gap-8">
                    <img src="/americanpolygraphassociation.png" alt="APA" className="h-10 w-10 object-contain grayscale opacity-80" />
                    <img src="/singaporeassociationofpolygraph.jfif" alt="SAP" className="h-8 w-16 object-contain grayscale opacity-80" />
                  </div>
                  <div className="text-[7.5px] text-zinc-400 text-center space-y-1 font-semibold">
                    <p>Polygraph International HR Consultancy LLC | Office 401-41, Deyaar building, Al Barsha 1, Dubai, United Arab Emirates</p>
                    <p>Website: www.polygraph.ae | Email: info@polygraph.ae</p>
                    <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mt-2">STAFF IN CONFIDENCE</p>
                  </div>
                </div>
              </div>

              {/* Visual Preview Template Page 2 */}
              <div className="w-[210mm] min-h-[297mm] bg-white text-zinc-900 p-[20mm] shadow-2xl relative flex flex-col justify-between text-[11px] leading-relaxed select-none border border-zinc-200">
                <div>
                  {/* Header page 2 */}
                  <div className="flex justify-between items-end border-b-2 border-zinc-200 pb-2">
                    <div className="flex items-center gap-2">
                      <img src="/logo.png" alt="Polygraph UAE" className="h-10 object-contain" />
                      <div className="flex flex-col">
                        <span className="text-sm font-black tracking-tight text-red-600">POLYGRAPH UAE</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">STAFF IN CONFIDENCE</span>
                  </div>

                  {/* Section 2 continuation */}
                  <div className="mt-8 space-y-3">
                    <p className="text-zinc-700 whitespace-pre-line">
                      {limestoneNotes}
                    </p>
                  </div>

                  {/* Section 3 */}
                  <div className="mt-8 space-y-3">
                    <h3 className="font-black text-xs uppercase tracking-wider border-b border-zinc-300 pb-1 text-zinc-800">
                      SECTION 3: OPINION OF EXAMINER
                    </h3>
                    <p className="whitespace-pre-line text-zinc-700">
                      {opinionPhaseText || `Based on the diagnostic evaluations and analysis of the polygrams, I am in the opinion that the examination on ${subjectName || "Candidate A"} as ${verdict === "DI" ? "Not Truthful" : "Truthful"}.`}
                    </p>
                    <p className="text-zinc-700">
                      {postTestNotes}
                    </p>
                    <div className="flex items-center gap-2 mt-4 pt-2">
                      <span className="font-black text-xs uppercase text-zinc-800">Result:</span>
                      <span className={`font-black text-xs uppercase ${verdict === "DI" ? "text-red-600" : verdict === "NDI" ? "text-emerald-600" : "text-zinc-500"}`}>
                        {verdict === "DI" ? "NOT TRUTHFUL" : verdict === "NDI" ? "TRUTHFUL / NO DECEPTION INDICATED" : "INCONCLUSIVE"}
                      </span>
                    </div>
                  </div>

                  {/* Section 4 */}
                  <div className="mt-8 space-y-3">
                    <h3 className="font-black text-xs uppercase tracking-wider border-b border-zinc-300 pb-1 text-zinc-800">
                      SECTION 4: FOLLOW-UP BY REQUESTING AGENCY
                    </h3>
                    <p className="text-zinc-700 font-semibold italic">
                      {section4FollowUp}
                    </p>
                  </div>

                  {/* Professional Conclusion Panel */}
                  <div className="mt-8 space-y-3 border-l-4 border-primary/20 bg-zinc-50 p-4 rounded-xl">
                    <h4 className="font-black text-xs uppercase text-zinc-800 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-zinc-600" /> Professional Findings Summary
                    </h4>
                    <p className="text-zinc-600 whitespace-pre-line">
                      {conclusion || "Analysis of the physiological records indicates..."}
                    </p>
                  </div>
                </div>

                {/* Footer page 2 */}
                <div className="border-t border-zinc-200 pt-6 mt-8 space-y-4">
                  <div className="flex justify-center items-center gap-8">
                    <img src="/americanpolygraphassociation.png" alt="APA" className="h-10 w-10 object-contain grayscale opacity-80" />
                    <img src="/singaporeassociationofpolygraph.jfif" alt="SAP" className="h-8 w-16 object-contain grayscale opacity-80" />
                  </div>
                  <div className="text-[7.5px] text-zinc-400 text-center space-y-1 font-semibold">
                    <p>Polygraph International HR Consultancy LLC | Office 401-41, Deyaar building, Al Barsha 1, Dubai, United Arab Emirates</p>
                    <p>Website: www.polygraph.ae | Email: info@polygraph.ae</p>
                    <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mt-2">STAFF IN CONFIDENCE</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="p-6 border-t border-border/40 gap-3 bg-card/10 shrink-0">
          <Button variant="outline" className="rounded-xl h-12 px-6 hover:bg-muted/50" onClick={() => onOpenChange(false)}>
            Close / Draft
          </Button>
          <Button
            className="rounded-xl font-bold gap-2 h-12 px-8 bg-primary hover:scale-[1.02] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all text-primary-foreground"
            onClick={() => void handleSave()}
            disabled={saving || loading}
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-1" />
                Compiling Report...
              </>
            ) : (
              <>
                <Printer className="h-5 w-5 mr-1" />
                Save & Compile Report PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
