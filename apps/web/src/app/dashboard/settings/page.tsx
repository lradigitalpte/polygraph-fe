"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteOrganizationData,
  fetchOrganizationSettings,
  updateOrganizationSettings,
} from "@/lib/settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [supportEmail, setSupportEmail] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [currency, setCurrency] = React.useState("AED");
  const [usdAedRate, setUsdAedRate] = React.useState("3.6725");
  const [usdGbpRate, setUsdGbpRate] = React.useState("0.7850");
  const [usdEurRate, setUsdEurRate] = React.useState("0.9250");
  const [sundayBookingsEnabled, setSundayBookingsEnabled] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const org = await fetchOrganizationSettings();
        setName(org.name);
        setSupportEmail(org.support_email ?? "");
        setAddress(org.address ?? "");
        setCurrency(org.currency ?? "AED");
        setUsdAedRate(String(org.usd_aed_rate ?? 3.6725));
        setUsdGbpRate(String(org.usd_gbp_rate ?? 0.7850));
        setUsdEurRate(String(org.usd_eur_rate ?? 0.9250));
        setSundayBookingsEnabled(org.sunday_bookings_enabled ?? false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const org = await updateOrganizationSettings({
        name: name.trim(),
        support_email: supportEmail.trim(),
        address: address.trim(),
        currency: currency,
        usd_aed_rate: parseFloat(usdAedRate) || 3.6725,
        usd_gbp_rate: parseFloat(usdGbpRate) || 0.7850,
        usd_eur_rate: parseFloat(usdEurRate) || 0.9250,
        sunday_bookings_enabled: sundayBookingsEnabled,
      });
      setName(org.name);
      setCurrency(org.currency ?? "AED");
      setUsdAedRate(String(org.usd_aed_rate ?? 3.6725));
      setUsdGbpRate(String(org.usd_gbp_rate ?? 0.7850));
      setUsdEurRate(String(org.usd_eur_rate ?? 0.9250));
      toast.success("Organization settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrganization = async (confirmName: string) => {
    try {
      await deleteOrganizationData(confirmName);
      toast.success("Organization data deleted. Users and roles were kept.");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete organization");
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">General Settings</h3>
        <p className="text-sm text-muted-foreground">
          Update your organization profile and public contact information.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Profile</CardTitle>
          <CardDescription>
            This information will be displayed on reports and client communications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-email">Support Email</Label>
                <Input
                  id="org-email"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-address">Physical Address</Label>
                <Input id="org-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-currency">Default Currency</Label>
                <Select value={currency} onValueChange={(val) => setCurrency(val as string)}>
                  <SelectTrigger id="org-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="AED">AED (AED)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Currency Conversion Rates (Relative to USD)</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-border/50 p-6 rounded-[2rem] bg-muted/10 shadow-inner">
                  <div className="grid gap-2">
                    <Label htmlFor="usd-aed-rate">AED per USD Rate</Label>
                    <Input
                      id="usd-aed-rate"
                      type="number"
                      step="0.0001"
                      value={usdAedRate}
                      onChange={(e) => setUsdAedRate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="usd-gbp-rate">GBP per USD Rate</Label>
                    <Input
                      id="usd-gbp-rate"
                      type="number"
                      step="0.0001"
                      value={usdGbpRate}
                      onChange={(e) => setUsdGbpRate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="usd-eur-rate">EUR per USD Rate</Label>
                    <Input
                      id="usd-eur-rate"
                      type="number"
                      step="0.0001"
                      value={usdEurRate}
                      onChange={(e) => setUsdEurRate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-3 rounded-lg border p-4">
                <Checkbox
                  checked={sundayBookingsEnabled}
                  onCheckedChange={(checked) => setSundayBookingsEnabled(Boolean(checked))}
                />
                <div>
                  <div className="text-sm font-medium">Allow Sunday bookings</div>
                  <div className="text-xs text-muted-foreground">
                    Enable this to make booking availability run Monday through Sunday. When disabled, Sundays remain closed.
                  </div>
                </div>
              </label>
              <Button className="w-fit" onClick={() => void handleSave()} disabled={saving || !name.trim()}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Exam Types</CardTitle>
            <CardDescription>
              Manage the protocols used in the booking flow and scheduling summaries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add, edit, or retire exam types without changing frontend code.
            </p>
            <Button variant="outline" render={<Link href={"/dashboard/settings/exam-types" as Route} />}>
              Manage Exam Types
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Question Library</CardTitle>
            <CardDescription>
              Reusable question templates per exam type that auto-populate a session and its report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Organize Relevant, Comparison, and Irrelevant question templates so examiners don&apos;t retype them per client.
            </p>
            <Button variant="outline" render={<Link href={"/dashboard/settings/question-library" as Route} />}>
              Manage Question Library
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Examiner Availability</CardTitle>
            <CardDescription>
              Manage full-day and time-window blocks that drive the booking calendar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Block leave days, vacations, training windows, or any other scheduling blackout periods for examiners.
            </p>
            <Button variant="outline" render={<Link href={"/dashboard/settings/availability" as Route} />}>
              Manage Availability
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User & Access Admin</CardTitle>
            <CardDescription>
              Jump into user assignment and role configuration from one place.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the admin center to manage examiners, booking staff, and security boundaries.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" render={<Link href={"/dashboard/settings/users" as Route} />}>
                Manage Users
              </Button>
              <Button variant="outline" render={<Link href={"/dashboard/settings/roles" as Route} />}>
                Manage Roles
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete all clients, examinees, appointments, exams, leads, forms, and audit logs. Staff
            accounts, roles, and exam types are kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteConfirmDialog
            title="Delete organization data"
            description={`Type "${name || "your organization name"}" to confirm. This cannot be undone.`}
            confirmLabel="Type organization name to confirm"
            expectedValue={name}
            triggerLabel="Delete Organization Data"
            onConfirm={async (typed) => {
              if (!typed) return;
              await handleDeleteOrganization(typed);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
