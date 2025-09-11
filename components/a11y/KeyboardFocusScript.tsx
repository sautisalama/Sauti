"use client";

import { useEffect } from "react";

export function KeyboardFocusScript() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        document.body.classList.add("using-keyboard");
      }
    };
    const onMouse = () => {
      document.body.classList.remove("using-keyboard");
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    window.addEventListener("touchstart", onMouse, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("touchstart", onMouse, true);
    };
  }, []);
  return null;
}

