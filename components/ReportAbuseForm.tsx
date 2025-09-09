"use client";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { submitReport } from "@/app/_actions/unauth_reports";
import { Mic, Square } from "lucide-react";
import { useSpeechToText } from "@/hooks/useSpeechToText";

const SUPPORT_SERVICE_OPTIONS = [
	{ value: "legal", label: "legal support" },
	{ value: "medical", label: "medical care" },
	{ value: "mental_health", label: "mental health support" },
	{ value: "shelter", label: "shelter services" },
	{ value: "financial_assistance", label: "financial assistance" },
	{ value: "other", label: "other support services" },
] as const;

export default function ReportAbuseForm({ onClose }: { onClose?: () => void }) {
	const { toast } = useToast();
	const [loading, setLoading] = useState(false);
	const [description, setDescription] = useState("");
	const { isSupported, isListening, transcript, start, stop, reset } = useSpeechToText({ lang: "en-US", interimResults: true });
	const [location, setLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);

	// Get location on component mount
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
					// Set default coordinates for Kenya
					setLocation({
						latitude: -1.2921,
						longitude: 36.8219,
					});
				}
			);
		}
	}, []);

	useEffect(() => {
		// When recording stops and we have a transcript, append it once to the description
		if (!isListening && transcript) {
			setDescription((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
			reset();
		}
	}, [isListening, transcript, reset]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		setLoading(true);

		const formData = new FormData(form);

		try {
			await submitReport({
				// Required fields from form
				first_name: formData.get("first_name") as string,
				email: formData.get("email") as string,
				incident_description: description,
				type_of_incident: formData.get("incident_type") as
					| "physical"
					| "emotional"
					| "sexual"
					| "financial"
					| "other",
				urgency: formData.get("urgency") as "high" | "medium" | "low",
				consent: formData.get("consent") as "yes" | "no",
				contact_preference: formData.get("contact_preference") as
					| "phone_call"
					| "sms"
					| "email"
					| "do_not_contact",

				// Optional fields with defaults
				phone: (formData.get("phone") as string) || null,
				last_name: null,
				user_id: null,
				latitude: location?.latitude || null,
				longitude: location?.longitude || null,
				required_services: [],
				submission_timestamp: new Date().toISOString(),

				// Required fields with default values
				ismatched: false,
				match_status: "pending",

				// Optional fields set to null
				administrative: null,
				additional_info: null,
				city: null,
				country: null,
				country_code: null,
				continent: null,
				continent_code: null,
				state: null,
				locality: null,
				location: null,
				plus_code: null,
				postcode: null,
				principal_subdivision: null,
				principal_subdivision_code: null,
				preferred_language: null,
				support_services: formData.get("support_services") as
					| "legal"
					| "medical"
					| "mental_health"
					| "shelter"
					| "financial_assistance"
					| "other"
					| null,
				dob: null,
				gender: null,
			});

			// Only reset and show success if the submission was successful
			form.reset();
			setDescription("");
			toast({
				title: "Report Submitted",
				description: "Thank you for your report. We will review it shortly.",
			});

			// Add timeout to close the dialog after successful submission
			if (onClose) {
				setTimeout(() => {
					onClose();
				}, 500);
			}
		} catch (error) {
			console.error("Submission error:", error);
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
		<form onSubmit={handleSubmit} className="space-y-8">
			<div className="prose prose-sm">
				<p className="leading-relaxed text-gray-600">
					Hello, my name is{" "}
					<input
						type="text"
						className="border-b-2 border-teal-500 focus:outline-none px-2 w-48 bg-transparent"
						placeholder="your name"
						name="first_name"
						required
					/>
					. You can reach me at{" "}
					<input
						type="email"
						className="border-b-2 border-teal-500 focus:outline-none px-2 w-64 bg-transparent"
						placeholder="your email"
						name="email"
						required
					/>{" "}
					or by phone at{" "}
					<input
						type="text"
						className="border-b-2 border-teal-500 focus:outline-none px-2 w-48 bg-transparent"
						placeholder="phone (optional)"
						name="phone"
					/>
					. I would like to report a case of{" "}
					<select
						name="incident_type"
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select incident type</option>
						<option value="physical">physical abuse</option>
						<option value="emotional">emotional abuse</option>
						<option value="sexual">sexual abuse</option>
						<option value="financial">financial abuse</option>
						<option value="other">other concerns</option>
					</select>{" "}
					which requires{" "}
					<select
						name="urgency"
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select urgency</option>
						<option value="high">high urgency</option>
						<option value="medium">medium urgency</option>
						<option value="low">low urgency</option>
					</select>{" "}
					attention. I most urgently need{" "}
					<select
						name="support_services"
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select type of help</option>
						{SUPPORT_SERVICE_OPTIONS.map(({ value, label }) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
					.
				</p>

				<p className="mt-4">Here's what happened:</p>
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs text-gray-500">You can speak instead of typing</span>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant={isListening ? "destructive" : "outline"}
								size="sm"
								onClick={() => (isListening ? stop() : start())}
							>
								{isListening ? (
									<>
										<Square className="h-4 w-4 mr-2" /> Stop
									</>
								) : (
									<>
										<Mic className="h-4 w-4 mr-2" /> Speak
									</>
								)}
							</Button>
						</div>
					</div>
					<Textarea
						placeholder="Please share what happened..."
						name="incident_description"
						required
						className="min-h-[140px] w-full mt-1"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
					{!isSupported && (
						<p className="text-xs text-gray-400">
							Voice input is not supported on this device/browser.
						</p>
					)}
				</div>

				<p className="mt-4">
					Please{" "}
					<select
						name="contact_preference"
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select contact method</option>
						<option value="phone_call">call me</option>
						<option value="sms">text me</option>
						<option value="email">email me</option>
						<option value="do_not_contact">don't contact me</option>
					</select>{" "}
					to follow up.{" "}
					<select
						name="consent"
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select consent</option>
						<option value="yes">I consent</option>
						<option value="no">I don't consent</option>
					</select>{" "}
					to share this information with relevant authorities if needed.
				</p>
			</div>

			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? "Submitting..." : "Submit Report"}
			</Button>
		</form>
	);
}
