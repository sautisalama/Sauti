"use client";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { VoiceRecorderModal } from "@/components/VoiceRecorderModal";
import { createClient } from "@/utils/supabase/client";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
	const [draft, setDraft] = useState<any | null>(null);
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

// Load draft
useEffect(() => {
	try {
		const saved = localStorage.getItem("reportDraft");
		if (saved) {
			const parsed = JSON.parse(saved);
			setDraft(parsed);
			if (parsed.description) setDescription(parsed.description);
			if (parsed.incidentTypes) setIncidentTypes(parsed.incidentTypes);
			if (parsed.isOnBehalf) setIsOnBehalf(!!parsed.isOnBehalf);
			if (parsed.needsDisabled) setNeedsDisabled(!!parsed.needsDisabled);
			if (parsed.needsQueer) setNeedsQueer(!!parsed.needsQueer);
    }
    } catch (e) {
      // ignore draft load errors
    }
  }, []);

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


const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		setLoading(true);

		const formData = new FormData(form);

		try {
			// Upload audio if present
			let media: { title: string; url: string } | null = null;
			if (audioBlob) {
				try {
					const supabase = createClient();
					const filename = `reports/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
					const { error: upErr } = await supabase.storage.from('report-audio').upload(filename, audioBlob, { contentType: audioBlob.type || 'audio/webm' });
					if (!upErr) {
						const { data } = supabase.storage.from('report-audio').getPublicUrl(filename);
						media = { title: 'audio', url: data.publicUrl };
					} else {
						toast({ title: 'Audio not saved', description: 'We could not save your voice note. Submitting without it.', variant: 'destructive' });
					}
				} catch (err) {
					console.debug('audio upload failed', err);
				}
			}

			// Determine primary incident type compatible with DB
			const allowed: Record<string, string> = { physical:'physical', emotional:'emotional', sexual:'sexual', financial:'financial', other:'other' };
			const first = incidentTypes.find(t => allowed[t]);
			const type_of_incident = (first as any) || 'other';

			const additional_info: any = {
				incident_types: incidentTypes,
				special_needs: { disabled: needsDisabled, queer_support: needsQueer }
			};

			const body = {
				first_name: formData.get("first_name"),
				email: formData.get("email"),
				phone: formData.get("phone") || null,
				incident_description: description || null,
				type_of_incident,
				urgency: formData.get("urgency"),
				consent: formData.get("consent"),
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

			const response = await fetch('/api/reports/anonymous', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!response.ok) throw new Error('Failed to submit report');

			// Only reset and show success if the submission was successful
			form.reset();
        setDescription("");
        try { localStorage.removeItem("reportDraft"); } catch (e) { /* ignore */ }
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
				<div className="flex items-center gap-2 mb-3">
					<Switch id="onbehalf" checked={isOnBehalf} onCheckedChange={setIsOnBehalf} />
					<Label htmlFor="onbehalf">Reporting on behalf of someone else</Label>
				</div>
				<p className="leading-relaxed text-gray-600">
					Hello, my name is{" "}
					<input
						type="text"
						className="border-b-2 border-teal-500 focus:outline-none px-2 w-48 bg-transparent"
						placeholder="your name"
						name="first_name"
						defaultValue={draft?.first_name || ""}
						required
					/>
					. You can reach me at{" "}
					<input
						type="email"
						className="border-b-2 border-teal-500 focus:outline-none px-2 w-64 bg-transparent"
						placeholder="your email"
						name="email"
						defaultValue={draft?.email || ""}
						required
					/>{" "}
					or by phone at{" "}
					<input
						type="text"
						className="border-b-2 border-teal-500 focus:outline-none px-2 w-48 bg-transparent"
						placeholder="phone (optional)"
						name="phone"
						defaultValue={draft?.phone || ""}
					/>
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
					<select
						name="urgency"
						required
						defaultValue={draft?.urgency || ""}
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
						defaultValue={draft?.support_services || ""}
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
						<span className="text-xs text-gray-500">You can record a voice note instead of typing</span>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setRecorderOpen(true)}
						>
							Record voice note
						</Button>
						</div>
					</div>
					<Textarea
						placeholder="Please share what happened... (optional if you attach a voice note)"
						name="incident_description"
						className="min-h-[140px] w-full mt-1"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
					{audioUrl && (
						<div className="mt-2 space-y-1">
							<p className="text-xs text-gray-500">Attached voice note:</p>
							<audio controls src={audioUrl} className="w-full" />
						</div>
					)}
				</div>

				<p className="mt-4">
					Please{" "}
					<select
						name="contact_preference"
						required
						defaultValue={draft?.contact_preference || ""}
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select contact method</option>
						<option value="phone_call">call me</option>
						<option value="sms">text me</option>
						<option value="email">email me</option>
						<option value="do_not_contact">don't contact me</option>
					</select>{" "}
					to follow up. In case you need specialized support, you can select:
					<span className="inline-flex items-center gap-3 ml-3">
						<label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={needsDisabled} onChange={(e)=>setNeedsDisabled(e.target.checked)} /> I am disabled</label>
						<label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={needsQueer} onChange={(e)=>setNeedsQueer(e.target.checked)} /> I need queer support</label>
					</span>
					<select
						name="consent"
						required
						defaultValue={draft?.consent || ""}
						className="border-b-2 border-teal-500 focus:outline-none px-2 bg-transparent"
					>
						<option value="">select consent</option>
						<option value="yes">I consent</option>
						<option value="no">I don't consent</option>
					</select>{" "}
					to share this information with relevant authorities if needed.
				</p>
			</div>

			<div className="flex flex-col sm:flex-row gap-2">
				<Button type="submit" className="w-full sm:flex-1" disabled={loading}>
					{loading ? "Submitting..." : "Submit Report"}
				</Button>
				<Button
					type="button"
					variant="outline"
					className="w-full sm:w-auto"
					onClick={(e) => {
						const form = (e.currentTarget.closest("form") as HTMLFormElement)!;
						const fd = new FormData(form);
						const toSave: any = Object.fromEntries(fd.entries());
        toSave.description = description;
        toSave.incidentTypes = incidentTypes;
        toSave.isOnBehalf = isOnBehalf;
        toSave.needsDisabled = needsDisabled;
        toSave.needsQueer = needsQueer;
        try { localStorage.setItem("reportDraft", JSON.stringify(toSave)); setDraft(toSave); } catch (e) { /* ignore */ }
        toast({ title: "Draft saved" });
					}}
				>
					Save Draft
				</Button>
				<Button
					type="button"
					variant="ghost"
        className="w-full sm:w-auto"
        onClick={() => { try { localStorage.removeItem("reportDraft"); setDraft(null); setDescription(""); } catch (e) { /* ignore */ } }}
				>
					Clear Draft
				</Button>
			</div>
		<VoiceRecorderModal 
			open={recorderOpen}
			onOpenChange={(v) => setRecorderOpen(v)}
			onRecorded={(blob) => { setAudioBlob(blob); try { const url = URL.createObjectURL(blob); setAudioUrl(url); } catch {} }}
		/>
		</form>
	);
}
