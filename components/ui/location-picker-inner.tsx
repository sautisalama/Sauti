"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { Loader2, MapPin, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { forwardGeocode, reverseGeocodeAddress } from "@/lib/utils/geocoding"

import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"

interface LocationPickerProps {
  initialLat?: number
  initialLng?: number
  initialRadius?: number
  initialAddress?: string
  onLocationChange: (lat: number, lng: number, address: string) => void
  onRadiusChange?: (radius: number) => void
  showRadius?: boolean
  disabled?: boolean
  className?: string
}

function MapEventsHandler({ 
  onLocationSelect 
}: { 
  onLocationSelect: (lat: number, lng: number) => void 
}) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPickerInner({
  initialLat = -1.2921, // Default to Nairobi
  initialLng = 36.8219,
  initialRadius = 5000,
  initialAddress = "",
  onLocationChange,
  onRadiusChange,
  showRadius = false,
  disabled = false,
  className,
}: LocationPickerProps) {
  const [markerPosition, setMarkerPosition] = useState<{lat: number, lng: number}>({ lat: initialLat, lng: initialLng })
  const [radius, setRadius] = useState(initialRadius)
  const [address, setAddress] = useState(initialAddress)
  const [searchQuery, setSearchQuery] = useState(initialAddress)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<{lat: number, lon: number, display_name: string}[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  
  const mapRef = useRef<L.Map | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (initialLat && initialLng) {
      setMarkerPosition({ lat: initialLat, lng: initialLng });
    }
    if (initialRadius) {
      setRadius(initialRadius);
    }
    if (initialAddress) {
      setAddress(initialAddress);
      setSearchQuery(initialAddress);
    }
  }, [initialLat, initialLng, initialRadius, initialAddress])


  const handleMapClick = async (lat: number, lng: number) => {
    if (disabled) return;
    setMarkerPosition({ lat, lng })
    setSearchLoading(true)
    
    try {
      const displayAddress = await reverseGeocodeAddress(lat, lng);
      const finalAddress = displayAddress || "Unknown Location";
      setAddress(finalAddress);
      setSearchQuery(finalAddress);
      onLocationChange(lat, lng, finalAddress);
    } catch (error) {
      console.error("Geocoding failed", error)
      onLocationChange(lat, lng, "Location selected from map")
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setShowDropdown(true);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const results = await forwardGeocode(val);
      setSearchResults(results);
      setSearchLoading(false);
    }, 500);
  }

  const handleSelectResult = (result: {lat: number, lon: number, display_name: string}) => {
    setMarkerPosition({ lat: result.lat, lng: result.lon });
    setSearchQuery(result.display_name);
    setAddress(result.display_name);
    setShowDropdown(false);
    onLocationChange(result.lat, result.lon, result.display_name);
    
    if (mapRef.current) {
        mapRef.current.flyTo([result.lat, result.lon], 15);
    }
  }

  const handleRadiusChange = (value: number[]) => {
    const newRadius = value[0]
    setRadius(newRadius)
    if (onRadiusChange) {
      onRadiusChange(newRadius)
    }
  }

  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  const tileUrl = maptilerKey 
    ? `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${maptilerKey}` 
    : `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`; // fallback if no key
  
  const attribution = maptilerKey
    ? '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative h-[280px] sm:h-[420px] w-full overflow-hidden rounded-xl shadow-sm border border-serene-neutral-200/60 group touch-pan-y z-0">
        <div className="absolute top-3 left-3 right-3 z-[1000]">
            <div className="relative shadow-md rounded-lg bg-white/90 backdrop-blur-sm">
                <Input
                    placeholder="Search location..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => setShowDropdown(true)}
                    disabled={disabled}
                    className="pr-10 h-10 border-0 focus-visible:ring-0 focus-visible:bg-white transition-all shadow-sm text-sm bg-transparent"
                />
                {searchLoading ? (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-sauti-teal" />
                ) : (
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-sauti-teal" />
                )}
            </div>

            {/* Dropdown for search results */}
            {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-serene-neutral-100 overflow-hidden z-[1001]">
                    {searchResults.map((res, i) => (
                        <div 
                            key={i} 
                            className="p-3 text-sm hover:bg-serene-neutral-50 cursor-pointer border-b border-serene-neutral-50 last:border-b-0 flex items-start gap-2"
                            onClick={() => handleSelectResult(res)}
                        >
                            <MapPin className="h-4 w-4 text-sauti-teal shrink-0 mt-0.5" />
                            <span className="line-clamp-2 text-sauti-dark">{res.display_name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <MapContainer 
            center={[markerPosition.lat, markerPosition.lng]} 
            zoom={13} 
            scrollWheelZoom={false}
            style={{ width: "100%", height: "100%", zIndex: 0 }}
            ref={mapRef}
        >
          <TileLayer
            attribution={attribution}
            url={tileUrl}
          />
          <MapEventsHandler onLocationSelect={handleMapClick} />
          <Marker position={[markerPosition.lat, markerPosition.lng]} draggable={!disabled} eventHandlers={{
              dragend: async (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  await handleMapClick(position.lat, position.lng);
              }
          }} />
          {showRadius && (
            <Circle 
              center={[markerPosition.lat, markerPosition.lng]} 
              radius={radius}
              pathOptions={{
                color: "#068297",
                fillColor: "#068297",
                fillOpacity: 0.15,
                weight: 2
              }} 
            />
          )}
        </MapContainer>

        {searchLoading && (
             <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[1px] z-[900] pointer-events-none"></div>
        )}
      </div>

      {showRadius && (
        <div className="rounded-xl bg-serene-neutral-50 p-3 border-none flex items-center justify-between gap-4">
          <Label className="text-xs font-bold uppercase tracking-wider text-serene-neutral-500 whitespace-nowrap">Radius: {(radius / 1000).toFixed(1)} km</Label>
          <Slider
            defaultValue={[initialRadius]}
            value={[radius]}
            max={50000} // 50km
            min={100}   // 100m
            step={100}
            onValueChange={handleRadiusChange}
            disabled={disabled}
            className="[&_.bg-primary]:bg-sauti-teal [&_.border-primary]:border-sauti-teal flex-1"
          />
        </div>
      )}
    </div>
  )
}
