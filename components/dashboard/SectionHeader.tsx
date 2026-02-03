"use client";

import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div>
        <h3 className="text-lg sm:text-xl font-black text-sauti-dark tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs sm:text-sm font-bold text-neutral-400 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

