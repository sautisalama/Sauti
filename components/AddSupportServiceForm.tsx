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
	}, []);

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
		<form onSubmit={handleSubmit} className="space-y-8">
			<div className="prose prose-sm">
				<p className="leading-relaxed text-gray-600">
					We are{" "}
					<input
						type="text"
						className="border-b-2 border-teal-500 focus:outline-none px-2 w-64 bg-transparent"
						placeholder="organization name"
						value={formData.name}
						onChange={(e) => setFormData({ ...formData, name: e.target.value })}
						required
					/>
					, providing{" "}
					<select
						value={formData.service_types}
						onChange={(e) =>
							setFormData({
								...formData,
								service_types: e.target.value as ServiceType,
							})
						}
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select service type</option>
						{SERVICE_OPTIONS.map(({ value, label }) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
					. You can reach us at{" "}
					<input
						type="tel"
						className="border-b-2 border-teal-500 focus:outline-none px-2 w-48 bg-transparent"
						placeholder="phone number"
						value={formData.phone_number}
						onChange={(e) =>
							setFormData({ ...formData, phone_number: e.target.value })
						}
						required
					/>
					. We are available{" "}
					<select
						value={formData.availability}
						onChange={(e) =>
							setFormData({ ...formData, availability: e.target.value })
						}
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select availability</option>
						{AVAILABILITY_OPTIONS.map(({ value, label }) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>{" "}
					and can serve clients within{" "}
					<select
						value={formData.coverage_area_radius}
						onChange={(e) =>
							setFormData({ ...formData, coverage_area_radius: e.target.value })
						}
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select coverage</option>
						{COVERAGE_OPTIONS.map(({ value, label }) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>{" "}
					of our location.
				</p>
			</div>

			<div className="flex items-center gap-4">
				<Button
					type="submit"
					className="bg-teal-600 hover:bg-teal-700"
					disabled={loading || !location}
				>
					{loading ? "Adding..." : "Register Service"}
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
