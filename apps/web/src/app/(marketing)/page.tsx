"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MockSpotsCalendar } from "@/components/mock-spots-calendar";
import { Activity } from "lucide-react";

export default function Home() {
  const [status, setStatus] = useState<string>("Checking...");

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/health`);
        const data = await response.json();
        setStatus(data.status === "ok" ? "System Online" : "System Error");
      } catch (error) {
        setStatus("System Offline");
      }
    };

    fetchStatus();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 px-4 text-center">
          <div className="container mx-auto max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-6 border border-primary/20 uppercase tracking-wider">
              <Activity className="w-3 h-3" />
              {status}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 text-foreground">
              Modern Practice Management
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Streamline your forensic operations, schedule appointments with ease, and manage secure documentation all in one place.
            </p>
            <div className="flex justify-center gap-4">
              <Button size="lg" className="rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary/90">
                Get Started
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8">
                Learn More
              </Button>
            </div>
          </div>
        </section>

        {/* Scheduling Section */}
        <section className="py-16 bg-muted/30 border-y">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4 text-foreground">Book an Appointment</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Select from our available slots below to schedule a session with our certified examiners.
              </p>
            </div>
            
            <MockSpotsCalendar />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-muted/30 text-muted-foreground py-12 text-center border-t">
        <div className="container mx-auto px-4 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 grayscale opacity-50 text-foreground">
            <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              P
            </div>
            <span className="font-bold text-lg tracking-tight">Polygraph</span>
          </div>
          <p className="text-sm opacity-60">© 2026 Polygraph System. All rights reserved.</p>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${status === "System Online" ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-[10px] uppercase tracking-widest opacity-40">Backend: {process.env.NEXT_PUBLIC_SERVER_URL}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
