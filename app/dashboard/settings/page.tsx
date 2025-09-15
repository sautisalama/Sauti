"use client";

import { useUser } from "@/hooks/useUser";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { useEffect, useState } from "react";
import { useAccessibility } from "@/components/a11y/AccessibilityProvider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function A11yToggle({
	label,
	attr,
	storageKey,
}: {
	label: string;
	attr: string;
	storageKey: string;
}) {
	// Simple client-side toggle that sets the html attribute directly and persists via provider state
	const a11y = useAccessibility();
	const isOn =
		typeof document !== "undefined" &&
		document.documentElement.getAttribute(attr) === "1";
	const toggle = () => {
		const el = document.documentElement;
		const next = isOn ? "0" : "1";
		el.setAttribute(attr, next);
		// Also merge into provider so it persists
		const patch: any = {};
		if (attr === "data-a11y-high-contrast") patch.highContrast = next === "1";
		if (attr === "data-a11y-reduce-motion") patch.reduceMotion = next === "1";
		if (attr === "data-a11y-lg-text") patch.largeText = next === "1";
		if (attr === "data-a11y-readable-font") patch.readableFont = next === "1";
		if (attr === "data-a11y-underline-links") patch.underlineLinks = next === "1";
		if (attr === "data-a11y-dyslexic") patch.dyslexic = next === "1";
		a11y.set(patch);
	};
	return (
		<div className="flex items-center justify-between">
			<span className="text-sm">{label}</span>
			<button
				onClick={toggle}
				className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
				style={{ backgroundColor: isOn ? "#0ea5e9" : "#e5e7eb" }}
				aria-pressed={isOn}
				aria-label={label}
			>
				<span
					className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
					style={{ transform: isOn ? "translateX(20px)" : "translateX(2px)" }}
				/>
			</button>
		</div>
	);
}

