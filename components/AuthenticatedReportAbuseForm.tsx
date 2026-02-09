"use client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { MultiSelect } from "@/components/ui/multi-select";
import { AudioMiniPlayer } from "@/components/ui/audio-mini-player";
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
	const [reportingFor, setReportingFor] = useState<'self' | 'someone_else' | 'child'>('self');
	const [needsDisabled, setNeedsDisabled] = useState(false);
	const [needsQueer, setNeedsQueer] = useState(false);
	const [autofilledPhone, setAutofilledPhone] = useState<string | null>(null);
	const [urgency, setUrgency] = useState<string>("");
	const [contactPreference, setContactPreference] = useState<string>("");
	const [consent, setConsent] = useState<string>("");
	const [recordOnly, setRecordOnly] = useState(false);
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
				const { data } = supabase.storage
					.from("report-audio")
					.getPublicUrl(filename);
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
		let media: { title: string; url: string; type: string; size: number } | null =
			null;
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
			is_onBehalf: reportingFor !== 'self',
			record_only: recordOnly,
			additional_info: {
				incident_types: incidentTypes,
				special_needs: { disabled: needsDisabled, queer_support: needsQueer },
				is_for_child: reportingFor === 'child',
				reporting_for: reportingFor
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

	// Validation check
	const formIsValid = useMemo(() => {
		const hasIncidentType = incidentTypes.length > 0;
		const hasUrgency = urgency !== "";
		const hasConsent = consent !== "";
		const hasContactPref = contactPreference !== "";
		// Phone is optional unless contact pref is call/sms
		const phoneRequired = contactPreference === "phone_call" || contactPreference === "sms";
		// We can't easily check phone value here without state, so we rely on HTML5 validation for phone
		// but checking other state-based requirements is good.
		return hasIncidentType && hasUrgency && hasConsent && hasContactPref;
	}, [incidentTypes, urgency, consent, contactPreference]);

	return (
		<div className="flex flex-col h-full bg-white rounded-lg sm:rounded-none">
			{/* Header - Compact */}
			<div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
				<div>
					<h2 className="text-lg font-bold text-neutral-900 tracking-tight">
						New Report
					</h2>
					<p className="text-xs text-neutral-500 font-medium">
						Secure submission
					</p>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
				<form 
					id="auth-report-form"
					onSubmit={handleSubmit} 
					className="space-y-6 max-w-3xl mx-auto pb-20"
				>
				
				{/* Reporting For */}
				<div className="space-y-2">
					<label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Who is this report for?</label>
					<div className="grid grid-cols-3 gap-2">
						{[
							{ id: 'self', label: 'Myself' },
							{ id: 'someone_else', label: 'Someone Else' },
							{ id: 'child', label: 'A Child' }
						].map((opt) => (
							<button
								key={opt.id}
								type="button"
								onClick={() => setReportingFor(opt.id as any)}
								className={`flex items-center justify-center px-2 py-2.5 rounded-lg border transition-all font-medium text-xs sm:text-sm ${
									reportingFor === opt.id 
										? "border-sauti-teal bg-sauti-teal/5 text-sauti-teal ring-1 ring-sauti-teal" 
										: "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
								}`}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-neutral-700 mb-1.5">
							Incident Type <span className="text-red-500">*</span>
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
							placeholder="Select types..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-700 mb-1.5">
							Urgency Level <span className="text-red-500">*</span>
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
							placeholder="Select urgency"
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

				<div className="w-full space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium text-neutral-700">
							What happened? <span className="text-neutral-400 font-normal ml-1">(Optional)</span>
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setRecorderOpen((v) => !v)}
							className="h-7 text-xs border-neutral-200 px-3"
						>
							{recorderOpen ? "Hide recorder" : "Add Voice Note"}
						</Button>
					</div>

					{recorderOpen && (
						<div className="mt-2 fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
							<div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
								<InlineRecorder
									onRecorded={(blob) => {
										setAudioBlob(blob);
										try {
											const url = URL.createObjectURL(blob);
											setAudioUrl(url);
										} catch (e) {
											console.debug("Error creating audio URL:", e);
										}
										try {
											startAudioUpload(blob);
										} catch {}
									}}
									onClose={() => setRecorderOpen(false)}
								/>
								{audioUploading && (
									<p className="text-xs text-gray-500 mt-2">Uploading...</p>
								)}
								{audioUploadedUrl && !audioUploading && (
									<p className="text-xs text-green-600 mt-2">Ready to submit ✓</p>
								)}
								{audioUploadError && (
									<p className="text-xs text-red-600 mt-2">{audioUploadError}</p>
								)}
							</div>
						</div>
					)}

					{audioUrl && (
						<div className="p-3 bg-green-50/50 border border-green-100 rounded-lg flex items-center gap-3">
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between mb-1">
									<span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
										Voice Note Attached
									</span>
									<button
										type="button"
										onClick={() => {
											setAudioUrl(null);
											setAudioBlob(null);
											setAudioUploadedUrl(null);
											setAudioUploadError(null);
											audioUploadPromiseRef.current = null;
											audioFilenameRef.current = null;
											setAudioUploading(false);
										}}
										className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
									>
										Remove
									</button>
								</div>
								<AudioMiniPlayer src={audioUrl || ""} />
							</div>
						</div>
					)}

					<Textarea
						placeholder="Describe the incident here..."
						name="incident_description"
						className="min-h-[100px] w-full text-sm border-neutral-200 focus:border-sauti-teal focus:ring-sauti-teal/20 rounded-xl resize-none py-3"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</div>

				<div className="w-full space-y-2">
					<p className="text-sm font-medium text-neutral-700">Required Services</p>
					<MultiSelect
						selected={selectedServices}
						onChange={setSelectedServices}
						options={SUPPORT_SERVICE_OPTIONS}
						placeholder="Select services..."
					/>
				</div>

				<div className="space-y-4 pt-2">
					<div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
						<label className="inline-flex items-center gap-2 text-sm text-neutral-600 cursor-pointer hover:text-neutral-900">
							<input
								type="checkbox"
								checked={needsDisabled}
								onChange={(e) => setNeedsDisabled(e.target.checked)}
								className="rounded border-neutral-300 text-sauti-teal focus:ring-sauti-teal h-4 w-4"
							/>
							<span>I have a disability</span>
						</label>
						<label className="inline-flex items-center gap-2 text-sm text-neutral-600 cursor-pointer hover:text-neutral-900">
							<input
								type="checkbox"
								checked={needsQueer}
								onChange={(e) => setNeedsQueer(e.target.checked)}
								className="rounded border-neutral-300 text-sauti-teal focus:ring-sauti-teal h-4 w-4"
							/>
							<span>I need queer-friendly support</span>
						</label>
					</div>
					
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-1">
							<label className="block text-sm font-medium text-neutral-700 mb-1">Phone Number</label>
							<Input
								placeholder="+254..."
								name="phone"
								type="tel"
								className="w-full rounded-lg border-neutral-200 h-10"
								defaultValue={autofilledPhone || ""}
							/>
						</div>
						<div className="space-y-1">
							<label className="block text-sm font-medium text-neutral-700 mb-1">
								Contact Method <span className="text-red-500">*</span>
							</label>
							<EnhancedSelect
								options={[
									{ value: "phone_call", label: "Phone Call" },
									{ value: "sms", label: "SMS / Text" },
									{ value: "email", label: "Email" },
									{ value: "do_not_contact", label: "Do Not Contact" },
								]}
								value={contactPreference}
								onChange={(value) => {
									setContactPreference(value);
									const form = document.querySelector("form") as HTMLFormElement;
									const select = form.querySelector('select[name="contact_preference"]') as HTMLSelectElement;
									if (select) select.value = value;
									const phoneInput = document.querySelector('input[name="phone"]') as HTMLInputElement;
									if (value === "phone_call" || value === "sms") phoneInput.required = true;
									else phoneInput.required = false;
								}}
								placeholder="Select preference"
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
					</div>

					<div className="space-y-1">
						<label className="block text-sm font-medium text-neutral-700 mb-1">
							Consent to share <span className="text-red-500">*</span>
						</label>
						<EnhancedSelect
							options={[
								{ value: "yes", label: "Yes, I consent" },
								{ value: "no", label: "No, I do not consent" },
							]}
							value={consent}
							onChange={(value) => {
								setConsent(value);
								const form = document.querySelector("form") as HTMLFormElement;
								const select = form.querySelector('select[name="consent"]') as HTMLSelectElement;
								if (select) select.value = value;
							}}
							placeholder="Select option"
							required
							name="consent"
						/>
						<select name="consent" className="hidden">
							<option value="">select consent</option>
							<option value="yes">Yes, I consent</option>
							<option value="no">No, I don't consent</option>
						</select>
					</div>

					{/* Record Only Option */}
					<div className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
						recordOnly 
							? 'border-amber-400 bg-amber-50' 
							: 'border-neutral-200 bg-white hover:border-neutral-300'
					}`}
						onClick={() => setRecordOnly(!recordOnly)}
					>
						<label className="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={recordOnly}
								onChange={(e) => setRecordOnly(e.target.checked)}
								className="mt-0.5 rounded border-neutral-300 text-amber-500 focus:ring-amber-500 h-5 w-5"
							/>
							<div className="flex-1">
								<span className="text-sm font-semibold text-neutral-800 block">
									I don't need immediate help right now
								</span>
								<span className="text-xs text-neutral-500 block mt-1">
									Your report will be safely documented for your records. You can request support later at any time.
								</span>
							</div>
						</label>
						{recordOnly && (
							<div className="mt-3 p-3 bg-amber-100/50 rounded-lg">
								<p className="text-xs text-amber-800">
									<strong>Note:</strong> Your report will be stored securely but won't be shared with service providers unless you request help later. You can always access your report from your dashboard.
								</p>
							</div>
						)}
					</div>
				</div>

				</form>
			</div>
			
			{/* Sticky Footer - Compact */}
			<div className="shrink-0 py-4 px-6 bg-white border-t border-neutral-100 z-40">
				<Button
					form="auth-report-form"
					type="submit"
					className={`w-full h-12 text-base font-bold rounded-xl shadow-md transition-all duration-300 ${
						loading || !formIsValid 
						? "bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none" 
						: "bg-sauti-teal hover:bg-sauti-dark text-white shadow-sauti-teal/20"
					}`}
					disabled={loading || !formIsValid}
				>
					{loading ? "Submitting..." : "Submit Report"}
				</Button>
			</div>
		</div>
	);
}
