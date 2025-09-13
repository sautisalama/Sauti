"use client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { MultiSelect } from "@/components/ui/multi-select";
import {
	SUPPORT_SERVICE_OPTIONS,
	type SupportServiceType,
} from "@/lib/constants";
import { useUser } from "@/hooks/useUser";
import { VoiceRecorderEnhanced as InlineRecorder } from "@/components/VoiceRecorderEnhanced";
import { EnhancedSelect } from "@/components/ui/enhanced-select";
import { EnhancedToggle } from "@/components/ui/enhanced-toggle";
import { normalizePhone } from "@/utils/phone";
import {
	validateAudioBlob,
	generateAudioFilename,
	createAudioMediaObject,
} from "@/utils/media";
import { getPhoneForAutofill } from "@/utils/phone-autofill";

interface AuthenticatedReportAbuseFormProps {
	onClose: () => void;
	userId: string;
}

export default function AuthenticatedReportAbuseForm({
	onClose,
	userId,
}: AuthenticatedReportAbuseFormProps) {
	const { toast } = useToast();
	const [loading, setLoading] = useState(false);
	const [selectedServices, setSelectedServices] = useState<string[]>([]);
	const [incidentTypes, setIncidentTypes] = useState<string[]>([]);
	const [description, setDescription] = useState("");
	// Voice via modal only for consistency
	const [location, setLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [recorderOpen, setRecorderOpen] = useState(false);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [audioUploading, setAudioUploading] = useState(false);
	const [audioUploadedUrl, setAudioUploadedUrl] = useState<string | null>(null);
	const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
	const audioUploadPromiseRef = useRef<Promise<string> | null>(null);
	const audioFilenameRef = useRef<string | null>(null);
	const [isOnBehalf, setIsOnBehalf] = useState(false);
	const [needsDisabled, setNeedsDisabled] = useState(false);
	const [needsQueer, setNeedsQueer] = useState(false);
	const [autofilledPhone, setAutofilledPhone] = useState<string | null>(null);
	const [urgency, setUrgency] = useState<string>("");
	const [contactPreference, setContactPreference] = useState<string>("");
	const [consent, setConsent] = useState<string>("");
	const supabase = useMemo(() => createClient(), []);
	const user = useUser();

	// Start uploading immediately when voice note is attached
	const startAudioUpload = (blob: Blob): Promise<string> => {
		const validation = validateAudioBlob(blob);
		if (!validation.valid) {
			setAudioUploadError(validation.error || "Invalid audio");
			return Promise.reject(new Error(validation.error || "Invalid audio"));
		}
		setAudioUploading(true);
		setAudioUploadError(null);
		setAudioUploadedUrl(null);
		const filename = generateAudioFilename(blob);
		audioFilenameRef.current = filename;
		const promise = supabase.storage
			.from("report-audio")
			.upload(filename, blob, {
				contentType: blob.type || "audio/webm",
				cacheControl: "3600",
				upsert: false,
			})
			.then(({ error }) => {
				if (error) throw error;
				const { data } = supabase.storage.from("report-audio").getPublicUrl(filename);
				setAudioUploadedUrl(data.publicUrl);
				setAudioUploading(false);
				return data.publicUrl;
			})
			.catch((err) => {
				setAudioUploading(false);
				setAudioUploadError(err?.message || "Failed to upload audio");
				throw err;
			});
		audioUploadPromiseRef.current = promise;
		return promise;
	};

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
	}, [toast]); // Include toast in dependencies

	// Autofill phone number from user profile or previous reports
	useEffect(() => {
		const autofillPhone = async () => {
			if (userId) {
				const result = await getPhoneForAutofill(userId);
				if (result.phone) {
					setAutofilledPhone(result.phone);
				}
			}
		};
		autofillPhone();
	}, [userId]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);

		const form = e.currentTarget;
		const formData = new FormData(form);
		const contactPreference = formData.get("contact_preference");
		const rawPhone = formData.get("phone") as string;
		const phone = normalizePhone(rawPhone);

		console.log("Phone validation:", { rawPhone, phone, contactPreference });

		// Description and voice recording are now completely optional

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

	// Use pre-uploaded audio if available; otherwise finish or start upload now
	let media: { title: string; url: string; type: string; size: number } | null = null;
	if (audioBlob) {
		// Validate first
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
			let url = audioUploadedUrl;
			if (!url && audioUploadPromiseRef.current) {
				toast({ title: "Finalizing voice note upload..." });
				url = await audioUploadPromiseRef.current;
			}
			if (!url) {
				url = await startAudioUpload(audioBlob);
			}
			if (url) {
				media = createAudioMediaObject(url, audioBlob);
			}
		} catch (e) {
			console.error("Audio upload error:", e);
			toast({
				title: "Audio Upload Failed",
				description: "Could not upload your voice note. Submitting without it.",
				variant: "destructive",
			});
		}
	}

		// Map the first selected enum-allowed incident to type_of_incident
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

		const data = {
			first_name: user?.profile?.first_name,
			last_name: user?.profile?.last_name || null,
			user_id: userId,
			phone: phone,
			type_of_incident,
			// With expanded enum, you can also allow multi-select here:
			// If you add MultiSelect later, map the first choice to type_of_incident and store all in additional_info
			incident_description: description || null,
			urgency: formData.get("urgency"),
			consent: formData.get("consent") || null,
			contact_preference: contactPreference,
			required_services: selectedServices,
			latitude: location?.latitude || null,
			longitude: location?.longitude || null,
			submission_timestamp: new Date().toISOString(),
			email: user?.profile?.email || null,
			media,
			is_onBehalf: isOnBehalf,
			additional_info: {
				incident_types: incidentTypes,
				special_needs: { disabled: needsDisabled, queer_support: needsQueer },
			},
		};

		try {
			const response = await fetch("/api/reports", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(data),
			});

			if (!response.ok) throw new Error("Failed to submit report");

			toast({
				title: "Report Submitted",
				description: "Thank you for your report. We will review it shortly.",
			});

			form.reset();
			setTimeout(() => {
				onClose();
			}, 500);
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
			className="relative w-full max-w-[1200px] max-h-[80vh] flex flex-col px-4 sm:px-6"
		>
			<div className="flex-1 overflow-y-auto space-y-6 px-1 sm:px-4 pb-32">
				<div className="space-y-4">
					<EnhancedToggle
						id="onbehalf-auth"
						checked={isOnBehalf}
						onCheckedChange={setIsOnBehalf}
						label="Reporting on behalf of someone else"
						description="Check this if you're submitting a report for another person"
					/>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Incident Type *
							</label>
							<MultiSelect
								selected={incidentTypes}
								onChange={setIncidentTypes}
								options={[
									{ value: "physical", label: "Physical abuse" },
									{ value: "emotional", label: "Emotional abuse" },
									{ value: "sexual", label: "Sexual abuse" },
									{ value: "financial", label: "Financial abuse" },
									{ value: "child_abuse", label: "Child abuse" },
									{ value: "other", label: "Other" },
								]}
								placeholder="Select incident types"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Urgency Level *
							</label>
							<EnhancedSelect
								options={[
									{ value: "high", label: "High urgency" },
									{ value: "medium", label: "Medium urgency" },
									{ value: "low", label: "Low urgency" },
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
								placeholder="Select urgency level"
								required
								name="urgency"
							/>
							<select name="urgency" className="hidden">
								<option value="">select urgency</option>
								<option value="high">high urgency</option>
								<option value="medium">medium urgency</option>
								<option value="low">low urgency</option>
							</select>
						</div>
					</div>
				</div>

				<div className="w-full space-y-3">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
						<span className="text-sm text-gray-600">
							Share your story in writing or by voice (you can start with either)
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setRecorderOpen((v) => !v)}
							className="w-full md:w-auto"
						>
							{recorderOpen ? "Hide voice recorder" : "Record voice note"}
						</Button>
					</div>

					{recorderOpen && (
						<div className="mt-2 fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
							<div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
								<InlineRecorder
									onRecorded={(blob) => {
										setAudioBlob(blob);
										try {
											const url = URL.createObjectURL(blob);
											setAudioUrl(url);
										} catch (e) {
											console.debug("Error creating audio URL:", e);
										}
										try { startAudioUpload(blob); } catch {}
									}}
									onClose={() => setRecorderOpen(false)}
								/>
								{audioUploading && (
									<p className="text-xs text-gray-500 mt-2">Uploading voice note in background…</p>
								)}
								{audioUploadedUrl && !audioUploading && (
									<p className="text-xs text-green-600 mt-2">Voice note uploaded ✓</p>
								)}
								{audioUploadError && (
									<p className="text-xs text-red-600 mt-2">{audioUploadError}</p>
								)}
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
										setAudioUploadedUrl(null);
										setAudioUploadError(null);
										audioUploadPromiseRef.current = null;
										audioFilenameRef.current = null;
										setAudioUploading(false);
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
						className="min-h-[120px] w-full text-base"
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

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="col-span-full flex items-center gap-4">
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
					</div>
					<div className="col-span-full">
						<p className="text-lg text-gray-700">Contact Preference:</p>
					</div>
					<div className="space-y-1">
						<Input
							placeholder="Your phone number"
							name="phone"
							type="tel"
							className="w-full"
							defaultValue={autofilledPhone || ""}
						/>
						{autofilledPhone && (
							<p className="text-xs text-green-600">
								✓ Phone number filled from your profile
							</p>
						)}
					</div>
					<EnhancedSelect
						options={[
							{ value: "phone_call", label: "Call me" },
							{ value: "sms", label: "Text me" },
							{ value: "email", label: "Email me" },
							{ value: "do_not_contact", label: "Don't contact me" },
						]}
						value={contactPreference}
						onChange={(value) => {
							setContactPreference(value);
							const form = document.querySelector("form") as HTMLFormElement;
							const select = form.querySelector(
								'select[name="contact_preference"]'
							) as HTMLSelectElement;
							if (select) select.value = value;

							const phoneInput = document.querySelector(
								'input[name="phone"]'
							) as HTMLInputElement;
							if (value === "phone_call" || value === "sms") {
								phoneInput.required = true;
							} else {
								phoneInput.required = false;
							}
						}}
						placeholder="Select contact preference"
						required
						name="contact_preference"
					/>
					<select name="contact_preference" className="hidden">
						<option value="">select contact preference</option>
						<option value="phone_call">Call me</option>
						<option value="sms">Text me</option>
						<option value="email">Email me</option>
						<option value="do_not_contact">Don't contact me</option>
					</select>
				</div>

				<div className="space-y-3">
					<label className="block text-sm font-medium text-gray-700">
						Consent to share information with authorities *
					</label>
					<EnhancedSelect
						options={[
							{ value: "yes", label: "Yes, I consent" },
							{ value: "no", label: "No, I don't consent" },
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
						placeholder="Select consent option"
						required
						name="consent"
					/>
					<select name="consent" className="hidden">
						<option value="">select consent</option>
						<option value="yes">Yes, I consent</option>
						<option value="no">No, I don't consent</option>
					</select>
				</div>
			</div>

			<div className="fixed bottom-0 left-0 right-0 pt-4 pb-4 bg-white border-t mt-4 z-40">
				<div className="max-w-[1200px] mx-auto px-4 space-y-2">
					<Button
						type="submit"
						className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-base sm:text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
						disabled={loading}
					>
						{loading ? "Submitting..." : "Submit Report"}
					</Button>
				</div>
			</div>
		</form>
	);
}
