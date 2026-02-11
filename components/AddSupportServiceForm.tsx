"use client";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Database } from "@/types/db-schema";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import {
	MapPin,
	Phone,
	Clock,
	Building2,
	Mail,
	Globe2,
	Plus,
	CheckCircle,
	Briefcase,
	Globe,
	ArrowRight,
	Loader2
} from "lucide-react";
import { EnhancedSelect } from "@/components/ui/enhanced-select";
import { cn } from "@/lib/utils";

type ServiceType = Database["public"]["Enums"]["support_service_type"];

const SERVICE_OPTIONS = [
	{ value: "legal", label: "Legal Support" },
	{ value: "medical", label: "Medical Care" },
	{ value: "mental_health", label: "Mental Health Support" },
	{ value: "shelter", label: "Shelter Services" },
	{ value: "financial_assistance", label: "Financial Assistance" },
	{ value: "other", label: "Other Support Services" },
];

const AVAILABILITY_OPTIONS = [
	{ value: "24/7", label: "24/7 Emergency Support" },
	{ value: "weekdays_9_5", label: "Weekdays (9 AM - 5 PM)" },
	{ value: "weekdays_extended", label: "Weekdays (8 AM - 8 PM)" },
	{ value: "weekends", label: "Weekends Only" },
	{ value: "by_appointment", label: "By Appointment" },
	{ value: "flexible", label: "Flexible Hours" },
];

const COVERAGE_OPTIONS = [
	{ value: "5", label: "5 kilometers" },
	{ value: "10", label: "10 kilometers" },
	{ value: "25", label: "25 kilometers" },
	{ value: "50", label: "50 kilometers" },
	{ value: "100", label: "100 kilometers" },
];

