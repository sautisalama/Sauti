"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import {
	SUPPORT_SERVICE_OPTIONS,
	type SupportServiceType,
} from "@/lib/constants";

// Add this form component
export default function ReportAbuseForm() {
	const { toast } = useToast();
	const [loading, setLoading] = useState(false);
	const [location, setLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [selectedServices, setSelectedServices] = useState<string[]>([]);

	useEffect(() => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setLocation({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					});
				},
				(error) => {
					console.error("Error getting location:", error);
					toast({
						title: "Location Unavailable",
						description:
							"Unable to get your location. Report will be submitted without location data.",
						variant: "default",
					});
				}
			);
		}
	}, [toast]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);

		const formData = new FormData(e.currentTarget);
		const contactPreference = formData.get("contact_preference");
		const phone = formData.get("phone");

		if (
			(contactPreference === "phone_call" || contactPreference === "sms") &&
			!phone
		) {
			toast({
				title: "Error",
				description:
					"Phone number is required for phone call or SMS contact preference.",
				variant: "destructive",
			});
			setLoading(false);
			return;
		}

		const data = {
			first_name: formData.get("first_name"),
			email: formData.get("email"),
			phone: phone,
			type_of_incident: formData.get("incident_type"),
			incident_description: formData.get("incident_description"),
			urgency: formData.get("urgency"),
			consent: formData.get("consent"),
			contact_preference: contactPreference,
			latitude: location?.latitude || null,
			longitude: location?.longitude || null,
			submission_timestamp: new Date().toISOString(),
			required_services: selectedServices,
		};

		try {
			const response = await fetch("/api/reports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || "Failed to submit report");
			}

			// Clear the form and show success toast
			e.currentTarget.reset();
			toast({
				title: "Report Submitted",
				description: "Thank you for your report. We will review it shortly.",
			});

			// After successful submission, close the dialog
			document
				.querySelector<HTMLButtonElement>(
					'[role="dialog"] button[aria-label="Close"]'
				)
				?.click();
		} catch (error) {
			console.error("Submission error:", error);
			toast({
				title: "Error",
				description:
					error instanceof Error
						? error.message
						: "Failed to submit report. Please try again.",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="relative w-full max-w-[1200px] max-h-[80vh] flex flex-col"
		>
			<div className="flex-1 overflow-y-auto space-y-6 pr-4 pb-20">
				<div className="flex items-center gap-4 flex-wrap">
					<p className="text-lg text-gray-700">I want to report about</p>
					<Select name="incident_type" required>
						<SelectTrigger className="w-56">
							<SelectValue placeholder="type of incident" />
						</SelectTrigger>
						<SelectContent className="z-[1001]">
							<SelectItem value="physical">physical abuse</SelectItem>
							<SelectItem value="emotional">emotional abuse</SelectItem>
							<SelectItem value="sexual">sexual abuse</SelectItem>
							<SelectItem value="financial">financial abuse</SelectItem>
							<SelectItem value="other">other concerns</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-lg text-gray-700">with</p>
					<Select name="urgency" required>
						<SelectTrigger className="w-48">
							<SelectValue placeholder="urgency" />
						</SelectTrigger>
						<SelectContent className="z-[1001]">
							<SelectItem value="high">high urgency</SelectItem>
							<SelectItem value="medium">medium urgency</SelectItem>
							<SelectItem value="low">low urgency</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="w-full">
					<Textarea
						placeholder="Please share what happened..."
						name="incident_description"
						required
						className="min-h-[120px] w-full"
					/>
				</div>

				<div className="w-full space-y-2">
					<p className="text-lg text-gray-700">What support services do you need?</p>
					<p className="text-sm text-gray-500">
						Select all that apply in order of priority
					</p>
					<MultiSelect
						selected={selectedServices}
						onChange={setSelectedServices}
						options={SUPPORT_SERVICE_OPTIONS}
						placeholder="Select required services..."
					/>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div className="col-span-full">
						<p className="text-lg text-gray-700">Contact Information:</p>
					</div>
					<Input
						placeholder="Your name"
						name="first_name"
						required
						className="w-full"
					/>
					<Input
						placeholder="Your email"
						name="email"
						type="email"
						required
						className="w-full"
					/>
					<Input
						placeholder="Your phone number"
						name="phone"
						type="tel"
						pattern="[0-9]{10,}"
						className="w-full"
					/>
					<Select
						name="contact_preference"
						required
						onValueChange={(value) => {
							const phoneInput = document.querySelector(
								'input[name="phone"]'
							) as HTMLInputElement;
							if (value === "phone_call" || value === "sms") {
								phoneInput.required = true;
							} else {
								phoneInput.required = false;
							}
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder="Preferred contact" />
						</SelectTrigger>
						<SelectContent className="z-[1001]">
							<SelectItem value="phone_call">Call me</SelectItem>
							<SelectItem value="sms">Text me</SelectItem>
							<SelectItem value="email">Email me</SelectItem>
							<SelectItem value="do_not_contact">Don't contact me</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center gap-4 justify-between">
					<p className="text-lg text-gray-700">
						Do you consent to share this information with relevant authorities if
						needed?
					</p>
					<Select name="consent" required>
						<SelectTrigger className="w-[200px]">
							<SelectValue placeholder="Select consent" />
						</SelectTrigger>
						<SelectContent className="z-[1001]">
							<SelectItem value="yes">Yes, I consent</SelectItem>
							<SelectItem value="no">No, I don't consent</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="fixed bottom-0 left-0 right-0 pt-4 pb-4 bg-white border-t mt-4 z-50">
				<div className="max-w-[1200px] mx-auto px-4">
					<Button
						type="submit"
						className="w-full max-w-md mx-auto block"
						disabled={loading}
					>
						{loading ? "Submitting..." : "Submit Report"}
					</Button>
				</div>
			</div>
		</form>
	);
}
