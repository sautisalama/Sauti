"use client";

import React from "react";

interface SamplePlaceholderProps {
  label?: string;
  className?: string;
  children: React.ReactNode;
}

// Wrap UI blocks that show illustrative content when real data is unavailable.
// Best practices applied:
// - Clearly distinguish from real data using reduced opacity and grayscale
// - Add a small inline label to communicate "Sample" state
// - Disable interactions to avoid confusion
// - Ensure assistive tech can still read content but conveys it's illustrative
export function SamplePlaceholder({ label = "Coming soon", className = "", children }: SamplePlaceholderProps) {
  return (
    <div className={`relative pointer-events-none opacity-60 grayscale select-none ${className}`} aria-live="polite">
      <div className="absolute top-2 right-2 z-10">
        <span className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-600 border px-2 py-0.5 text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      {children}
    </div>
  );
}

export default SamplePlaceholder;

