"use client";

import { useEffect, useState } from "react";

export function OrientationGuard() {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const onResize = () => {
      try {
        const isMobile = window.matchMedia("only screen and (max-width: 900px)").matches;
        const landscape = window.matchMedia("(orientation: landscape)").matches;
        setIsLandscape(isMobile && landscape);
      } catch {}
    };
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize as EventListener);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize as EventListener);
    };
  }, []);

  if (!isLandscape) return null;

  return (
    <div className="orientation-lock-portrait fixed inset-0 z-[1000] items-center justify-center bg-neutral-900/95 text-white p-6 text-center">
      <div>
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-500/20 flex items-center justify-center recording-pulse">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
            <path d="M7 10v4a5 5 0 0 0 10 0v-4a5 5 0 0 0-10 0Zm5 11a7 7 0 0 0 7-7v-2a1 1 0 1 0-2 0v2a5 5 0 1 1-10 0v-2a1 1 0 1 0-2 0v2a7 7 0 0 0 7 7Z"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Please rotate your phone</h2>
        <p className="text-sm text-neutral-300 mt-1">Sauti Salama works best in portrait on mobile.</p>
      </div>
    </div>
  );
}

