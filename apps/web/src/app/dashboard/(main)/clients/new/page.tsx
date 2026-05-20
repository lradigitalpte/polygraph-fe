"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Phone,
  Save,
  Scale,
  User,
} from "lucide-react";
import { toast } from "sonner";

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
import { createClient } from "@/lib/clients";

type FormState = {
  name: string;
  clientType: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  paymentMethod: string;
  notes: string;
};

const initialState: FormState = {
  name: "",
  clientType: "Individual",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  taxId: "",
  paymentMethod: "Bank Transfer",
  notes: "",
};

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(initialState);

  const handleInput = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }

    setLoading(true);
    try {
      await createClient({
        name: form.name.trim(),
        client_type: form.clientType,
        contact_person: form.contactPerson.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        tax_id: form.taxId.trim() || undefined,
        preferred_payment_method: form.paymentMethod,
        notes: form.notes.trim() || undefined,
      });

      toast.success("Client created successfully");
      router.push("/dashboard/clients");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create client";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/dashboard/clients" />} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Add New Client</h1>
          <p className="text-sm text-muted-foreground font-medium">Create a new organization or individual record.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  General Information
                </CardTitle>
                <CardDescription>Primary identification details for the client.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name or Company Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Acme Corp or John Doe"
                    required
                    className="h-11 rounded-xl"
                    value={form.name}
                    onChange={(e) => handleInput("name", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client Type</Label>
                    <Select value={form.clientType} onValueChange={(value) => handleInput("clientType", String(value))}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Individual">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>Individual</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="Corporate">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>Corporate</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="Law Firm">
                          <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4 text-muted-foreground" />
                            <span>Law Firm</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contact_person" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Person</Label>
                    <Input
                      id="contact_person"
                      placeholder="Primary contact name"
                      className="h-11 rounded-xl"
                      value={form.contactPerson}
                      onChange={(e) => handleInput("contactPerson", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Contact and Location
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-primary">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="client@example.com"
                        required
                        className="h-11 pl-10 rounded-xl"
                        value={form.email}
                        onChange={(e) => handleInput("email", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="+1 (555) 000-0000"
                        className="h-11 pl-10 rounded-xl"
                        value={form.phone}
                        onChange={(e) => handleInput("phone", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Physical Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Full street address..."
                    className="min-h-[100px] rounded-xl resize-none"
                    value={form.address}
                    onChange={(e) => handleInput("address", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Billing
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="tax_id" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tax ID / VAT</Label>
                  <Input
                    id="tax_id"
                    placeholder="Registration number"
                    className="h-11 rounded-xl"
                    value={form.taxId}
                    onChange={(e) => handleInput("taxId", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payment_method" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Method</Label>
                  <Select value={form.paymentMethod} onValueChange={(value) => handleInput("paymentMethod", String(value))}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  className="min-h-[120px] rounded-xl resize-none text-xs"
                  value={form.notes}
                  onChange={(e) => handleInput("notes", e.target.value)}
                />
              </CardContent>
            </Card>

            <div className="pt-4 flex flex-col gap-3">
              <Button type="submit" className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20 gap-2" disabled={loading}>
                {loading ? "Creating..." : <><Save className="h-4 w-4" /> Save Client</>}
              </Button>
              <Button type="button" variant="ghost" className="w-full h-11 rounded-xl text-muted-foreground" render={<Link href="/dashboard/clients" />}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
