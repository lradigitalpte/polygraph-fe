"use client";

import * as React from "react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
const STORAGE_KEY = "polygraph.notification-prefs";

type NotificationPrefs = {
  emailReminders: boolean;
  emailFormUpdates: boolean;
  emailAppointments: boolean;
};

const defaults: NotificationPrefs = {
  emailReminders: true,
  emailFormUpdates: true,
  emailAppointments: true,
};

function loadPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export default function ProfileNotificationsPage() {
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(defaults);

  React.useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    toast.success("Notification preferences saved on this device");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Choose which email alerts you want. Stored locally until server preferences are added.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email alerts</CardTitle>
          <CardDescription>These preferences apply to this browser only for now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["emailReminders", "Payment and form reminders"],
              ["emailFormUpdates", "Online form submissions"],
              ["emailAppointments", "Appointment confirmations and changes"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 rounded-lg border p-4 cursor-pointer">
              <span className="text-sm font-medium">{label}</span>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={prefs[key]}
                onChange={() => toggle(key)}
              />
            </label>
          ))}
          <Button onClick={handleSave}>Save preferences</Button>
        </CardContent>
      </Card>
    </div>
  );
}
