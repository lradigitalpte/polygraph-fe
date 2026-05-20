"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { deleteClient, formatClientCode, updateClient, type ClientRecord } from "@/lib/clients";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  clientType: string;
  gender: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  paymentMethod: string;
  notes: string;
};

const fieldLabelClass =
  "text-xs font-bold uppercase tracking-wider text-muted-foreground";

function clientToForm(client: ClientRecord): FormState {
  return {
    name: client.name ?? "",
    clientType: client.client_type || "Individual",
    gender: client.gender ?? "",
    contactPerson: client.contact_person ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    taxId: client.tax_id ?? "",
    paymentMethod: client.preferred_payment_method || "Bank Transfer",
    notes: client.notes ?? "",
  };
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isCompanyType(clientType: string) {
  const t = clientType.toLowerCase();
  return t.includes("corporate") || t.includes("law");
}

function FormField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor} className={fieldLabelClass}>
        {label}
      </Label>
      {children}
    </div>
  );
}

export default function ClientPersonalDetailsPage() {
  const router = useRouter();
  const { client, clientId, loading, error, setClientRecord } = useClientDetail();
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (client) {
      setForm(clientToForm(client));
      setDirty(false);
    }
  }, [client]);

  const handleInput = (field: keyof FormState, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setDirty(true);
  };

  const handleReset = () => {
    if (client) {
      setForm(clientToForm(client));
      setDirty(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    if (!form.name.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateClient(clientId, {
        name: form.name.trim(),
        client_type: form.clientType,
        gender: form.gender.trim() || undefined,
        contact_person: form.contactPerson.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        tax_id: form.taxId.trim() || undefined,
        preferred_payment_method: form.paymentMethod,
        notes: form.notes.trim() || undefined,
      });
      setClientRecord(updated);
      setForm(clientToForm(updated));
      toast.success("Client details saved");
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading personal details...
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
        {error || "Client record not found."}
      </div>
    );
  }

  const showContactPerson = isCompanyType(form.clientType);
  const showGender = !showContactPerson;
  const inputClass = "h-11 rounded-xl";

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Personal Details</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Update identification, contact, and billing for this client record.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
            {formatClientCode(client.id)}
          </Badge>
          {dirty && (
            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/15">
              Unsaved changes
            </Badge>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  General Information
                </CardTitle>
                <CardDescription>Primary identification for this client.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField label="Full name or organization" htmlFor="name">
                  <Input
                    id="name"
                    required
                    placeholder="e.g. John Doe or Acme Corp"
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => handleInput("name", e.target.value)}
                    disabled={saving}
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Client type">
                    <Select
                      value={form.clientType}
                      onValueChange={(value) => handleInput("clientType", String(value))}
                      disabled={saving}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Individual">Individual</SelectItem>
                        <SelectItem value="Corporate">Corporate</SelectItem>
                        <SelectItem value="Law Firm">Law Firm</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>

                  {showGender ? (
                    <FormField label="Gender">
                      <Select
                        value={form.gender || "unset"}
                        onValueChange={(value) =>
                          handleInput("gender", value === "unset" ? "" : String(value))
                        }
                        disabled={saving}
                      >
                        <SelectTrigger className={inputClass}>
                          <SelectValue placeholder="Not specified" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">Not specified</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                  ) : (
                    <FormField label="Contact person" htmlFor="contact_person">
                      <Input
                        id="contact_person"
                        placeholder="Primary contact name"
                        className={inputClass}
                        value={form.contactPerson}
                        onChange={(e) => handleInput("contactPerson", e.target.value)}
                        disabled={saving}
                      />
                    </FormField>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Contact & Location
                </CardTitle>
                <CardDescription>How to reach this client.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Email address" htmlFor="email">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="client@example.com"
                        className={cn(inputClass, "pl-10")}
                        value={form.email}
                        onChange={(e) => handleInput("email", e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </FormField>
                  <FormField label="Phone number" htmlFor="phone">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="phone"
                        placeholder="+1 (555) 000-0000"
                        className={cn(inputClass, "pl-10")}
                        value={form.phone}
                        onChange={(e) => handleInput("phone", e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </FormField>
                </div>
                <FormField label="Physical address" htmlFor="address">
                  <Textarea
                    id="address"
                    placeholder="Street, city, postal code..."
                    className="min-h-[100px] rounded-xl resize-none"
                    value={form.address}
                    onChange={(e) => handleInput("address", e.target.value)}
                    disabled={saving}
                  />
                </FormField>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base">Record</CardTitle>
                <CardDescription>System metadata (read-only).</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-3 text-sm">
                <div className="flex justify-between gap-4 py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Registered</span>
                  <span className="font-medium">{formatDate(client.created_at)}</span>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <span className="text-muted-foreground">Last updated</span>
                  <span className="font-medium">{formatDate(client.updated_at)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Billing
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField label="Tax ID / VAT" htmlFor="tax_id">
                  <Input
                    id="tax_id"
                    placeholder="Optional"
                    className={inputClass}
                    value={form.taxId}
                    onChange={(e) => handleInput("taxId", e.target.value)}
                    disabled={saving}
                  />
                </FormField>
                <FormField label="Payment method">
                  <Select
                    value={form.paymentMethod}
                    onValueChange={(value) => handleInput("paymentMethod", String(value))}
                    disabled={saving}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Internal Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Textarea
                  id="notes"
                  placeholder="Private notes about this client..."
                  className="min-h-[120px] rounded-xl resize-none text-sm"
                  value={form.notes}
                  onChange={(e) => handleInput("notes", e.target.value)}
                  disabled={saving}
                />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={saving || !dirty}
                className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20 gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Saving..." : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={saving || !dirty}
                onClick={handleReset}
                className="w-full h-11 rounded-xl text-muted-foreground gap-2"
              >
                <X className="h-4 w-4" />
                Discard changes
              </Button>
            </div>

            <Card className="border-destructive/30 shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-destructive">Delete client record</CardTitle>
                <CardDescription>
                  Permanently removes this client, all examinees, sessions, documents, and billing history.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteConfirmDialog
                  title={`Delete ${client.name}`}
                  description={`Type the client name exactly to confirm. This cannot be undone.`}
                  confirmLabel="Type client name to confirm"
                  confirmPlaceholder={client.name}
                  expectedValue={client.name}
                  triggerLabel="Delete client record"
                  onConfirm={async (typed) => {
                    if (!typed) return;
                    try {
                      await deleteClient(clientId, typed);
                      toast.success("Client record deleted");
                      router.push("/dashboard/clients");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to delete client");
                      throw err;
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
