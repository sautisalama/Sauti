"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Dynamically import the Leaflet implementation to avoid 'window is not defined' SSR errors
const LocationPickerInner = dynamic(
  () => import('./location-picker-inner').then(mod => mod.LocationPickerInner),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex h-[300px] sm:h-[420px] w-full items-center justify-center rounded-xl border border-serene-neutral-200 bg-serene-neutral-50/50">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-sauti-teal" />
            <span className="text-xs font-bold text-serene-neutral-400 uppercase tracking-wider">Loading Map...</span>
        </div>
      </div>
    )
  }
)

export function LocationPicker(props: any) {
  return <LocationPickerInner {...props} />
}
