"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users,
  CalendarDays,
  FileCheck,
  Map,
  BadgeAlert,
  FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { type ClientRecord, fetchClients } from "@/lib/clients";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import {
  bulkSchedule,
  bulkImportHistorical,
  fetchExamTypes,
  type BulkScheduleRow,
  type BulkImportHistoricalRow,
  type ExamTypeRecord,
} from "@/lib/exam-booking";

// ─── CSV templates ──────────────────────────────────────────────────────────

const CSV_TEMPLATE = `first_name,last_name,email,phone,employee_ref
Jane,Doe,jane@example.com,+971-50-0001,EMP-001
John,Smith,john@example.com,+971-50-0002,EMP-002`;

const HISTORICAL_CSV_TEMPLATE_INDIVIDUAL = `SN,NAME,PHONE NUMBER,GENDER,CASE,EXPERIENCE,LANGUAGE,DATE,TIME,STATUS,RESULTS,REMARK
1,Connor Thomson,-,Male,Infidelity,-,English,2-Feb-2026,1830hrs,COMPLETED,Available,DXB-WI204/2026
2,Tony Mcnamara,-,Male,Infidelity,-,English,2-Feb-2026,1430hrs,COMPLETED,Available,DXB-WI0205/2026`;

const HISTORICAL_CSV_TEMPLATE_CORPORATE = `SN,NAME,PHONE NUMBER,POSITION,GENDER,EXPERIENCE,LANGUAGE,DATE,TIME,MAIL,STATUS,RESULTS,REMARK
1,Asakura Atsuko,+819050454527,Conversion with exp,Female,Yes,English,6-Jan-2026,1030hrs,SENT,Completed,AVAILABLE,DXB0182/2026
2,Omar Gaber,+995557543627,Retention with exp,Male,Yes,English,9-Jan-2026,1030hrs,SENT,Completed,Failed,DXB0194/2026
3,Lesi Yuliasari,+905445469424,Conversion with exp,Female,Yes,English,20-Feb-2026,1100hrs,-,no show,-,-`;

function parseMailColumn(val: string): { email: string; mailStatus: string } {
  const clean = (val || "").trim();
  if (!clean || clean === "-") return { email: "", mailStatus: "" };
  const lower = clean.toLowerCase();
  if (lower === "sent" || lower === "mailed") {
    return { email: "", mailStatus: "sent" };
  }
  if (clean.includes("@")) return { email: clean, mailStatus: "" };
  return { email: "", mailStatus: clean };
}

function isLegendOrHeaderRow(cols: string[], rawLower: string): boolean {
  const joined = cols.join(" ").toLowerCase();
  if (
    joined.includes("legend") ||
    joined.includes("colour") ||
    joined.includes("color") ||
    joined.includes("meaning") ||
    joined.includes("passed stest") ||
    joined.includes("passed test") ||
    joined.includes("failed test") ||
    joined.includes("yet to take") ||
    joined.includes("no show") && joined.includes("red") ||
    joined.includes("re-test") && joined.includes("purple")
  ) {
    return true;
  }
  const first = (cols[0] || "").toLowerCase();
  if (first === "sn" || first === "s/n" || first === "name") return true;
  if (rawLower.includes("phone number") && rawLower.includes("gender")) return true;
  return false;
}

// ─── CSV/TSV helpers ────────────────────────────────────────────────────────

function parseCsvRows(text: string): ExamineeRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Detect separator: comma, tab (copy/paste from Excel), or semicolon
  let separator = ",";
  const sampleLine = lines[0];
  if (sampleLine.includes("\t")) {
    separator = "\t";
  } else if (sampleLine.includes(";")) {
    separator = ";";
  }

  const headerLine = lines[0].toLowerCase();
  const hasHeader = headerLine.includes("first_name") || headerLine.includes("name") || headerLine.includes("first");
  
  let header: string[] = [];
  let startIndex = 0;
  if (hasHeader) {
    header = lines[0].toLowerCase().split(separator).map((h) => h.trim());
    startIndex = 1;
  }

  const idx = (n: string) => header.indexOf(n);
  return lines.slice(startIndex).map((line, i) => {
    const cols = line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ""));
    const getCol = (name: string, defaultIdx: number) => {
      const colIndex = idx(name);
      if (colIndex !== -1 && colIndex < cols.length) return cols[colIndex];
      if (defaultIdx < cols.length) return cols[defaultIdx];
      return "";
    };

    return {
      _key: `csv-${i}-${Date.now()}`,
      first_name: getCol("first_name", 0),
      last_name: getCol("last_name", 1),
      email: getCol("email", 2),
      phone: getCol("phone", 3),
      employee_ref: getCol("employee_ref", 4),
      offset_minutes: 0,
    };
  });
}

interface RawHistoricalRow {
  first_name: string;
  last_name: string;
  phone: string;
  employee_ref: string;
  serial_no: string;
  position: string;
  case_label: string;
  date_str: string;
  time_str: string;
  status: string;
  legacy_results: string;
  gender: string;
  experience: string;
  language: string;
  email: string;
  legacy_mail_status: string;
}

