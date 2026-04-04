"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  if (!content) return null;

  // Split by bold (**), italic (* or _), and strikethrough (~~)
  const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|_.*?_|~~.*?~~)/g);

  return (
    <span className={cn("break-words whitespace-pre-wrap", className)}>
      {parts.map((part, i) => {
        // Bold: **text**
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        // Strikethrough: ~~text~~
        if (part.startsWith("~~") && part.endsWith("~~")) {
          return (
            <del key={i} className="opacity-70">
              {part.slice(2, -2)}
            </del>
          );
        }
        // Italic: *text* or _text_
        if (
          (part.startsWith("*") && part.endsWith("*")) ||
          (part.startsWith("_") && part.endsWith("_"))
        ) {
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }
        // Plain text
        return part;
      })}
    </span>
  );
}
