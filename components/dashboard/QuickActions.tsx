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
  disabled?: boolean;
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
            disabled={a.disabled}
            className={cn(
              "w-full h-28 flex flex-col items-start justify-between rounded-2xl border-0 bg-white hover:bg-neutral-50 shadow-sm hover:shadow-md transition-all duration-300 group",
              a.disabled && "opacity-50 pointer-events-none"
            )}
          >
            <div className="p-2 rounded-xl bg-sauti-teal/10 group-hover:bg-sauti-teal/20 transition-colors">
              <Icon className="h-5 w-5 text-sauti-teal" />
            </div>
            <div className="text-left">
              <div className="font-black text-sauti-dark leading-tight tracking-tight">{a.label}</div>
              {a.description && (
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider leading-tight mt-1">{a.description}</div>
              )}
            </div>
          </Button>
        );
        if (a.href && !a.disabled) {
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

