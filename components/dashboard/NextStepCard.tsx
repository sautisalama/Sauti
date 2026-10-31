import Link from "next/link";
import { ArrowRight, CheckCircle2, HeartHandshake, Hourglass, MessageCircle, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

type MatchLike = { match_status_type?: string | null };
type ReportLike = { report_id: string; matched_services?: MatchLike[] | null };

/**
 * One calm answer to "what do I do now?" for a survivor, chosen from where their
 * reports actually are. It only asks for action when action is really needed.
 */
export function NextStepCard({ reports }: { reports: ReportLike[] }) {
	const withStatus = (status: string) =>
		reports.find((r) => r.matched_services?.some((m) => m.match_status_type === status));

	const needsYou = withStatus("pending_survivor");
	const wrapUp = withStatus("completion_pending");
	const connected = withStatus("accepted");

	let step: { icon: React.ReactNode; title: string; body: string; href?: string; cta?: string; tone: "action" | "calm" };

	if (needsYou) {
		step = {
			icon: <PenLine className="h-5 w-5" />,
			title: "A provider is waiting on you",
			body: "They suggested a time or step. Take a look when you feel ready. There is no rush.",
			href: `/dashboard/reports/${needsYou.report_id}`,
			cta: "Review",
			tone: "action",
		};
	} else if (wrapUp) {
		step = {
			icon: <CheckCircle2 className="h-5 w-5" />,
			title: "Is your support finished?",
			body: "Your provider marked this case as complete. Confirm it and, if you like, tell us how it went.",
			href: `/dashboard/reports/${wrapUp.report_id}`,
			cta: "Confirm",
			tone: "action",
		};
	} else if (connected) {
		step = {
			icon: <MessageCircle className="h-5 w-5" />,
			title: "You're connected with support",
			body: "Your provider can see only what you chose to share. Message them whenever you want.",
			href: "/dashboard/chat",
			cta: "Open messages",
			tone: "calm",
		};
	} else if (reports.length > 0) {
		step = {
			icon: <Hourglass className="h-5 w-5" />,
			title: "We're finding the right support",
			body: "Your report is with our matching system. You don't need to do anything. We'll notify you the moment a provider responds.",
			tone: "calm",
		};
	} else {
		step = {
			icon: <HeartHandshake className="h-5 w-5" />,
			title: "Whenever you're ready",
			body: "You can tell us what happened in your own words, or just record a voice note. You choose what to share.",
			href: "/report-abuse",
			cta: "Start a report",
			tone: "calm",
		};
	}

	return (
		<section
			aria-label="Your next step"
			className={cn(
				"flex items-start gap-4 rounded-2xl border p-4 sm:p-5",
				step.tone === "action" ? "border-amber-200 bg-amber-50" : "border-teal-100 bg-teal-50/60"
			)}
		>
			<div
				className={cn(
					"mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
					step.tone === "action" ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"
				)}
			>
				{step.icon}
			</div>
			<div className="min-w-0 flex-1">
				<h2 className="text-base font-semibold text-neutral-900">{step.title}</h2>
				<p className="mt-1 text-sm leading-relaxed text-neutral-700">{step.body}</p>
				{step.href && (
					<Link
						href={step.href}
						className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
					>
						{step.cta} <ArrowRight className="h-4 w-4" aria-hidden />
					</Link>
				)}
			</div>
		</section>
	);
}
