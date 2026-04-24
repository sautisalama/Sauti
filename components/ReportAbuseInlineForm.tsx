"use client";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { VoiceRecorderModal } from "@/components/VoiceRecorderModal";
import { VoiceRecorderEnhanced as InlineRecorder } from "@/components/VoiceRecorderEnhanced";
import { createClient } from "@/utils/supabase/client";
import { MultiSelect } from "@/components/ui/multi-select";
import { AudioMiniPlayer } from "@/components/ui/audio-mini-player";
import { EnhancedSelect } from "@/components/ui/enhanced-select";
import { EnhancedToggle } from "@/components/ui/enhanced-toggle";
import { normalizePhone } from "@/utils/phone";
import {
	validateAudioBlob,
	generateAudioFilename,
	createAudioMediaObject,
} from "@/utils/media";
import { getPhoneFromEmail } from "@/utils/phone-autofill";
import { Eye, EyeOff } from "lucide-react";

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
	{ value: "child_labor", label: "Child labor" },
	{ value: "neglect", label: "Neglect" },
	{ value: "trafficking", label: "Human Trafficking" },
	{ value: "stalking", label: "Stalking/Harassment" },
	{ value: "cyber", label: "Cyber Bullying" },
	{ value: "racial", label: "Racial Discrimination" },
	{ value: "other", label: "Other" },
] as const;

