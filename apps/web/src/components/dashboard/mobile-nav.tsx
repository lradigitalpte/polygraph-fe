"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { SettingsSidebar } from "./settings-sidebar";
import { ClientSidebar } from "./client-sidebar";
import { ProfileSidebar } from "./profile-sidebar";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Determine which sidebar to show
  let SidebarContent = Sidebar;
  
  if (pathname.startsWith("/dashboard/settings")) {
    SidebarContent = SettingsSidebar;
  } else if (pathname.startsWith("/dashboard/clients/CL-")) { // Simple check for client detail
     SidebarContent = ClientSidebar;
  } else if (pathname.startsWith("/dashboard/profile")) {
    SidebarContent = ProfileSidebar;
  }

  // Close sheet on path change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden -ml-2")}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72">
        <div className="h-full border-none">
          <SidebarContent />
        </div>
      </SheetContent>
    </Sheet>
  );
}