export function AddSupportServiceForm({
	onSuccess,
}: {
	onSuccess?: (newServiceId?: string) => void;
}) {
	const { toast } = useToast();
	const dash = useDashboardData();
	const profile = dash?.data?.profile;
	const [loading, setLoading] = useState(false);
	const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
	
	const [formData, setFormData] = useState({
		name: "",
		service_types: "" as ServiceType,
		phone_number: "",
		email: "",
		website: "",
		availability: "",
		coverage_area_radius: "",
		is_remote: false,
	});

	// Get location on mount
	useEffect(() => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setLocation({
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					});
				},
				(error) => console.error("Error getting location:", error)
			);
		}
	}, []);

	const isFormFilled = useMemo(() => {
		const basicFilled = !!(
			formData.name && 
			formData.service_types && 
			formData.phone_number && 
			formData.availability
		);
		const coverageFilled = !!(formData.coverage_area_radius || formData.is_remote);
		return basicFilled && coverageFilled;
	}, [formData]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!isFormFilled) return;
		
		setLoading(true);

		try {
			// Prepare data
			const hasLocalServices = formData.coverage_area_radius && formData.coverage_area_radius !== "";
			
			if (hasLocalServices && !location) {
				toast({
					title: "Location needed",
					description: "Please enable location services for local coverage.",
					variant: "destructive",
				});
				setLoading(false);
				return;
			}

			const serviceData = {
				...formData,
				latitude: hasLocalServices ? location?.lat : null,
				longitude: hasLocalServices ? location?.lng : null,
				coverage_area_radius: hasLocalServices ? Number(formData.coverage_area_radius) : null,
			};

			const response = await fetch("/api/support-services", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(serviceData),
			});

			if (!response.ok) throw new Error("Failed to create service");

			const newService = await response.json();

			toast({
				title: "Service Created",
				description: "Now, please upload your verification documents.",
			});

			// Pass the new ID so parent can open the upload modal
			onSuccess?.(newService.id);

		} catch (error) {
			console.error("Error creating service:", error);
			toast({
				title: "Error",
				description: "Failed to create service. Please try again.",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex flex-col h-full bg-white sm:rounded-3xl overflow-hidden">
			{/* Header */}
			<div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
				<div>
					<h2 className="text-xl font-bold text-neutral-900 tracking-tight">
						Add Support Service
					</h2>
					<p className="text-sm text-neutral-500 font-medium">
						Step 1 of 2: Service Details
					</p>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				<form id="add-service-form" onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-8">
					
					{/* Organization Info */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 mb-2">
							<Building2 className="h-5 w-5 text-sauti-teal" />
							<h3 className="text-lg font-bold text-neutral-900">Organization Details</h3>
						</div>
						
						<div className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="name" className="text-sm font-semibold text-neutral-700">
									Organization Name <span className="text-red-500">*</span>
								</Label>
								<Input
									id="name"
									placeholder="e.g. Hope Counseling Center"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									className="h-11 rounded-xl border-neutral-200 focus:border-sauti-teal focus:ring-sauti-teal/20"
								/>
							</div>

							<div className="space-y-1.5">
								<Label className="text-sm font-semibold text-neutral-700">
									Service Type <span className="text-red-500">*</span>
								</Label>
								<EnhancedSelect
									options={SERVICE_OPTIONS}
									value={formData.service_types}
									onChange={(val) => setFormData({ ...formData, service_types: val as ServiceType })}
									placeholder="Select service type..."
								/>
							</div>
						</div>
					</div>

					{/* Contact Info */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 mb-2">
							<Phone className="h-5 w-5 text-sauti-teal" />
							<h3 className="text-lg font-bold text-neutral-900">Contact Information</h3>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<Label htmlFor="phone" className="text-sm font-semibold text-neutral-700">Phone Number <span className="text-red-500">*</span></Label>
								<Input
									id="phone"
									type="tel"
									placeholder="+254..."
									value={formData.phone_number}
									onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
									className="h-11 rounded-xl border-neutral-200 focus:border-sauti-teal focus:ring-sauti-teal/20"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="email" className="text-sm font-semibold text-neutral-700">Email Address</Label>
								<Input
									id="email"
									type="email"
									placeholder="contact@org.com"
									value={formData.email}
									onChange={(e) => setFormData({ ...formData, email: e.target.value })}
									className="h-11 rounded-xl border-neutral-200 focus:border-sauti-teal focus:ring-sauti-teal/20"
								/>
							</div>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="website" className="text-sm font-semibold text-neutral-700">Website</Label>
							<Input
								id="website"
								placeholder="https://..."
								value={formData.website}
								onChange={(e) => setFormData({ ...formData, website: e.target.value })}
								className="h-11 rounded-xl border-neutral-200 focus:border-sauti-teal focus:ring-sauti-teal/20"
							/>
						</div>
					</div>

					{/* Availability & Coverage */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 mb-2">
							<Globe className="h-5 w-5 text-sauti-teal" />
							<h3 className="text-lg font-bold text-neutral-900">Availability & Coverage</h3>
						</div>

						<div className="space-y-1.5">
							<Label className="text-sm font-semibold text-neutral-700">
								Typical Availability <span className="text-red-500">*</span>
							</Label>
							<EnhancedSelect
								options={AVAILABILITY_OPTIONS}
								value={formData.availability}
								onChange={(val) => setFormData({ ...formData, availability: val })}
								placeholder="Select availability..."
							/>
						</div>

						<div className="space-y-3 pt-2">
							<Label className="text-sm font-semibold text-neutral-700">Service Reach <span className="text-red-500">*</span></Label>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								{/* Remote Option */}
								<div 
									onClick={() => setFormData({ ...formData, is_remote: !formData.is_remote })}
									className={cn(
										"cursor-pointer p-4 rounded-xl border-2 transition-all flex items-start gap-3",
										formData.is_remote 
											? "border-sauti-teal bg-sauti-teal/5 ring-1 ring-sauti-teal" 
											: "border-neutral-100 bg-neutral-50 hover:border-neutral-200"
									)}
								>
									<div className={cn("mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center shrink-0", 
										formData.is_remote ? "border-sauti-teal bg-sauti-teal" : "border-neutral-300 bg-white"
									)}>
										{formData.is_remote && <CheckCircle className="h-3.5 w-3.5 text-white" />}
									</div>
									<div>
										<span className="block font-semibold text-neutral-900">Remote Services</span>
										<span className="text-xs text-neutral-500">Phone, video, or online support available anywhere.</span>
									</div>
								</div>

								{/* In-Person Option */}
								<div 
									onClick={() => setFormData({ ...formData, coverage_area_radius: formData.coverage_area_radius ? "" : "5" })}
									className={cn(
										"cursor-pointer p-4 rounded-xl border-2 transition-all flex items-start gap-3",
										formData.coverage_area_radius 
											? "border-sauti-teal bg-sauti-teal/5 ring-1 ring-sauti-teal" 
											: "border-neutral-100 bg-neutral-50 hover:border-neutral-200"
									)}
								>
									<div className={cn("mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center shrink-0", 
										formData.coverage_area_radius ? "border-sauti-teal bg-sauti-teal" : "border-neutral-300 bg-white"
									)}>
										{formData.coverage_area_radius && <CheckCircle className="h-3.5 w-3.5 text-white" />}
									</div>
									<div>
										<span className="block font-semibold text-neutral-900">In-Person Services</span>
										<span className="text-xs text-neutral-500">Physical support within a specific radius.</span>
									</div>
								</div>
							</div>

							{/* Radius Slider if In-Person */}
							{formData.coverage_area_radius && (
								<div className="pt-2 animate-in fade-in slide-in-from-top-2">
									<div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 space-y-3">
										<div className="flex justify-between items-center">
											<Label className="text-xs font-semibold uppercase text-neutral-500">Coverage Radius</Label>
											<span className="text-sm font-bold text-sauti-teal">{formData.coverage_area_radius} km</span>
										</div>
										<input
											type="range"
											min="1"
											max="100"
											value={Number(formData.coverage_area_radius) || 5}
											onChange={(e) => setFormData({ ...formData, coverage_area_radius: e.target.value })}
											className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-sauti-teal"
										/>
										<div className="flex gap-2 flex-wrap">
											{[5, 10, 25, 50, 100].map(val => (
												<button
													key={val}
													type="button"
													onClick={() => setFormData({ ...formData, coverage_area_radius: val.toString() })}
													className={cn(
														"px-2.5 py-1 text-xs rounded-lg font-medium transition-colors border",
														Number(formData.coverage_area_radius) === val
															? "bg-sauti-teal text-white border-sauti-teal"
															: "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
													)}
												>
													{val}km
												</button>
											))}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				</form>
			</div>

			{/* Sticky Footer */}
			<div className="p-6 border-t border-neutral-100 bg-white shrink-0">
				<Button
					form="add-service-form"
					type="submit"
					disabled={!isFormFilled || loading}
					className={cn(
						"w-full h-12 text-base font-bold rounded-xl shadow-md transition-all",
						!isFormFilled || loading
							? "bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none"
							: "bg-sauti-teal hover:bg-sauti-dark text-white shadow-sauti-teal/20"
					)}
				>
					{loading ? (
						<>
							<Loader2 className="mr-2 h-5 w-5 animate-spin" />
							Creating Service...
						</>
					) : (
						<>
							Create & Continue <ArrowRight className="ml-2 h-5 w-5" />
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
