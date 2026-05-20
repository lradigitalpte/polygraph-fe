"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

export default function ClientBiometricsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Biometric Data</h2>
        <p className="text-muted-foreground">
          Physiological baselines and session charts will be available here.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            HR, GSR, RESP, and BVP traces from completed exams will be linked to this client record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-end gap-2 px-2 py-4 opacity-40">
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
