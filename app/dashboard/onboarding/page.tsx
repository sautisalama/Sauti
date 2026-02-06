"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/utils/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AddSupportServiceForm } from "@/components/AddSupportServiceForm";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";

interface Step {
	id: string;
	title: string;
	description: string;
}

const steps: Step[] = [
	{
		id: "welcome",
		title: "Welcome",
		description: "Overview, privacy and safety.",
	},
	{ id: "basics", title: "Basics", description: "Name and contact details." },
	{
		id: "pro_profile",
		title: "Professional Profile",
		description: "Title, bio, languages.",
	},
	{
		id: "credentials",
		title: "Credentials",
		description: "Training and verification docs (UI).",
	},
	{
		id: "services",
		title: "Services",
		description: "List the services you provide.",
	},
	{
		id: "availability",
		title: "Availability & Calendar",
		description: "Set availability and connect calendar.",
	},
	{
		id: "policies",
		title: "Policies",
		description: "Read and accept code of conduct.",
	},
	{
		id: "preferences",
		title: "Preferences",
		description: "Notifications and privacy.",
	},
	{
		id: "finish",
		title: "Finish",
		description: "Complete and go to dashboard.",
	},
];

export default function OnboardingPage() {
	const user = useUser();
	const supabase = createClient();
	const [stepIndex, setStepIndex] = useState(0);
	const [saving, setSaving] = useState(false);
	const router = useRouter();

	useEffect(() => {
		if (user?.profile?.is_anonymous || user?.profile?.anon_username) {
			window.location.href = "/dashboard";
		}
	}, [user]);

	const [profile, setProfile] = useState({
		first_name: "",
		last_name: "",
		phone: "",
		professional_title: "",
		bio: "",
		is_public_booking: false,
	});

	useEffect(() => {
		if (user?.profile) {
			setProfile({
				first_name: user.profile.first_name || "",
				last_name: user.profile.last_name || "",
				phone: user.profile.phone || "",
				professional_title: user.profile.professional_title || "",
				bio: user.profile.bio || "",
				is_public_booking: Boolean(user.profile.is_public_booking),
			});
		}
	}, [user?.profile]);

	const next = async () => {
		// Persist on certain steps
		const current = steps[stepIndex]?.id;
		try {
			if (!user?.id) return setStepIndex((i) => Math.min(i + 1, steps.length - 1));
			setSaving(true);
			if (
				current === "basics" ||
				current === "pro_profile" ||
				current === "availability"
			) {
				await supabase
					.from("profiles")
					.update({
						first_name: profile.first_name || null,
						last_name: profile.last_name || null,
						phone: profile.phone || null,
						professional_title: profile.professional_title || null,
						bio: profile.bio || null,
						is_public_booking: profile.is_public_booking,
					})
					.eq("id", user.id);
			}
		} finally {
			setSaving(false);
			setStepIndex((i) => Math.min(i + 1, steps.length - 1));
		}
	};

	const back = () => setStepIndex((i) => Math.max(i - 1, 0));

	const isPro =
		user?.profile?.user_type === "professional" ||
		user?.profile?.user_type === "ngo";

	const Header = (
		<div className="mb-6">
			<SereneBreadcrumb items={[{ label: "Onboarding", active: true }]} className="mb-4" />
			<h1 className="text-2xl font-bold">Onboarding</h1>
			<p className="text-sm text-neutral-500">
				A few quick steps to get you set up.
			</p>
			<div className="flex gap-2 mt-3 flex-wrap">
				{steps.map((s, idx) => (
					<Badge key={s.id} variant={idx === stepIndex ? "default" : "secondary"}>
						{idx + 1}. {s.title}
					</Badge>
				))}
			</div>
		</div>
	);

	const Welcome = (
		<Card>
			<CardHeader>
				<CardTitle>Welcome to Sauti</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 text-sm text-neutral-700">
				<p>
					Your privacy and safety are our top priority. You control what you share.
				</p>
				<ul className="list-disc pl-4 space-y-1">
					<li>All communications are encrypted.</li>
					<li>You can switch to Anonymous Mode anytime.</li>
					<li>We only ask for information required to match and coordinate care.</li>
				</ul>
			</CardContent>
		</Card>
	);

	const Basics = (
		<Card>
			<CardHeader>
				<CardTitle>Basic Information</CardTitle>
			</CardHeader>
			<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Input
					placeholder="First name"
					value={profile.first_name}
					onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))}
				/>
				<Input
					placeholder="Last name"
					value={profile.last_name}
					onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))}
				/>
				<Input
					placeholder="Phone"
					value={profile.phone}
					onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
				/>
			</CardContent>
		</Card>
	);

	const ProProfile = (
		<Card>
			<CardHeader>
				<CardTitle>Professional Profile</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<Input
					placeholder="Professional title (e.g., Counselor, Legal Advocate)"
					value={profile.professional_title}
					onChange={(e) =>
						setProfile((p) => ({ ...p, professional_title: e.target.value }))
					}
				/>
				<Textarea
					placeholder="Short bio, specialties, languages"
					rows={4}
					value={profile.bio}
					onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
				/>
			</CardContent>
		</Card>
	);

	function CredentialsSection() {
		const [files, setFiles] = useState<File[]>([]);
		return (
			<Card>
				<CardHeader>
					<CardTitle>Credentials & Documents</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm">
					<p className="text-neutral-600">
						Upload multiple certifications and training documents. You can add or
						remove files before submitting.
					</p>
					<div className="space-y-3">
						<Input
							type="file"
							multiple
							onChange={(e) => {
								const list = e.target.files ? Array.from(e.target.files) : [];
								setFiles(list);
							}}
						/>
						{files.length > 0 && (
							<div className="rounded border bg-neutral-50 p-3">
								<p className="text-xs mb-2">Selected files ({files.length}):</p>
								<ul className="space-y-1 max-h-40 overflow-auto">
									{files.map((f, idx) => (
										<li key={idx} className="flex items-center justify-between text-xs">
											<span className="truncate max-w-[70%]">{f.name}</span>
											<span className="text-neutral-400">
												{Math.round(f.size / 1024)} KB
											</span>
										</li>
									))}
								</ul>
							</div>
						)}
						<div className="flex gap-2">
							<Button
								type="button"
								variant="secondary"
								onClick={() => setFiles([])}
								disabled={files.length === 0}
							>
								Clear
							</Button>
							<Button
								type="button"
								onClick={() => alert("Upload pending backend wiring")}
							>
								Upload (UI only)
							</Button>
						</div>
					</div>
					<p className="text-[11px] text-neutral-500">
						Note: We’ll securely store your certifications once document storage is
						enabled.
					</p>
				</CardContent>
			</Card>
		);
	}

	const Services = (
		<Card>
			<CardHeader>
				<CardTitle>Services You Provide</CardTitle>
			</CardHeader>
			<CardContent>
				<AddSupportServiceForm
					onSuccess={() => {
						/* no-op */
					}}
				/>
			</CardContent>
		</Card>
	);

	const Availability = (
		<Card>
			<CardHeader>
				<CardTitle>Availability & Calendar</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center justify-between">
					<Label htmlFor="public-booking">Enable public booking</Label>
					<Switch
						id="public-booking"
						checked={profile.is_public_booking}
						onCheckedChange={(v) =>
							setProfile((p) => ({ ...p, is_public_booking: v }))
						}
					/>
				</div>
				<div className="text-sm text-muted-foreground">
					<p>
						Calendar integration is optional. You can use the app without connecting
						to Google Calendar.
					</p>
				</div>
				<div className="flex gap-2">
					<Link href="/dashboard/appointments">
						<Button variant="default">Open Scheduler</Button>
					</Link>
					<Button variant="outline" disabled>
						Calendar Integration (Optional)
					</Button>
				</div>
			</CardContent>
		</Card>
	);

	const Policies = (
		<Card>
			<CardHeader>
				<CardTitle>Code of Conduct</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				<p>
					Please confirm you agree to our professional code of conduct and data
					protection policy.
				</p>
				<ul className="list-disc pl-4 space-y-1">
					<li>Maintain confidentiality and privacy.</li>
					<li>Respond promptly to matched cases.</li>
					<li>Provide trauma-informed, survivor-centered care.</li>
				</ul>
			</CardContent>
		</Card>
	);

	const Preferences = (
		<Card>
			<CardHeader>
				<CardTitle>Notifications & Privacy</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 text-sm">
				<div className="flex items-center justify-between">
					<Label htmlFor="notif-cases">Notify me for new matches</Label>
					<Switch id="notif-cases" />
				</div>
				<div className="flex items-center justify-between">
					<Label htmlFor="notif-chat">Notify me for messages</Label>
					<Switch id="notif-chat" />
				</div>
			</CardContent>
		</Card>
	);

	const Finish = (
		<Card>
			<CardHeader>
				<CardTitle>You're all set</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				<p>
					Thanks for completing onboarding. You can update any info later in your
					profile.
				</p>
				<div className="flex gap-2">
					<Link href="/dashboard">
						<Button>Go to Dashboard</Button>
					</Link>
					{isPro && (
						<Link href="/dashboard/cases">
							<Button variant="outline">Review Cases</Button>
						</Link>
					)}
				</div>
			</CardContent>
		</Card>
	);

	const contentMap: Record<string, React.ReactNode> = {
		welcome: Welcome,
		basics: Basics,
		pro_profile: ProProfile,
		credentials: <CredentialsSection />,
		services: Services,
		availability: Availability,
		policies: Policies,
		preferences: Preferences,
		finish: Finish,
	};

	const Current = contentMap[steps[stepIndex].id];

	return (
		<div className="max-w-3xl mx-auto p-4 md:p-6">
			{Header}
			<div className="space-y-4">
				{Current}
				<div className="flex justify-between pt-2">
					<Button variant="ghost" onClick={back} disabled={stepIndex === 0}>
						Back
					</Button>
					<div className="flex gap-2">
						{stepIndex < steps.length - 1 ? (
							<>
								<Button variant="secondary" asChild>
									<Link href="/dashboard">Skip for now</Link>
								</Button>
								<Button onClick={next} disabled={saving}>
									{saving ? "Saving..." : "Next"}
								</Button>
							</>
						) : (
							<Button asChild>
								<Link href="/dashboard">Finish</Link>
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
