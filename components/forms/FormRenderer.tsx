"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OTHER_LABEL, type Answer, type Question } from "@/lib/forms/schema";
import type { PublicForm, SubmitResult } from "@/app/actions/public-forms";

type State = Record<string, Answer | undefined>;
const field = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20";

/**
 * A form as the public sees it (and as the builder previews it). Calm Google-Forms-like layout: one card
 * per question, a purple edge, required marks and inline errors.
 */
export function FormRenderer({ form, preview = false, onSubmit }: { form: PublicForm; preview?: boolean; onSubmit?: (answers: Record<string, unknown>, extra: { email?: string; website?: string }) => Promise<SubmitResult> }) {
	const [answers, setAnswers] = useState<State>({});
	const [others, setOthers] = useState<Record<string, string>>({});
	const [email, setEmail] = useState("");
	const [website, setWebsite] = useState(""); // honeypot
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState<string | null>(null);
	const [topError, setTopError] = useState<string | null>(null);

	const set = (id: string, v: Answer) => setAnswers((a) => ({ ...a, [id]: v }));

	/** What is actually sent: a pick from the list, or what they typed under Other. */
	const resolved = (): Record<string, unknown> => {
		const out: Record<string, unknown> = {};
		for (const q of form.questions) {
			const v = answers[q.id];
			const other = others[q.id]?.trim();
			if (q.type === "choice" || q.type === "dropdown") out[q.id] = v === OTHER_LABEL ? other || "" : v;
			else if (q.type === "checkbox") {
				const list = (Array.isArray(v) ? v : []).filter((x) => x !== OTHER_LABEL);
				const typed = Array.isArray(v) && v.includes(OTHER_LABEL) && other ? other.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [];
				out[q.id] = [...list, ...typed];
			} else out[q.id] = v;
		}
		return out;
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (preview || !onSubmit) return;
		// Client-side required check first, for a fast response.
		const local: Record<string, string> = {};
		const r = resolved();
		for (const q of form.questions) {
			const v = r[q.id];
			if (q.required && (v == null || v === "" || (Array.isArray(v) && v.length === 0))) local[q.id] = "This question is required.";
		}
		if (form.collectEmail && !email.trim()) local.__email = "Enter your email address.";
		if (Object.keys(local).length) {
			setErrors(local);
			setTopError("Please answer the required questions.");
			document.getElementById(`q-${Object.keys(local)[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
			return;
		}
		setBusy(true);
		setTopError(null);
		try {
			const res = await onSubmit(r, { email, website });
			if (res.ok) setDone(res.message);
			else {
				setErrors(res.fieldErrors ?? {});
				setTopError(res.error);
			}
		} catch {
			setTopError("Could not send your response. Check your connection and try again.");
		} finally {
			setBusy(false);
		}
	};

	if (done) {
		return (
			<div className="rounded-2xl border border-gray-200 border-t-8 border-t-purple-600 bg-white p-8 text-center shadow-sm">
				<CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
				<h2 className="mt-4 text-xl font-bold text-gray-900">{form.title}</h2>
				<p className="mt-2 text-gray-600">{done}</p>
				<button className="mt-6 text-sm font-semibold text-purple-700 hover:underline" onClick={() => { setDone(null); setAnswers({}); setOthers({}); }}>Submit another response</button>
			</div>
		);
	}

	return (
		<form onSubmit={submit} noValidate className="space-y-3">
			<header className="rounded-2xl border border-gray-200 border-t-8 border-t-purple-600 bg-white p-6 shadow-sm">
				<h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{form.title}</h1>
				{form.description && <p className="mt-2 whitespace-pre-line text-gray-600">{form.description}</p>}
				<p className="mt-4 text-xs text-red-600">* Required</p>
			</header>

			{form.collectEmail && (
				<Card id="q-__email" error={errors.__email}>
					<Label required>Your email</Label>
					<input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="you@example.com" />
				</Card>
			)}

			{form.questions.map((q) => (
				<Card key={q.id} id={`q-${q.id}`} error={errors[q.id]}>
					<Label required={q.required}>{q.label || "Untitled question"}</Label>
					{q.help && <p className="-mt-1 mb-3 text-sm text-gray-500">{q.help}</p>}
					<Control q={q} value={answers[q.id]} other={others[q.id] ?? ""} onChange={(v) => set(q.id, v)} onOther={(t) => setOthers((o) => ({ ...o, [q.id]: t }))} />
				</Card>
			))}

			{/* Honeypot: hidden from people, tempting to bots. */}
			<div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
				<label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
			</div>

			{topError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{topError}</p>}
			<div className="flex items-center justify-between pt-1">
				<button type="submit" disabled={busy || preview} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60">
					{busy && <Loader2 className="h-4 w-4 animate-spin" />} {preview ? "Submit (preview)" : busy ? "Sending..." : "Submit"}
				</button>
				<button type="button" onClick={() => { setAnswers({}); setOthers({}); setErrors({}); setTopError(null); }} className="text-sm font-medium text-purple-700 hover:underline">Clear form</button>
			</div>
		</form>
	);
}

function Card({ id, error, children }: { id?: string; error?: string; children: React.ReactNode }) {
	return (
		<section id={id} className={cn("space-y-3 rounded-2xl border bg-white p-5 shadow-sm", error ? "border-red-300" : "border-gray-200")}>
			{children}
			{error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
		</section>
	);
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
	return <h2 className="text-base font-medium text-gray-900">{children}{required && <span className="ml-1 text-red-600">*</span>}</h2>;
}

function Control({ q, value, other, onChange, onOther }: { q: Question; value: Answer | undefined; other: string; onChange: (v: Answer) => void; onOther: (t: string) => void }) {
	const options = [...(q.options ?? []), ...(q.allowOther ? [OTHER_LABEL] : [])];
	const otherInput = (
		<input value={other} onChange={(e) => onOther(e.target.value)} placeholder={q.type === "checkbox" ? "What is it? Separate several with commas" : "What is it?"} className={cn(field, "mt-2")} autoComplete="off" />
	);

	switch (q.type) {
		case "short":
			return <input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} maxLength={500} className={field} placeholder="Your answer" />;
		case "email":
			return <input type="email" inputMode="email" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={field} placeholder="Your email" />;
		case "number":
			return <input type="number" inputMode="decimal" value={(value as string | number) ?? ""} onChange={(e) => onChange(e.target.value)} className={field} placeholder="Your answer" />;
		case "date":
			return <input type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={cn(field, "sm:w-60")} />;
		case "paragraph":
			return <textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} maxLength={5000} className={field} placeholder="Your answer" />;
		case "dropdown":
			return (
				<>
					<select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={cn(field, "sm:w-72")}>
						<option value="">Choose</option>
						{options.map((o) => <option key={o} value={o}>{o}</option>)}
					</select>
					{value === OTHER_LABEL && otherInput}
				</>
			);
		case "choice":
			return (
				<div role="radiogroup" className="space-y-1">
					{options.map((o) => (
						<label key={o} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-gray-50">
							<input type="radio" name={q.id} checked={value === o} onChange={() => onChange(o)} className="h-4 w-4 accent-purple-600" />
							<span className="text-gray-800">{o}</span>
						</label>
					))}
					{value === OTHER_LABEL && otherInput}
				</div>
			);
		case "checkbox": {
			const list = Array.isArray(value) ? value : [];
			return (
				<div className="space-y-1">
					{options.map((o) => (
						<label key={o} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-gray-50">
							<input type="checkbox" checked={list.includes(o)} onChange={() => onChange(list.includes(o) ? list.filter((x) => x !== o) : [...list, o])} className="h-4 w-4 accent-purple-600" />
							<span className="text-gray-800">{o}</span>
						</label>
					))}
					{list.includes(OTHER_LABEL) && otherInput}
				</div>
			);
		}
		case "scale": {
			const { min = 1, max = 5, minLabel, maxLabel } = q.scale ?? {};
			const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
			return (
				<div>
					<div className="flex flex-wrap items-end gap-1 sm:gap-3">
						{minLabel && <span className="mr-1 text-xs text-gray-500">{minLabel}</span>}
						{steps.map((n) => (
							<label key={n} className="flex cursor-pointer flex-col items-center gap-1">
								<span className="text-xs text-gray-600">{n}</span>
								<input type="radio" name={q.id} checked={value === n} onChange={() => onChange(n)} className="h-5 w-5 accent-purple-600" />
							</label>
						))}
						{maxLabel && <span className="ml-1 text-xs text-gray-500">{maxLabel}</span>}
					</div>
				</div>
			);
		}
	}
}
