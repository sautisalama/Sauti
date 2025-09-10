"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

export type QuickAction = {
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  variant?: "default" | "outline" | "secondary" | "ghost";
};

export function QuickActions({ actions, className }: { actions: QuickAction[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3", className)}>
      {actions.map((a, i) => {
        const Icon = a.icon;
        const content = (
          <Button
            key={i}
            onClick={a.onClick}
            variant={a.variant || "secondary"}
            className="w-full h-24 sm:h-28 flex flex-col items-start justify-between rounded-xl border bg-card hover:shadow-md"
          >
            <Icon className="h-5 w-5 text-teal-700" />
            <div className="text-left">
              <div className="font-medium text-[#1A3434] leading-tight">{a.label}</div>
              {a.description && (
                <div className="text-xs text-muted-foreground leading-tight mt-1">{a.description}</div>
              )}
            </div>
          </Button>
        );
        if (a.href) {
          return (
            <Link key={i} href={a.href} className="block">
              {content}
            </Link>
          );
        }
        return content;
      })}
    </div>
  );
}

