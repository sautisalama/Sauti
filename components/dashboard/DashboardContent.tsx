"use client";

import React from "react";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { GlobalReportFab } from "@/components/dashboard/GlobalReportFab";
import { DesktopHeader } from "@/components/navigation/DesktopHeader";

interface DashboardContentProps {
  children: React.ReactNode;
}

export function DashboardContent({ children }: DashboardContentProps) {
  const dash = useDashboardData();
  const rawIsCollapsed = dash?.isSidebarCollapsed ?? false;
  const user = dash?.data?.userId;

  // Hydration fix
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isCollapsed = mounted ? rawIsCollapsed : false;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chatId = searchParams.get('id');

  // Logic for mobile spacing
  const isChat = pathname?.startsWith("/dashboard/chat");
  const isChatDetail = isChat && !!chatId; // Chat + ID param means detail view

  // Top Bar (pt-16) is hidden on ALL chat pages (list and detail) and Onboarding.
  // So pt-0 for chat/onboarding. pt-16 for others.
  const profile = dash?.data?.profile;
  const hasAcceptedPolicies = !!(profile?.policies as any)?.all_policies_accepted;
  const isOnboardingRoute = pathname === "/dashboard/onboarding" || pathname?.startsWith("/dashboard/onboarding");
  const needsOnboarding = isOnboardingRoute || (!profile?.user_type || 
    !hasAcceptedPolicies ||
    ((profile.user_type === 'professional' || profile.user_type === 'ngo') && !profile.professional_title));

  const showTopPadding = !isChat && !needsOnboarding;

  // Bottom Nav (pb-24) is hidden on chat DETAIL (but shown on list)
  // and Appointment detail
  const isApptDetail = pathname?.includes("/appointment/");
  const showBottomPadding = !isChatDetail && !isApptDetail && !pathname?.includes("/dashboard/cases/") && !pathname?.includes("/dashboard/reports/") && !pathname?.includes("/dashboard/matches");



  return (
    <>
        <main
            className={cn(
                "flex-1 transition-all duration-300 ease-in-out relative min-h-screen flex flex-col",
                "lg:ml-72", // Default expanded width
                isCollapsed && "lg:ml-20" // Collapsed width
            )}
        >
      <div className={cn(
                "flex-1 flex flex-col w-full", // Ensure full width/height usage
                "lg:pt-0 lg:pb-0", // Reset on desktop
                showTopPadding ? "pt-14 lg:pt-0" : "", // 56px (h-14) mobile top bar
                showBottomPadding ? "pb-24 lg:pb-0" : "" // Bottom nav spacing
            )}>
                {!isChat && !needsOnboarding && (
                    <div className="hidden lg:block">
                        <DesktopHeader 
                            showSearch={true} 
                            showNotifications={true}
                        />
                    </div>
                )}
                {children}
            </div>
        </main>
        {/* FAB removed as per request for cleaner UI */}
    </>
  );
}
