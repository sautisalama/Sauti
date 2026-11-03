"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarDays, Camera, Check, CircleCheck, HardDrive, Mail } from "lucide-react";
import { suiteWelcomeStatus, type WelcomeStatus } from "@/app/actions/suite-welcome";

const SNOOZE_KEY = "ss_suite_welcome_until";
const DAY = 24 * 60 * 60 * 1000;
const snooze = () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + DAY)); } catch { /* ignore */ } };

/**
 * Shown to an administrator who opens the suite with something still to set up: a photo, and Google for mail,
 * calendar and files (one consent covers all three). Closing it hides it for 24 hours; it returns until done.
 */
export function SuiteWelcome() {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const justConnected = params.get("welcome") === "connected";
	const [status, setStatus] = useState<WelcomeStatus | null>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		let snoozed = false;
		try { snoozed = Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { /* ignore */ }
		if (snoozed && !justConnected) return;
		let live = true;
		suiteWelcomeStatus().then((s) => {
			if (!live || !s) return;
			setStatus(s);
			const done = s.photo && s.mail && s.calendar && s.drive;
			if (justConnected || !done) setOpen(true);
		}).catch(() => undefined);
		return () => { live = false; };
	}, [justConnected]);

	const done = !!status && status.photo && status.mail && status.calendar && status.drive;
	const close = () => {
		setOpen(false);
		if (!done) snooze();
		if (justConnected) router.replace(pathname);
	};

	if (!open || !status) return null;
	const googleDone = status.mail && status.calendar && status.drive;
	const connectHref = `/api/mjengo/mail/oauth/google/start?choice=done&email=${encodeURIComponent(status.email)}&return=${encodeURIComponent("/dashboard/mjengo?welcome=connected")}`;
	const rows = [
		{ id: "photo", icon: Camera, label: "Profile photo", done: status.photo },
		{ id: "mail", icon: Mail, label: "Mail", done: status.mail },
		{ id: "calendar", icon: CalendarDays, label: "Calendar", done: status.calendar },
		{ id: "drive", icon: HardDrive, label: "Google Drive", done: status.drive },
	];

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Set up your suite">
			<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
				{done ? (
					<div className="text-center">
						<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CircleCheck className="h-8 w-8" /></span>
						<h2 className="mt-4 text-xl font-bold text-sauti-dark">You are all set</h2>
						<p className="mt-1 text-sm text-serene-neutral-600">Photo, mail, calendar and files are ready.</p>
						<button onClick={close} className="mt-6 w-full rounded-full bg-sauti-teal px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">Start</button>
					</div>
				) : (
					<>
						<h2 className="text-xl font-bold text-sauti-dark">Set up your suite</h2>
						<p className="mt-1 text-sm text-serene-neutral-600">A few things before you start.</p>
						<ul className="mt-5 space-y-2">
							{rows.map(({ id, icon: Icon, label, done: ok }) => (
								<li key={id} className="flex items-center gap-3 rounded-xl border border-serene-neutral-200 px-3 py-2.5">
									<span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ok ? "bg-emerald-50 text-emerald-600" : "bg-serene-neutral-100 text-serene-neutral-600"}`}><Icon className="h-4 w-4" /></span>
									<span className="flex-1 text-sm font-medium text-sauti-dark">{label}</span>
									{ok && <Check className="h-4 w-4 text-emerald-600" aria-label="Done" />}
								</li>
							))}
						</ul>
						<div className="mt-6 flex flex-col gap-2">
							{!status.photo && (
								<Link href="/dashboard/profile" className="rounded-full bg-sauti-teal px-4 py-2.5 text-center text-sm font-semibold text-white hover:opacity-90">Add a photo</Link>
							)}
							{!googleDone && (
								<a href={connectHref} className={`rounded-full px-4 py-2.5 text-center text-sm font-semibold ${status.photo ? "bg-sauti-teal text-white hover:opacity-90" : "border border-sauti-teal text-sauti-teal hover:bg-sauti-teal-light/40"}`}>Connect to Google services</a>
							)}
							<button onClick={close} className="rounded-full px-4 py-2 text-sm font-medium text-serene-neutral-500 hover:bg-serene-neutral-50">Later</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
