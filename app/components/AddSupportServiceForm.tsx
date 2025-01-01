"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";

type ServiceType = Database["public"]["Enums"]["support_service_type"];

export function AddSupportServiceForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    service_types: "" as ServiceType,
    phone_number: "",
    availability: "",
  });

  useEffect(() => {
    // Get user's location when component mounts
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          toast({
            title: "Location Access Failed",
            description: "We couldn't access your location. Some features may be limited.",
            variant: "destructive",
          });
        }
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/support-services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          latitude: location?.lat,
          longitude: location?.lng,
        }),
      });

      if (!response.ok) throw new Error("Failed to add service");

      toast({
        title: "Service Added",
        description: "Your support service has been successfully registered.",
      });

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add support service. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-lg leading-relaxed">
      <p className="text-gray-700">
        I work with{" "}
        <input
          type="text"
          className="border-b-2 border-teal-500 focus:outline-none px-2 w-64"
          placeholder="organization name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        , providing{" "}
        <select
          className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
          value={formData.service_types}
          onChange={(e) => setFormData({ ...formData, service_types: e.target.value as ServiceType })}
          required
        >
          <option value="">select service type</option>
          <option value="legal">legal support</option>
          <option value="medical">medical care</option>
          <option value="mental_health">mental health support</option>
          <option value="shelter">shelter services</option>
          <option value="financial_assistance">financial assistance</option>
          <option value="other">other support services</option>
        </select>
        . You can reach us at{" "}
        <input
          type="tel"
          className="border-b-2 border-teal-500 focus:outline-none px-2 w-48"
          placeholder="phone number"
          value={formData.phone_number}
          onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
        />
        . We are typically available{" "}
        <input
          type="text"
          className="border-b-2 border-teal-500 focus:outline-none px-2 w-64"
          placeholder="e.g., Monday-Friday, 9 AM-5 PM"
          value={formData.availability}
          onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
        />
        .
      </p>

      <div className="flex items-center gap-4">
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
          Register Service
        </Button>
        {location ? (
          <span className="text-sm text-green-600">📍 Location detected</span>
        ) : (
          <span className="text-sm text-yellow-600">📍 Detecting location...</span>
        )}
      </div>
    </form>
  );
} 