export default function ReportAbuseInlineForm() {
	const { toast } = useToast();
	const router = useRouter();
	const supabase = createClient();
	const [loading, setLoading] = useState(false);
	const [description, setDescription] = useState("");
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
	const [incidentTypes, setIncidentTypes] = useState<string[]>([]);
	const [isWorkplace, setIsWorkplace] = useState(false);
	const [needsDisabled, setNeedsDisabled] = useState(false);
	const [needsQueer, setNeedsQueer] = useState(false);
	const [consent, setConsent] = useState<string>("");
	const [urgency, setUrgency] = useState<string>("");
	const [supportServices, setSupportServices] = useState<string>("");

	const isChildCase = incidentTypes.includes('child_abuse') || incidentTypes.includes('child_labor') || reportingFor === 'child';
	const [autofilledPhone, setAutofilledPhone] = useState<string | null>(null);
	const [contactPreference, setContactPreference] = useState<string>("");
	const [allowLocation, setAllowLocation] = useState(true);
	// Password for anonymous account
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [passwordError, setPasswordError] = useState<string | null>(null);;

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

	// Autofill phone number when email is entered
	const handleEmailChange = async (email: string) => {
		if (email && email.includes("@")) {
			const result = await getPhoneFromEmail(email);
			if (result.phone) {
				setAutofilledPhone(result.phone);
			}
		}
};

	// Start uploading the voice note in the background as soon as it's attached
	const startAudioUpload = (blob: Blob): Promise<string> => {
		const validation = validateAudioBlob(blob);
		if (!validation.valid) {
			setAudioUploadError(validation.error || "Invalid audio");
			return Promise.reject(new Error(validation.error || "Invalid audio"));
		}
		setAudioUploading(true);
		setAudioUploadError(null);
		setAudioUploadedUrl(null);
		const supabase = createClient();
		const filename = generateAudioFilename(blob);
		audioFilenameRef.current = filename;
		toast({
			title: "Uploading voice note...",
			description: "We'll keep uploading while you fill in the report.",
		});
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
				toast({ title: "Voice note uploaded", description: "It will be attached to your report." });
				return data.publicUrl;
			})
			.catch((err) => {
				setAudioUploading(false);
				setAudioUploadError(err?.message || "Failed to upload audio");
				toast({
					title: "Audio Upload Failed",
					description:
						(err?.message || "We couldn't upload your voice note. You can still submit the report without it."),
					variant: "destructive",
				});
				throw err;
			});
		audioUploadPromiseRef.current = promise;
		return promise;
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		setLoading(true);

		const formData = new FormData(form);

		try {
			// Voice recording handling
			let media: {
				title: string;
				url: string;
				type: string;
				size: number;
			} | null = null;

			if (audioBlob) {
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
				} catch (err) {
					console.error("Audio upload error:", err);
					toast({
						title: "Audio Upload Failed",
						description: "Could not upload your voice note. Submitting report without it.",
						variant: "destructive",
					});
				}
			}

			// Incident type handling
			const allowed: Record<string, string> = {
				physical: "physical",
				emotional: "emotional",
				sexual: "sexual",
				financial: "financial",
				child_abuse: "child_abuse",
				child_labor: "child_labor",
				other: "other",
			};
			const first = incidentTypes.find((t) => allowed[t]);
			const type_of_incident = (first as any) || "other";

			const additional_info = {
				incident_types: incidentTypes,
				special_needs: { disabled: needsDisabled, queer_support: needsQueer },
				is_for_child: reportingFor === 'child',
				reporting_for: reportingFor
			};

			const urgencyValue = formData.get("urgency");
			if (!urgencyValue) {
				toast({
					title: "Missing Information",
					description: "Please select an urgency level.",
					variant: "destructive",
				});
				setLoading(false);
				return;
			}

			const body = {
				first_name: "Anonymous",
				email: null,
				phone: null,
				incident_description: description || null,
				type_of_incident,
				urgency: isChildCase ? "high" : urgencyValue,
				consent: isChildCase ? "yes" : (formData.get("consent") || null),
				contact_preference: "do_not_contact",
				required_services: [],
				latitude: allowLocation ? (location?.latitude || null) : null,
				longitude: allowLocation ? (location?.longitude || null) : null,
				submission_timestamp: new Date().toISOString(),
				media,
				is_onBehalf: reportingFor !== 'self',
				additional_info,
				is_workplace_incident: isWorkplace,
				support_services: formData.get("support_services") || null,
				password: password,
				screen: typeof window !== "undefined" ? {
					width: window.innerWidth,
					height: window.innerHeight
				} : undefined,
				record_only: isChildCase ? false : formData.get("record_only") === "true",
			};

			const response = await fetch("/api/reports/anonymous", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			// Safely handle non-JSON responses
			const contentType = response.headers.get("content-type");
			if (!contentType || !contentType.includes("application/json")) {
				const text = await response.text();
				console.error("Server returned non-JSON response:", text.substring(0, 500));
				throw new Error("Server error: Received invalid response format");
			}

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.details || result.error || "Failed to submit report");
			}

			// If anonymous account was created, sign in and redirect
			if (result.anonymous && result.email && password) {
				const { error: signInError } = await supabase.auth.signInWithPassword({
					email: result.email,
					password: password,
				});

				if (signInError) {
					toast({
						title: "Sign-In Required",
						description: `Your anonymous account was created as: ${result.username}, but auto sign-in failed. Please sign in manually.`,
						variant: "destructive",
					});
				} else {
					toast({
						title: "Report Submitted Successfully!",
						description: "Your safe space is ready. Redirecting to your dashboard...",
					});
					
					if (typeof window !== "undefined") {
						sessionStorage.setItem("anon_username", result.username);
						setTimeout(() => {
							window.location.replace("/dashboard");
						}, 100);
					}
					return;
				}
			} else {
				toast({
					title: "Report Submitted",
					description: "Thank you for your anonymous report. We will review it shortly.",
				});
			}

			// Clear states for safety
			setDescription("");
			setPassword("");
			form.reset();
		} catch (error) {
			console.error("Submission error:", error);
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to submit report. Please try again.",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="w-full bg-white">
			<form onSubmit={handleSubmit} className="space-y-6 sm:space-y-10 max-w-4xl mx-auto pb-12">
				<div className="space-y-6 sm:space-y-8">
					<div className="bg-white border-2 border-neutral-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm hover:border-sauti-teal/30 transition-all">
						<p className="text-sm font-black text-sauti-dark uppercase tracking-wider mb-4">Who are you reporting for?</p>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
							<button
								type="button"
								onClick={() => setReportingFor('self')}
								className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all font-bold ${
									reportingFor === 'self' 
										? "border-sauti-teal bg-sauti-teal/5 text-sauti-teal shadow-inner" 
										: "border-neutral-100 bg-neutral-50 text-neutral-500 hover:border-neutral-200"
								}`}
							>
								<div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${reportingFor === 'self' ? "border-sauti-teal" : "border-neutral-300"}`}>
									{reportingFor === 'self' && <div className="h-2 w-2 rounded-full bg-sauti-teal" />}
								</div>
								Myself
							</button>
							<button
								type="button"
								onClick={() => setReportingFor('someone_else')}
								className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all font-bold ${
									reportingFor === 'someone_else' 
										? "border-sauti-teal bg-sauti-teal/5 text-sauti-teal shadow-inner" 
										: "border-neutral-100 bg-neutral-50 text-neutral-500 hover:border-neutral-200"
								}`}
							>
								<div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${reportingFor === 'someone_else' ? "border-sauti-teal" : "border-neutral-300"}`}>
									{reportingFor === 'someone_else' && <div className="h-2 w-2 rounded-full bg-sauti-teal" />}
								</div>
								Someone Else
							</button>
							<button
								type="button"
								onClick={() => setReportingFor('child')}
								className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all font-bold ${
									reportingFor === 'child' 
										? "border-sauti-teal bg-sauti-teal/5 text-sauti-teal shadow-inner" 
										: "border-neutral-100 bg-neutral-50 text-neutral-500 hover:border-neutral-200"
								}`}
							>
								<div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${reportingFor === 'child' ? "border-sauti-teal" : "border-neutral-300"}`}>
									{reportingFor === 'child' && <div className="h-2 w-2 rounded-full bg-sauti-teal" />}
								</div>
								A Child
							</button>
						</div>
					</div>

					<div className="leading-relaxed text-gray-800 bg-neutral-100/70 p-4 sm:p-6 rounded-2xl border border-neutral-200/50 shadow-sm text-base md:text-lg">
						I would like to report {reportingFor !== 'self' ? "a case" : "incident(s)"} of{" "}
						<span className="inline-flex align-middle w-full sm:w-auto mt-2 mb-2 sm:mt-0 sm:mb-0">
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
								const select = form?.querySelector(
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
						{isChildCase && (
							<div className="-mx-4 md:-mx-8 mt-6 mb-6">
								<div className="bg-orange-50 border-y-2 border-orange-200 px-4 md:px-8 py-4 flex items-start gap-4">
									<div className="p-2.5 bg-orange-100 rounded-full text-orange-600 shrink-0">
										<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
									</div>
									<div className="flex-1">
										<p className="text-sm font-black text-orange-900 leading-tight uppercase tracking-tight">Mandatory Reporting Required</p>
										<p className="text-xs md:text-sm text-orange-850 mt-1.5 font-medium leading-relaxed">
											Under Kenya&apos;s <a href="https://www.ilo.org/dyn/natlex/natlex4.detail?p_lang=en&p_isn=113388" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-orange-950 transition-colors">Children Act, 2022</a>, 
											it is <span className="font-bold underline">legally mandatory</span> to report all cases of child exploitation and abuse to relevant authorities. 
											Consent is automatically established by law for these reports.
										</p>
									</div>
								</div>
							</div>
						)}
						attention. I most urgently need{" "}
						<EnhancedSelect
							options={SUPPORT_SERVICE_OPTIONS as any}
							value={supportServices}
							onChange={(value) => {
								setSupportServices(value);
								const form = document.querySelector("form") as HTMLFormElement;
								const select = form?.querySelector(
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
					</div>

					<p className="mt-4 text-base md:text-lg">Here's what happened:</p>
					<div className="space-y-3">
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
											} catch {}
											try {
												startAudioUpload(blob);
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
								<AudioMiniPlayer src={audioUrl} />
								{audioUploading && (
									<p className="text-xs text-gray-500 mt-1">Uploading voice note in background…</p>
								)}
								{audioUploadedUrl && !audioUploading && (
									<p className="text-xs text-green-600 mt-1">Voice note uploaded ✓</p>
								)}
								{audioUploadError && (
									<p className="text-xs text-red-600 mt-1">{audioUploadError}</p>
								)}
							</div>
						)}

						<Textarea
							placeholder="Please share what happened... (optional)"
							name="incident_description"
							className="min-h-[120px] w-full text-base"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</div>

					<div className="mt-4 flex flex-wrap items-center gap-4">
						<div className="inline-flex flex-wrap items-center gap-3 w-full sm:w-auto">
							<label className="flex-1 sm:flex-none inline-flex items-center gap-2 text-sm font-bold text-sauti-dark/80 bg-white px-3 py-2.5 rounded-xl border border-neutral-200 shadow-sm hover:border-sauti-teal/50 transition-colors cursor-pointer">
								<input
									type="checkbox"
									className="w-4 h-4 accent-sauti-teal"
									checked={needsDisabled}
									onChange={(e) => setNeedsDisabled(e.target.checked)}
								/>{" "}
								<span className="whitespace-nowrap">I am disabled</span>
							</label>
							<label className="flex-1 sm:flex-none inline-flex items-center gap-2 text-sm font-bold text-sauti-dark/80 bg-white px-3 py-2.5 rounded-xl border border-neutral-200 shadow-sm hover:border-sauti-teal/50 transition-colors cursor-pointer">
								<input
									type="checkbox"
									className="w-4 h-4 accent-sauti-teal"
									checked={needsQueer}
									onChange={(e) => setNeedsQueer(e.target.checked)}
								/>{" "}
								<span className="whitespace-nowrap">I need queer support</span>
							</label>
						</div>
						<div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
							<div className="w-full sm:w-auto">
								<EnhancedSelect
									options={[
										{ value: "yes", label: isChildCase ? "Established by Law (Yes)" : "I consent" },
										{ value: "no", label: "I don't consent" },
									]}
									value={isChildCase ? "yes" : consent}
									disabled={isChildCase}
									onChange={(value) => {
										setConsent(value);
										const form = document.querySelector("form") as HTMLFormElement;
										const select = form?.querySelector(
											'select[name="consent"]'
										) as HTMLSelectElement;
										if (select) select.value = value;
									}}
									placeholder="select consent"
									required
									name="consent"
									className={isChildCase ? "opacity-70 grayscale bg-neutral-100 border-neutral-300 font-bold" : ""}
								/>
							</div>
							{!isChildCase && (
								<span className="text-neutral-500 font-medium">to share this information with relevant authorities if needed.</span>
							)}
						</div>
						<select name="consent" className="hidden">
							<option value="">select consent</option>
							<option value="yes">I consent</option>
							<option value="no">I don't consent</option>
						</select>
						
						<div className="w-full mt-4">
							<label className="inline-flex items-center gap-2 text-sm font-bold text-sauti-dark/80 bg-white px-3 py-2 rounded-xl border border-neutral-200 shadow-sm hover:border-sauti-teal/50 transition-colors cursor-pointer">
								<input
									type="checkbox"
									className="w-4 h-4 accent-sauti-teal"
									checked={isWorkplace}
									onChange={(e) => setIsWorkplace(e.target.checked)}
								/>{" "}
								This happened at the workplace
							</label>
						</div>
					</div>
					
					<div className="mt-6 flex flex-col gap-1.5 p-4 bg-serene-neutral-50/50 rounded-xl border border-serene-neutral-200/50">
						<label className="inline-flex items-center gap-3 cursor-pointer text-sm font-semibold text-neutral-800">
							<input
								type="radio"
								name="allow_location"
								className="w-4 h-4 accent-sauti-teal shrink-0"
								checked={allowLocation}
								onChange={(e) => setAllowLocation(true)}
							/>
							Allow Sauti to automatically use my device's location to assist responders.
						</label>
						<label className="inline-flex items-center gap-3 cursor-pointer text-sm font-semibold text-neutral-800">
							<input
								type="radio"
								name="allow_location"
								className="w-4 h-4 accent-sauti-teal shrink-0"
								checked={!allowLocation}
								onChange={(e) => setAllowLocation(false)}
							/>
							Do not use my device's location.
						</label>
						<p className="text-[10px] text-neutral-500 pl-7 leading-relaxed mt-1">
							We will securely attach your estimated location without displaying a map. This helps us direct support units nearest to you. Your permission ensures safe alignment with privacy laws.
						</p>
					</div>
				</div>

				<div className="bg-blue-50/50 border border-blue-200/50 rounded-2xl p-4 sm:p-5 space-y-3">
					<div>
						<h3 className="text-lg font-semibold text-blue-900 mb-1">Create Your Secure Account</h3>
						<p className="text-sm text-blue-700">
							Set a password to access your dashboard, track your report, and connect with support services.
						</p>
					</div>
					<div className="relative">
						<input
							type={showPassword ? "text" : "password"}
							className="w-full border-2 border-blue-300 focus:border-blue-500 focus:outline-none rounded-lg px-4 py-3 pr-12 bg-white"
							placeholder="Create a password (min. 6 characters)"
							value={password}
							onChange={(e) => {
								setPassword(e.target.value);
								if (e.target.value.length > 0 && e.target.value.length < 6) {
									setPasswordError("Password must be at least 6 characters");
								} else {
									setPasswordError(null);
								}
							}}
							minLength={6}
							required
						/>
						<button
							type="button"
							className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
							onClick={() => setShowPassword(!showPassword)}
						>
							{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
						</button>
					</div>
					{passwordError && (
						<p className="text-sm text-red-600">{passwordError}</p>
					)}
				</div>

				<div className="pt-2">
					<Button
						type="submit"
						className="w-full bg-sauti-teal hover:bg-sauti-dark text-white py-4 text-base sm:text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
						disabled={loading || (password.length > 0 && password.length < 6)}
					>
						{loading ? "Submitting..." : "Submit Report"}
					</Button>
				</div>
			</form>
		</div>
	);
}
