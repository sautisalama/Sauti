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
	{ value: "other", label: "Other" },
] as const;

export default function ReportAbuseForm({ onClose }: { onClose?: () => void }) {
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
	const [needsDisabled, setNeedsDisabled] = useState(false);
	const [needsQueer, setNeedsQueer] = useState(false);
	const [autofilledPhone, setAutofilledPhone] = useState<string | null>(null);
	const [urgency, setUrgency] = useState<string>("");
	const [supportServices, setSupportServices] = useState<string>("");
	const [contactPreference, setContactPreference] = useState<string>("");
	const [consent, setConsent] = useState<string>("");
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
				urgency: urgencyValue,
				consent: formData.get("consent") || null,
				contact_preference: "do_not_contact",
				required_services: [],
				latitude: location?.latitude || null,
				longitude: location?.longitude || null,
				submission_timestamp: new Date().toISOString(),
				media,
				is_onBehalf: reportingFor !== 'self',
				additional_info,
				support_services: formData.get("support_services") || null,
				password: password,
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
				console.error("Server returned non-JSON response:", text.substring(0, 500)); // Log first 500 chars
				throw new Error("Server error: Received invalid response format");
			}

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.details || result.error || "Failed to submit report");
			}

			// If anonymous account was created, sign in and redirect
			if (result.anonymous && result.email && password) {
				console.log("Anonymous account created, signing in...", result.email);
				const { error: signInError } = await supabase.auth.signInWithPassword({
					email: result.email,
					password: password,
				});

				if (signInError) {
					console.error("Auto sign-in failed:", signInError);
					toast({
						title: "Sign-In Required",
						description: `Your anonymous account was created as: ${result.username}, but auto sign-in failed. Please sign in manually.`,
						variant: "destructive",
					});
				} else {
					console.log("Sign-in successful for anonymous user", result.username);
					toast({
						title: "Report Submitted Successfully!",
						description: "Your safe space is ready. Redirecting to your dashboard...",
					});
					
					if (typeof window !== "undefined") {
						sessionStorage.setItem("anon_username", result.username);
						// Allow toast to be seen briefly
						setTimeout(() => {
							window.location.replace("/dashboard");
						}, 100);
					}
					return;
				}
			} else {
				console.log("No anonymous credentials returned or password missing:", { 
					hasAnon: !!result.anonymous, 
					hasEmail: !!result.email, 
					hasPassword: !!password 
				});
				toast({
					title: "Report Submitted",
					description: "Thank you for your anonymous report. We will review it shortly.",
				});
			}

			// Clear states for safety
			setDescription("");
			setPassword("");
			form.reset();
			if (onClose) onClose();
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
		<div className="flex flex-col h-[90vh] sm:h-[85vh] bg-white overflow-hidden rounded-none sm:rounded-2xl">
			{/* Modal Header */}
			<div className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-neutral-50 flex items-center justify-between shrink-0">
				<div>
					<h2 className="text-lg sm:text-xl font-bold text-sauti-dark">Report Abuse</h2>
					<p className="text-xs text-neutral-500">Your safety is our priority. All reports are encrypted.</p>
				</div>
				{onClose && (
					<Button variant="ghost" size="sm" onClick={onClose} className="rounded-full h-8 w-8 p-0">
						✕
					</Button>
				)}
			</div>

			<div className="flex-1 overflow-y-auto p-3 sm:p-8 bg-neutral-50/30">
				<form onSubmit={handleSubmit} className="space-y-8 sm:space-y-10 max-w-2xl mx-auto pb-12">
					<div className="space-y-4 sm:space-y-6">
						<div className="bg-white border-2 border-neutral-200 rounded-xl sm:rounded-3xl p-4 sm:p-6 shadow-sm hover:border-sauti-teal/30 transition-all">
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

				<div className="leading-relaxed text-gray-800 bg-neutral-100/70 p-5 rounded-2xl border border-neutral-200/50 shadow-sm text-base md:text-lg">
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

				<div className="mt-4 flex flex-wrap items-center gap-4">
					<div className="inline-flex flex-wrap items-center gap-4">
						<label className="inline-flex items-center gap-2 text-sm font-bold text-sauti-dark/80 bg-white px-3 py-2 rounded-xl border border-neutral-200 shadow-sm hover:border-sauti-teal/50 transition-colors cursor-pointer">
							<input
								type="checkbox"
								className="w-4 h-4 accent-sauti-teal"
								checked={needsDisabled}
								onChange={(e) => setNeedsDisabled(e.target.checked)}
							/>{" "}
							I am disabled
						</label>
						<label className="inline-flex items-center gap-2 text-sm font-bold text-sauti-dark/80 bg-white px-3 py-2 rounded-xl border border-neutral-200 shadow-sm hover:border-sauti-teal/50 transition-colors cursor-pointer">
							<input
								type="checkbox"
								className="w-4 h-4 accent-sauti-teal"
								checked={needsQueer}
								onChange={(e) => setNeedsQueer(e.target.checked)}
							/>{" "}
							I need queer support
						</label>
					</div>
					<span className="block mt-3 w-full md:inline-block md:w-auto">
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
					</span>
					<select name="consent" className="hidden">
						<option value="">select consent</option>
						<option value="yes">I consent</option>
						<option value="no">I don't consent</option>
					</select>{" "}
					to share this information with relevant authorities if needed.
				</div>
				</div>

			{/* Anonymous Account Password Section */}
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
				<p className="text-xs text-blue-600">
					💡 You&apos;ll use this password to log in later. A unique username will be generated for you.
				</p>
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
	</div>
	);
}