export default function SettingsPage() {
	const user = useUser();
	const { toast } = useToast();
	const a11y = useAccessibility();
	const isProfessional =
		user?.profile?.user_type === "professional" ||
		user?.profile?.user_type === "ngo";

	// Gender preference state for survivors
	const [genderPreferences, setGenderPreferences] = useState({
		preferFemale: false,
		preferMale: false,
		noPreference: true,
	});

	const onSave = (section: string) =>
		toast({ title: "Saved", description: `${section} updated (UI only)` });

	const handleGenderPreferenceChange = (
		preference: keyof typeof genderPreferences
	) => {
		setGenderPreferences((prev) => {
			const newState = { ...prev };

			// If selecting a specific gender preference, uncheck "no preference"
			if (preference !== "noPreference") {
				newState.noPreference = false;
				newState[preference] = !newState[preference];
			} else {
				// If selecting "no preference", uncheck all specific preferences
				newState.noPreference = true;
				newState.preferFemale = false;
				newState.preferMale = false;
			}

			return newState;
		});
	};

	return (
		<div className="max-w-4xl mx-auto p-4 md:p-6">
			<h1 className="text-2xl font-bold mb-4">Settings</h1>

			<Tabs defaultValue="account" className="w-full">
				<TabsList className="w-full overflow-x-auto flex whitespace-nowrap">
					<TabsTrigger value="account">Account</TabsTrigger>
					<TabsTrigger value="preferences">Preferences</TabsTrigger>
					<TabsTrigger value="accessibility">Accessibility</TabsTrigger>
					{isProfessional && (
						<TabsTrigger value="availability">Availability</TabsTrigger>
					)}
				</TabsList>

				<TabsContent value="account">
					<div className="space-y-6">
						{/* Account Settings */}
						<Card>
							<CardHeader>
								<CardTitle>Account</CardTitle>
							</CardHeader>
							<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<Input placeholder="Email" defaultValue={user?.email || ""} disabled />
								<Input placeholder="Phone" />
								<Input placeholder="City" />
								<div className="md:col-span-2 flex justify-end">
									<Button onClick={() => onSave("Account")}>Save</Button>
								</div>
							</CardContent>
						</Card>

						{/* Next of Kin Settings - Only for survivors */}
						{!isProfessional && (
							<Card>
								<CardHeader>
									<CardTitle>Next-of-Kin</CardTitle>
								</CardHeader>
								<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<Input placeholder="Full Name" />
									<Input placeholder="Relationship" />
									<Input placeholder="Phone Number" />
									<Input placeholder="Alternate Phone (optional)" />
									<Input placeholder="City / Location" />
									<div className="md:col-span-2">
										<Textarea placeholder="Notes / Instructions" rows={3} />
									</div>
									<div className="md:col-span-2 flex justify-end">
										<Button onClick={() => onSave("Next-of-Kin")}>Save</Button>
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				</TabsContent>

				<TabsContent value="preferences">
					<div className="space-y-6">
						{/* General Preferences */}
						<Card>
							<CardHeader>
								<CardTitle>General Preferences</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<Textarea placeholder="Notes (UI only)" rows={3} />
								<div className="flex justify-end">
									<Button onClick={() => onSave("Preferences")}>Save</Button>
								</div>
							</CardContent>
						</Card>

						{/* Support Preferences - Only for survivors */}
						{!isProfessional && (
							<Card>
								<CardHeader>
									<CardTitle>Support Preferences</CardTitle>
									<p className="text-sm text-muted-foreground">
										Choose your preferences for support professionals. This helps us match
										you with the most suitable support.
									</p>
								</CardHeader>
								<CardContent className="space-y-6">
									<div className="space-y-4">
										<div className="space-y-2">
											<Label className="text-base font-medium">
												Gender Preference for Support
											</Label>
											<p className="text-sm text-muted-foreground">
												Select your preferred gender for support professionals. You can
												choose multiple options or no preference.
											</p>
										</div>

										<div className="space-y-3">
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label htmlFor="prefer-female" className="text-sm font-medium">
														Prefer Female Support Professionals
													</Label>
													<p className="text-xs text-muted-foreground">
														I would prefer to work with female support professionals
													</p>
												</div>
												<Switch
													id="prefer-female"
													checked={genderPreferences.preferFemale}
													onCheckedChange={() =>
														handleGenderPreferenceChange("preferFemale")
													}
												/>
											</div>

											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label htmlFor="prefer-male" className="text-sm font-medium">
														Prefer Male Support Professionals
													</Label>
													<p className="text-xs text-muted-foreground">
														I would prefer to work with male support professionals
													</p>
												</div>
												<Switch
													id="prefer-male"
													checked={genderPreferences.preferMale}
													onCheckedChange={() => handleGenderPreferenceChange("preferMale")}
												/>
											</div>

											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label htmlFor="no-preference" className="text-sm font-medium">
														No Gender Preference
													</Label>
													<p className="text-xs text-muted-foreground">
														I have no preference for the gender of my support professional
													</p>
												</div>
												<Switch
													id="no-preference"
													checked={genderPreferences.noPreference}
													onCheckedChange={() =>
														handleGenderPreferenceChange("noPreference")
													}
												/>
											</div>
										</div>
									</div>

									<div className="flex justify-end">
										<Button onClick={() => onSave("Support Preferences")}>
											Save Preferences
										</Button>
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				</TabsContent>

				<TabsContent value="accessibility">
					<Card>
						<CardHeader>
							<CardTitle>Accessibility</CardTitle>
							<p className="text-sm text-muted-foreground">
								Adjust settings to improve readability and comfort. These apply on this
								device and are synced with the floating accessibility button.
							</p>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3">
								<A11yToggle
									label="High contrast"
									attr="data-a11y-high-contrast"
									storageKey="ss_a11y_high"
								/>
								<A11yToggle
									label="Reduce motion"
									attr="data-a11y-reduce-motion"
									storageKey="ss_a11y_motion"
								/>
								<A11yToggle
									label="Large text"
									attr="data-a11y-lg-text"
									storageKey="ss_a11y_large"
								/>
								<A11yToggle
									label="Dyslexic-friendly font"
									attr="data-a11y-dyslexic"
									storageKey="ss_a11y_dyslexic"
								/>
								<A11yToggle
									label="Readable font spacing"
									attr="data-a11y-readable-font"
									storageKey="ss_a11y_font"
								/>
								<A11yToggle
									label="Underline links"
									attr="data-a11y-underline-links"
									storageKey="ss_a11y_links"
								/>

								<div className="pt-1">
									<label className="text-sm block mb-1">Text size</label>
									<select
										aria-label="Text size"
										className="w-full rounded-md border px-2 py-1 text-sm"
										defaultValue={
											typeof document !== "undefined"
												? document.documentElement.getAttribute("data-a11y-text-scale") ||
												  "100"
												: "100"
										}
										onChange={(e) => {
											const n = Number(e.target.value) || 100;
											document.documentElement.setAttribute(
												"data-a11y-text-scale",
												String(n)
											);
											// Also update the accessibility provider
											a11y.set({ textScale: n });
										}}
									>
										<option value="100">100%</option>
										<option value="112.5">112.5%</option>
										<option value="125">125%</option>
										<option value="137.5">137.5%</option>
										<option value="150">150%</option>
									</select>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{isProfessional && (
					<TabsContent value="availability">
						<Card>
							<CardHeader>
								<CardTitle>Availability</CardTitle>
							</CardHeader>
							<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<Input placeholder="Time zone" />
								<Input placeholder="Available days" />
								<Input placeholder="Available hours" />
								<div className="md:col-span-2 flex justify-end">
									<Button onClick={() => onSave("Availability")}>Save</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}
