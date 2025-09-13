"use client";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { VoiceRecorderModal } from "@/components/VoiceRecorderModal";
import { VoiceRecorderEnhanced as InlineRecorder } from "@/components/VoiceRecorderEnhanced";
import { createClient } from "@/utils/supabase/client";
import { MultiSelect } from "@/components/ui/multi-select";
import { EnhancedSelect } from "@/components/ui/enhanced-select";
import { EnhancedToggle } from "@/components/ui/enhanced-toggle";
import { normalizePhone } from "@/utils/phone";
import {
	validateAudioBlob,
	generateAudioFilename,
	createAudioMediaObject,
} from "@/utils/media";
import { getPhoneFromEmail } from "@/utils/phone-autofill";

const SUPPORT_SERVICE_OPTIONS = [
	{ value: "legal", label: "legal support" },
	{ value: "medical", label: "medical care" },
	{ value: "mental_health", label: "mental health support" },
	{ value: "shelter", label: "shelter services" },
	{ value: "financial_assistance", label: "financial assistance" },
	{ value: "other", label: "other support services" },
] as const;

const INCIDENT_OPTIONS = [
	{ value: "physical", label: "Physical abuse" },
	{ value: "emotional", label: "Emotional abuse" },
	{ value: "sexual", label: "Sexual abuse" },
	{ value: "financial", label: "Financial abuse" },
	{ value: "child_abuse", label: "Child abuse" },
	{ value: "other", label: "Other" },
] as const;

