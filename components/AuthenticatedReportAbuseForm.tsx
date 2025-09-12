"use client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { MultiSelect } from "@/components/ui/multi-select";
import {
	SUPPORT_SERVICE_OPTIONS,
	type SupportServiceType,
} from "@/lib/constants";
import { useUser } from "@/hooks/useUser";
import { Mic, Square } from "lucide-react";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { VoiceRecorderModal } from "@/components/VoiceRecorderModal";

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
	const [description, setDescription] = useState("");
	const [draft, setDraft] = useState<any | null>(null);
	const { isSupported, isListening, transcript, start, stop, reset } = useSpeechToText({ lang: "en-US", interimResults: true });
	const [location, setLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [recorderOpen, setRecorderOpen] = useState(false);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const supabase = createClient();
	const user = useUser();

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

	useEffect(() => {
		try {
			const saved = localStorage.getItem("authReportDraft");
			if (saved) {
				const parsed = JSON.parse(saved);
				setDraft(parsed);
				if (parsed.description) setDescription(parsed.description);
				if (parsed.selectedServices) setSelectedServices(parsed.selectedServices);
    }
    } catch (e) {
      // ignore draft load errors
    }
  }, []);

	useEffect(() => {
		if (!isListening && transcript) {
			setDescription((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
			reset();
		}
	}, [isListening, transcript, reset]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);

		const form = e.currentTarget;
		const formData = new FormData(form);
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

		// Upload audio first if present
		let administrative: any = null;
		if (audioBlob) {
			try {
				const filename = `reports/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
				const { error: upErr } = await supabase.storage.from('report-audio').upload(filename, audioBlob, { contentType: audioBlob.type || 'audio/webm' });
				if (!upErr) administrative = { audio_bucket: 'report-audio', audio_path: filename };
			} catch (e) {
				console.debug('auth audio upload failed', e);
			}
		}

		const data = {
			first_name: user?.profile?.first_name,
			last_name: user?.profile?.last_name || null,
			user_id: userId,
			phone: phone,
			type_of_incident: formData.get("incident_type"),
			incident_description: description || null,
			urgency: formData.get("urgency"),
			consent: formData.get("consent"),
			contact_preference: contactPreference,
			required_services: selectedServices,
			latitude: location?.latitude || null,
			longitude: location?.longitude || null,
			submission_timestamp: new Date().toISOString(),
			email: user?.profile?.email || null,
			administrative,
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
            try { localStorage.removeItem("authReportDraft"); } catch (e) { /* ignore */ }
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
			className="relative w-full max-w-[1200px] max-h-[80vh] flex flex-col"
		>
			<div className="flex-1 overflow-y-auto space-y-6 pr-4 pb-20">
				<div className="flex items-center gap-4 flex-wrap">
					<p className="text-lg text-gray-700">I want to report about</p>
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
					</select>
					<p className="text-lg text-gray-700">with</p>
					<select
						name="urgency"
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select urgency</option>
						<option value="high">high urgency</option>
						<option value="medium">medium urgency</option>
						<option value="low">low urgency</option>
					</select>
				</div>

				<div className="w-full space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs text-gray-500">You can speak instead of typing</span>
					<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setRecorderOpen(true)}
						>
						Record voice note
						</Button>
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
					<Textarea
						placeholder="Please share what happened... (optional if you attach a voice note)"
						name="incident_description"
						className="min-h-[140px] w-full"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
					{audioUrl && (
						<div className="mt-2 space-y-1">
							<p className="text-xs text-gray-500">Attached voice note:</p>
							<audio controls src={audioUrl} className="w-full" />
						</div>
					)}
					{!isSupported && (
						<p className="text-xs text-gray-400">
							Voice input is not supported on this device/browser.
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
									{draft?.selectedServices && draft.selectedServices.length > 0 && (
										<p className="text-xs text-gray-400">Draft selected: {draft.selectedServices.join(", ")}</p>
									)}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="col-span-full">
						<p className="text-lg text-gray-700">Contact Preference:</p>
					</div>
					<Input
						placeholder="Your phone number"
						name="phone"
						type="text"
						pattern="[0-9]{10,}"
						className="w-full"
					/>
					<select
						name="contact_preference"
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
						onChange={(e) => {
							const phoneInput = document.querySelector(
								'input[name="phone"]'
							) as HTMLInputElement;
							if (e.target.value === "phone_call" || e.target.value === "sms") {
								phoneInput.required = true;
							} else {
								phoneInput.required = false;
							}
						}}
					>
						<option value="">select contact preference</option>
						<option value="phone_call">Call me</option>
						<option value="sms">Text me</option>
						<option value="email">Email me</option>
						<option value="do_not_contact">Don't contact me</option>
					</select>
				</div>

				<div className="flex items-center gap-4 justify-between">
					<p className="text-lg text-gray-700">
						Do you consent to share this information with relevant authorities if
						needed?
					</p>
					<select
						name="consent"
						required
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent w-[200px]"
					>
						<option value="">select consent</option>
						<option value="yes">Yes, I consent</option>
						<option value="no">No, I don't consent</option>
					</select>
				</div>
			</div>

			<div className="fixed bottom-0 left-0 right-0 pt-4 pb-4 bg-white border-t mt-4 z-50">
				<div className="max-w-[1200px] mx-auto px-4 flex flex-col sm:flex-row gap-2">
					<Button
						type="submit"
						className="w-full sm:flex-1"
						disabled={loading}
					>
						{loading ? "Submitting..." : "Submit Report"}
					</Button>
					<Button
						variant="outline"
						onClick={(e) => {
							const form = (e.currentTarget.closest("form") as HTMLFormElement)!;
							const fd = new FormData(form);
							const toSave = Object.fromEntries(fd.entries());
            (toSave as any).description = description;
            (toSave as any).selectedServices = selectedServices;
            try { localStorage.setItem("authReportDraft", JSON.stringify(toSave)); setDraft(toSave); } catch (e) { /* ignore */ }
						}}
					>
						Save Draft
					</Button>
					<Button
            variant="ghost"
            onClick={() => { try { localStorage.removeItem("authReportDraft"); setDraft(null); setDescription(""); setSelectedServices([]); } catch (e) { /* ignore */ } }}
					>
						Clear Draft
					</Button>
				</div>
			</div>
		<VoiceRecorderModal 
			open={recorderOpen}
			onOpenChange={(v) => setRecorderOpen(v)}
			onRecorded={(blob) => { setAudioBlob(blob); try { const url = URL.createObjectURL(blob); setAudioUrl(url); } catch {} }}
		/>
		</form>
	);
}
