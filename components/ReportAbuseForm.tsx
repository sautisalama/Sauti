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

// Add this form component
export default function ReportAbuseForm({ onClose }: { onClose: () => void }) {
	const { toast } = useToast();
	const [loading, setLoading] = useState(false);
	const [location, setLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);

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
	}, []);

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
		};

		try {
			// TODO: Add your API endpoint here
			const response = await fetch("/api/reports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});

			if (!response.ok) throw new Error("Failed to submit report");

			// Clear the form
			e.currentTarget.reset();

			toast({
				title: "Report Submitted",
				description: "Thank you for your report. We will review it shortly.",
			});
			onClose();
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to submit report. Please try again.",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-6 relative z-[1000] w-full max-w-3xl"
		>
			<div className="space-y-4">
				<div className="flex items-center gap-2 flex-wrap">
					<p className="text-lg text-gray-700 whitespace-nowrap">
						I want to report about
					</p>
					<Select name="incident_type" required>
						<SelectTrigger className="w-48">
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
					<p className="text-lg text-gray-700 whitespace-nowrap">with</p>
					<Select name="urgency" required>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="urgency" />
						</SelectTrigger>
						<SelectContent className="z-[1001]">
							<SelectItem value="high">high urgency</SelectItem>
							<SelectItem value="medium">medium urgency</SelectItem>
							<SelectItem value="low">low urgency</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="pl-4 space-y-4">
					<Textarea
						placeholder="Please share what happened..."
						name="incident_description"
						required
						className="min-h-[150px] w-full"
					/>
				</div>

				<p className="text-lg text-gray-700 mt-6">You can contact me at:</p>
				<div className="pl-4 space-y-4">
					<div className="flex items-center gap-2">
						<Input
							placeholder="Your name"
							name="first_name"
							required
							className="w-full max-w-[200px]"
						/>
						<Input
							placeholder="Your email"
							name="email"
							type="email"
							required
							className="w-full"
						/>
					</div>
					<div className="flex items-center gap-2">
						<Input
							placeholder="Your phone number"
							name="phone"
							type="tel"
							pattern="[0-9]{10,}"
							title="Please enter a valid phone number (minimum 10 digits)"
							className="w-full"
						/>
						<Select
							name="contact_preference"
							required
							value=""
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
				</div>

				<div className="mt-6 space-y-4">
					<p className="text-lg text-gray-700">
						Do you consent to share this information with relevant authorities if
						needed?
					</p>
					<div className="pl-4">
						<Select name="consent" required>
							<SelectTrigger>
								<SelectValue placeholder="Select consent" />
							</SelectTrigger>
							<SelectContent className="z-[1001]">
								<SelectItem value="yes">Yes, I consent</SelectItem>
								<SelectItem value="no">No, I don't consent</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			<Button type="submit" className="w-full mt-8" disabled={loading}>
				{loading ? "Submitting..." : "Submit Report"}
			</Button>
		</form>
	);
}
