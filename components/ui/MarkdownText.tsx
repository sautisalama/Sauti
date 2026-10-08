"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

/** Inline: **bold**, *italic* / _italic_, ~~strikethrough~~. Never injects HTML. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+?\*\*|~~.+?~~|\*[^*\s][^*]*?\*|\b_[^_\s][^_]*?_\b)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={key} className="font-bold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) return <del key={key} className="opacity-70">{part.slice(2, -2)}</del>;
    if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) || (part.startsWith("_") && part.endsWith("_") && part.length > 2)) return <em key={key} className="italic">{part.slice(1, -1)}</em>;
    return part;
  });
}

const BULLET = /^\s*(?:[*\-•])\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;

/**
 * Small, safe Markdown for chat: paragraphs, bullet lists ("* ", "- ", "• "), numbered lists, bold and
 * italic. Lines starting with "* " are list items, not italics (assistant replies use them heavily).
 */
export function MarkdownText({ content, className }: MarkdownTextProps) {
  if (!content) return null;
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push(<span key={`p${blocks.length}`} className="block">{inline(para.join("\n"), `p${blocks.length}`)}</span>);
      para = [];
    }
  };

  lines.forEach((line, idx) => {
    const b = line.match(BULLET);
    const n = line.match(NUMBERED);
    if (b || n) {
      flush();
      blocks.push(
        <span key={`l${idx}`} className="flex gap-2 pl-1">
          <span aria-hidden className="shrink-0 text-current/70">{b ? "•" : `${n![1]}.`}</span>
          <span className="min-w-0">{inline((b ? b[1] : n![2]).trim(), `l${idx}`)}</span>
        </span>
      );
    } else if (line.trim() === "") {
      flush();
      if (blocks.length && idx < lines.length - 1) blocks.push(<span key={`g${idx}`} className="block h-2" aria-hidden />);
    } else {
      para.push(line);
    }
  });
  flush();

  return <span className={cn("block break-words whitespace-pre-wrap", className)}>{blocks}</span>;
}
