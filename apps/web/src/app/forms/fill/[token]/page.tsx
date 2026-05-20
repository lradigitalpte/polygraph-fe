"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  fetchPublicForm,
  submitPublicForm,
  type FormField,
  type PublicFormView,
} from "@/lib/forms";

export default function PublicFormFillPage() {
  const params = useParams();
  const token = params.token as string;
  const [view, setView] = React.useState<PublicFormView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [values, setValues] = React.useState<Record<string, string | boolean>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPublicForm(token);
        if (!cancelled) {
          setView(data);
          const initial: Record<string, string | boolean> = {};
          for (const field of data.schema.fields) {
            initial[field.key] = field.type === "checkbox" ? false : "";
          }
          if (data.request.recipient_name) {
            const nameField = data.schema.fields.find((f) => f.key.includes("name"));
            if (nameField && !initial[nameField.key]) {
              initial[nameField.key] = data.request.recipient_name;
            }
          }
          if (data.request.recipient_email) {
            const emailField = data.schema.fields.find((f) => f.type === "email");
            if (emailField) {
              initial[emailField.key] = data.request.recipient_email;
            }
          }
          setValues(initial);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load form");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitPublicForm(token, values);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageShell>
    );
  }

  if (error && !view) {
    return (
      <PageShell>
        <Card className="max-w-lg mx-auto border-destructive/30">
          <CardHeader>
            <CardTitle>Form unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  if (done) {
    return (
      <PageShell>
        <Card className="max-w-lg mx-auto text-center">
          <CardContent className="pt-10 pb-10 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <h1 className="text-2xl font-bold">Thank you</h1>
            <p className="text-muted-foreground">
              Your form has been submitted securely. Our team has received your responses.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!view) return null;

  return (
    <PageShell>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary mb-2">
            <Shield className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Secure form</span>
          </div>
          <CardTitle>{view.template.name}</CardTitle>
          {view.template.description && (
            <CardDescription>{view.template.description}</CardDescription>
          )}
          {view.request.recipient_name && (
            <p className="text-sm text-muted-foreground pt-1">
              For: <span className="font-medium text-foreground">{view.request.recipient_name}</span>
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {view.schema.fields.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
              />
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit form"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer">
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(Boolean(c))}
        />
        <span className="text-sm leading-snug">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
          {field.help && (
            <span className="block text-xs text-muted-foreground mt-1">{field.help}</span>
          )}
        </span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-2">
        <Label>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <div className="space-y-2">
        <Label>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(String(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        type={field.type === "email" ? "email" : "text"}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-primary">
          Polygraph Forensic System
        </p>
      </div>
      {children}
    </div>
  );
}
