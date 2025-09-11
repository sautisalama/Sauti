"use client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { Database } from "@/types/db-schema";

type ServiceType = Database["public"]["Enums"]["support_service_type"];

const SERVICE_OPTIONS = [
	{ value: "legal", label: "legal support" },
	{ value: "medical", label: "medical care" },
	{ value: "mental_health", label: "mental health support" },
	{ value: "shelter", label: "shelter services" },
	{ value: "financial_assistance", label: "financial assistance" },
	{ value: "other", label: "other support services" },
] as const;

const AVAILABILITY_OPTIONS = [
	{ value: "24/7", label: "24/7" },
	{ value: "weekdays_9_5", label: "weekdays (9 AM - 5 PM)" },
	{ value: "weekdays_extended", label: "weekdays (8 AM - 8 PM)" },
	{ value: "weekends", label: "weekends only" },
	{ value: "by_appointment", label: "by appointment" },
] as const;

const COVERAGE_OPTIONS = [
	{ value: "5", label: "5 kilometers" },
	{ value: "10", label: "10 kilometers" },
	{ value: "25", label: "25 kilometers" },
	{ value: "50", label: "50 kilometers" },
	{ value: "100", label: "100 kilometers" },
] as const;

export function AddSupportServiceForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
	const { toast } = useToast();
	const [loading, setLoading] = useState(false);
	const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
		null
	);
	const [formData, setFormData] = useState({
		name: "",
		service_types: "" as ServiceType,
		phone_number: "",
		availability: "",
		coverage_area_radius: "",
	});

	useEffect(() => {
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
						title: "Location Error",
						description: "Unable to get your location. Some features may be limited.",
						variant: "destructive",
					});
				}
			);
		}
	}, [toast]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);

		try {
			const data = {
				...formData,
				latitude: location?.lat,
				longitude: location?.lng,
				coverage_area_radius: formData.coverage_area_radius
					? Number(formData.coverage_area_radius)
					: null,
			};

			const response = await fetch("/api/support-services", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});

			if (!response.ok) throw new Error("Failed to add service");

			toast({
				title: "Success",
				description: "Support service has been successfully added.",
			});

			onSuccess?.();
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to add support service. Please try again.",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Organization / Service Name</label>
          <input
            type="text"
            className="w-full border rounded-md px-3 py-2"
            placeholder="e.g., SafeCare Counseling"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Service Type</label>
          <select
            value={formData.service_types}
            onChange={(e) => setFormData({ ...formData, service_types: e.target.value as ServiceType })}
            required
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Select a service</option>
            {SERVICE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contact Phone</label>
          <input
            type="tel"
            className="w-full border rounded-md px-3 py-2"
            placeholder="Phone number"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Availability</label>
          <select
            value={formData.availability}
            onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
            required
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Select availability</option>
            {AVAILABILITY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Coverage Radius</label>
          <select
            value={formData.coverage_area_radius}
            onChange={(e) => setFormData({ ...formData, coverage_area_radius: e.target.value })}
            required
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Select coverage</option>
            {COVERAGE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <span className="text-sm">
            {location ? (
              <span className="text-green-600">📍 Location detected</span>
            ) : (
              <span className="text-yellow-700">📍 Detecting location...</span>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={loading || !location}>
          {loading ? "Adding..." : "Register Service"}
        </Button>
      </div>
    </form>
  );
}
