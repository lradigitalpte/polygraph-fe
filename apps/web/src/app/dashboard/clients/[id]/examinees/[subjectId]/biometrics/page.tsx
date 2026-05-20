"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { formatSubjectName } from "@/lib/subjects";
import { Activity, FolderLock, Loader2 } from "lucide-react";

export default function ExamineeBiometricsPage() {
  const params = useParams();
  const clientId = params.id as string;
  const subjectId = params.subjectId as string;
  const documentsHref = `/dashboard/clients/${clientId}/examinees/${subjectId}/documents`;
  const { subject, loading, error } = useSubjectDetail();

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
      </div>
    );
  }

  if (error || !subject) {
    return <p className="text-destructive">{error || "Examinee not found"}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Biometric data</h2>
        <p className="text-sm text-muted-foreground">
          Physiological baseline for {formatSubjectName(subject)}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Baseline chart
          </CardTitle>
          <CardDescription>
            Live instrument feeds will connect here in a future update. Upload chart and trace
            files under Documents in the meantime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            className="mb-4"
            render={<Link href={documentsHref as `/dashboard/clients/${string}/examinees/${string}/documents`} />}
          >
            <FolderLock className="h-4 w-4 mr-2" />
            Upload test charts & traces
          </Button>
          <div className="h-[200px] flex items-end gap-2 px-2 py-4">
            {[40, 70, 45, 90, 65, 80, 50, 85, 60, 75].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-primary/20 rounded-t-sm"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-2">
            <span>HR</span>
            <span>GSR</span>
            <span>RESP</span>
            <span>BVP</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
