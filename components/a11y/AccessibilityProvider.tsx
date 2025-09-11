"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AccessibilityState = {
  highContrast: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  readableFont: boolean;
  underlineLinks: boolean;
  dyslexic: boolean;
  textScale: number; // 100, 112.5, 125, 137.5, 150
  set: (patch: Partial<Omit<AccessibilityState, "set">>) => void;
};

const A11yContext = createContext<AccessibilityState | null>(null);

const STORAGE_KEY = "ss_a11y";

function load(): Omit<AccessibilityState, "set"> {
  if (typeof window === "undefined") return {
    highContrast: false,
    reduceMotion: false,
    largeText: false,
    readableFont: false,
    underlineLinks: false,
    dyslexic: false,
    textScale: 100,
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no a11y");
    const parsed = JSON.parse(raw);
    return {
      highContrast: !!parsed.highContrast,
      reduceMotion: !!parsed.reduceMotion,
      largeText: !!parsed.largeText,
      readableFont: !!parsed.readableFont,
      underlineLinks: !!parsed.underlineLinks,
      dyslexic: !!parsed.dyslexic,
      textScale: Number(parsed.textScale) || 100,
    };
  } catch {
    return {
      highContrast: false,
      reduceMotion: false,
      largeText: false,
      readableFont: false,
      underlineLinks: false,
      dyslexic: false,
      textScale: 100,
    };
  }
}

function save(state: Omit<AccessibilityState, "set">) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {
    // ignore storage errors (private mode or quota exceeded)
  }
}

function applyAttrs(state: Omit<AccessibilityState, "set">) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-a11y-high-contrast", state.highContrast ? "1" : "0");
  el.setAttribute("data-a11y-reduce-motion", state.reduceMotion ? "1" : "0");
  el.setAttribute("data-a11y-lg-text", state.largeText ? "1" : "0");
  el.setAttribute("data-a11y-readable-font", state.readableFont ? "1" : "0");
  el.setAttribute("data-a11y-underline-links", state.underlineLinks ? "1" : "0");
  el.setAttribute("data-a11y-dyslexic", state.dyslexic ? "1" : "0");
  el.setAttribute("data-a11y-text-scale", String(state.textScale));
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AccessibilityState, "set">>(() => load());

  useEffect(() => { applyAttrs(state); save(state); }, [state]);

  const value = useMemo<AccessibilityState>(() => ({
    ...state,
    set: (patch) => setState((s) => ({ ...s, ...patch })),
  }), [state]);

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useAccessibility() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}