export default function ReportAbuseForm({ onClose }: { onClose?: () => void }) {
	const { toast } = useToast();
	const [loading, setLoading] = useState(false);
	const [description, setDescription] = useState("");
	const [location, setLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [recorderOpen, setRecorderOpen] = useState(false);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [isOnBehalf, setIsOnBehalf] = useState(false);
	const [incidentTypes, setIncidentTypes] = useState<string[]>([]);
	const [needsDisabled, setNeedsDisabled] = useState(false);
	const [needsQueer, setNeedsQueer] = useState(false);
	const [autofilledPhone, setAutofilledPhone] = useState<string | null>(null);
	const [urgency, setUrgency] = useState<string>("");
	const [supportServices, setSupportServices] = useState<string>("");
	const [contactPreference, setContactPreference] = useState<string>("");
	const [consent, setConsent] = useState<string>("");

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
	}, []); // Empty dependency array is correct here

	// Autofill phone number when email is entered
	const handleEmailChange = async (email: string) => {
		if (email && email.includes("@")) {
			const result = await getPhoneFromEmail(email);
			if (result.phone) {
				setAutofilledPhone(result.phone);
			}
		}
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		setLoading(true);

		const formData = new FormData(form);
		const rawPhone = formData.get("phone") as string;
		const phone = normalizePhone(rawPhone);

		console.log("Phone validation:", { rawPhone, phone });

		// Description and voice recording are now completely optional

		try {
			// Upload audio if present
			let media: {
				title: string;
				url: string;
				type: string;
				size: number;
			} | null = null;
			if (audioBlob) {
				// Validate audio blob before upload
				const validation = validateAudioBlob(audioBlob);
				if (!validation.valid) {
					toast({
						title: "Invalid Audio",
						description: validation.error || "Audio file is invalid",
						variant: "destructive",
					});
					setLoading(false);
					return;
				}

				try {
					const supabase = createClient();
					const filename = generateAudioFilename(audioBlob);
					const { error: upErr } = await supabase.storage
						.from("report-audio")
						.upload(filename, audioBlob, {
							contentType: audioBlob.type || "audio/webm",
							cacheControl: "3600",
							upsert: false,
						});
					if (!upErr) {
						const { data } = supabase.storage
							.from("report-audio")
							.getPublicUrl(filename);
						media = createAudioMediaObject(data.publicUrl, audioBlob);
						console.log("Audio uploaded successfully:", data.publicUrl);
					} else {
						console.error("Audio upload failed:", upErr);
						console.error("Upload error details:", {
							error: upErr,
							filename,
							bucket: "report-audio",
							blobSize: audioBlob.size,
							blobType: audioBlob.type,
						});
						toast({
							title: "Audio Upload Failed",
							description: `Could not save your voice recording: ${
								upErr.message || "Unknown error"
							}. Please try again or submit without it.`,
							variant: "destructive",
						});
					}
				} catch (err) {
					console.error("Audio upload error:", err);
					toast({
						title: "Audio Upload Error",
						description:
							"An error occurred while saving your voice recording. Please try again.",
						variant: "destructive",
					});
				}
			}

			// Determine primary incident type compatible with DB
			const allowed: Record<string, string> = {
				physical: "physical",
				emotional: "emotional",
				sexual: "sexual",
				financial: "financial",
				child_abuse: "child_abuse",
				other: "other",
			};
			const first = incidentTypes.find((t) => allowed[t]);
			const type_of_incident = (first as any) || "other";

			const additional_info: any = {
				incident_types: incidentTypes,
				special_needs: { disabled: needsDisabled, queer_support: needsQueer },
			};

			const body = {
				first_name: formData.get("first_name"),
				email: formData.get("email"),
				phone: normalizePhone((formData.get("phone") as string) || null),
				incident_description: description || null,
				type_of_incident,
				urgency: formData.get("urgency"),
				consent: formData.get("consent") || null,
				contact_preference: formData.get("contact_preference"),
				required_services: [],
				latitude: location?.latitude || null,
				longitude: location?.longitude || null,
				submission_timestamp: new Date().toISOString(),
				media,
				is_onBehalf: isOnBehalf,
				additional_info,
				support_services: formData.get("support_services") || null,
			};

			const response = await fetch("/api/reports/anonymous", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!response.ok) throw new Error("Failed to submit report");

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
			<div className="space-y-6">
				<EnhancedToggle
					id="onbehalf"
					checked={isOnBehalf}
					onCheckedChange={setIsOnBehalf}
					label="Reporting on behalf of someone else"
					description="Check this if you're submitting a report for another person"
				/>
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
						onChange={(e) => handleEmailChange(e.target.value)}
					/>{" "}
					or by phone at{" "}
					<div className="inline-block">
						<input
							type="tel"
							className="border-b-2 border-teal-500 focus:outline-none px-2 w-48 bg-transparent"
							placeholder="phone (optional)"
							name="phone"
							defaultValue={autofilledPhone || ""}
						/>
						{autofilledPhone && (
							<span className="text-xs text-green-600 ml-2">
								✓ (from previous report)
							</span>
						)}
					</div>
					. I would like to report cases of{" "}
					<span className="inline-flex align-middle">
						<MultiSelect
							selected={incidentTypes}
							onChange={setIncidentTypes}
							options={INCIDENT_OPTIONS}
							placeholder="select incident types"
						/>
					</span>{" "}
					which requires{" "}
					<EnhancedSelect
						options={[
							{ value: "high", label: "high urgency" },
							{ value: "medium", label: "medium urgency" },
							{ value: "low", label: "low urgency" },
						]}
						value={urgency}
						onChange={(value) => {
							setUrgency(value);
							const form = document.querySelector("form") as HTMLFormElement;
							const select = form.querySelector(
								'select[name="urgency"]'
							) as HTMLSelectElement;
							if (select) select.value = value;
						}}
						placeholder="select urgency"
						required
						name="urgency"
					/>
					<select name="urgency" className="hidden">
						<option value="">select urgency</option>
						<option value="high">high urgency</option>
						<option value="medium">medium urgency</option>
						<option value="low">low urgency</option>
					</select>{" "}
					attention. I most urgently need{" "}
					<EnhancedSelect
						options={SUPPORT_SERVICE_OPTIONS as any}
						value={supportServices}
						onChange={(value) => {
							setSupportServices(value);
							const form = document.querySelector("form") as HTMLFormElement;
							const select = form.querySelector(
								'select[name="support_services"]'
							) as HTMLSelectElement;
							if (select) select.value = value;
						}}
						placeholder="select type of help"
						required
						name="support_services"
					/>
					<select name="support_services" className="hidden">
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
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-sm text-gray-600">
							Share your story in writing or by voice (you can start with either)
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setRecorderOpen((v) => !v)}
						>
							{recorderOpen ? "Hide voice recorder" : "Record voice note"}
						</Button>
					</div>

					{recorderOpen && (
						<div className="mt-2 fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
							<div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
								<InlineRecorder
									onRecorded={(blob) => {
										setAudioBlob(blob);
										try {
											const url = URL.createObjectURL(blob);
											setAudioUrl(url);
										} catch {}
									}}
									onClose={() => setRecorderOpen(false)}
								/>
							</div>
						</div>
					)}

					{audioUrl && (
						<div className="p-3 bg-green-50 border border-green-200 rounded-lg">
							<div className="flex items-center justify-between mb-2">
								<span className="text-sm font-medium text-green-700">
									Voice note attached
								</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										setAudioUrl(null);
										setAudioBlob(null);
									}}
								>
									Remove
								</Button>
							</div>
							<audio controls src={audioUrl} className="w-full" />
						</div>
					)}

					<Textarea
						placeholder="Please share what happened... (optional)"
						name="incident_description"
						className="min-h-[120px] w-full"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
					{audioUrl && (
						<p className="text-xs text-gray-500">
							✓ Voice note attached - you can add additional text details if needed
						</p>
					)}
					{!audioUrl && !description && (
						<p className="text-xs text-gray-500">
							💡 You can optionally describe what happened in writing, by voice, or
							both
						</p>
					)}
				</div>

				<p className="mt-4">
					Please{" "}
					<EnhancedSelect
						options={[
							{ value: "phone_call", label: "call me" },
							{ value: "sms", label: "text me" },
							{ value: "email", label: "email me" },
							{ value: "do_not_contact", label: "don't contact me" },
						]}
						value={contactPreference}
						onChange={(value) => {
							setContactPreference(value);
							const form = document.querySelector("form") as HTMLFormElement;
							const select = form.querySelector(
								'select[name="contact_preference"]'
							) as HTMLSelectElement;
							if (select) select.value = value;
						}}
						placeholder="select contact method"
						required
						name="contact_preference"
					/>
					<select name="contact_preference" className="hidden">
						<option value="">select contact method</option>
						<option value="phone_call">call me</option>
						<option value="sms">text me</option>
						<option value="email">email me</option>
						<option value="do_not_contact">don't contact me</option>
					</select>{" "}
					to follow up. In case you need specialized support, you can select:
					<span className="inline-flex items-center gap-3 ml-3">
						<label className="inline-flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={needsDisabled}
								onChange={(e) => setNeedsDisabled(e.target.checked)}
							/>{" "}
							I am disabled
						</label>
						<label className="inline-flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={needsQueer}
								onChange={(e) => setNeedsQueer(e.target.checked)}
							/>{" "}
							I need queer support
						</label>
					</span>
					<EnhancedSelect
						options={[
							{ value: "yes", label: "I consent" },
							{ value: "no", label: "I don't consent" },
						]}
						value={consent}
						onChange={(value) => {
							setConsent(value);
							const form = document.querySelector("form") as HTMLFormElement;
							const select = form.querySelector(
								'select[name="consent"]'
							) as HTMLSelectElement;
							if (select) select.value = value;
						}}
						placeholder="select consent"
						required
						name="consent"
					/>
					<select name="consent" className="hidden">
						<option value="">select consent</option>
						<option value="yes">I consent</option>
						<option value="no">I don't consent</option>
					</select>{" "}
					to share this information with relevant authorities if needed.
				</p>
			</div>

			<div className="space-y-2">
				<Button
					type="submit"
					className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
					disabled={loading}
				>
					{loading ? "Submitting..." : "Submit Report"}
				</Button>
			</div>
		</form>
	);
}
