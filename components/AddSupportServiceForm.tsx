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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LocationPicker } from "@/components/ui/location-picker";
import { Badge } from "@/components/ui/badge";

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
	embedded = false,
}: {
	onSuccess?: (newServiceId?: string) => void;
	embedded?: boolean;
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
		latitude: null as number | null,
		longitude: null as number | null,
		address: "",
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
				latitude: hasLocalServices ? formData.latitude : null,
				longitude: hasLocalServices ? formData.longitude : null,
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
		<div className={cn("flex flex-col h-full bg-white sm:rounded-3xl overflow-hidden", embedded && "h-auto bg-transparent sm:rounded-none overflow-visible")}>
			{/* Premium Glass Header */}
			{!embedded && (
				<div className="px-4 py-3 border-b border-serene-blue-100 flex items-center justify-between bg-serene-blue-50/50 backdrop-blur-xl sticky top-0 z-10 shrink-0">
					<div className="flex items-center gap-2">
						<div className="h-8 w-8 rounded-xl bg-white shadow-sm flex items-center justify-center border border-serene-blue-100">
							<Briefcase className="h-4 w-4 text-serene-blue-600" />
						</div>
						<div>
							<h2 className="text-lg font-black text-serene-blue-900 tracking-tight leading-none mb-1">
								Define Your Service
							</h2>
							<p className="text-[10px] font-black text-serene-blue-500 uppercase tracking-widest">
								Setup your professional profile
							</p>
						</div>
					</div>
					<Badge variant="outline" className="rounded-full border-serene-blue-200 text-serene-blue-700 bg-white font-black text-[9px] uppercase px-2 py-0">
						Step 3 of 3
					</Badge>
				</div>
			)}

			<div className={cn("flex-1 overflow-y-auto no-scrollbar", embedded && "flex-initial overflow-visible")}>
				<form id="add-service-form" onSubmit={handleSubmit} className={cn("max-w-2xl mx-auto p-4 md:p-6 space-y-4 md:space-y-8", embedded && "p-0")}>
					
					{/* Primary Details Grid - Dashboard inspired */}
					<div className={cn("bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-serene-neutral-100 shadow-sm space-y-4 md:space-y-6", embedded && "bg-transparent border-none shadow-none p-0")}>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 md:gap-y-5">
							<div className="space-y-2">
								<Label htmlFor="name" className="text-[11px] font-black text-serene-neutral-600 uppercase tracking-widest px-1">
									Service/Org Name <span className="text-red-500">*</span>
								</Label>
								<Input
									id="name"
									placeholder="e.g. Sauti Hope Solutions"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									className="h-11 rounded-[1rem] border-serene-neutral-200 focus:border-serene-blue-500 focus:ring-serene-blue-500/10 bg-serene-neutral-50/50 transition-all font-medium"
								/>
							</div>

							<div className="space-y-2">
								<Label className="text-[11px] font-black text-serene-neutral-600 uppercase tracking-widest px-1">
									Field of Expertise <span className="text-red-500">*</span>
								</Label>
								<EnhancedSelect
									options={SERVICE_OPTIONS}
									value={formData.service_types}
									onChange={(val) => setFormData({ ...formData, service_types: val as ServiceType })}
									placeholder="Select category..."
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="phone" className="text-[11px] font-black text-serene-neutral-600 uppercase tracking-widest px-1">Contact Phone <span className="text-red-500">*</span></Label>
								<Input
									id="phone"
									type="tel"
									placeholder="+254 7XX XXX XXX"
									value={formData.phone_number}
									onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
									className="h-11 rounded-[1rem] border-serene-neutral-200 focus:border-serene-blue-500 focus:ring-serene-blue-500/10 bg-serene-neutral-50/50 transition-all font-medium"
								/>
							</div>

							<div className="space-y-2">
								<Label className="text-[11px] font-black text-serene-neutral-600 uppercase tracking-widest px-1">
									Work Schedule <span className="text-red-500">*</span>
								</Label>
								<EnhancedSelect
									options={AVAILABILITY_OPTIONS}
									value={formData.availability}
									onChange={(val) => setFormData({ ...formData, availability: val })}
									placeholder="Select availability..."
								/>
							</div>
						</div>
					</div>

					{/* Progressive Disclosure (Accordions) */}
					<div className="space-y-2">
						<Accordion type="single" collapsible className="w-full">
							<AccordionItem value="reach" className="border-none bg-serene-blue-50/30 rounded-[1.5rem] mb-3 overflow-hidden transition-all hover:bg-serene-blue-50/50">
								<AccordionTrigger className="hover:no-underline py-3 px-4 group">
									<div className="flex items-center gap-3">
										<div className="h-7 w-7 rounded-lg bg-white shadow-sm flex items-center justify-center border border-serene-blue-100 group-hover:scale-110 transition-transform">
											<Globe className="h-3.5 w-3.5 text-serene-blue-600" />
										</div>
										<div className="text-left">
											<span className="block text-[11px] font-black text-serene-blue-900 uppercase tracking-widest leading-none mb-1">Reach & Coverage</span>
											<span className="block text-[9px] text-serene-neutral-500 font-medium tracking-tight">Set radius or remote status</span>
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent className="pt-2 pb-4 px-4 space-y-3 border-t border-serene-blue-100/50 mt-1">
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div 
											onClick={() => setFormData({ ...formData, is_remote: !formData.is_remote })}
											className={cn(
												"cursor-pointer p-4 rounded-[1.25rem] border-2 transition-all flex items-center gap-4 bg-white",
												formData.is_remote 
													? "border-serene-blue-500 shadow-md ring-2 ring-serene-blue-500/10" 
													: "border-serene-neutral-100 hover:border-serene-blue-200"
											)}
										>
											<div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0", 
												formData.is_remote ? "border-serene-blue-500 bg-serene-blue-500" : "border-serene-neutral-300"
											)}>
												{formData.is_remote && <CheckCircle className="h-3 w-3 text-white" />}
											</div>
											<span className="text-sm font-bold text-serene-neutral-900">Virtual/Remote</span>
										</div>

										<div 
											onClick={() => setFormData({ ...formData, coverage_area_radius: formData.coverage_area_radius ? "" : "5" })}
											className={cn(
												"cursor-pointer p-4 rounded-[1.25rem] border-2 transition-all flex items-center gap-4 bg-white",
												formData.coverage_area_radius 
													? "border-serene-blue-500 shadow-md ring-2 ring-serene-blue-500/10" 
													: "border-serene-neutral-100 hover:border-serene-blue-200"
											)}
										>
											<div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0", 
												formData.coverage_area_radius ? "border-serene-blue-500 bg-serene-blue-500" : "border-serene-neutral-300"
											)}>
												{formData.coverage_area_radius && <CheckCircle className="h-3 w-3 text-white" />}
											</div>
											<span className="text-sm font-bold text-serene-neutral-900">In-Person/Local</span>
										</div>
									</div>

									{formData.coverage_area_radius && (
										<div className="pt-2 animate-in fade-in slide-in-from-top-4 duration-500">
											<div className="p-1 bg-serene-neutral-50 rounded-[1.75rem] border border-serene-neutral-200 overflow-hidden shadow-inner">
												<LocationPicker
													initialLat={location?.lat || -1.2921}
													initialLng={location?.lng || 36.8219}
													initialRadius={Number(formData.coverage_area_radius) === 0 ? 5000 : Number(formData.coverage_area_radius)}
													onLocationChange={(lat, lng, address) => {
														setFormData(prev => ({ ...prev, latitude: lat, longitude: lng, address }));
													}}
													onRadiusChange={(radius) => {
														setFormData(prev => ({ ...prev, coverage_area_radius: String(radius) }));
													}}
												/>
											</div>
										</div>
									)}
								</AccordionContent>
							</AccordionItem>

							<AccordionItem value="digital" className="border-none bg-serene-neutral-50/50 rounded-[1.5rem] overflow-hidden transition-all hover:bg-serene-neutral-100/50">
								<AccordionTrigger className="hover:no-underline py-3 px-4 group">
									<div className="flex items-center gap-3">
										<div className="h-7 w-7 rounded-lg bg-white shadow-sm flex items-center justify-center border border-serene-neutral-200 group-hover:scale-110 transition-transform">
											<Mail className="h-3.5 w-3.5 text-serene-neutral-600" />
										</div>
										<div className="text-left">
											<span className="block text-[11px] font-black text-serene-neutral-900 uppercase tracking-widest leading-none mb-1">Digital Presence</span>
											<span className="block text-[9px] text-serene-neutral-500 font-medium tracking-tight">Email and website for searchability</span>
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent className="pt-2 pb-4 px-4 border-t border-serene-neutral-200/50 mt-1">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
										<div className="space-y-1.5">
											<Label htmlFor="email" className="text-[10px] font-black text-serene-neutral-500 uppercase tracking-widest px-1">Email (Optional)</Label>
											<Input
												id="email"
												type="email"
												placeholder="provider@service.com"
												value={formData.email}
												onChange={(e) => setFormData({ ...formData, email: e.target.value })}
												className="h-10 rounded-[0.75rem] border-serene-neutral-200 focus:border-serene-blue-500 bg-white"
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="website" className="text-[10px] font-black text-serene-neutral-500 uppercase tracking-widest px-1">Website (Optional)</Label>
											<Input
												id="website"
												placeholder="https://myservice.com"
												value={formData.website}
												onChange={(e) => setFormData({ ...formData, website: e.target.value })}
												className="h-10 rounded-[0.75rem] border-serene-neutral-200 focus:border-serene-blue-500 bg-white"
											/>
										</div>
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</div>

				</form>
			</div>

			{/* Sticky Dashboard-Style Footer */}
			{!embedded && (
				<div className="p-5 border-t border-serene-blue-100 bg-serene-blue-50/80 backdrop-blur-xl shrink-0">
					<Button
						form="add-service-form"
						type="submit"
						disabled={!isFormFilled || loading}
						className={cn(
							"w-full h-12 text-xs font-black rounded-2xl shadow-xl transition-all uppercase tracking-[0.2em]",
							!isFormFilled || loading
								? "bg-serene-neutral-200 text-serene-neutral-400 cursor-not-allowed shadow-none"
								: "bg-serene-blue-600 hover:bg-serene-blue-700 text-white shadow-serene-blue-500/20 hover:scale-[1.02] active:scale-95"
						)}
					>
						{loading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Finalizing...
							</>
						) : (
							<>
								Create Professional Profile <ArrowRight className="ml-2 h-4 w-4" />
							</>
						)}
					</Button>
				</div>
			)}
		</div>
	);
}
