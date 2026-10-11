"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Rows3, SquareStack, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { OTHER_LABEL, type Answer, type Question } from "@/lib/forms/schema";
import type { PublicForm, SubmitResult } from "@/app/actions/public-forms";

type State = Record<string, Answer | undefined>;
const field = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

/**
 * A form as the public sees it (and as the builder previews it). Two layouts: every question on one page,
 * or one question at a time like Typeform; the respondent can switch. Answers are kept on this device so
 * a half-finished form can be resumed. Signed-in people are identified by their account unless they
 * choose to answer anonymously.
 */
export function FormRenderer({ form, preview = false, onSubmit }: { form: PublicForm; preview?: boolean; onSubmit?: (answers: Record<string, unknown>, extra: { email?: string; website?: string; anonymous?: boolean }) => Promise<SubmitResult> }) {
	const [answers, setAnswers] = useState<State>({});
	const [others, setOthers] = useState<Record<string, string>>({});
	const [email, setEmail] = useState("");
	const [anonymous, setAnonymous] = useState(false);
	const [website, setWebsite] = useState(""); // honeypot
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState<string | null>(null);
	const [topError, setTopError] = useState<string | null>(null);
	const [layout, setLayout] = useState<"page" | "single">(form.layout);
	const [step, setStep] = useState(0);
	const [resumed, setResumed] = useState(false);
	const hydrated = useRef(false);
	const storeKey = `ss_form_${form.slug}`;

	useEffect(() => setLayout(form.layout), [form.layout]);

	// Pick up where the person left off.
	useEffect(() => {
		if (preview) { hydrated.current = true; return; }
		try {
			const raw = localStorage.getItem(storeKey);
			if (raw) {
				const d = JSON.parse(raw) as { answers?: State; others?: Record<string, string>; email?: string; step?: number; anonymous?: boolean; layout?: "page" | "single" };
				if (d.answers && Object.keys(d.answers).length) {
					setAnswers(d.answers);
					setOthers(d.others ?? {});
					setEmail(d.email ?? "");
					setAnonymous(!!d.anonymous);
					if (d.layout) setLayout(d.layout);
					if (typeof d.step === "number") setStep(d.step);
					setResumed(true);
				}
			}
		} catch { /* nothing saved */ }
		hydrated.current = true;
	}, [storeKey, preview]);

	// ...and save as they go.
	useEffect(() => {
		if (!hydrated.current || preview || done) return;
		const t = setTimeout(() => {
			try {
				const empty = !Object.keys(answers).length && !email;
				if (empty) localStorage.removeItem(storeKey);
				else localStorage.setItem(storeKey, JSON.stringify({ answers, others, email, step, anonymous, layout }));
			} catch { /* storage full or blocked */ }
		}, 400);
		return () => clearTimeout(t);
	}, [answers, others, email, step, anonymous, layout, storeKey, preview, done]);

	const set = (id: string, v: Answer) => setAnswers((a) => ({ ...a, [id]: v }));
	const accent = form.accent;
	const style = { "--accent": accent } as React.CSSProperties;
	const identified = !!form.responder && !(anonymous && form.allowAnonymous);

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

	const missing = (q: Question) => {
		const v = resolved()[q.id];
		return q.required && (v == null || v === "" || (Array.isArray(v) && v.length === 0));
	};

	const submit = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (preview || !onSubmit) return;
		const local: Record<string, string> = {};
		for (const q of form.questions) if (missing(q)) local[q.id] = "This question is required.";
		if (form.collectEmail && !identified && !email.trim()) local.__email = "Enter your email address.";
		if (Object.keys(local).length) {
			setErrors(local);
			setTopError("Please answer the required questions.");
			const first = Object.keys(local)[0];
			if (layout === "single" && first !== "__email") setStep(Math.max(0, form.questions.findIndex((q) => q.id === first)));
			else document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
			return;
		}
		setBusy(true);
		setTopError(null);
		try {
			const res = await onSubmit(resolved(), { email, website, anonymous });
			if (res.ok) {
				setDone(res.message);
				try { localStorage.removeItem(storeKey); } catch { /* ignore */ }
			} else {
				setErrors(res.fieldErrors ?? {});
				setTopError(res.error);
			}
		} catch {
			setTopError("Could not send your response. Check your connection and try again.");
		} finally {
			setBusy(false);
		}
	};

	const reset = () => { setAnswers({}); setOthers({}); setErrors({}); setTopError(null); setStep(0); setResumed(false); try { localStorage.removeItem(storeKey); } catch { /* ignore */ } };

	if (done) {
		return (
			<div style={style} className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm" >
				<div className="mx-auto mb-4 h-1.5 w-16 rounded-full" style={{ background: accent }} />
				<CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
				<h2 className="mt-4 text-xl font-bold text-gray-900">{form.title}</h2>
				<p className="mt-2 text-gray-600">{done}</p>
				<button className="mt-6 text-sm font-semibold hover:underline" style={{ color: accent }} onClick={() => { setDone(null); reset(); }}>Submit another response</button>
			</div>
		);
	}

	const total = form.questions.length;
	const q = form.questions[step];
	const identity = (
		<div className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
			{form.responder ? (
				<div className="flex flex-wrap items-center gap-3">
					<span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: accent }}><UserRound className="h-5 w-5" /></span>
					<div className="min-w-0 flex-1">
						{identified ? (
							<>
								<p className="font-medium text-gray-900">Responding as {form.responder.email}</p>
								<p className="text-xs text-gray-500">Your answers will be recorded with this email address.</p>
							</>
						) : (
							<>
								<p className="font-medium text-gray-900">Responding anonymously</p>
								<p className="text-xs text-gray-500">Your email address will not be recorded.</p>
							</>
						)}
					</div>
					{form.allowAnonymous && (
						<button type="button" onClick={() => setAnonymous((v) => !v)} className="text-xs font-semibold hover:underline" style={{ color: accent }}>{identified ? "Answer anonymously" : "Use my email instead"}</button>
					)}
				</div>
			) : (
				<p className="text-gray-600">You are not signed in, so your answers are anonymous{form.collectEmail ? ", apart from the email you enter below" : ""}.</p>
			)}
		</div>
	);

	return (
		<form onSubmit={submit} noValidate className="space-y-3" style={style}>
			<header className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
				<div className="h-2" style={{ background: accent }} />
				{form.images.length > 0 && (
					<div className={cn("grid gap-1", form.images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
						{form.images.slice(0, 4).map((u) => <img key={u} src={u} alt="" className="h-40 w-full object-cover sm:h-52" />)}
					</div>
				)}
				<div className="p-6">
					<h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{form.title}</h1>
					{form.description && <p className="mt-2 whitespace-pre-line text-gray-600">{form.description}</p>}
					<div className="mt-4 flex flex-wrap items-center justify-between gap-2">
						<p className="text-xs text-red-600">* Required</p>
						<button
							type="button"
							onClick={() => { setLayout((l) => (l === "page" ? "single" : "page")); setStep(0); }}
							className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
							aria-label={layout === "page" ? "Show one question at a time" : "Show all questions on one page"}
						>
							{layout === "page" ? <SquareStack className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
							{layout === "page" ? "One at a time" : "Whole page"}
						</button>
					</div>
				</div>
			</header>

			{resumed && !preview && (
				<p className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 text-sm text-gray-700 shadow-sm">
					<span>Welcome back. Your earlier answers are still here.</span>
					<button type="button" onClick={reset} className="shrink-0 text-xs font-semibold hover:underline" style={{ color: accent }}>Start again</button>
				</p>
			)}

			{identity}

			{form.collectEmail && !identified && (
				<Card id="q-__email" error={errors.__email}>
					<Label required>Your email</Label>
					<input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="you@example.org" />
				</Card>
			)}

			{layout === "page" ? (
				form.questions.map((qq) => (
					<Card key={qq.id} id={`q-${qq.id}`} error={errors[qq.id]}>
						<Label required={qq.required}>{qq.label || "Untitled question"}</Label>
						{qq.help && <p className="-mt-1 mb-3 text-sm text-gray-500">{qq.help}</p>}
						<Control q={qq} value={answers[qq.id]} other={others[qq.id] ?? ""} onChange={(v) => set(qq.id, v)} onOther={(t) => setOthers((o) => ({ ...o, [qq.id]: t }))} />
					</Card>
				))
			) : q ? (
				<div className="space-y-3">
					<div className="h-1.5 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + 1}>
						<div className="h-full rounded-full transition-all" style={{ width: `${((step + 1) / total) * 100}%`, background: accent }} />
					</div>
					<div className="flex min-h-[40vh] flex-col justify-center">
						<Card key={q.id} id={`q-${q.id}`} error={errors[q.id]} large>
							<p className="text-xs font-semibold text-gray-500">{step + 1} of {total}</p>
							<Label required={q.required} large>{q.label || "Untitled question"}</Label>
							{q.help && <p className="-mt-1 mb-3 text-sm text-gray-500">{q.help}</p>}
							<Control q={q} value={answers[q.id]} other={others[q.id] ?? ""} onChange={(v) => set(q.id, v)} onOther={(t) => setOthers((o) => ({ ...o, [q.id]: t }))} />
						</Card>
					</div>
				</div>
			) : null}

			<div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
				<label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
			</div>

			{topError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{topError}</p>}

			{layout === "page" || step >= total - 1 ? (
				<div className="flex items-center justify-between gap-2 pt-1">
					<div className="flex items-center gap-2">
						{layout === "single" && step > 0 && <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700"><ArrowLeft className="h-4 w-4" /> Back</button>}
						<button type="submit" disabled={busy || preview} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-6 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: accent }}>
							{busy && <Loader2 className="h-4 w-4 animate-spin" />} {preview ? "Submit (preview)" : busy ? "Sending..." : "Submit"}
						</button>
					</div>
					<button type="button" onClick={reset} className="text-sm font-medium hover:underline" style={{ color: accent }}>Clear form</button>
				</div>
			) : (
				<div className="flex items-center justify-between pt-1">
					<button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Back</button>
					<button
						type="button"
						onClick={() => {
							if (q && missing(q)) { setErrors({ [q.id]: "This question is required." }); return; }
							setErrors({});
							setStep((s) => Math.min(total - 1, s + 1));
						}}
						className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-5 font-semibold text-white hover:opacity-90"
						style={{ background: accent }}
					>Next <ArrowRight className="h-4 w-4" /></button>
				</div>
			)}
		</form>
	);
}

function Card({ id, error, large, children }: { id?: string; error?: string; large?: boolean; children: React.ReactNode }) {
	return (
		<section id={id} className={cn("space-y-3 rounded-2xl border bg-white shadow-sm", large ? "p-6 sm:p-8" : "p-5", error ? "border-red-300" : "border-gray-200")}>
			{children}
			{error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
		</section>
	);
}

function Label({ children, required, large }: { children: React.ReactNode; required?: boolean; large?: boolean }) {
	return <h2 className={cn("font-medium text-gray-900", large ? "text-xl sm:text-2xl" : "text-base")}>{children}{required && <span className="ml-1 text-red-600">*</span>}</h2>;
}

function Control({ q, value, other, onChange, onOther }: { q: Question; value: Answer | undefined; other: string; onChange: (v: Answer) => void; onOther: (t: string) => void }) {
	const options = [...(q.options ?? []), ...(q.allowOther ? [OTHER_LABEL] : [])];
	const otherInput = (
		<input value={other} onChange={(e) => onOther(e.target.value)} placeholder={q.type === "checkbox" ? "What is it? Separate several with commas" : "What is it?"} className={cn(field, "mt-2")} autoComplete="off" />
	);
	const accent = "accent-[var(--accent)]";

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
							<input type="radio" name={q.id} checked={value === o} onChange={() => onChange(o)} className={cn("h-4 w-4", accent)} />
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
							<input type="checkbox" checked={list.includes(o)} onChange={() => onChange(list.includes(o) ? list.filter((x) => x !== o) : [...list, o])} className={cn("h-4 w-4", accent)} />
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
								<input type="radio" name={q.id} checked={value === n} onChange={() => onChange(n)} className={cn("h-5 w-5", accent)} />
							</label>
						))}
						{maxLabel && <span className="ml-1 text-xs text-gray-500">{maxLabel}</span>}
					</div>
				</div>
			);
		}
	}
}


