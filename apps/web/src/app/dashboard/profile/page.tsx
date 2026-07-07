"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { deleteMyAccount, deleteMySignature, fetchMe, fetchMySignature, updateMe, uploadMySignature } from "@/lib/account";

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [roleName, setRoleName] = React.useState("");
  const [signatureImage, setSignatureImage] = React.useState("");
  const [signatureTitle, setSignatureTitle] = React.useState("Private Polygraph Examiner");
  const [signatureOrganization, setSignatureOrganization] = React.useState("Polygraph International HR Consultancy LLC");
  const [signatureSaving, setSignatureSaving] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const me = await fetchMe();
        setName(me.name);
        setEmail(me.email);
        setRoleName(me.role?.name ?? "");
        const signature = await fetchMySignature();
        if (signature) {
          setSignatureImage(signature.image);
          setSignatureTitle(signature.title);
          setSignatureOrganization(signature.organization);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const me = await updateMe({ name: name.trim() });
      setName(me.name);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureUpload = async (file?: File) => {
    if (!file) return;
    setSignatureSaving(true);
    try {
      await uploadMySignature(file, signatureTitle.trim(), signatureOrganization.trim());
      const signature = await fetchMySignature();
      setSignatureImage(signature?.image ?? "");
      toast.success("Examiner signature saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload signature");
    } finally { setSignatureSaving(false); }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteMyAccount();
      await authClient.signOut();
      toast.success("Your account was deleted");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">My Profile</h3>
        <p className="text-sm text-muted-foreground">Manage your display name and account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update how your name appears across the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex items-center gap-6 mb-4">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl border-2 border-primary/20">
                  {initials(name, email)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Role: <span className="font-medium text-foreground">{roleName || "—"}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={email} disabled />
                <p className="text-[10px] text-muted-foreground">
                  Email is tied to your sign-in account and cannot be changed here.
                </p>
              </div>

              <Button onClick={() => void handleSave()} disabled={saving || !name.trim()}>
                {saving ? "Saving…" : "Update Profile"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {roleName.toLowerCase() === "examiner" && (
        <Card>
          <CardHeader>
            <CardTitle>Report Signature</CardTitle>
            <CardDescription>Your signature is applied only when an authorized user finalizes a report under your recorded authorization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {signatureImage && <div className="w-fit rounded-xl border bg-white p-4"><img src={signatureImage} alt="Saved signature" className="h-20 max-w-72 object-contain" /></div>}
            <div className="grid gap-2"><Label htmlFor="signature-title">Professional title</Label><Input id="signature-title" value={signatureTitle} onChange={(e) => setSignatureTitle(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="signature-org">Organization</Label><Input id="signature-org" value={signatureOrganization} onChange={(e) => setSignatureOrganization(e.target.value)} /></div>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                {signatureSaving ? "Uploading..." : signatureImage ? "Replace Signature PNG" : "Upload Signature PNG"}
                <input type="file" accept="image/png,.png" className="hidden" disabled={signatureSaving || !signatureTitle.trim() || !signatureOrganization.trim()} onChange={(e) => void handleSignatureUpload(e.target.files?.[0])} />
              </label>
              {signatureImage && <Button type="button" variant="outline" onClick={() => void deleteMySignature().then(() => { setSignatureImage(""); toast.success("Signature removed"); })}>Remove</Button>}
            </div>
            <p className="text-xs text-muted-foreground">Use a transparent PNG, maximum 1 MB. A snapshot is retained in each finalized report.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently remove your staff account and sign-in. You will not be able to sign in again with this email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteConfirmDialog
            title="Delete your account"
            description="This permanently deletes your user record and authentication login. Other staff accounts are not affected."
            confirmLabel="Confirmation"
            triggerLabel="Delete My Account"
            onConfirm={handleDeleteAccount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
