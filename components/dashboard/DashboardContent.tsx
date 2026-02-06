"use client";

import React from "react";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { cn } from "@/lib/utils";
import { GlobalReportFab } from "@/components/dashboard/GlobalReportFab";

interface DashboardContentProps {
  children: React.ReactNode;
}

export function DashboardContent({ children }: DashboardContentProps) {
  const dash = useDashboardData();
  const isCollapsed = dash?.isSidebarCollapsed ?? false;

	  const user = dash?.data?.userId;

	  return (
		<>
			<main
				className={cn(
					"flex-1 transition-all duration-300 ease-in-out relative min-h-screen",
					"lg:ml-72", // Default expanded width
					isCollapsed && "lg:ml-20" // Collapsed width
				)}
			>
				{children}
			</main>
			{user && <GlobalReportFab userId={user} />}
		</>
	  );
	}
