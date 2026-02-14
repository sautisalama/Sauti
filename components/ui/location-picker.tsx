"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { GoogleMap, Marker, Circle, useLoadScript, Autocomplete } from "@react-google-maps/api"
import { Loader2, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface LocationPickerProps {
  initialLat?: number
  initialLng?: number
  initialRadius?: number
  initialAddress?: string
  onLocationChange: (lat: number, lng: number, address: string) => void
  onRadiusChange: (radius: number) => void
  disabled?: boolean
  className?: string
}

const libraries: ("places" | "geometry")[] = ["places", "geometry"]

export function LocationPicker({
  initialLat = -1.2921, // Default to Nairobi
  initialLng = 36.8219,
  initialRadius = 5000,
  initialAddress = "",
  onLocationChange,
  onRadiusChange,
  disabled = false,
  className,
}: LocationPickerProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [markerPosition, setMarkerPosition] = useState({ lat: initialLat, lng: initialLng })
  const [radius, setRadius] = useState(initialRadius)
  const [address, setAddress] = useState(initialAddress)
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Update internal state when props change (e.g. initial load)
  useEffect(() => {
    if (initialLat && initialLng) {
      setMarkerPosition({ lat: initialLat, lng: initialLng })
    }
    if (initialRadius) {
      setRadius(initialRadius)
    }
    if (initialAddress) {
      setAddress(initialAddress)
    }
  }, [initialLat, initialLng, initialRadius, initialAddress])


  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

  const onAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    setAutocomplete(autocomplete)
  }, [])

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace()
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()
        const formattedAddress = place.formatted_address || ""

        setMarkerPosition({ lat, lng })
        setAddress(formattedAddress)
        onLocationChange(lat, lng, formattedAddress)
        map?.panTo({ lat, lng })
        map?.setZoom(15)
      }
    }
  }

  const onMarkerDragEnd = async (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      setMarkerPosition({ lat, lng })
      setSearchLoading(true)
      
      // Reverse geocode to get address
      try {
        const geocoder = new google.maps.Geocoder()
        const response = await geocoder.geocode({ location: { lat, lng } })
        if (response.results[0]) {
            const newAddress = response.results[0].formatted_address
            setAddress(newAddress)
            onLocationChange(lat, lng, newAddress)
        } else {
            onLocationChange(lat, lng, "Unknown Location")
        }
      } catch (error) {
        console.error("Geocoding failed", error)
        onLocationChange(lat, lng, "Location selected from map")
      } finally {
        setSearchLoading(false)
      }
    }
  }

  const handleRadiusChange = (value: number[]) => {
    const newRadius = value[0]
    setRadius(newRadius)
    onRadiusChange(newRadius)
  }

  /*
  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      setSearchLoading(true)
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng } = position.coords
          setMarkerPosition({ lat, lng })
          map?.panTo({ lat, lng })
          map?.setZoom(15)
           // Reverse geocode
           try {
            const geocoder = new google.maps.Geocoder()
            const response = await geocoder.geocode({ location: { lat, lng } })
            if (response.results[0]) {
                const newAddress = response.results[0].formatted_address
                setAddress(newAddress)
                onLocationChange(lat, lng, newAddress)
            }
          } catch (error) {
              onLocationChange(lat, lng, "Current Location")
          } finally {
            setSearchLoading(false)
          }
        },
        () => {
          setSearchLoading(false)
          // Handle error (e.g. toast)
        }
      )
    }
  }
  */

  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: false,
      clickableIcons: false,
      scrollwheel: false,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      gestureHandling: "cooperative",
    }),
    []
  )

  if (loadError) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-md border border-destructive/50 bg-destructive/10 text-destructive">
        Error loading Google Maps. Please check your API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-md border bg-muted/50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative h-[280px] sm:h-[420px] w-full overflow-hidden rounded-xl shadow-sm border border-serene-neutral-200/60 group touch-pan-y">
        <div className="absolute top-3 left-3 right-3 z-10">
            <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
            <div className="relative shadow-md rounded-lg">
                <Input
                    placeholder="Search location..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={disabled}
                    className="pr-10 h-10 bg-white/90 backdrop-blur-sm border-0 focus-visible:ring-0 focus-visible:bg-white transition-all shadow-sm text-sm"
                />
                <MapPin className="absolute right-3 top-2.5 h-4 w-4 text-sauti-teal" />
            </div>
            </Autocomplete>
        </div>

        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={markerPosition}
          zoom={13}
          onLoad={onMapLoad}
          options={mapOptions}
          onClick={onMarkerDragEnd} // Re-use the same handler logic for clicks
        >
          <Marker
            position={markerPosition}
            draggable={!disabled}
            onDragEnd={onMarkerDragEnd}
            animation={google.maps.Animation.DROP}
          />
          <Circle
            center={markerPosition}
            radius={radius}
            options={{
              fillColor: "#068297", // sauti-teal
              fillOpacity: 0.15,
              strokeColor: "#068297",
              strokeOpacity: 0.5,
              strokeWeight: 2,
              clickable: false,
              draggable: false,
              editable: false,
              visible: true,
            }}
          />
        </GoogleMap>
        {searchLoading && (
             <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-20">
                <Loader2 className="h-8 w-8 animate-spin text-sauti-teal" />
             </div>
        )}
      </div>

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
    </div>
  )
}
