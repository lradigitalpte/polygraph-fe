"use client";

import * as React from "react";
import { ClipboardList, ExternalLink, FileText, FolderLock, Inbox, Mail, PenLine, Search, Send, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export const VAULT_CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    upload: "File",
    consent_form: "Consent",
    intake_form: "Intake",
    privacy: "Privacy",
    legal: "Legal",
    report: "Report",
    agreement: "Agreement",
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
      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .slice(0, 3)
      .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
      .join(" · ");
  } catch {
    return formData.slice(0, 120);
  }
}

export function VaultDocumentRow({ doc, onSend }: { doc: VaultDocument; onSend?: (doc: VaultDocument) => void }) {
  const isForm = doc.source === "online_form";
  const isAgreement = doc.type === "agreement";
  const preview = isForm ? formPreview(doc.form_data) : null;
  const canSend = Boolean(onSend && doc.url && !isForm);
  const Icon = isForm ? ClipboardList : isAgreement ? FileText : FolderLock;

  return (
    <li className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            isForm ? "bg-primary/12 text-[oklch(0.45_0.12_39)] dark:text-primary" : "bg-[#F3F1EA] text-muted-foreground dark:bg-muted",
          )}
        >
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={doc.name}>
            {doc.name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-[#F3F1EA] px-2 py-px font-medium text-[#3D3929] capitalize dark:bg-muted dark:text-foreground">{typeLabel(doc.type)}</span>
            <span>{isForm ? "Filled in by client" : isAgreement ? "Signed online" : "Uploaded"}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(doc.created_at)}</span>
          </p>
          {preview ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{preview}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 pl-[52px] sm:pl-0">
        {doc.url ? (
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" /> Open
          </a>
        ) : null}
        {canSend ? (
          <button
            type="button"
            onClick={() => onSend?.(doc)}
            className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
          >
            <Send aria-hidden="true" className="size-3.5" /> Send
          </button>
        ) : null}
      </div>
    </li>
  );
}

type TabKey = "vault" | "forms" | "upload" | "manual";

type DocumentVaultTabsProps = {
  clientName: string;
  documents: VaultDocument[];
  sendTab: React.ReactNode;
  uploadTab: React.ReactNode;
  manualTab: React.ReactNode;
  pendingCount: number;
  showManualTab?: boolean;
  onSendDocument?: (doc: VaultDocument) => void;
  sharesPanel?: React.ReactNode;
};

