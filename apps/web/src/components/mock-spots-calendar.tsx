"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function MockSpotsCalendar() {
  const [selectedDate, setSelectedDate] = useState<number>(2);

  const dates = [
    { day: "Mon", date: 1, available: true },
    { day: "Tue", date: 2, available: true },
    { day: "Wed", date: 3, available: false },
    { day: "Thu", date: 4, available: true },
    { day: "Fri", date: 5, available: true },
    { day: "Sat", date: 6, available: false },
    { day: "Sun", date: 7, available: false },
  ];

  const timeSpots = [
    "09:00 AM",
    "09:30 AM",
    "10:00 AM",
    "11:30 AM",
    "01:00 PM",
    "02:30 PM",
    "04:00 PM",
  ];

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-md">
      <CardHeader className="bg-primary/5 border-b pb-6">
        <CardTitle className="text-2xl font-bold text-foreground">Schedule an Appointment</CardTitle>
        <CardDescription className="text-muted-foreground text-base">
          Select a date and time that works best for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Calendar Section */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">May 2026</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2 text-center">
              {dates.map((d) => (
                <div key={d.day} className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    {d.day}
                  </span>
                  <Button
                    variant={selectedDate === d.date ? "default" : "outline"}
                    className={`h-12 w-full rounded-lg ${
                      !d.available && "opacity-50 cursor-not-allowed"
                    } ${
                      selectedDate === d.date 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "hover:bg-accent/10 hover:text-accent"
                    }`}
                    disabled={!d.available}
                    onClick={() => setSelectedDate(d.date)}
                  >
                    {d.date}
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-primary" /> Available
              <div className="w-3 h-3 rounded-full bg-muted border ml-4" /> Unavailable
            </div>
          </div>

          {/* Time Spots Section */}
          <div className="w-full md:w-64 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-8">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Available times
            </h3>
            <div className="flex flex-col gap-3">
              {timeSpots.map((time) => (
                <Button
                  key={time}
                  variant="outline"
                  className="w-full justify-center font-medium border-primary/20 hover:border-primary hover:bg-primary/5 text-foreground transition-all"
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
