"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Download, FileText, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPublicSharedDoc, type PublicSharedDocument } from "@/lib/document-shares";

export default function PublicSharedDocumentPage() {
  const params = useParams();
  const token = params.token as string;
  const [doc, setDoc] = React.useState<PublicSharedDocument | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchPublicSharedDoc(token)
      .then((data) => {
        if (!cancelled) setDoc(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load document");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const expiryDate = doc
    ? new Date(doc.expires_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-lg mx-auto mb-8 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-primary">
          Polygraph Forensic System
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error || !doc ? (
        <Card className="max-w-lg mx-auto border-destructive/30">
          <CardHeader>
            <CardTitle>Document unavailable</CardTitle>
            <CardDescription>{error ?? "This link could not be opened."}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary mb-2">
              <Shield className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Secure document</span>
            </div>
            <CardTitle>A document has been shared with you</CardTitle>
            {doc.recipient_name && (
              <CardDescription>For: {doc.recipient_name}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4">
              <div className="h-11 w-11 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">Link expires {expiryDate}</p>
              </div>
            </div>
            <Button
              className="w-full h-11 gap-2"
              render={<a href={doc.url} target="_blank" rel="noopener noreferrer" />}
            >
              <Download className="h-4 w-4" />
              View / Download
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              If the button does not work, copy this link into your browser:
              <br />
              <span className="break-all">{doc.url}</span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
