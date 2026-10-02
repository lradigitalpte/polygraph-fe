"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Loader2,
  Search,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchClients, type ClientRecord } from "@/lib/clients";
import { catalogPriceInCurrency, formatMoney } from "@/lib/client-account";
import { fetchExamTypes, type ExamTypeRecord } from "@/lib/exam-booking";
import { createQuotation } from "@/lib/quotations";
import { computeQuotationTotal } from "@/lib/quotation-pricing";
import { fetchOrganizationSettings } from "@/lib/settings";
import { fetchExaminers, type UserRecord } from "@/lib/users";

export default function NewQuotationPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [clients, setClients] = React.useState<ClientRecord[]>([]);
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [orgCurrency, setOrgCurrency] = React.useState("AED");
  const [orgSettings, setOrgSettings] = React.useState<{
    usd_aed_rate?: number;
    usd_gbp_rate?: number;
    usd_eur_rate?: number;
  }>({});

  const [form, setForm] = React.useState({
    client: null as ClientRecord | null,
    clientSearch: "",
    showClientList: false,
    examType: null as ExamTypeRecord | null,
    examTypeSearch: "",
    showExamTypeList: false,
    examiner: null as UserRecord | null,
    examinerSearch: "",
    showExaminerList: false,
    currency: "AED",
    discountType: "percent" as "percent" | "fixed",
    discountValue: 0,
    includeVat: false,
    vatRate: 5,
    extraItems: [] as { description: string; amount: number }[],
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, et, ex, org] = await Promise.all([
          fetchClients(),
          fetchExamTypes(),
          fetchExaminers(),
          fetchOrganizationSettings().catch(() => null),
        ]);
        if (cancelled) return;
        setClients(c);
        setExamTypes(et);
        setExaminers(ex);
        const currency = (org?.currency || "AED").toUpperCase();
        setOrgCurrency(currency);
        setOrgSettings({
          usd_aed_rate: org?.usd_aed_rate,
          usd_gbp_rate: org?.usd_gbp_rate,
          usd_eur_rate: org?.usd_eur_rate,
        });
        setForm((f) => ({
          ...f,
          currency,
          vatRate: org?.default_vat_rate ?? 5,
        }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load form data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredClients = React.useMemo(() => {
    const q = form.clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q)).slice(0, 8);
  }, [clients, form.clientSearch]);

  const filteredExamTypes = React.useMemo(() => {
    const q = form.examTypeSearch.trim().toLowerCase();
    if (!q) return examTypes.slice(0, 8);
    return examTypes.filter((et) => et.name.toLowerCase().includes(q)).slice(0, 8);
  }, [examTypes, form.examTypeSearch]);

  const filteredExaminers = React.useMemo(() => {
    const q = form.examinerSearch.trim().toLowerCase();
    if (!q) return examiners.slice(0, 8);
    return examiners.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [examiners, form.examinerSearch]);

  const preview = React.useMemo(() => {
    if (!form.examType) return null;
    const basePrice = catalogPriceInCurrency(form.examType.price, form.currency, orgSettings);
    const lineItems = [
      { description: form.examType.name, amount: basePrice },
      ...form.extraItems.filter((item) => item.description.trim() && item.amount > 0),
    ];
    const subtotal = lineItems.reduce((acc, item) => acc + item.amount, 0);
    const discountAmount = Math.min(
      form.discountValue > 0
        ? form.discountType === "percent"
          ? subtotal * (form.discountValue / 100)
          : form.discountValue
        : 0,
      subtotal,
    );
    const priced = computeQuotationTotal({
      subtotal,
      discountAmount,
      vatRate: form.vatRate,
      applyVat: form.includeVat,
    });
    return {
      lineItems,
      subtotal: priced.subtotal,
      discountAmount: priced.discountAmount,
      vatAmount: priced.vatAmount,
      vatRate: priced.vatRate,
      total: priced.total,
    };
  }, [form, orgSettings]);

  const handleCreate = async () => {
    if (!form.client || !form.examType || !preview) {
      toast.error("Client and exam type are required");
      return;
    }
    if (preview.total <= 0) {
      toast.error("Total must be greater than zero");
      return;
    }

    const discountLabel = `Discount${form.discountType === "percent" ? ` (${form.discountValue}%)` : ""}`;
    const title = [form.examType.name, form.examiner ? `— ${form.examiner.name}` : ""].filter(Boolean).join(" ");
    const description = [
      ...preview.lineItems.map((item) => `${item.description}: ${formatMoney(item.amount, form.currency)}`),
      preview.discountAmount > 0 ? `${discountLabel}: -${formatMoney(preview.discountAmount, form.currency)}` : null,
      preview.vatAmount > 0 ? `VAT (${preview.vatRate}%): ${formatMoney(preview.vatAmount, form.currency)}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    setCreating(true);
    try {
      const record = await createQuotation({
        client_id: form.client.id,
        title,
        description,
        amount: preview.total,
        subtotal_amount: preview.subtotal,
        discount_amount: preview.discountAmount,
        vat_rate: preview.vatAmount > 0 ? preview.vatRate : 0,
        vat_amount: preview.vatAmount,
        currency: form.currency,
      });
      toast.success("Quotation created");
      router.push(`/dashboard/payments/q/${record.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create quotation");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20 px-4 sm:px-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard/payments" />} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Quotation</h1>
          <p className="text-sm text-muted-foreground">Create an invoice, then send payment from the invoice page.</p>
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Quotation details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 relative">
            <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
              <User className="h-3 w-3" /> Client
            </Label>
            {form.client ? (
              <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/20">
                <span className="font-bold text-sm">{form.client.name}</span>
                <button type="button" onClick={() => setForm((f) => ({ ...f, client: null, clientSearch: "" }))} className="text-muted-foreground hover:text-foreground">
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
                {form.showClientList && filteredClients.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-44 overflow-y-auto">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted/50"
                        onClick={() => setForm((f) => ({ ...f, client: c, clientSearch: "", showClientList: false }))}
                      >
                        {c.name}
                        <span className="block text-[10px] text-muted-foreground font-normal">{c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 relative">
            <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
              <ClipboardList className="h-3 w-3" /> Exam Type
            </Label>
            {form.examType ? (
              <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">{form.examType.name}</span>
                  <Badge variant="outline" className="text-[9px] font-black">
                    {formatMoney(catalogPriceInCurrency(form.examType.price, form.currency, orgSettings), form.currency)}
                  </Badge>
                </div>
                <button type="button" onClick={() => setForm((f) => ({ ...f, examType: null, examTypeSearch: "" }))} className="text-muted-foreground hover:text-foreground">
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
                {form.showExamTypeList && filteredExamTypes.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-44 overflow-y-auto">
                    {filteredExamTypes.map((et) => (
                      <button
                        key={et.id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 flex justify-between"
                        onClick={() => setForm((f) => ({ ...f, examType: et, examTypeSearch: "", showExamTypeList: false }))}
                      >
                        <span>{et.name}</span>
                        <span className="text-xs font-black text-primary">
                          {formatMoney(catalogPriceInCurrency(et.price, form.currency, orgSettings), form.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 relative">
            <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
              <Stethoscope className="h-3 w-3" /> Examiner (optional)
            </Label>
            {form.examiner ? (
              <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/20">
                <span className="font-bold text-sm">{form.examiner.name}</span>
                <button type="button" onClick={() => setForm((f) => ({ ...f, examiner: null, examinerSearch: "" }))} className="text-muted-foreground hover:text-foreground">
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
                {form.showExaminerList && filteredExaminers.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-44 overflow-y-auto">
                    {filteredExaminers.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted/50"
                        onClick={() => setForm((f) => ({ ...f, examiner: e, examinerSearch: "", showExaminerList: false }))}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Currency</Label>
              <Select value={form.currency} onValueChange={(val) => setForm((f) => ({ ...f, currency: (val as string) || orgCurrency }))}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["AED", "USD", "GBP", "EUR"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Discount</Label>
              <div className="flex gap-2">
                <Select
                  value={form.discountType}
                  onValueChange={(val) => setForm((f) => ({ ...f, discountType: ((val as string) || "percent") as "percent" | "fixed" }))}
                >
                  <SelectTrigger className="h-12 w-28 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">%</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  className="h-12 rounded-xl"
                  value={form.discountValue || ""}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold shrink-0">
              <input
                type="checkbox"
                checked={form.includeVat}
                onChange={(e) => setForm((f) => ({ ...f, includeVat: e.target.checked }))}
              />
              Include VAT
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">VAT rate (%)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="h-10 w-24 rounded-xl"
                value={form.vatRate}
                disabled={!form.includeVat}
                onChange={(e) => setForm((f) => ({ ...f, vatRate: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {preview && (
            <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-bold">{formatMoney(preview.subtotal, form.currency)}</span>
              </div>
              {preview.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-rose-600">
                  <span>Discount</span>
                  <span className="font-bold">-{formatMoney(preview.discountAmount, form.currency)}</span>
                </div>
              )}
              {preview.vatAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>VAT</span>
                  <span className="font-bold">{formatMoney(preview.vatAmount, form.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black border-t border-border/40 pt-2">
                <span>Total</span>
                <span>{formatMoney(preview.total, form.currency)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-12 rounded-2xl" render={<Link href="/dashboard/payments" />}>
              Cancel
            </Button>
            <Button className="flex-1 h-12 rounded-2xl font-black" onClick={() => void handleCreate()} disabled={creating || !form.client || !form.examType}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating…
                </>
              ) : (
                "Create quotation"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