function detectCsvSeparator(lines: string[]): string {
  let tabCount = 0;
  let commaCount = 0;
  for (const line of lines.slice(0, 20)) {
    tabCount += (line.match(/\t/g) || []).length;
    commaCount += (line.match(/,/g) || []).length;
  }
  if (tabCount > commaCount) return "\t";
  if (commaCount > 0) return ",";
  return ";";
}

function splitCsvLine(line: string, separator: string): string[] {
  return line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ""));
}

type ImportLayoutMode = "corporate" | "individual";

type HistoricalColumnMap = {
  snIdx: number;
  nameIdx: number;
  phoneIdx: number;
  genderIdx: number;
  caseIdx: number;
  experienceIdx: number;
  languageIdx: number;
  dateIdx: number;
  timeIdx: number;
  mailIdx: number;
  statusIdx: number;
  resultsIdx: number;
  remarkIdx: number;
};

/** Individual walk-ins: SN, NAME, PHONE, GENDER, CASE, … (no MAIL column) */
const INDIVIDUAL_COLUMN_MAP: HistoricalColumnMap = {
  snIdx: 0,
  nameIdx: 1,
  phoneIdx: 2,
  genderIdx: 3,
  caseIdx: 4,
  experienceIdx: 5,
  languageIdx: 6,
  dateIdx: 7,
  timeIdx: 8,
  mailIdx: -1,
  statusIdx: 9,
  resultsIdx: 10,
  remarkIdx: 11,
};

/** Corporate roster: SN, NAME, PHONE, POSITION, GENDER, …, MAIL, STATUS, RESULTS, REMARK */
const CORPORATE_COLUMN_MAP: HistoricalColumnMap = {
  snIdx: 0,
  nameIdx: 1,
  phoneIdx: 2,
  caseIdx: 3,
  genderIdx: 4,
  experienceIdx: 5,
  languageIdx: 6,
  dateIdx: 7,
  timeIdx: 8,
  mailIdx: 9,
  statusIdx: 10,
  resultsIdx: 11,
  remarkIdx: 12,
};

function looksLikeSnDataRow(cols: string[]): boolean {
  if (cols.length < 8) return false;
  const sn = cols[0]?.trim() || "";
  const name = cols[1]?.trim() || "";
  return /^\d+$/.test(sn) && name.length >= 2;
}

function defaultColumnMapForMode(mode: ImportLayoutMode): HistoricalColumnMap {
  return mode === "corporate" ? { ...CORPORATE_COLUMN_MAP } : { ...INDIVIDUAL_COLUMN_MAP };
}

function buildColumnMapFromHeaders(headers: string[]): HistoricalColumnMap | null {
  const find = (pred: (h: string) => boolean) => headers.findIndex(pred);
  const nameIdx = find((h) => h === "name" || h === "full name" || h === "examinee");
  if (nameIdx === -1) return null;

  const snIdx = find((h) => h === "sn" || h === "s/n" || h.includes("serial"));
  const phoneIdx = find((h) => h.includes("phone") || h.includes("mobile"));
  const genderIdx = find((h) => h.includes("gender") || h === "sex");
  const caseIdx = find(
    (h) => h === "case" || h === "case type" || h.startsWith("case ") || h.endsWith(" case")
  );
  const positionIdx = find((h) => h.includes("position") || h.includes("job") || h.includes("role"));
  const experienceIdx = find((h) => h === "experience" || h.startsWith("exp"));
  const languageIdx = find((h) => h.includes("language") || h === "lang");
  const dateIdx = find((h) => h.includes("date"));
  const timeIdx = find((h) => h.includes("time"));
  const mailIdx = find((h) => h === "mail" || h === "email" || h === "e-mail");
  const statusIdx = find((h) => h === "status" || h.includes("session status"));
  const resultsIdx = find((h) => h === "results" || h.includes("result") || h.includes("verdict"));
  const remarkIdx = find(
    (h) => h === "remark" || h === "remarks" || h === "reference" || h === "ref no" || h === "ref"
  );

  return {
    snIdx,
    nameIdx,
    phoneIdx,
    genderIdx,
    caseIdx: caseIdx !== -1 ? caseIdx : positionIdx,
    experienceIdx,
    languageIdx,
    dateIdx,
    timeIdx,
    mailIdx,
    statusIdx,
    resultsIdx,
    remarkIdx,
  };
}

