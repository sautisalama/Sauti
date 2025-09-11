"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export function SafetyBar() {
  const supabase = createClient();

  // Keyboard quick-exit: Shift+Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "Escape") {
        quickExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const quickExit = () => {
    try {
      // Clear transient client state only; do not clear cookies (handled by panicLogout)
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // ignore storage errors
    }
    // Redirect to a neutral, safe page
    window.location.replace("https://www.google.com");
  };

  const panicLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore signout errors
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // ignore storage errors
    }
    window.location.replace("https://www.google.com");
  };

  return (
    <div className="w-full bg-[#102a2a] text-white px-3 py-2 flex items-center justify-between text-sm md:text-xs">
      <div className="truncate opacity-80">
        Press Shift+Esc anytime to Quick Exit
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" className="h-8" onClick={quickExit}>
          Quick Exit
        </Button>
        <Button size="sm" className="h-8 bg-red-600 hover:bg-red-700" onClick={panicLogout}>
          Panic Logout
        </Button>
      </div>
    </div>
  );
}
