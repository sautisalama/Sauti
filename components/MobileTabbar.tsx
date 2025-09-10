"use client";

import Link from "next/link";
import { LayoutDashboard, FileText, MessageCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileTabbar({
  active,
  base = "/dashboard",
}: {
  active: "overview" | "reports" | "chat" | "appointments";
  base?: string;
}) {
  const item = (key: string, href: string, label: string, Icon: any) => (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 py-2 flex-1",
        active === key ? "text-[#f8941c]" : "text-white"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs">{label}</span>
    </Link>
  );

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1A3434] border-t border-[#2A4444] z-40">
      <nav className="flex items-center justify-around px-4 py-2">
        {item("overview", `${base}`, "Overview", LayoutDashboard)}
        {item("reports", `${base}?tab=reports`, "Reports", FileText)}
        {item("chat", `${base}/chat`, "Messages", MessageCircle)}
        {item("appointments", `${base}?tab=appointments`, "Appointments", Calendar)}
      </nav>
    </div>
  );
}

