"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  ChevronLeft,
  Mail,
  FileText,
  ChevronDown,
  X,
  User,
  ClipboardList,
  Stethoscope,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchClients, type ClientRecord } from "@/lib/clients";
import {
  collectQuotationPayment,
  createQuotation,
  sendQuotationEmail,
} from "@/lib/quotations";
import { fetchExamTypes, type ExamTypeRecord } from "@/lib/exam-booking";
import { collectAppointmentPayment } from "@/lib/client-account";
import { fetchBillingLedger, mapLedgerEntryToInvoice, type FinancialInvoice } from "@/lib/billing";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { 
  Sheet, 
  SheetContent, 
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Types for our billing system
type TransactionStatus = "Completed" | "Pending" | "Partial" | "Overdue" | "Sent" | "Draft";

type Invoice = FinancialInvoice & {
  examId?: string;
  sentAt?: string;
};

// ---------- helper: generate + open printable PDF for a quotation ----------
function downloadQuotationPDF(inv: Invoice, examiner: string, examType: string) {
  const balance = inv.totalAmount - inv.paidAmount;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${inv.code} — Polygraph Quotation</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',sans-serif;color:#111;padding:48px}
  .logo{font-size:22px;font-weight:900;letter-spacing:-0.03em;color:#000}
  .tagline{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.15em;margin-top:2px}
  h1{font-size:38px;font-weight:900;letter-spacing:-0.04em;margin:40px 0 4px}
  .meta{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.12em}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:32px 0}
  .field label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;color:#aaa;display:block;margin-bottom:4px}
  .field span{font-size:13px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin:32px 0}
  th{font-size:9px;text-transform:uppercase;letter-spacing:0.14em;color:#aaa;border-bottom:1px solid #e5e5e5;padding:8px 0;text-align:left;font-weight:800}
  td{padding:12px 0;font-size:13px;border-bottom:1px solid #f3f3f3;font-weight:600}
  .amount{text-align:right}
  .total-row td{font-weight:900;font-size:15px;border-top:2px solid #000;border-bottom:none;padding-top:16px}
  .badge{display:inline-block;background:#f0f0f0;border-radius:99px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;padding:3px 10px;color:#444}
  .footer{margin-top:64px;font-size:10px;color:#bbb;border-top:1px solid #eee;padding-top:16px}
  @media print{body{padding:32px}}
</style>
</head>
<body>
<div class="logo">Polygraph Services</div>
<div class="tagline">Forensic Examination &amp; Clinical Assessment</div>

<h1>$${balance.toFixed(2)}</h1>
<div class="meta">Balance Due • <span class="badge">${inv.status}</span></div>

<div class="grid">
  <div class="field"><label>Quotation No.</label><span>${inv.code}</span></div>
  <div class="field"><label>Issue Date</label><span>${inv.date}</span></div>
  <div class="field"><label>Client</label><span>${inv.client}</span></div>
  <div class="field"><label>Examiner</label><span>${examiner || "—"}</span></div>
  ${examType ? `<div class="field"><label>Exam Type</label><span>${examType}</span></div>` : ""}
  ${inv.sentAt ? `<div class="field"><label>Emailed</label><span>${inv.sentAt}</span></div>` : ""}
</div>

<table>
  <thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead>
  <tbody>
    ${inv.items.map((item) => `<tr><td>${item.description}</td><td class="amount">$${item.amount.toFixed(2)}</td></tr>`).join("")}
    <tr class="total-row"><td>Total</td><td class="amount">$${inv.totalAmount.toFixed(2)}</td></tr>
    <tr><td style="color:#888;font-size:12px">Collected</td><td class="amount" style="color:#22c55e">-$${inv.paidAmount.toFixed(2)}</td></tr>
    <tr class="total-row"><td>Balance Due</td><td class="amount">$${balance.toFixed(2)}</td></tr>
  </tbody>
</table>

<div class="footer">Thank you for choosing Polygraph Services. This quotation is valid for 30 days.</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { toast.error("Allow popups to download PDF"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}
// ---------------------------------------------------------------------------

export default function PaymentsPage() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [clients, setClients] = React.useState<ClientRecord[]>([]);
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 5;

  // Modal states
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = React.useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false);
  const [isSendQuoteOpen, setIsSendQuoteOpen] = React.useState(false);
  const [sendEmail, setSendEmail] = React.useState({ toEmail: "", subject: "", body: "" });
  const [sendingSaving, setSendingSaving] = React.useState(false);

  // New quotation form state
  const [form, setForm] = React.useState<{
    client: ClientRecord | null;
    examType: ExamTypeRecord | null;
    examiner: UserRecord | null;
    extraItems: { description: string; amount: number }[];
    clientSearch: string;
    examTypeSearch: string;
    examinerSearch: string;
    showClientList: boolean;
    showExamTypeList: boolean;
    showExaminerList: boolean;
  }>({
    client: null,
    examType: null,
    examiner: null,
    extraItems: [],
    clientSearch: "",
    examTypeSearch: "",
    examinerSearch: "",
    showClientList: false,
    showExamTypeList: false,
    showExaminerList: false,
  });

  const filteredFormClients = clients.filter((c) =>
    c.name.toLowerCase().includes(form.clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(form.clientSearch.toLowerCase()),
  );
  const filteredFormExamTypes = examTypes.filter((et) =>
    et.name.toLowerCase().includes(form.examTypeSearch.toLowerCase()),
  );
  const filteredFormExaminers = examiners.filter((ex) =>
    ex.name.toLowerCase().includes(form.examinerSearch.toLowerCase()),
  );

  const resetForm = () => {
    setForm({
      client: null, examType: null, examiner: null, extraItems: [],
      clientSearch: "", examTypeSearch: "", examinerSearch: "",
      showClientList: false, showExamTypeList: false, showExaminerList: false,
    });
  };

  React.useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ledger, clientRows, examTypeRows, examinerRows] = await Promise.all([
        fetchBillingLedger(),
        fetchClients(),
        fetchExamTypes(),
        fetchExaminers(),
      ]);

      setInvoices(
        ledger.entries.map((entry) => {
          const inv = mapLedgerEntryToInvoice(entry) as Invoice;
          if (entry.appointment_id) {
            inv.examId = `APT-${String(entry.appointment_id).padStart(4, "0")}`;
          }
          return inv;
        }),
      );
      setClients(clientRows);
      setExamTypes(examTypeRows);
      setExaminers(examinerRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load financial records");
    } finally {
      setLoading(false);
    }
  };

  // Record Payment Form State
  const [paymentAmount, setPaymentAmount] = React.useState<string>("");
  const [recordingPayment, setRecordingPayment] = React.useState(false);

  const filteredInvoices = invoices.filter(inv => 
    inv.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));
  
  // Ensure currentPage is within bounds if filters change
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: invoices.reduce((acc, inv) => acc + inv.totalAmount, 0),
    collected: invoices.reduce((acc, inv) => acc + inv.paidAmount, 0),
    pending: invoices.reduce((acc, inv) => acc + (inv.totalAmount - inv.paidAmount), 0),
    overdue: invoices.filter(inv => inv.status === "Overdue").reduce((acc, inv) => acc + (inv.totalAmount - inv.paidAmount), 0)
  };

  const handleCreateInvoice = async () => {
    if (!form.client) { toast.error("Select a client"); return; }
    if (!form.examType) { toast.error("Select an exam type"); return; }

    const lineItems: { description: string; amount: number }[] = [
      { description: form.examType.name, amount: form.examType.price },
      ...form.extraItems.filter((item) => item.description.trim() && item.amount > 0),
    ];
    const total = lineItems.reduce((acc, item) => acc + item.amount, 0);
    if (total <= 0) { toast.error("Total must be greater than zero"); return; }

    const title = [form.examType.name, form.examiner ? `— ${form.examiner.name}` : ""].filter(Boolean).join(" ");
    const description = lineItems
      .map((item) => `${item.description}: $${item.amount.toFixed(2)}`)
      .join("\n");

    try {
      await createQuotation({
        client_id: form.client.id,
        title,
        description,
        amount: total,
      });
      await loadData();
      setIsNewInvoiceOpen(false);
      resetForm();
      toast.success("Quotation created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create quotation");
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setRecordingPayment(true);
    try {
      if (selectedInvoice.appointmentId) {
        await collectAppointmentPayment(selectedInvoice.appointmentId, { amount });
      } else {
        await collectQuotationPayment(selectedInvoice.quotationId ?? selectedInvoice.id, {
          amount,
        });
      }

      await loadData();
      setIsRecordPaymentOpen(false);
      setPaymentAmount("");
      setIsSheetOpen(false);
      toast.success("Payment collected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to collect payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleSendQuotation = async () => {
    if (!selectedInvoice) return;
    const quoteId = selectedInvoice.quotationId ?? (selectedInvoice.source === "quote" ? selectedInvoice.id : undefined);
    if (!quoteId) {
      toast.error("No invoice on file for this record");
      return;
    }
    if (!sendEmail.toEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    setSendingSaving(true);
    try {
      await sendQuotationEmail(quoteId, {
        to_email: sendEmail.toEmail.trim(),
        subject: sendEmail.subject.trim(),
        body: sendEmail.body.trim(),
      });
      await loadData();
      setIsSendQuoteOpen(false);
      toast.success("Quotation emailed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send quotation");
    } finally {
      setSendingSaving(false);
    }
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20 px-4 sm:px-0">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-[2.5rem] bg-card/40 border border-border/50 backdrop-blur-xl shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <DollarSign className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Financial Hub</h1>
          </div>
          <p className="text-muted-foreground text-sm font-bold opacity-70 uppercase tracking-widest text-[10px] pl-1 pt-1">
            Clinical Revenue & Collection Oversight
          </p>
          <p className="text-xs text-muted-foreground pl-1 pt-2 max-w-xl">
            Booked exams from Calendar appear here as invoices. Exam types under Settings set the price when you book.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <Button 
            onClick={() => setIsNewInvoiceOpen(true)}
            className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Quotation
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Billed Total", value: stats.total, icon: FileText, color: "bg-primary/10 text-primary" },
          { label: "Collected", value: stats.collected, icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-500" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "bg-amber-500/10 text-amber-500" },
          { label: "Overdue", value: stats.overdue, icon: AlertCircle, color: "bg-rose-500/10 text-rose-500" }
        ].map((stat, i) => (
          <Card key={i} className="border-border/40 bg-card/30 backdrop-blur-md shadow-xl overflow-hidden group hover:border-primary/30 transition-all hover:scale-[1.02]">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className={cn("p-2.5 rounded-xl shadow-inner", stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60">{stat.label}</p>
              </div>
              <p className="text-3xl font-black tracking-tighter">${stat.value.toFixed(0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="relative w-full sm:w-96 group">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-all" />
            <Input 
              placeholder="Search by client or invoice ID..." 
              className="h-12 pl-12 rounded-2xl bg-card border-border/50 focus:border-primary/50 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-12 rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm px-6 gap-2 hover:bg-muted/50 transition-all">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filters</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl border border-border/50 hover:bg-muted/50">
                <Download className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-border/40 bg-card/20 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Invoice / Client</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Progress</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Balance Due</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                      Loading financial records...
                    </td>
                  </tr>
                ) : paginatedInvoices.length > 0 ? (
                  paginatedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-primary/[0.03] transition-all group">
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-base leading-none text-foreground">{inv.client}</span>
                          <span className="text-[10px] font-black text-primary uppercase tracking-[0.1em]">{inv.code}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <Badge 
                          variant="outline"
                          className={cn(
                            "rounded-full px-3 py-1 font-black uppercase tracking-widest text-[9px] border-none shadow-sm",
                            inv.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" : 
                            inv.status === "Pending" ? "bg-amber-500/10 text-amber-600" : 
                            inv.status === "Sent" ? "bg-cyan-500/10 text-cyan-600" : 
                            inv.status === "Partial" ? "bg-blue-500/10 text-blue-600" : 
                            "bg-rose-500/10 text-rose-600"
                          )}
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-2">
                          <div className="w-32 h-1.5 bg-muted/50 rounded-full overflow-hidden border border-border/50">
                            <div 
                              className={cn(
                                "h-full transition-all duration-1000 ease-out rounded-full",
                                inv.status === "Completed" ? "bg-emerald-500" : 
                                inv.status === "Partial" ? "bg-blue-500" : "bg-primary/20"
                              )}
                              style={{ width: `${(inv.paidAmount / inv.totalAmount) * 100}%` }}
                            />
                          </div>
                          <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">
                            ${inv.paidAmount.toFixed(0)} Collected
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-lg tracking-tighter">
                        ${(inv.totalAmount - inv.paidAmount).toFixed(2)}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all group-hover:translate-x-1"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setIsSheetOpen(true);
                          }}
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                      No invoices found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-10 py-6 border-t border-border/50 bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Showing <span className="text-foreground">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredInvoices.length)}</span> of {filteredInvoices.length} Transactions
            </p>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-10 px-4 rounded-xl border-border/50 bg-card hover:bg-muted transition-all disabled:opacity-30"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span className="font-black text-[9px] uppercase tracking-widest">Previous</span>
              </Button>
              
              <div className="flex items-center gap-1.5">
                {[...Array(totalPages)].map((_, i) => (
                    <Button 
                        key={i}
                        variant={currentPage === i + 1 ? "default" : "ghost"}
                        className={cn(
                            "h-10 w-10 rounded-xl font-black text-xs transition-all", 
                            currentPage === i + 1 ? "shadow-xl shadow-primary/20 bg-primary" : "text-muted-foreground hover:bg-primary/5"
                        )}
                        onClick={() => setCurrentPage(i + 1)}
                    >
                        {i + 1}
                    </Button>
                ))}
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="h-10 px-4 rounded-xl border-border/50 bg-card hover:bg-muted transition-all disabled:opacity-30"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <span className="font-black text-[9px] uppercase tracking-widest">Next</span>
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md bg-card/95 backdrop-blur-3xl border-l border-border/50 shadow-2xl p-0 overflow-hidden">
          {selectedInvoice && (
            <div className="h-full flex flex-col">
              <div className="h-72 flex flex-col justify-end p-10 text-white relative">
                <div className="absolute inset-0 bg-neutral-950 z-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent z-10" />
                <div className="absolute inset-0 opacity-10 z-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
                
                <div className="relative z-20 space-y-4">
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 backdrop-blur-xl">
                    {selectedInvoice.status}
                  </Badge>
                  <div className="space-y-1">
                    <h2 className="text-5xl font-black tracking-tighter leading-none">${(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toFixed(2)}</h2>
                    <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] pl-1">Balance Due</p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-background">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Case Information</p>
                  <div className="grid grid-cols-2 gap-4 border border-border/50 p-6 rounded-[2rem] bg-muted/10 shadow-inner">
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Client</p>
                      <p className="text-sm font-black tracking-tight">{selectedInvoice.client}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Issue Date</p>
                      <p className="text-sm font-black tracking-tight">{selectedInvoice.date}</p>
                    </div>
                  </div>
                  {selectedInvoice.sentAt ? (
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                      Emailed: {selectedInvoice.sentAt}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Service Fee Breakdown</p>
                  <div className="space-y-3">
                    {selectedInvoice.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 border border-border/30 rounded-2xl bg-card shadow-sm transition-all hover:border-primary/20">
                        <span className="text-xs font-black text-foreground/80 uppercase tracking-tight">{item.description}</span>
                        <span className="text-sm font-black text-foreground">${item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-10 flex flex-col gap-4">
                  <Button 
                    onClick={() => setIsRecordPaymentOpen(true)}
                    className="w-full h-16 rounded-[2rem] font-black text-base shadow-2xl shadow-primary/30 bg-primary text-primary-foreground hover:scale-[1.03] transition-all"
                  >
                    Record Payment Entry
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-border/50 hover:bg-muted/20"
                      disabled={selectedInvoice.source !== "quote"}
                      onClick={() => {
                        if (selectedInvoice.source !== "quote") {
                          return;
                        }
                        setSendEmail({
                          toEmail: selectedInvoice.clientEmail || "",
                          subject: `${selectedInvoice.code} Quotation`,
                          body: `Hello ${selectedInvoice.client},\n\nPlease find your quotation ${selectedInvoice.code} for $${selectedInvoice.totalAmount.toFixed(2)}.`,
                        });
                        setIsSendQuoteOpen(true);
                      }}
                    >
                        <Mail className="mr-2 h-4 w-4 text-primary" />
                        {selectedInvoice.quotationId ? "Email invoice" : "Email (invoice only)"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-border/50 hover:bg-muted/20"
                      onClick={() => downloadQuotationPDF(selectedInvoice, "", "")}
                    >
                        <Download className="mr-2 h-4 w-4 text-primary" /> PDF
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* New Quotation Dialog — smart search-select */}
      <Dialog open={isNewInvoiceOpen} onOpenChange={(open) => { setIsNewInvoiceOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-border/50 shadow-2xl">
          <div className="p-8 space-y-6 bg-background max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">New Quotation</h2>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Forensic Polygraph Services</p>
              </div>
            </div>

            {/* Client picker */}
            <div className="space-y-2 relative">
              <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                <User className="h-3 w-3" /> Client
              </Label>
              {form.client ? (
                <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/20">
                  <span className="font-bold text-sm">{form.client.name}</span>
                  <button onClick={() => setForm((f) => ({ ...f, client: null, clientSearch: "" }))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-12 pl-9 rounded-xl"
                    placeholder="Search clients…"
                    value={form.clientSearch}
                    onFocus={() => setForm((f) => ({ ...f, showClientList: true }))}
                    onChange={(e) => setForm((f) => ({ ...f, clientSearch: e.target.value, showClientList: true }))}
                  />
                  {form.showClientList && filteredFormClients.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-44 overflow-y-auto">
                      {filteredFormClients.map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 flex flex-col"
                          onClick={() => setForm((f) => ({ ...f, client: c, clientSearch: "", showClientList: false }))}
                        >
                          {c.name}
                          <span className="text-[10px] text-muted-foreground font-normal">{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Exam type picker */}
            <div className="space-y-2 relative">
              <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" /> Exam Type
              </Label>
              {form.examType ? (
                <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">{form.examType.name}</span>
                    <Badge variant="outline" className="text-[9px] font-black">${form.examType.price.toFixed(2)}</Badge>
                  </div>
                  <button onClick={() => setForm((f) => ({ ...f, examType: null, examTypeSearch: "" }))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-12 pl-9 rounded-xl"
                    placeholder="Search exam types…"
                    value={form.examTypeSearch}
                    onFocus={() => setForm((f) => ({ ...f, showExamTypeList: true }))}
                    onChange={(e) => setForm((f) => ({ ...f, examTypeSearch: e.target.value, showExamTypeList: true }))}
                  />
                  {form.showExamTypeList && filteredFormExamTypes.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-44 overflow-y-auto">
                      {filteredFormExamTypes.map((et) => (
                        <button
                          key={et.id}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 flex items-center justify-between"
                          onClick={() => setForm((f) => ({ ...f, examType: et, examTypeSearch: "", showExamTypeList: false }))}
                        >
                          <span>{et.name}</span>
                          <span className="text-xs font-black text-primary">${et.price.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Examiner picker */}
            <div className="space-y-2 relative">
              <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                <Stethoscope className="h-3 w-3" /> Rendering Examiner
              </Label>
              {form.examiner ? (
                <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/20">
                  <span className="font-bold text-sm">{form.examiner.name}</span>
                  <button onClick={() => setForm((f) => ({ ...f, examiner: null, examinerSearch: "" }))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-12 pl-9 rounded-xl"
                    placeholder="Search examiners…"
                    value={form.examinerSearch}
                    onFocus={() => setForm((f) => ({ ...f, showExaminerList: true }))}
                    onChange={(e) => setForm((f) => ({ ...f, examinerSearch: e.target.value, showExaminerList: true }))}
                  />
                  {form.showExaminerList && filteredFormExaminers.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-44 overflow-y-auto">
                      {filteredFormExaminers.map((ex) => (
                        <button
                          key={ex.id}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 flex flex-col"
                          onClick={() => setForm((f) => ({ ...f, examiner: ex, examinerSearch: "", showExaminerList: false }))}
                        >
                          {ex.name}
                          <span className="text-[10px] text-muted-foreground font-normal">{ex.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fee preview / extra items */}
            {form.examType && (
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Fee Schedule</Label>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                    <span className="text-xs font-bold">{form.examType.name}</span>
                    <span className="text-sm font-black text-primary">${form.examType.price.toFixed(2)}</span>
                  </div>
                  {form.extraItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-4 py-2 border-t border-border/50">
                      <Input
                        className="h-9 flex-1 text-xs"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => {
                          const next = [...form.extraItems];
                          next[idx] = { ...next[idx], description: e.target.value };
                          setForm((f) => ({ ...f, extraItems: next }));
                        }}
                      />
                      <div className="relative w-24">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          className="h-9 pl-6 text-xs"
                          placeholder="0.00"
                          value={item.amount || ""}
                          onChange={(e) => {
                            const next = [...form.extraItems];
                            next[idx] = { ...next[idx], amount: parseFloat(e.target.value) || 0 };
                            setForm((f) => ({ ...f, extraItems: next }));
                          }}
                        />
                      </div>
                      <button
                        className="text-muted-foreground hover:text-rose-500 transition-colors"
                        onClick={() => setForm((f) => ({ ...f, extraItems: f.extraItems.filter((_, i) => i !== idx) }))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    className="w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 border-t border-border/50 transition-colors"
                    onClick={() => setForm((f) => ({ ...f, extraItems: [...f.extraItems, { description: "", amount: 0 }] }))}
                  >
                    + Add fee line
                  </button>
                </div>
                <div className="flex justify-between items-center px-1 pt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total</span>
                  <span className="text-lg font-black text-foreground">
                    ${(form.examType.price + form.extraItems.reduce((s, i) => s + i.amount, 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <Button
              className="w-full h-13 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
              onClick={() => void handleCreateInvoice()}
              disabled={!form.client || !form.examType}
            >
              Generate &amp; Save Quotation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSendQuoteOpen} onOpenChange={setIsSendQuoteOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-[2rem] p-8 border-border/50 shadow-2xl bg-background">
          <DialogHeader>
            <DialogTitle>Send Quotation Email</DialogTitle>
            <DialogDescription>
              This records email delivery details so your team can track quote communication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Recipient email"
              value={sendEmail.toEmail}
              onChange={(e) => setSendEmail((v) => ({ ...v, toEmail: e.target.value }))}
            />
            <Input
              placeholder="Email subject"
              value={sendEmail.subject}
              onChange={(e) => setSendEmail((v) => ({ ...v, subject: e.target.value }))}
            />
            <Input
              placeholder="Message"
              value={sendEmail.body}
              onChange={(e) => setSendEmail((v) => ({ ...v, body: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendQuoteOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSendQuotation()}>Mark as Sent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog
        open={isRecordPaymentOpen}
        onOpenChange={(open) => {
          if (recordingPayment) return;
          setIsRecordPaymentOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[440px] rounded-[3rem] p-12 border-border/50 shadow-2xl bg-background">
          <div className="space-y-8">
            <div className="space-y-3">
                <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                    <DollarSign className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-black tracking-tighter text-foreground">Record Payment</h2>
                <p className="text-muted-foreground font-bold text-xs leading-relaxed">
                    Verify and enter the amount collected. Partial payments are supported for clinical cases.
                </p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Collection Amount ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
                <Input 
                  placeholder="0.00" 
                  className="h-20 pl-14 rounded-[1.5rem] border-border/50 bg-muted/30 text-3xl font-black focus:bg-background transition-all shadow-inner"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  disabled={recordingPayment}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                    {[100, 250, 500].map(val => (
                        <Button 
                            key={val}
                            variant="outline" 
                            className="h-12 rounded-2xl text-[11px] font-black border-border/40 hover:bg-muted/50 transition-all"
                            disabled={recordingPayment}
                            onClick={() => setPaymentAmount(val.toString())}
                        >
                            +${val}
                        </Button>
                    ))}
              </div>
            </div>

            <div className="pt-4">
                <Button 
                    className="w-full h-16 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] bg-primary text-primary-foreground shadow-2xl shadow-primary/20 hover:scale-[1.03] transition-all disabled:opacity-70 disabled:hover:scale-100" 
                    onClick={() => void handleRecordPayment()}
                    disabled={recordingPayment}
                >
                    {recordingPayment ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Confirm Entry"
                    )}
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