function parseRawHistoricalCsv(text: string, importMode: ImportLayoutMode = "individual"): RawHistoricalRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const separator = detectCsvSeparator(lines);

  let headerIndex = -1;
  let columnMap: HistoricalColumnMap | null = null;

  for (let i = 0; i < lines.length; i++) {
    const headers = splitCsvLine(lines[i], separator).map((h) => h.trim().toLowerCase());
    const map = buildColumnMapFromHeaders(headers);
    if (map) {
      headerIndex = i;
      columnMap = map;
      break;
    }
  }

  if (!columnMap) {
    for (let i = 0; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i], separator);
      if (looksLikeSnDataRow(cols)) {
        columnMap = defaultColumnMapForMode(importMode);
        headerIndex = i - 1;
        break;
      }
    }
  }

  if (!columnMap) {
    columnMap = defaultColumnMapForMode(importMode);
    headerIndex = -1;
  }

  const col = (cols: string[], idx: number) =>
    idx !== -1 && idx < cols.length ? cols[idx] : "";

  const results: RawHistoricalRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = splitCsvLine(rawLine, separator);
    if (cols.length < 2) continue;

    const rawLower = rawLine.toLowerCase();
    if (isLegendOrHeaderRow(cols, rawLower)) continue;

    let firstName = "";
    let lastName = "";
    const fullName = col(cols, columnMap.nameIdx);
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "Subject";
    }

    if (!firstName && !lastName) continue;

    if (
      firstName.toLowerCase().includes("legend") ||
      firstName.toLowerCase().includes("colour") ||
      firstName.toLowerCase() === "name" ||
      firstName.toLowerCase() === "sn" ||
      rawLower.includes("january") ||
      rawLower.includes("february") ||
      rawLower.includes("march") ||
      rawLower.includes("april") ||
      rawLower.includes("may") ||
      rawLower.includes("june") ||
      rawLower.includes("july") ||
      rawLower.includes("august") ||
      rawLower.includes("september") ||
      rawLower.includes("october") ||
      rawLower.includes("november") ||
      rawLower.includes("december")
    ) {
      continue;
    }

    if (/^\d+(st|nd|rd|th)$/i.test(firstName)) continue;

    const caseLabel =
      col(cols, columnMap.caseIdx) || "General Screening";
    const phone = col(cols, columnMap.phoneIdx);
    const gender = col(cols, columnMap.genderIdx);
    const experience = col(cols, columnMap.experienceIdx);
    const language = col(cols, columnMap.languageIdx);
    const dateStr = col(cols, columnMap.dateIdx);
    const timeStr = col(cols, columnMap.timeIdx);
    const mailRaw = col(cols, columnMap.mailIdx);
    const { email, mailStatus } = parseMailColumn(mailRaw);
    const statusVal = col(cols, columnMap.statusIdx) || "Completed";
    const resultVal = col(cols, columnMap.resultsIdx);
    const remarkVal = col(cols, columnMap.remarkIdx);
    const serialNo = col(cols, columnMap.snIdx) || cols[0] || "";

    results.push({
      first_name: firstName,
      last_name: lastName,
      phone: phone === "-" ? "" : phone,
      employee_ref: remarkVal === "-" ? "" : remarkVal,
      serial_no: serialNo,
      position: caseLabel,
      case_label: caseLabel,
      date_str: dateStr,
      time_str: timeStr,
      status: statusVal || "Completed",
      legacy_results: resultVal === "-" ? "" : resultVal,
      gender,
      experience: experience === "-" ? "" : experience,
      language: language === "-" ? "" : language,
      email,
      legacy_mail_status: mailStatus,
    });
  }

  return results;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ExamineeRow = {
  _key: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  employee_ref: string;
  offset_minutes: number;
};

type HistoricalExamineeRow = {
  _key: string;
  first_name: string;
  last_name: string;
  phone: string;
  employee_ref: string;
  serial_no: string;
  scheduled_at: string;
  status: string;
  legacy_results: string;
  legacy_mail_status: string;
  position: string;
  case_label: string;
  gender: string;
  experience: string;
  language: string;
  email: string;
};

