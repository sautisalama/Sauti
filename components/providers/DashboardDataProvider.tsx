"use client";

import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { Tables } from "@/types/db-schema";
import { AppointmentWithDetails, MatchedServiceWithRelations, ReportWithRelations } from "@/app/dashboard/_types";

export type DashboardData = {
  userId: string;
  profile: Tables<"profiles">;
  userType: Tables<"profiles">["user_type"] | null;
  reports: ReportWithRelations[];
  matchedServices: MatchedServiceWithRelations[];
  supportServices: Tables<"support_services">[];
  appointments: AppointmentWithDetails[];
  casesCount: number;
  unreadChatCount: number;
  preloaded: boolean;
  verification?: {
    overallStatus: string;
    lastChecked?: string | null;
    documentsCount?: number;
    pendingCount?: number;
  };
  isAdminMode: boolean;
};

export type DashboardDataContextType = {
  data: DashboardData | null;
  setUnreadChatCount: (n: number) => void;
  updatePartial: (patch: Partial<DashboardData>) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  isAdminMode: boolean;
  topBarTitle: React.ReactNode | string | null;
  setTopBarTitle: (v: React.ReactNode | string | null) => void;
  topBarActions: React.ReactNode | null;
  setTopBarActions: (v: React.ReactNode | null) => void;
  isReportDialogOpen: boolean;
  setIsReportDialogOpen: (v: boolean) => void;
};

const DashboardDataContext = createContext<DashboardDataContextType | null>(null);

export function DashboardDataProvider({
  initialData,
  children,
}: {
  initialData: DashboardData;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<DashboardData | null>(initialData ?? null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [topBarTitle, setTopBarTitle] = useState<React.ReactNode | string | null>(null);
  const [topBarActions, setTopBarActions] = useState<React.ReactNode | null>(null);

  // Initial load from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ss_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "1");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ss_sidebar_collapsed", isSidebarCollapsed ? "1" : "0");
    }
  }, [isSidebarCollapsed]);

  // Track Admin Mode
  useEffect(() => {
    const checkAdminMode = () => {
      const mode = localStorage.getItem("adminMode") === "true";
      setIsAdminMode(mode);
    };

    checkAdminMode();
    window.addEventListener("adminModeChanged", checkAdminMode);
    window.addEventListener("storage", checkAdminMode);

    return () => {
      window.removeEventListener("adminModeChanged", checkAdminMode);
      window.removeEventListener("storage", checkAdminMode);
    };
  }, []);
  // Sync state with fresh initialData from server re-renders (router.refresh)
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  const setUnreadChatCount = useCallback((n: number) => {
    setData((prev) => {
      if (!prev) return prev;
      if (prev.unreadChatCount === n) return prev; // avoid unnecessary updates/loops
      return { ...prev, unreadChatCount: n };
    });
  }, []);

  const updatePartial = useCallback((patch: Partial<DashboardData>) => {
    setData((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  
  const value = useMemo<DashboardDataContextType>(() => ({ 
    data, 
    setUnreadChatCount, 
    updatePartial,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isAdminMode,
    topBarTitle,
    setTopBarTitle,
    topBarActions,
    setTopBarActions,
    isReportDialogOpen,
    setIsReportDialogOpen
  }), [data, setUnreadChatCount, updatePartial, isSidebarCollapsed, isAdminMode, topBarTitle, topBarActions, isReportDialogOpen]);

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardDataContextType | null {
  return useContext(DashboardDataContext);
}
