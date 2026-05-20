"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList,
  ExternalLink,
  FolderLock,
  Inbox,
  Link2,
  Mail,
  PenLine,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type VaultDocument = {
  id: number;
  name: string;
  type: string;
  source: string;
  created_at: string;
  url?: string;
  form_data?: string;
};

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    upload: "File",
    consent_form: "Consent",
    intake_form: "Intake",
    privacy: "Privacy",
    legal: "Legal",
    report: "Report",
    test_chart: "Chart",
    biometric_trace: "Trace",
    other: "Other",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

function formPreview(formData?: string) {
  if (!formData) return null;
  try {
    const parsed = JSON.parse(formData) as Record<string, unknown>;
    return Object.entries(parsed)
      .slice(0, 4)
      .map(([key, value]) => {
        const label = key.replace(/_/g, " ");
        return `${label}: ${String(value)}`;
      })
      .join(" · ");
  } catch {
    return formData.slice(0, 120);
  }
}

export function VaultDocumentRow({ doc }: { doc: VaultDocument }) {
  const isForm = doc.source === "online_form";
  const preview = isForm ? formPreview(doc.form_data) : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card/50 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
            isForm ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {isForm ? (
            <ClipboardList className="h-4 w-4" />
          ) : (
            <FolderLock className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-semibold truncate">{doc.name}</div>
          <div className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</div>
          {preview && (
            <p className="text-xs text-muted-foreground line-clamp-2">{preview}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline">{typeLabel(doc.type)}</Badge>
        <Badge variant={isForm ? "secondary" : "default"}>
          {isForm ? "Client submitted" : "Uploaded"}
        </Badge>
        {doc.url && (
          <Button
            variant="ghost"
            size="sm"
            render={<a href={doc.url} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open
          </Button>
        )}
      </div>
    </div>
  );
}

type DocumentVaultTabsProps = {
  clientName: string;
  documents: VaultDocument[];
  sendTab: React.ReactNode;
  uploadTab: React.ReactNode;
  manualTab: React.ReactNode;
  pendingCount: number;
  showManualTab?: boolean;
};

export function DocumentVaultTabs({
  clientName,
  documents,
  sendTab,
  uploadTab,
  manualTab,
  pendingCount,
  showManualTab = true,
}: DocumentVaultTabsProps) {
  const [filter, setFilter] = React.useState<"all" | "forms" | "files">("all");

  const forms = documents.filter((d) => d.source === "online_form");
  const files = documents.filter((d) => d.source !== "online_form");

  const filtered =
    filter === "forms" ? forms : filter === "files" ? files : documents;

  return (
    <Tabs defaultValue="send" className="space-y-6">
      <TabsList
        className={cn(
          "grid w-full h-auto p-1 gap-1",
          showManualTab ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"
        )}
      >
        <TabsTrigger value="send" className="gap-2 py-2.5 text-xs sm:text-sm">
          <Mail className="h-4 w-4 shrink-0" />
          <span className="truncate">Send forms</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {pendingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="received" className="gap-2 py-2.5 text-xs sm:text-sm">
          <Inbox className="h-4 w-4 shrink-0" />
          Received ({documents.length})
        </TabsTrigger>
        <TabsTrigger value="upload" className="gap-2 py-2.5 text-xs sm:text-sm">
          <Upload className="h-4 w-4 shrink-0" />
          Upload file
        </TabsTrigger>
        <TabsTrigger value="manual" className="gap-2 py-2.5 text-xs sm:text-sm">
          <PenLine className="h-4 w-4 shrink-0" />
          Paper / staff entry
        </TabsTrigger>
      </TabsList>

      <TabsContent value="send" className="space-y-4 mt-0 outline-none">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Email a form link to {clientName}
            </CardTitle>
            <CardDescription>
              This is the usual workflow: pick consent, privacy, or intake → client gets an email →
              they fill a secure page → answers land in <strong>Received</strong> automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <span className="font-bold text-foreground">1. You send</span>
              <p className="mt-1">Choose template and email address.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <span className="font-bold text-foreground">2. They complete</span>
              <p className="mt-1">Public link (expires in 14 days).</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <span className="font-bold text-foreground">3. You receive</span>
              <p className="mt-1">Saved in vault — check Received tab.</p>
            </div>
          </CardContent>
        </Card>
        {sendTab}
      </TabsContent>

      <TabsContent value="received" className="space-y-4 mt-0 outline-none">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: `All (${documents.length})` },
              { id: "forms" as const, label: `Client forms (${forms.length})` },
              { id: "files" as const, label: `Files (${files.length})` },
            ] as const
          ).map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? "default" : "outline"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stored documents</CardTitle>
            <CardDescription>
              Everything returned from form links or uploaded by your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                {filter === "forms"
                  ? "No completed client forms yet. Use the Send forms tab."
                  : filter === "files"
                    ? "No uploaded files yet. Use the Upload file tab."
                    : "Nothing stored yet. Send a form link or upload a file."}
              </p>
            ) : (
              filtered.map((doc) => <VaultDocumentRow key={doc.id} doc={doc} />)
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="upload" className="mt-0 outline-none">
        {uploadTab}
      </TabsContent>

      {showManualTab && (
        <TabsContent value="manual" className="mt-0 outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record a paper or in-office form</CardTitle>
              <CardDescription>
                Only use this when the client already signed on paper or you are typing answers for
                them. For normal cases, use <strong>Send forms</strong> so they fill it online
                themselves.
              </CardDescription>
            </CardHeader>
            <CardContent>{manualTab}</CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