function emptyRow(): ExamineeRow {
  return {
    _key: `row-${Date.now()}-${Math.random()}`,
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    employee_ref: "",
    offset_minutes: 0,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BatchIntakePage() {
  const router = useRouter();

  // Mode state
  const [isHistoricalMode, setIsHistoricalMode] = React.useState(false);
  const [importMode, setImportMode] = React.useState<"corporate" | "individual">("individual");

  // Config data loaded from backend APIs
  const [clients, setClients] = React.useState<ClientRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);

  // Form selections
  const [clientId, setClientId] = React.useState<string>("");
  const [examinerId, setExaminerId] = React.useState<string>("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("09:00");
  const [examTypeId, setExamTypeId] = React.useState("");
  const [paymentMode, setPaymentMode] = React.useState("Bank Transfer");
  const [notes, setNotes] = React.useState("");

  // Grid rows depending on mode
  const [rows, setRows] = React.useState<ExamineeRow[]>([emptyRow()]);
  const [histRows, setHistRows] = React.useState<HistoricalExamineeRow[]>([]);

  // Mapping state: maps spreadsheet position strings -> System Exam Type ID & Custom Price
  const [uniquePositions, setUniquePositions] = React.useState<string[]>([]);
  const [positionMapping, setPositionMapping] = React.useState<Record<string, string>>({});

  // UI state
  const [submitting, setSubmitting] = React.useState(false);
  const [csvText, setCsvText] = React.useState("");
  const [showCsvImport, setShowCsvImport] = React.useState(false);

  // File Upload refs & state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  // Load clients, examiners and exam types on mount
  React.useEffect(() => {
    Promise.all([fetchClients(), fetchExaminers(), fetchExamTypes()])
      .then(([c, e, t]) => {
        setClients(c);
        setExaminers(e);
        setExamTypes(t);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load system config"))
      .finally(() => setLoadingData(false));
  }, []);

  React.useEffect(() => {
    if (examTypes.length > 0 && !examTypeId) {
      setExamTypeId(String(examTypes[0].id));
    }
  }, [examTypes, examTypeId]);

  const selectedExamType = React.useMemo(
    () => examTypes.find((type) => String(type.id) === examTypeId),
    [examTypes, examTypeId],
  );

  // ── Row helpers ──────────────────────────────────────────────────────────

  function addRow() {
    if (isHistoricalMode) {
      setHistRows((prev) => [
        ...prev,
        {
          _key: `row-hist-${Date.now()}-${Math.random()}`,
          first_name: "",
          last_name: "",
          phone: "",
          employee_ref: "",
          serial_no: "",
          scheduled_at: new Date().toISOString(),
          status: "Completed",
          legacy_results: "",
          legacy_mail_status: "",
          position: uniquePositions[0] || "General Screening",
          case_label: uniquePositions[0] || "General Screening",
          gender: "Male",
          experience: "Yes",
          language: "English",
          email: "",
        },
      ]);
    } else {
      setRows((prev) => [...prev, emptyRow()]);
    }
  }

  function removeRow(key: string) {
    if (isHistoricalMode) {
      setHistRows((prev) => prev.filter((r) => r._key !== key));
    } else {
      setRows((prev) => prev.filter((r) => r._key !== key));
    }
  }

  function updateRow(key: string, field: string, value: string | number) {
    if (isHistoricalMode) {
      setHistRows((prev) =>
        prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
      );
    } else {
      setRows((prev) =>
        prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
      );
    }
  }

  const lastImportTextRef = React.useRef<string | null>(null);

  const applyHistoricalParse = React.useCallback(
    (text: string, mode: "corporate" | "individual", filename?: string, quiet = false) => {
      const parsedRaw = parseRawHistoricalCsv(text, mode);
      if (parsedRaw.length === 0) {
        if (!quiet) {
          toast.error(
            mode === "corporate"
              ? "No valid entries found. Expected columns: NAME, POSITION, DATE, STATUS…"
              : "No valid entries found. Expected columns: NAME, GENDER, CASE, DATE, STATUS…"
          );
        }
        return false;
      }

      lastImportTextRef.current = text;

      const positions = Array.from(new Set(parsedRaw.map((r) => r.position))).filter(Boolean);
      setUniquePositions(positions);

      const initialMap: Record<string, string> = {};
      positions.forEach((pos) => {
        const cleanPos = (pos || "General Screening").trim();
        const firstWord =
          cleanPos.split(" ")[0]?.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase() || "";

        const match =
          examTypes.find((t) => t.name.toLowerCase().includes(firstWord)) || examTypes[0];

        initialMap[cleanPos] = match ? String(match.id) : "";
      });
      setPositionMapping(initialMap);

      const convertedRows: HistoricalExamineeRow[] = parsedRaw.map((r, idx) => {
        let scheduledAt = new Date().toISOString();
        try {
          if (r.date_str) {
            const dParts = r.date_str.split("-");
            if (dParts.length === 3) {
              const day = dParts[0];
              const month = dParts[1];
              const year = dParts[2];

              let hours = "09";
              let minutes = "00";
              const cleanTime = r.time_str.replace("hrs", "").trim();
              if (cleanTime.length === 4) {
                hours = cleanTime.substring(0, 2);
                minutes = cleanTime.substring(2, 4);
              } else if (cleanTime.length === 3) {
                hours = "0" + cleanTime.substring(0, 1);
                minutes = cleanTime.substring(1, 3);
              }

              const dateObj = new Date(`${month} ${day}, ${year} ${hours}:${minutes}:00`);
              if (!isNaN(dateObj.getTime())) {
                scheduledAt = dateObj.toISOString();
              }
            }
          }
        } catch (e) {
          console.error(e);
        }

        return {
          _key: `csv-hist-${idx}-${Date.now()}`,
          first_name: r.first_name,
          last_name: r.last_name,
          phone: r.phone,
          employee_ref: r.employee_ref,
          serial_no: r.serial_no,
          scheduled_at: scheduledAt,
          status: r.status,
          legacy_results: r.legacy_results,
          legacy_mail_status: r.legacy_mail_status,
          position: r.position,
          case_label: r.case_label,
          gender: r.gender,
          experience: r.experience,
          language: r.language,
          email: r.email,
        };
      });

      setHistRows(convertedRows);
      setCsvText("");
      setShowCsvImport(false);
      if (!quiet) {
        toast.success(
          filename
            ? `Loaded ${convertedRows.length} rows from ${filename} (${mode === "corporate" ? "corporate" : "individual"} column layout)`
            : `Loaded ${convertedRows.length} rows using ${mode === "corporate" ? "corporate" : "individual"} columns. Map case types below.`
        );
      }
      return true;
    },
    [examTypes]
  );

  React.useEffect(() => {
    if (!isHistoricalMode || !lastImportTextRef.current) return;
    applyHistoricalParse(lastImportTextRef.current, importMode, undefined, true);
  }, [importMode, isHistoricalMode, applyHistoricalParse]);

  // Parses and populates CSV/TSV text into corresponding layout rows safely
  const handleParseAndLoad = (text: string, filename?: string) => {
    if (isHistoricalMode) {
      applyHistoricalParse(text, importMode, filename);
      return;
    }
    const parsed = parseCsvRows(text);
    if (parsed.length === 0) {
      toast.error("Paste CSV with standard header row and examinees");
      return;
    }
    setRows(parsed);
    setCsvText("");
    setShowCsvImport(false);
    toast.success(
      filename
        ? `Successfully loaded ${parsed.length} rows from ${filename}!`
        : `Loaded ${parsed.length} rows from CSV`
    );
  };

  const handleCsvImport = () => {
    handleParseAndLoad(csvText);
  };

  // ── Drag & Drop / File Select Handlers ─────────────────────────────────────

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleParseAndLoad(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    const templateContent = isHistoricalMode
      ? importMode === "corporate"
        ? HISTORICAL_CSV_TEMPLATE_CORPORATE
        : HISTORICAL_CSV_TEMPLATE_INDIVIDUAL
      : CSV_TEMPLATE;
    const blob = new Blob([templateContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isHistoricalMode
      ? importMode === "corporate"
        ? "historical-import-corporate-template.csv"
        : "historical-import-individual-template.csv"
      : "batch-intake-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMappingChange = (position: string, examTypeIdValue: string) => {
    setPositionMapping((prev) => ({
      ...prev,
      [position]: examTypeIdValue,
    }));
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (importMode === "corporate" && !clientId) {
      toast.error("Select a client / organisation");
      return;
    }
    if (!examinerId) { toast.error("Select an examiner"); return; }
    if (!isHistoricalMode && !selectedExamType) {
      toast.error("Select an exam type");
      return;
    }

    setSubmitting(true);
    try {
      if (isHistoricalMode) {
        const validRows = histRows.filter((r) => r.first_name.trim() || r.last_name.trim());
        if (validRows.length === 0) {
          toast.error("No valid rows to import");
          setSubmitting(false);
          return;
        }

        const unmapped = uniquePositions.filter((p) => !positionMapping[p]);
        if (unmapped.length > 0) {
          toast.error(`Please map all spreadsheet positions to system exam types (Missing: ${unmapped.join(", ")})`);
          setSubmitting(false);
          return;
        }

        const payload: {
          client_id?: number;
          import_mode: "corporate" | "individual";
          examiner_id: number;
          rows: BulkImportHistoricalRow[];
        } = {
          import_mode: importMode,
          examiner_id: Number(examinerId),
          rows: validRows.map((r) => {
            const mappedExamTypeId = positionMapping[r.position];
            return {
              first_name: r.first_name.trim(),
              last_name: r.last_name.trim(),
              phone: r.phone.trim() || undefined,
              employee_ref: r.employee_ref.trim() || undefined,
              serial_no: r.serial_no.trim() || undefined,
              scheduled_at: r.scheduled_at,
              status: r.status,
              exam_type_id: mappedExamTypeId ? Number(mappedExamTypeId) : undefined,
              gender: r.gender.trim() || undefined,
              spoken_language: r.language.trim() || undefined,
              experience: r.experience.trim() || undefined,
              email: r.email.trim() || undefined,
              case_label: r.case_label.trim() || r.position.trim() || undefined,
              legacy_results: r.legacy_results.trim() || undefined,
              legacy_mail_status: r.legacy_mail_status.trim() || undefined,
            };
          }),
        };
        if (importMode === "corporate") {
          payload.client_id = Number(clientId);
        }

        const result = await bulkImportHistorical(payload);
        toast.success(
          `Imported ${result.imported} historical record${result.imported !== 1 ? "s" : ""}. Billing history created — examiners can now write formal reports in Reports.`
        );
        router.push(importMode === "corporate" ? `/dashboard/clients/${clientId}/roster` : "/dashboard/clients");
      } else {
        if (!date) { toast.error("Pick a session date"); setSubmitting(false); return; }
        const validRows = rows.filter((r) => r.first_name.trim() || r.last_name.trim());
        if (validRows.length === 0) {
          toast.error("Add at least one examinee");
          setSubmitting(false);
          return;
        }

        const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
        const batchNotes = notes.trim()
          ? `${selectedExamType!.name}\n\n${notes.trim()}`
          : selectedExamType!.name;
        const examinees: BulkScheduleRow[] = validRows.map((r) => ({
          first_name: r.first_name.trim(),
          last_name: r.last_name.trim(),
          email: r.email.trim() || undefined,
          phone: r.phone.trim() || undefined,
          employee_ref: r.employee_ref.trim() || undefined,
          offset_minutes: r.offset_minutes || 0,
        }));

        const schedulePayload: Parameters<typeof bulkSchedule>[0] = {
          import_mode: importMode,
          examiner_id: Number(examinerId),
          scheduled_at: scheduledAt,
          duration: selectedExamType!.duration,
          exam_fee: selectedExamType!.price,
          payment_mode: paymentMode,
          notes: batchNotes,
          examinees,
        };
        if (importMode === "corporate") {
          schedulePayload.client_id = Number(clientId);
        }

        const result = await bulkSchedule(schedulePayload);

        toast.success(
          `Batch scheduled: ${result.scheduled} appointment${result.scheduled !== 1 ? "s" : ""} created`
        );
        router.push(importMode === "corporate" ? `/dashboard/clients/${clientId}/roster` : "/dashboard/calendar");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/clients"
            className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Batch Intake & Migration Hub</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add upcoming examinees to calendar, or import historical completed database spreadsheets.
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-2xl p-1 shrink-0">
          <Button
            type="button"
            variant={!isHistoricalMode ? "default" : "ghost"}
            size="sm"
            className="rounded-xl font-bold uppercase tracking-wider text-[9px] h-8"
            onClick={() => {
              setIsHistoricalMode(false);
              setRows([emptyRow()]);
              setHistRows([]);
              setUniquePositions([]);
            }}
          >
            <CalendarDays className="h-3.5 w-3.5 mr-1" /> Scheduler
          </Button>
          <Button
            type="button"
            variant={isHistoricalMode ? "default" : "ghost"}
            size="sm"
            className="rounded-xl font-bold uppercase tracking-wider text-[9px] h-8"
            onClick={() => {
              setIsHistoricalMode(true);
              setHistRows([]);
              setRows([]);
              setUniquePositions([]);
            }}
          >
            <FileCheck className="h-3.5 w-3.5 mr-1" /> Historical Migration
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Settings card ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isHistoricalMode ? "Migration parameters" : "Session details"}
            </CardTitle>
            <CardDescription>
              {isHistoricalMode
                ? importMode === "individual"
                  ? "Each row creates an Individual client, booking history, and an open exam for the examiner to write the formal report."
                  : "Import under one organisation account. Legacy spreadsheet results are kept for reference only — formal reports are written in Reports."
                : importMode === "individual"
                  ? "Each examinee becomes their own Individual client with a booked appointment. No organisation picker needed."
                  : "These settings apply to every appointment in this batch."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {/* Import mode */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Account type</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={importMode === "individual" ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setImportMode("individual")}
                >
                  Individual clients
                </Button>
                <Button
                  type="button"
                  variant={importMode === "corporate" ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setImportMode("corporate")}
                >
                  Corporate / organisation
                </Button>
              </div>
              {isHistoricalMode && (
                <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                  {importMode === "individual" ? (
                    <>
                      <span className="font-semibold text-foreground">Individual columns:</span>{" "}
                      SN, NAME, PHONE, GENDER, <span className="font-semibold">CASE</span>, EXPERIENCE, LANGUAGE, DATE, TIME, STATUS, RESULTS, REMARK
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">Corporate columns:</span>{" "}
                      SN, NAME, PHONE, <span className="font-semibold">POSITION</span>, GENDER, EXPERIENCE, LANGUAGE, DATE, TIME, MAIL, STATUS, RESULTS, REMARK
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Client — corporate mode only */}
            {importMode === "corporate" && (
            <div className="space-y-1.5">
              <Label htmlFor="client">Organisation / Client *</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(String(v))}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select client…">
                    {clients.find((c) => String(c.id) === clientId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.client_type !== "Individual" && (
                        <span className="ml-1 text-muted-foreground text-xs">({c.client_type})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            {/* Examiner */}
            <div className="space-y-1.5">
              <Label htmlFor="examiner">{isHistoricalMode ? "Assigned Examiner *" : "Examiner *"}</Label>
              <Select value={examinerId} onValueChange={(v) => setExaminerId(String(v))}>
                <SelectTrigger id="examiner">
                  <SelectValue placeholder="Select examiner…">
                    {examiners.find((e) => String(e.id) === examinerId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {examiners.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exam type — scheduler only; historical uses per-row mapping below */}
            {!isHistoricalMode && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exam-type">Exam type *</Label>
                <Select value={examTypeId} onValueChange={(v) => setExamTypeId(String(v))}>
                  <SelectTrigger id="exam-type">
                    <SelectValue placeholder="Select exam type…">
                      {selectedExamType?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {examTypes.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name} · {type.duration} min · ${type.price} USD
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedExamType && (
                  <p className="text-[11px] text-muted-foreground">
                    Duration and billing use this exam type&apos;s catalog settings (
                    {selectedExamType.duration} minutes, ${selectedExamType.price} USD catalog price).
                  </p>
                )}
              </div>
            )}

            {/* Date and Time (Scheduler mode only) */}
            {!isHistoricalMode && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="date">Session date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="time">Start time *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </>
            )}

            {!isHistoricalMode && (
              <>
                {/* Payment mode */}
                <div className="space-y-1.5">
                  <Label htmlFor="payment">Payment mode</Label>
                  <Select value={paymentMode} onValueChange={(v) => setPaymentMode(String(v))}>
                    <SelectTrigger id="payment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Bank Transfer", "Credit Card", "Cash"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    placeholder="Any instructions or context for this batch…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── CSV Position Mapping Wizard Card (Historical Mode Only) ── */}
        {isHistoricalMode && uniquePositions.length > 0 && (
          <Card className="border-amber-500/20 bg-amber-500/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <Map className="h-5 w-5" />{" "}
                {importMode === "corporate" ? "Position to Exam Type Mapping" : "Case Type to Exam Type Mapping"}
              </CardTitle>
              <CardDescription>
                We found {uniquePositions.length} unique{" "}
                {importMode === "corporate" ? "positions" : "case types"} in your spreadsheet. Map each to a system exam type for billing and report protocols.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-wider pb-1.5 border-b border-border/40">
                <div className="col-span-5">
                  Spreadsheet {importMode === "corporate" ? "Position" : "Case / Type"}
                </div>
                <div className="col-span-7">System Exam Type</div>
              </div>

              {uniquePositions.map((pos) => {
                const mappedExamTypeId = positionMapping[pos] || "";
                const mappedType = examTypes.find((type) => String(type.id) === mappedExamTypeId);
                return (
                  <div key={pos} className="grid grid-cols-12 gap-2 items-center text-sm">
                    <div className="col-span-5 font-black text-amber-700 dark:text-amber-400 break-all">{pos}</div>
                    <div className="col-span-7">
                      <Select
                        value={mappedExamTypeId}
                        onValueChange={(v) => handleMappingChange(pos, String(v))}
                      >
                        <SelectTrigger className="h-10 rounded-xl bg-background border-amber-500/30">
                          <SelectValue placeholder="Select mapping..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {examTypes.map((type) => (
                            <SelectItem key={type.id} value={String(type.id)}>
                              {type.name} · {type.duration} min · ${type.price} USD
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {mappedType && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Uses catalog duration and price for {mappedType.name}.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── Examinee Roster Import ── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> {isHistoricalMode ? "Imported Records" : "Examinees"}
                </CardTitle>
                <CardDescription className="mt-1">
                  {isHistoricalMode
                    ? "Verify the imported entries, parsed date/times, SN reference, and results. Set default values for blank ones."
                    : "One row = one examinee = one booked time slot. Use Offset to stagger start times."}
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs rounded-xl"
                  onClick={downloadTemplate}
                >
                  <Download className="h-3.5 w-3.5" />
                  Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs rounded-xl border-primary text-primary hover:bg-primary/[0.05]"
                  onClick={() => setShowCsvImport((v) => !v)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV / TSV File
                </Button>
              </div>
            </div>

            {/* CSV Import Drop Zone & Textarea */}
            {showCsvImport && (
              <div className="mt-4 space-y-4 rounded-2xl border border-border/40 p-4 bg-card/30">
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-primary bg-primary/[0.05]"
                      : "border-border hover:border-primary/50 hover:bg-muted/10"
                  }`}
                >
                  <FileSpreadsheet className="h-10 w-10 text-primary mb-2 animate-pulse" />
                  <p className="text-sm font-black">Drag & drop your CSV / TSV file here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to <span className="text-primary font-bold underline">browse files</span> on your computer (Desktop, etc.)
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-muted-foreground">
                    <span className="bg-background px-2.5">Or paste raw spreadsheet columns (Tab or Comma separated)</span>
                  </div>
                </div>

                <Textarea
                  rows={5}
                  placeholder={
                    isHistoricalMode
                      ? importMode === "corporate"
                        ? HISTORICAL_CSV_TEMPLATE_CORPORATE
                        : HISTORICAL_CSV_TEMPLATE_INDIVIDUAL
                      : CSV_TEMPLATE
                  }
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="font-mono text-xs rounded-2xl bg-background"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleCsvImport} className="rounded-xl">
                    Load rows from text
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowCsvImport(false); setCsvText(""); }}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Table Header mapping */}
            {!isHistoricalMode ? (
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr_6rem_2.5rem] gap-2 px-1">
                {["First name", "Last name", "Email", "Phone", "Employee ref", "Offset (min)", ""].map(
                  (h) => (
                    <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </span>
                  )
                )}
              </div>
            ) : (
              histRows.length > 0 && (
                <div className="hidden sm:grid grid-cols-[0.8fr_0.8fr_0.8fr_0.8fr_1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.9fr_0.9fr_2.5rem] gap-1 px-1">
                  {[
                    "First name",
                    "Last name",
                    "Phone",
                    "Ref / SN",
                    "Scheduled Time",
                    "Case type",
                    "Gender",
                    "Language",
                    "Experience",
                    "Session status",
                    "Legacy results",
                    "",
                  ].map((h) => (
                    <span key={h} className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground truncate" title={h}>
                      {h}
                    </span>
                  ))}
                </div>
              )
            )}

            {/* Table Rows rendering */}
            {!isHistoricalMode ? (
              rows.map((row, i) => (
                <div
                  key={row._key}
                  className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_1fr_1fr_6rem_2.5rem] items-center"
                >
                  <Input
                    placeholder="First name"
                    value={row.first_name}
                    onChange={(e) => updateRow(row._key, "first_name", e.target.value)}
                    aria-label={`Row ${i + 1} first name`}
                    className="rounded-xl h-10 bg-card border-border/50"
                  />
                  <Input
                    placeholder="Last name"
                    value={row.last_name}
                    onChange={(e) => updateRow(row._key, "last_name", e.target.value)}
                    aria-label={`Row ${i + 1} last name`}
                    className="rounded-xl h-10 bg-card border-border/50"
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={row.email}
                    onChange={(e) => updateRow(row._key, "email", e.target.value)}
                    aria-label={`Row ${i + 1} email`}
                    className="rounded-xl h-10 bg-card border-border/50"
                  />
                  <Input
                    placeholder="Phone"
                    value={row.phone}
                    onChange={(e) => updateRow(row._key, "phone", e.target.value)}
                    aria-label={`Row ${i + 1} phone`}
                    className="rounded-xl h-10 bg-card border-border/50"
                  />
                  <Input
                    placeholder="Ref"
                    value={row.employee_ref}
                    onChange={(e) => updateRow(row._key, "employee_ref", e.target.value)}
                    aria-label={`Row ${i + 1} employee ref`}
                    className="rounded-xl h-10 bg-card border-border/50"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    placeholder="0"
                    value={row.offset_minutes || ""}
                    onChange={(e) =>
                      updateRow(row._key, "offset_minutes", Number(e.target.value))
                    }
                    aria-label={`Row ${i + 1} offset minutes`}
                    className="rounded-xl h-10 bg-card border-border/50"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive rounded-lg"
                    onClick={() => removeRow(row._key)}
                    disabled={rows.length === 1}
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              histRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-2xl bg-muted/20 text-center">
                  <BadgeAlert className="h-8 w-8 text-amber-500 mb-2" />
                  <p className="text-sm font-semibold">No examinee data loaded yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Click "Import CSV / TSV File" at the top right to select a file or paste your spreadsheet records.
                  </p>
                </div>
              ) : (
                histRows.map((row, i) => (
                  <div
                    key={row._key}
                    className="grid gap-1 sm:grid-cols-[0.8fr_0.8fr_0.8fr_0.8fr_1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.9fr_0.9fr_2.5rem] items-center text-[10px]"
                  >
                    <Input
                      placeholder="First"
                      value={row.first_name}
                      onChange={(e) => updateRow(row._key, "first_name", e.target.value)}
                      className="h-9 rounded-xl text-[10px] px-2"
                    />
                    <Input
                      placeholder="Last"
                      value={row.last_name}
                      onChange={(e) => updateRow(row._key, "last_name", e.target.value)}
                      className="h-9 rounded-xl text-[10px] px-2"
                    />
                    <Input
                      placeholder="Phone"
                      value={row.phone}
                      onChange={(e) => updateRow(row._key, "phone", e.target.value)}
                      className="h-9 rounded-xl text-[10px] px-2"
                    />
                    <Input
                      placeholder="Ref"
                      value={row.employee_ref}
                      onChange={(e) => updateRow(row._key, "employee_ref", e.target.value)}
                      className="h-9 rounded-xl text-[10px] px-2"
                    />
                    <Input
                      placeholder="ISO Timestamp"
                      value={row.scheduled_at}
                      onChange={(e) => updateRow(row._key, "scheduled_at", e.target.value)}
                      className="h-9 rounded-xl font-mono text-[8px] px-1"
                    />
                    <div className="font-semibold text-amber-700 dark:text-amber-400 max-w-[100px] truncate text-[9px]" title={row.position}>
                      {row.position}
                    </div>
                    <Input
                      placeholder="Gender"
                      value={row.gender}
                      onChange={(e) => updateRow(row._key, "gender", e.target.value)}
                      className="h-9 rounded-xl text-[10px] px-2"
                    />
                    <Input
                      placeholder="Language"
                      value={row.language}
                      onChange={(e) => updateRow(row._key, "language", e.target.value)}
                      className="h-9 rounded-xl text-[10px] px-2"
                    />
                    <Input
                      placeholder="Exp"
                      value={row.experience}
                      onChange={(e) => updateRow(row._key, "experience", e.target.value)}
                      className="h-9 rounded-xl text-[10px] px-2"
                    />
                    <Select
                      value={row.status}
                      onValueChange={(v) => updateRow(row._key, "status", String(v))}
                    >
                      <SelectTrigger className="h-9 rounded-xl text-[9px] bg-background px-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                        <SelectItem value="NO SHOW">No Show</SelectItem>
                        <SelectItem value="Re-test">Re-test</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Legacy results"
                      value={row.legacy_results}
                      onChange={(e) => updateRow(row._key, "legacy_results", e.target.value)}
                      className="h-9 rounded-xl text-[10px] px-2"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive rounded-lg h-8 w-8"
                      onClick={() => removeRow(row._key)}
                      disabled={histRows.length === 1}
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )
            )}

            {(isHistoricalMode ? histRows.length > 0 : true) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 mt-2 rounded-xl text-xs h-9"
                onClick={addRow}
              >
                <Plus className="h-3.5 w-3.5" />
                Add row
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── Submit ── */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" render={<Link href="/dashboard/clients" />} className="rounded-xl h-11 px-5">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="gap-2 min-w-36 rounded-xl h-11 px-6 font-bold">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isHistoricalMode ? "Migrating..." : "Scheduling…"}
              </>
            ) : (
              <>
                {isHistoricalMode ? (
                  <>
                    <FileCheck className="h-4 w-4" />
                    Migrate {histRows.filter((r) => r.first_name || r.last_name).length || 0} Records
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    Schedule {rows.filter((r) => r.first_name || r.last_name).length || ""} appointment
                    {rows.filter((r) => r.first_name || r.last_name).length !== 1 ? "s" : ""}
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
