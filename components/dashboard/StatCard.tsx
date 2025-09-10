"use client";

import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  icon,
  className,
  footer,
  invertColors,
}: {
  title: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
  footer?: ReactNode;
  invertColors?: boolean;
}) {
  return (
    <Card className={cn("p-4 sm:p-5 rounded-xl border bg-card hover:shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className={cn("text-xs sm:text-[13px]", invertColors ? "text-white/80" : "text-muted-foreground")}>{title}</div>
          <div className={cn("text-2xl sm:text-3xl font-semibold", invertColors ? "text-white" : "text-[#1A3434]")}>{value}</div>
        </div>
        {icon && <div className={cn(invertColors ? "text-white" : "text-teal-700")}>{icon}</div>}
      </div>
      {footer && <div className={cn("mt-3 text-xs", invertColors ? "text-white/80" : "text-muted-foreground")}>{footer}</div>}
    </Card>
  );
}

