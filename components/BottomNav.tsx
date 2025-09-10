"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Megaphone, Home, Cloud, LayoutDashboard, LogIn, MessageCircle, FileText, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReportAbuseForm from "@/components/ReportAbuseForm";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";

export function BottomNav({ forceShow = false }: { forceShow?: boolean }) {
  const pathname = usePathname();
  const user = useUser();
  const [open, setOpen] = useState(false);

  // Hide the bar entirely on immersive views like chat and resources (maximize space),
  // unless explicitly forced to show (e.g., chat contacts list view).
  const hide = forceShow ? false : (pathname?.startsWith("/dashboard/chat") || pathname?.startsWith("/dashboard/resources"));

  const isDashboard = pathname?.startsWith("/dashboard");

  const Item = ({ href, active, label, icon: Icon }: { href: string; active: boolean; label: string; icon: any }) => (
    <Link href={href} className="flex-1">
      <div className={cn("flex flex-col items-center gap-1 py-2", active ? "text-[#f8941c]" : "text-white/90") }>
        <Icon className="h-5 w-5" />
        <span className="text-[11px] leading-none">{label}</span>
      </div>
    </Link>
  );

  return (
    <>
      {!hide && (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        {/* raised center action */}
        <div className="relative h-16">
          <div className="absolute inset-0 bg-[#1A3434] border-t border-[#2A4444]" />

          {/* nav items */}
          <div className="absolute inset-0 px-2 grid grid-cols-5 items-end">
            {isDashboard ? (
              <>
                <Item href="/dashboard/chat" active={pathname?.startsWith("/dashboard/chat")} label="Chat" icon={MessageCircle} />
                <Item href="/dashboard" active={pathname === "/dashboard"} label="Overview" icon={LayoutDashboard} />
                <div className="flex items-center justify-center">
                  <Button onClick={() => setOpen(true)} className="h-12 w-12 rounded-full bg-[#f8941c] hover:bg-[#e38313] shadow-lg -mt-8">
                    <Megaphone className="h-5 w-5 text-white" />
                  </Button>
                </div>
                <Item href="/dashboard/resources" active={pathname?.startsWith("/dashboard/resources")} label="Learn" icon={FileText} />
                <div />
              </>
            ) : (
              <>
                <Item href="/" active={pathname === "/"} label="Home" icon={Home} />
                <Item href="/weather" active={pathname?.startsWith("/weather")} label="Weather" icon={Cloud} />
                <div className="flex items-center justify-center">
                  <Button onClick={() => setOpen(true)} className="h-12 w-12 rounded-full bg-[#f8941c] hover:bg-[#e38313] shadow-lg -mt-8">
                    <Megaphone className="h-5 w-5 text-white" />
                  </Button>
                </div>
                {user ? (
                  <Item href="/dashboard" active={pathname?.startsWith("/dashboard")} label="Dashboard" icon={LayoutDashboard} />
                ) : (
                  <Item href="/signin" active={pathname?.startsWith("/signin")} label="Sign In" icon={LogIn} />
                )}
                <div />
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Global Report Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Report Abuse</DialogTitle>
            <DialogDescription>
              Please fill out this form to report an incident. All information will be kept confidential.
            </DialogDescription>
          </DialogHeader>
          <ReportAbuseForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

