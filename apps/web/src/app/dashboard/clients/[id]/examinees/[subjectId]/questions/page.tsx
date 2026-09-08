"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Route } from "next";
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  ListChecks,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { SessionQuestionsPanel } from "@/components/dashboard/session-questions-panel";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { formatClinicDateTime } from "@/lib/clinic-time";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50] as const;

type QuestionsFilter = "all" | "prepared" | "not_prepared";
type SessionFilter = "all" | "started" | "not_started";

const QUESTIONS_FILTER_LABELS: Record<QuestionsFilter, string> = {
  all: "All questions",
  prepared: "Prepared",
  not_prepared: "Not prepared",
};

const SESSION_FILTER_LABELS: Record<SessionFilter, string> = {
  all: "All sessions",
  started: "Session started",
  not_started: "Not started",
};

export default function ExamineeSessionQuestionsPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const { appointments, loading } = useSubjectDetail();
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [questionsFilter, setQuestionsFilter] = React.useState<QuestionsFilter>("all");
  const [sessionFilter, setSessionFilter] = React.useState<SessionFilter>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState<number>(10);

  // Newest first — the sessions you are most likely preparing for.
  const sessions = React.useMemo(
    () =>
      [...appointments].sort(
        (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      ),
    [appointments]
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, questionsFilter, sessionFilter, itemsPerPage]);

  const hasActiveFilters = Boolean(search.trim()) || questionsFilter !== "all" || sessionFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setQuestionsFilter("all");
    setSessionFilter("all");
  };

  const filtered = React.useMemo(() => {
    const s = search.toLowerCase().trim();
    return sessions.filter((appointment) => {
      const code = formatAppointmentCode(appointment.id).toLowerCase();
      const matchesSearch = !s || code.includes(s);

      const matchesQuestions =
        questionsFilter === "all" ||
        (questionsFilter === "prepared" && appointment.questions_prepared) ||
        (questionsFilter === "not_prepared" && !appointment.questions_prepared);

      const matchesSession =
        sessionFilter === "all" ||
        (sessionFilter === "started" && Boolean(appointment.exam_id)) ||
        (sessionFilter === "not_started" && !appointment.exam_id);

      return matchesSearch && matchesQuestions && matchesSession;
    });
  }, [sessions, search, questionsFilter, sessionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageNumbers = React.useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Session Questions</h3>
        <p className="text-sm text-muted-foreground">
          Prepare what you&apos;ll ask for each booking. Questions are copied into the session when
          documentation starts, so later Question Library edits never change a past session.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading sessions...</CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No sessions booked for this examinee yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 rounded-[1.25rem] border border-border/50 bg-card/30 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10 h-11 rounded-xl"
                  placeholder="Search by appointment code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={questionsFilter} onValueChange={(v) => setQuestionsFilter(v as QuestionsFilter)}>
                  <SelectTrigger className="h-11 w-[160px] rounded-xl">
                    <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <SelectValue>{QUESTIONS_FILTER_LABELS[questionsFilter]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All questions</SelectItem>
                    <SelectItem value="prepared">Prepared</SelectItem>
                    <SelectItem value="not_prepared">Not prepared</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sessionFilter} onValueChange={(v) => setSessionFilter(v as SessionFilter)}>
                  <SelectTrigger className="h-11 w-[160px] rounded-xl">
                    <SelectValue>{SESSION_FILTER_LABELS[sessionFilter]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sessions</SelectItem>
                    <SelectItem value="started">Session started</SelectItem>
                    <SelectItem value="not_started">Not started</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" className="h-11 rounded-xl gap-1.5" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" />
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                No sessions match your search or filters.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {paginated.map((appointment) => {
                const expanded = expandedId === appointment.id;
                const sessionHref = `/dashboard/clients/${clientId}/exams/${appointment.id}/questions`;
                return (
                  <Card key={appointment.id}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left"
                          onClick={() => setExpandedId(expanded ? null : appointment.id)}
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <CardTitle className="text-base">{formatAppointmentCode(appointment.id)}</CardTitle>
                            <CardDescription className="flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {formatClinicDateTime(appointment.scheduled_at) || appointment.scheduled_at}
                            </CardDescription>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          {appointment.questions_prepared ? (
                            <Badge variant="success" className="gap-1">
                              <ListChecks className="h-3.5 w-3.5" />
                              Questions prepared
                            </Badge>
                          ) : (
                            <Badge variant="outline">No questions yet</Badge>
                          )}
                          {appointment.exam_id ? <Badge variant="outline">Session started</Badge> : null}
                          <Button variant="ghost" size="icon" render={<Link href={sessionHref as Route} />}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {expanded ? (
                      <CardContent className="pt-2">
                        <SessionQuestionsPanel
                          appointmentId={appointment.id}
                          examId={appointment.exam_id}
                          examTypeId={appointment.exam_type_id ?? null}
                          showResponses={Boolean(appointment.exam_id)}
                        />
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex flex-col gap-4 rounded-[1.25rem] border border-border/50 bg-card/30 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Showing{" "}
                  <span className="text-foreground">
                    {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)}
                  </span>{" "}
                  of {filtered.length}
                  {filtered.length !== sessions.length ? ` (${sessions.length} total)` : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                    Per page
                  </Label>
                  <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                    <SelectTrigger className="h-9 w-[88px] rounded-lg">
                      <SelectValue>{itemsPerPage}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 rounded-xl"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {pageNumbers.map((page, index) => {
                    const prev = pageNumbers[index - 1];
                    const showEllipsis = prev !== undefined && page - prev > 1;
                    return (
                      <React.Fragment key={page}>
                        {showEllipsis && <span className="px-1 text-xs text-muted-foreground">…</span>}
                        <Button
                          variant={currentPage === page ? "default" : "ghost"}
                          size="sm"
                          className={cn(
                            "h-9 w-9 rounded-xl text-xs font-black",
                            currentPage === page && "shadow-md shadow-primary/20",
                          )}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      </React.Fragment>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 rounded-xl"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
