"use client";

import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
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
};

export type DashboardDataContextType = {
  data: DashboardData | null;
  setUnreadChatCount: (n: number) => void;
  updatePartial: (patch: Partial<DashboardData>) => void;
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

  const setUnreadChatCount = useCallback((n: number) => {
    setData((prev) => (prev ? { ...prev, unreadChatCount: n } : prev));
  }, []);

  const updatePartial = useCallback((patch: Partial<DashboardData>) => {
    setData((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo<DashboardDataContextType>(() => ({ data, setUnreadChatCount, updatePartial }), [data, setUnreadChatCount, updatePartial]);

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardDataContextType | null {
  return useContext(DashboardDataContext);
}