export function DocumentVaultTabs({
  clientName,
  documents,
  sendTab,
  uploadTab,
  manualTab,
  pendingCount,
  showManualTab = true,
  onSendDocument,
  sharesPanel,
}: DocumentVaultTabsProps) {
  // Land on what's already stored; an empty vault starts on sending forms.
  const [tab, setTab] = React.useState<TabKey>(documents.length > 0 ? "vault" : "forms");
  const [filter, setFilter] = React.useState<"all" | "forms" | "files" | "agreements">("all");
  const [search, setSearch] = React.useState("");

  const forms = documents.filter((d) => d.source === "online_form");
  const agreements = documents.filter((d) => d.type === "agreement" && d.source !== "online_form");
  const files = documents.filter((d) => d.source !== "online_form" && d.type !== "agreement");

  const filtered = React.useMemo(() => {
    const base = filter === "forms" ? forms : filter === "files" ? files : filter === "agreements" ? agreements : documents;
    const q = search.trim().toLowerCase();
    return [...base]
      .filter((d) => !q || d.name.toLowerCase().includes(q) || typeLabel(d.type).toLowerCase().includes(q))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived from documents
  }, [documents, filter, search]);

  const tabs: { key: TabKey; label: string; icon: typeof Inbox; badge?: number; hidden?: boolean }[] = [
    { key: "vault", label: "In vault", icon: Inbox, badge: documents.length },
    { key: "forms", label: "Send forms", icon: Mail, badge: pendingCount || undefined },
    { key: "upload", label: "Upload", icon: Upload },
    { key: "manual", label: "Paper entry", icon: PenLine, hidden: !showManualTab },
  ];

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Document vault" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-[#E9E6DD] p-1 no-scrollbar dark:bg-muted">
        {tabs
          .filter((t) => !t.hidden)
          .map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors",
                  active ? "bg-white text-foreground shadow-sm dark:bg-card" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon aria-hidden="true" className="size-4" />
                {t.label}
                {t.badge ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      t.key === "forms" ? "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200" : "bg-[#F3F1EA] dark:bg-muted-foreground/20",
                    )}
                    title={t.key === "forms" ? "Forms awaiting the client" : undefined}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
      </div>

      {tab === "vault" ? (
        <div className="space-y-5">
          <section aria-label="Stored documents" className={cn(VAULT_CARD, "overflow-hidden")}>
            <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div role="radiogroup" aria-label="Filter documents" className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "all", label: "All", count: documents.length },
                    { id: "forms", label: "Client forms", count: forms.length },
                    { id: "files", label: "Files", count: files.length },
                    ...(agreements.length ? [{ id: "agreements", label: "Agreements", count: agreements.length }] : []),
                  ] as { id: typeof filter; label: string; count: number }[]
                ).map((item) => {
                  const active = filter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setFilter(item.id)}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                        active ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background" : "text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
                      )}
                    >
                      {item.label}
                      <span className="tabular-nums opacity-70">{item.count}</span>
                    </button>
                  );
                })}
              </div>
              {documents.length > 4 ? (
                <div className="relative w-full lg:w-60">
                  <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input aria-label="Search documents" placeholder="Search files…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 rounded-full border-0 bg-[#F3F1EA] pr-9 pl-10 text-sm shadow-none dark:bg-muted" />
                  {search ? (
                    <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card">
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
                  <FolderLock aria-hidden="true" className="size-5 text-muted-foreground" />
                </span>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {search
                    ? "Nothing matches your search."
                    : documents.length === 0
                      ? `Nothing in ${clientName.split(" ")[0]}'s vault yet. Send a form for them to fill in, or upload a file.`
                      : "Nothing in this category."}
                </p>
                {documents.length === 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => setTab("forms")} className="flex h-10 items-center gap-1.5 rounded-full bg-[#2B2A27] px-4 text-sm font-medium text-[#FAF9F5] hover:bg-[#3A3935] dark:bg-foreground dark:text-background">
                      <Mail aria-hidden="true" className="size-4" /> Send a form
                    </button>
                    <button type="button" onClick={() => setTab("upload")} className="flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted">
                      <Upload aria-hidden="true" className="size-4" /> Upload a file
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-border/50 border-t border-border/50">
                {filtered.map((doc) => (
                  <VaultDocumentRow key={doc.id} doc={doc} onSend={onSendDocument} />
                ))}
              </ul>
            )}
          </section>
          {sharesPanel}
        </div>
      ) : null}

      {tab === "forms" ? (
        <div className="space-y-5">
          <section className={cn(VAULT_CARD, "p-6")}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-lg">
                <h3 className="text-[15px] font-medium">Ask {clientName.split(" ")[0]} to fill in a form</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">They get a secure link by email, fill it in online, and the answers land in the vault automatically.</p>
              </div>
              <ol className="flex flex-wrap items-center gap-2 text-[13px]">
                {["You send", "They fill it in", "It's in the vault"].map((step, i) => (
                  <li key={step} className="flex items-center gap-2">
                    {i > 0 ? <span aria-hidden="true" className="h-px w-4 bg-border" /> : null}
                    <span className="flex items-center gap-1.5 rounded-full bg-[#F7F6F1] px-3 py-1.5 dark:bg-muted/50">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#2B2A27] text-[11px] font-semibold text-[#FAF9F5] dark:bg-foreground dark:text-background">{i + 1}</span>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          {sendTab}
        </div>
      ) : null}

      {tab === "upload" ? <div className="space-y-5">{uploadTab}</div> : null}

      {tab === "manual" && showManualTab ? (
        <section className={cn(VAULT_CARD, "p-6")}>
          <h3 className="text-[15px] font-medium">Record a paper form</h3>
          <p className="mt-1 mb-4 max-w-xl text-[13px] text-muted-foreground">
            Only for forms the client already signed on paper, or answers you&apos;re typing for them. Normally, use <strong>Send forms</strong> so they fill it in themselves.
          </p>
          {manualTab}
        </section>
      ) : null}
    </div>
  );
}
