"use client";

import dynamic from "next/dynamic";
import { Loader2, Activity } from "lucide-react";

// This is a Client Component that handles the dynamic loading of the visualizer with SSR disabled.
const MatchingVisualizer = dynamic(
  () => import("./MatchingVisualizer"),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-80px)] w-full items-center justify-center bg-[#FAFAFA]/40 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-10 -mt-16">
          <div className="relative h-24 w-24">
            <div className="absolute inset-0 border-[3px] border-serene-blue-50/50 rounded-full" />
            <div className="absolute inset-0 border-[3px] border-serene-blue-500 border-t-transparent rounded-full animate-[spin_1.2s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
            <div className="absolute inset-3 border-[2px] border-serene-blue-100 border-b-transparent rounded-full animate-[spin_2s_linear_infinite]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="h-8 w-8 text-serene-blue-600 animate-pulse duration-700" />
            </div>
          </div>
          <div className="text-center px-8 py-6 bg-white rounded-2xl shadow-[0_15px_50px_-12px_rgba(0,0,0,0.06)] border border-serene-neutral-100 max-w-[280px]">
            <h3 className="text-lg font-black text-serene-blue-950 tracking-tight leading-none mb-1.5">Vectural Engine</h3>
            <p className="text-[9px] font-black text-serene-neutral-400 uppercase tracking-[0.2em]">Initializing Workflow</p>
          </div>
        </div>
      </div>
    )
  }
);

export default function VisualizerClientWrapper(props: any) {
  return <MatchingVisualizer {...props} />;
}
