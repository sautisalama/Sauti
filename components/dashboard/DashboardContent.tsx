"use client";

import React from "react";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { cn } from "@/lib/utils";

interface DashboardContentProps {
  children: React.ReactNode;
}

export function DashboardContent({ children }: DashboardContentProps) {
  const dash = useDashboardData();
  const isCollapsed = dash?.isSidebarCollapsed ?? false;

  return (
    <main
      className={cn(
        "flex-1 transition-all duration-300 ease-in-out",
        "lg:ml-72", // Default expanded width
        isCollapsed && "lg:ml-20" // Collapsed width
      )}
    >
      {children}
    </main>
  );
}
