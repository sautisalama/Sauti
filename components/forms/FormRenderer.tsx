"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Loader2, Rows3, SquareStack, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { OTHER_LABEL, layoutFor, mediaFor, videoEmbed, type Answer, type Device, type FormTheme, type Media, type Question } from "@/lib/forms/schema";
import type { PublicForm, SubmitResult } from "@/app/actions/public-forms";

type State = Record<string, Answer | undefined>;
type Screen = { kind: "welcome" } | { kind: "email" } | { kind: "q"; q: Question };

const cardField = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export const FONT_STACK: Record<NonNullable<FormTheme["font"]>, string> = {
	sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
	rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Quicksand", system-ui, sans-serif',
	mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

const isDark = (hex: string) => {
	const m = /^#([0-9a-f]{6})$/i.exec(hex);
	if (!m) return false;
	const n = parseInt(m[1], 16);
	const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};
const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

function useDevice(force?: Device): Device {
	const mobile = useSyncExternalStore(
		(cb) => { const m = window.matchMedia("(max-width: 767px)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
		() => window.matchMedia("(max-width: 767px)").matches,
		() => false,
	);
	return force ?? (mobile ? "mobile" : "desktop");
}

/**
 * A form as the public sees it (and as the builder previews it). Two layouts: every question on one page,
 * or one question at a time, full page, like Typeform; the respondent can switch and nothing they typed is lost.
 * Each question can carry a picture or video and lays it out differently on a phone and on a desktop.
 * Answers are kept on this device so a half-finished form can be resumed. Signed-in people are identified
 * by their account unless they choose to answer anonymously.
 */
export function FormRenderer({
	form, preview = false, device: forceDevice, embedded = false, focusId, layoutOverride, onSubmit,
}: {
	form: PublicForm;
	preview?: boolean;
	/** Force a device (the builder's phone and desktop mock-ups). Otherwise the window decides. */
	device?: Device;
	/** Fill the parent instead of the window. */
	embedded?: boolean;
	/** Jump to this question (or "welcome") when it changes: the builder follows what is being edited. */
	focusId?: string | null;
	layoutOverride?: "page" | "single";
	onSubmit?: (answers: Record<string, unknown>, extra: { email?: string; website?: string; anonymous?: boolean }) => Promise<SubmitResult>;
}) {
	const device = useDevice(forceDevice);
	const mobile = device === "mobile";
	const [answers, setAnswers] = useState<State>({});
	const [others, setOthers] = useState<Record<string, string>>({});
	const [email, setEmail] = useState("");
	const [anonymous, setAnonymous] = useState(false);
	const [website, setWebsite] = useState(""); // honeypot
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState<string | null>(null);
	const [topError, setTopError] = useState<string | null>(null);
	const [layout, setLayout] = useState<"page" | "single">(layoutOverride ?? form.layout);
	const [step, setStep] = useState(0);
	const [dir, setDir] = useState<1 | -1>(1);
	const [resumed, setResumed] = useState(false);
	const hydrated = useRef(false);
	const storeKey = `ss_form_${form.slug}`;

	useEffect(() => setLayout(layoutOverride ?? form.layout), [form.layout, layoutOverride]);

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
					if (d.layout && !layoutOverride) setLayout(d.layout);
					if (typeof d.step === "number") setStep(d.step);
					setResumed(true);
				}
			}
		} catch { /* nothing saved */ }
		hydrated.current = true;
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
	const identified = !!form.responder && !(anonymous && form.allowAnonymous);
	const needEmail = form.collectEmail && !identified;

	const screens = useMemo<Screen[]>(() => [
		...(form.welcome ? [{ kind: "welcome" } as Screen] : []),
		...(needEmail ? [{ kind: "email" } as Screen] : []),
		...form.questions.map((q) => ({ kind: "q", q }) as Screen),
	], [form.welcome, needEmail, form.questions]);

	// The builder follows the question being edited.
	useEffect(() => {
		if (!focusId) return;
		const i = focusId === "welcome" ? screens.findIndex((s) => s.kind === "welcome") : screens.findIndex((s) => s.kind === "q" && s.q.id === focusId);
		if (i >= 0) setStep(i);
	}, [focusId, screens]);
	useEffect(() => { if (step > screens.length - 1) setStep(Math.max(0, screens.length - 1)); }, [screens.length, step]);

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
		if (needEmail && !email.trim()) local.__email = "Enter your email address.";
		if (Object.keys(local).length) {
			setErrors(local);
			setTopError("Please answer the required questions.");
			const first = Object.keys(local)[0];
			if (layout === "single") {
				const i = screens.findIndex((s) => (first === "__email" ? s.kind === "email" : s.kind === "q" && s.q.id === first));
				if (i >= 0) { setDir(-1); setStep(i); }
			} else document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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

	// ---- Look
	const t = form.theme ?? {};
	const bg = t.background ?? { kind: "color" as const, value: form.background };
	const darkBg = bg.kind === "image" ? (bg.overlay ?? 0) >= 25 : isDark(bg.value);
	const qColor = t.questionColor ?? (darkBg ? "#ffffff" : "#111827");
	const aColor = t.answerColor ?? (darkBg ? "#ffffff" : form.accent);
	const btnColor = t.buttonColor ?? form.accent;
	const btnText = t.buttonText ?? (isDark(btnColor) ? "#ffffff" : "#111827");
	const radius = t.radius === "none" ? 0 : t.radius === "full" ? 9999 : 12;
	const radiusBtn = t.radius === "none" ? 0 : t.radius === "full" ? 9999 : 10;
	const font = FONT_STACK[t.font ?? "sans"];
	const vars = { "--accent": btnColor, "--q": qColor, "--a": aColor, "--btn": btnColor, "--btn-text": btnText, "--r": `${radius}px`, "--rb": `${radiusBtn}px`, fontFamily: font } as React.CSSProperties;
	const background: React.CSSProperties = bg.kind === "image" ? { backgroundImage: `url("${bg.value}")`, backgroundSize: "cover", backgroundPosition: "center" } : { background: bg.value };
	const overlay = bg.kind === "image" && (bg.overlay ?? 0) > 0 ? <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `rgba(0,0,0,${(bg.overlay ?? 0) / 100})` }} /> : null;
	const logoEl = t.logo ? (
		<div className={cn("flex w-full shrink-0", t.logo.align === "center" ? "justify-center" : t.logo.align === "right" ? "justify-end" : "justify-start")}>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={t.logo.url} alt={t.logo.alt ?? ""} className={cn("w-auto object-contain", t.logo.size === "sm" ? "h-7" : t.logo.size === "lg" ? "h-16" : "h-11")} />
		</div>
	) : null;

	const total = form.questions.length;

	if (done) {
		return (
			<div style={{ ...vars, ...background, color: qColor }} className={cn("relative flex items-center justify-center p-6", embedded ? "h-full" : "min-h-[100dvh]")}>
				{overlay}
				<div className="relative max-w-md text-center">
					<CheckCircle2 className="mx-auto h-14 w-14" style={{ color: aColor }} />
					<h2 className="mt-4 text-2xl font-bold">{form.title}</h2>
					<p className="mt-2 opacity-80">{done}</p>
					<button className="mt-6 text-sm font-semibold underline underline-offset-4" onClick={() => { setDone(null); reset(); }}>Submit another response</button>
				</div>
			</div>
		);
	}

	const identity = (
		<div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-900 shadow-sm">
			{form.responder ? (
				<div className="flex flex-wrap items-center gap-3">
					<span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: btnColor }}><UserRound className="h-5 w-5" /></span>
					<div className="min-w-0 flex-1">
						{identified ? (
							<>
								<p className="font-medium">Responding as {form.responder.email}</p>
								<p className="text-xs text-gray-500">Your answers will be recorded with this email address.</p>
							</>
						) : (
							<>
								<p className="font-medium">Responding anonymously</p>
								<p className="text-xs text-gray-500">Your email address will not be recorded.</p>
							</>
						)}
					</div>
					{form.allowAnonymous && (
						<button type="button" onClick={() => setAnonymous((v) => !v)} className="text-xs font-semibold hover:underline" style={{ color: btnColor }}>{identified ? "Answer anonymously" : "Use my email instead"}</button>
					)}
				</div>
			) : (
				<p className="text-gray-600">You are not signed in, so your answers are anonymous{form.collectEmail ? ", apart from the email you enter below" : ""}.</p>
			)}
		</div>
	);

	const toggle = (
		<button
			type="button"
			onClick={() => { setLayout((l) => (l === "page" ? "single" : "page")); setStep(0); }}
			className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
			style={{ borderColor: mix(qColor, 35), color: qColor, background: mix(qColor, 8) }}
			aria-label={layout === "page" ? "Show one question at a time" : "Show all questions on one page"}
		>
			{layout === "page" ? <SquareStack className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
			{layout === "page" ? "One at a time" : "Whole page"}
		</button>
	);

	/* ---------------------------------------------------------------- Whole page */
	if (layout === "page") {
		const welcomeMedia = form.welcome ? mediaFor(form.welcome, device) : null;
		return (
			<form onSubmit={submit} noValidate style={{ ...vars, ...background, color: qColor }} className={cn("relative overflow-y-auto", embedded ? "h-full" : "min-h-[100dvh]")}>
				{overlay}
				<div className={cn("relative mx-auto w-full max-w-2xl space-y-3", mobile ? "px-3 py-5" : "px-4 py-10")}>
					{logoEl}
					<header className="overflow-hidden border border-gray-200 bg-white text-gray-900 shadow-sm" style={{ borderRadius: "var(--r)" }}>
						<div className="h-2" style={{ background: btnColor }} />
						{form.images.length > 0 && (
							<div className={cn("grid gap-1", form.images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								{form.images.slice(0, 4).map((u) => <img key={u} src={u} alt="" className="h-40 w-full object-cover sm:h-52" />)}
							</div>
						)}
						{welcomeMedia && <MediaBlock media={welcomeMedia} className="max-h-72 w-full" />}
						<div className={cn(mobile ? "p-4" : "p-6")}>
							<h1 className={cn("font-bold", mobile ? "text-2xl" : "text-3xl")}>{form.welcome?.title || form.title}</h1>
							{(form.welcome?.description || form.description) && <p className="mt-2 whitespace-pre-line text-gray-600">{form.welcome?.description || form.description}</p>}
							<div className="mt-4 flex flex-wrap items-center justify-between gap-2">
								<p className="text-xs text-red-600">* Required</p>
								{toggle}
							</div>
						</div>
					</header>

					{resumed && !preview && (
						<p className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 text-sm text-gray-700 shadow-sm">
							<span>Welcome back. Your earlier answers are still here.</span>
							<button type="button" onClick={reset} className="shrink-0 text-xs font-semibold hover:underline" style={{ color: btnColor }}>Start again</button>
						</p>
					)}

					{identity}

					{needEmail && (
						<Card id="q-__email" error={errors.__email}>
							<Label required>Your email</Label>
							<input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cardField} style={{ borderRadius: "var(--rb)" }} placeholder="you@example.org" />
						</Card>
					)}

					{form.questions.map((qq) => {
						const m = mediaFor(qq, device);
						return (
							<Card key={qq.id} id={`q-${qq.id}`} error={errors[qq.id]}>
								{m && <MediaBlock media={m} className="mb-1 max-h-64 w-full rounded-lg" />}
								<Label required={qq.required}>{qq.label || "Untitled question"}</Label>
								{qq.help && <p className="-mt-1 mb-3 text-sm text-gray-500">{qq.help}</p>}
								<Control q={qq} look="card" value={answers[qq.id]} other={others[qq.id] ?? ""} onChange={(v) => set(qq.id, v)} onOther={(x) => setOthers((o) => ({ ...o, [qq.id]: x }))} />
							</Card>
						);
					})}

					<Honeypot website={website} setWebsite={setWebsite} />
					{topError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{topError}</p>}

					<div className="flex items-center justify-between gap-2 pt-1">
						<button type="submit" disabled={busy || preview} className="inline-flex min-h-11 items-center gap-2 px-6 py-2.5 font-semibold transition hover:opacity-90 disabled:opacity-60" style={{ background: btnColor, color: btnText, borderRadius: "var(--rb)" }}>
							{busy && <Loader2 className="h-4 w-4 animate-spin" />} {preview ? "Submit (preview)" : busy ? "Sending..." : "Submit"}
						</button>
						<button type="button" onClick={reset} className="text-sm font-medium underline underline-offset-4 opacity-80 hover:opacity-100">Clear form</button>
					</div>
					<p className="pt-6 text-center text-xs opacity-60">Sauti Salama · Please do not share passwords or card numbers in forms.</p>
				</div>
			</form>
		);
	}

	/* ------------------------------------------------------------ Full page, one at a time */
	const cur = screens[Math.min(step, screens.length - 1)];
	const last = step >= screens.length - 1;
	const goto = (i: number) => { setDir(i > step ? 1 : -1); setStep(Math.max(0, Math.min(screens.length - 1, i))); setTopError(null); };
	const advance = () => {
		if (!cur) return;
		if (cur.kind === "q" && missing(cur.q)) { setErrors({ [cur.q.id]: "This question is required." }); return; }
		if (cur.kind === "email") {
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErrors({ __email: "Enter a valid email address." }); return; }
		}
		setErrors({});
		if (last) void submit(); else goto(step + 1);
	};

	const media = cur ? (cur.kind === "welcome" ? (form.welcome ? { m: mediaFor(form.welcome, device), l: layoutFor(form.welcome, device) } : null) : cur.kind === "q" ? { m: mediaFor(cur.q, device), l: layoutFor(cur.q, device) } : null) : null;
	const hasMedia = !!media?.m;
	const lay = hasMedia ? media!.l : "stack";
	const split = !mobile && (lay === "split-left" || lay === "split-right");
	const wallpaper = lay === "wallpaper";

	const body = cur ? (
		<div key={`${cur.kind}-${cur.kind === "q" ? cur.q.id : ""}`} className={cn("animate-in fade-in duration-300", dir === 1 ? "slide-in-from-bottom-4" : "slide-in-from-top-4", "w-full")}>
			{cur.kind === "welcome" && form.welcome && (
				<div className="space-y-5">
					<h1 className={cn("font-semibold leading-tight", mobile ? "text-3xl" : "text-5xl")} style={{ color: wallpaper ? "#fff" : qColor }}>{form.welcome.title || form.title}</h1>
					{(form.welcome.description || form.description) && <p className={cn("whitespace-pre-line", mobile ? "text-base" : "text-xl")} style={{ color: wallpaper ? "rgba(255,255,255,.85)" : mix(qColor, 80) }}>{form.welcome.description || form.description}</p>}
					<div className="flex flex-wrap items-center gap-3 pt-2">
						<PrimaryButton onClick={() => goto(step + 1)}>{form.welcome.button || "Start"}</PrimaryButton>
						{!mobile && <span className="text-xs opacity-70">press <b>Enter</b> ↵</span>}
					</div>
					<div className="pt-2">{identity}</div>
				</div>
			)}
			{cur.kind === "email" && (
				<div className="space-y-4">
					<p className="text-sm font-semibold opacity-70">{step + 1} → </p>
					<h2 className={cn("font-medium leading-snug", mobile ? "text-2xl" : "text-3xl")}>Your email address<span className="ml-1 text-red-500">*</span></h2>
					<input autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="w-full border-0 border-b-2 bg-transparent py-2 text-2xl outline-none placeholder:opacity-40" style={{ color: aColor, borderColor: mix(aColor, 50) }} />
					{errors.__email && <p role="alert" className="text-sm font-medium text-red-500">{errors.__email}</p>}
				</div>
			)}
			{cur.kind === "q" && (
				<div className="space-y-4">
					<p className="flex items-center gap-1 text-sm font-semibold" style={{ color: wallpaper ? "rgba(255,255,255,.8)" : mix(qColor, 70) }}>{step + 1 - (form.welcome ? 1 : 0) - (needEmail ? 1 : 0)} <ArrowRight className="h-3.5 w-3.5" /></p>
					<h2 className={cn("font-medium leading-snug", mobile ? "text-2xl" : "text-3xl")} style={{ color: wallpaper ? "#fff" : qColor }}>{cur.q.label || "Untitled question"}{cur.q.required && <span className="ml-1 text-red-500">*</span>}</h2>
					{cur.q.help && <p className={cn(mobile ? "text-sm" : "text-lg")} style={{ color: wallpaper ? "rgba(255,255,255,.8)" : mix(qColor, 70) }}>{cur.q.help}</p>}
					<Control q={cur.q} look="full" value={answers[cur.q.id]} other={others[cur.q.id] ?? ""} onChange={(v) => set(cur.q.id, v)} onOther={(x) => setOthers((o) => ({ ...o, [cur.q.id]: x }))} onPicked={() => { if (cur.q.type === "choice" && !last) setTimeout(() => goto(step + 1), 380); }} onEnter={advance} />
					{errors[cur.q.id] && <p role="alert" className="text-sm font-medium text-red-500">{errors[cur.q.id]}</p>}
					{topError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{topError}</p>}
					<div className="flex flex-wrap items-center gap-3 pt-1">
						<PrimaryButton onClick={advance} disabled={busy}>
							{busy && <Loader2 className="h-4 w-4 animate-spin" />}
							{last ? (preview ? "Submit (preview)" : busy ? "Sending..." : "Submit") : "OK"}
							{!last && <Check className="h-4 w-4" />}
						</PrimaryButton>
						{!mobile && <span className="text-xs opacity-70">press <b>Enter</b> ↵</span>}
					</div>
				</div>
			)}
		</div>
	) : null;

	const mediaPane = hasMedia ? <MediaBlock media={media!.m!} className={cn("h-full w-full", split && "object-cover")} fill={split || wallpaper} /> : null;
	const progress = screens.length > 1 ? ((step + 1) / screens.length) * 100 : 100;

	return (
		<form
			onSubmit={(e) => { e.preventDefault(); advance(); }}
			noValidate
			style={{ ...vars, ...(wallpaper && media?.m?.kind === "image" ? { backgroundImage: `url("${media.m.url}")`, backgroundSize: "cover", backgroundPosition: "center" } : background), color: wallpaper ? "#fff" : qColor }}
			className={cn("relative flex flex-col overflow-hidden", embedded ? "h-full" : "h-[100dvh]")}
		>
			{overlay}
			{wallpaper && <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/55" />}
			<div className="relative h-1.5 w-full shrink-0" style={{ background: mix(qColor, 15) }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
				<div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: btnColor }} />
			</div>

			<div className={cn("relative flex min-h-0 flex-1", split ? (lay === "split-left" ? "flex-row" : "flex-row-reverse") : "flex-col")}>
				{split && <div className="relative w-1/2 shrink-0 overflow-hidden">{mediaPane}</div>}
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					{logoEl && <div className={cn(mobile ? "px-4 pt-4" : "px-8 pt-6")}>{logoEl}</div>}
					<div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", mobile ? "px-5 py-5" : "px-10 py-8")}>
						<div className="m-auto w-full max-w-xl">
							{!split && !wallpaper && hasMedia && <div className={cn("mb-6 overflow-hidden", mobile ? "max-h-48" : "max-h-64")} style={{ borderRadius: "var(--r)" }}>{mediaPane}</div>}
							{body}
							<Honeypot website={website} setWebsite={setWebsite} />
						</div>
					</div>
				</div>
			</div>

			<footer className="relative flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
				<div className="flex items-center gap-2">
					{toggle}
					{resumed && !preview && <button type="button" onClick={reset} className="underline underline-offset-4 opacity-80">Start again</button>}
				</div>
				<div className="flex items-center gap-2">
					{!mobile && <span className="opacity-60">{Math.min(step + 1, screens.length)} of {screens.length}</span>}
					<button type="button" disabled={step === 0} onClick={() => goto(step - 1)} aria-label="Previous question" className="flex h-9 w-9 items-center justify-center disabled:opacity-30" style={{ background: btnColor, color: btnText, borderRadius: "var(--rb)" }}><ChevronUp className="h-4 w-4" /></button>
					<button type="button" disabled={last || (cur?.kind === "q" && missing(cur.q))} onClick={() => goto(step + 1)} aria-label="Next question" className="flex h-9 w-9 items-center justify-center disabled:opacity-30" style={{ background: btnColor, color: btnText, borderRadius: "var(--rb)" }}><ChevronDown className="h-4 w-4" /></button>
				</div>
			</footer>
			{total === 0 && <p className="absolute inset-x-0 top-1/2 text-center text-sm opacity-70">Add a question to see it here.</p>}
		</form>
	);
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
	return (
		<button type="button" onClick={onClick} disabled={disabled} className="inline-flex min-h-11 items-center gap-2 px-5 text-base font-semibold shadow-sm transition hover:opacity-90 disabled:opacity-60" style={{ background: "var(--btn)", color: "var(--btn-text)", borderRadius: "var(--rb)" }}>{children}</button>
	);
}

function Honeypot({ website, setWebsite }: { website: string; setWebsite: (v: string) => void }) {
	return (
		<div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
			<label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
		</div>
	);
}

/** A picture, an embedded video, or a video file. */
export function MediaBlock({ media, className, fill }: { media: Media; className?: string; fill?: boolean }) {
	if (media.kind === "image") {
		// eslint-disable-next-line @next/next/no-img-element
		return <img src={media.url} alt={media.alt ?? ""} className={cn("object-cover", fill ? "absolute inset-0 h-full w-full" : "h-auto", className)} />;
	}
	const v = videoEmbed(media.url);
	if (v.kind === "iframe") {
		return (
			<div className={cn("overflow-hidden bg-black", fill ? "absolute inset-0" : "aspect-video", className)}>
				<iframe src={v.src} title={media.alt || "Video"} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
			</div>
		);
	}
	return <video src={v.src} controls playsInline preload="metadata" className={cn("bg-black object-cover", fill ? "absolute inset-0 h-full w-full" : "w-full", className)} />;
}

function Card({ id, error, children }: { id?: string; error?: string; children: React.ReactNode }) {
	return (
		<section id={id} className={cn("space-y-3 border bg-white p-5 text-gray-900 shadow-sm", error ? "border-red-300" : "border-gray-200")} style={{ borderRadius: "var(--r)" }}>
			{children}
			{error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
		</section>
	);
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
	return <h2 className="text-base font-medium text-gray-900">{children}{required && <span className="ml-1 text-red-600">*</span>}</h2>;
}

const KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function Control({ q, look, value, other, onChange, onOther, onPicked, onEnter }: {
	q: Question; look: "card" | "full"; value: Answer | undefined; other: string; onChange: (v: Answer) => void; onOther: (t: string) => void; onPicked?: () => void; onEnter?: () => void;
}) {
	const options = [...(q.options ?? []), ...(q.allowOther ? [OTHER_LABEL] : [])];
	const full = look === "full";
	const underline = "w-full border-0 border-b-2 bg-transparent py-2 text-2xl outline-none placeholder:opacity-40 focus:border-b-[3px]";
	const underStyle = { color: "var(--a)", borderColor: mix("var(--a)", 50) } as React.CSSProperties;
	const enter = (e: React.KeyboardEvent) => { if (e.key === "Enter" && onEnter && (!(e.target instanceof HTMLTextAreaElement) || e.ctrlKey || e.metaKey)) { e.preventDefault(); onEnter(); } };
	const otherInput = (
		<input value={other} onChange={(e) => onOther(e.target.value)} onKeyDown={enter} placeholder={q.type === "checkbox" ? "What is it? Separate several with commas" : "What is it?"} className={full ? cn(underline, "mt-2 text-lg") : cn(cardField, "mt-2")} style={full ? underStyle : { borderRadius: "var(--rb)" }} autoComplete="off" />
	);
	const accent = "accent-[var(--accent)]";

	// Letter shortcuts on the full-page layout: press A, B, C to pick, like Typeform.
	useEffect(() => {
		if (!full || !(q.type === "choice" || q.type === "checkbox")) return;
		const h = (e: KeyboardEvent) => {
			const el = document.activeElement as HTMLElement | null;
			if (el && (el.tagName === "INPUT" && (el as HTMLInputElement).type === "text" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			const i = KEYS.indexOf(e.key.toUpperCase());
			if (i < 0 || i >= options.length || e.key.length !== 1) return;
			e.preventDefault();
			const o = options[i];
			if (q.type === "choice") { onChange(o); onPicked?.(); }
			else { const list = Array.isArray(value) ? value : []; onChange(list.includes(o) ? list.filter((x) => x !== o) : [...list, o]); }
		};
		window.addEventListener("keydown", h);
		return () => window.removeEventListener("keydown", h);
	});

	const choiceBtn = (o: string, i: number, on: boolean, pick: () => void, kind: "radio" | "check") => (
		<button
			key={o}
			type="button"
			role={kind === "radio" ? "radio" : "checkbox"}
			aria-checked={on}
			onClick={pick}
			className="flex w-full items-center gap-3 border px-3 py-2.5 text-left text-lg transition hover:opacity-90"
			style={{ color: "var(--a)", borderColor: on ? "var(--a)" : mix("var(--a)", 45), background: mix("var(--a)", on ? 22 : 8), borderRadius: "var(--rb)", borderWidth: on ? 2 : 1 }}
		>
			<span className="flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-semibold" style={{ borderColor: mix("var(--a)", 60), borderRadius: 6, background: on ? "var(--a)" : "transparent", color: on ? "var(--btn-text)" : "var(--a)" }}>{on ? <Check className="h-3.5 w-3.5" /> : KEYS[i]}</span>
			<span className="min-w-0 flex-1 break-words">{o}</span>
		</button>
	);

	switch (q.type) {
		case "short":
			return <input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={enter} maxLength={500} className={full ? underline : cardField} style={full ? underStyle : { borderRadius: "var(--rb)" }} placeholder={full ? "Type your answer here..." : "Your answer"} autoFocus={full} />;
		case "email":
			return <input type="email" inputMode="email" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={enter} className={full ? underline : cardField} style={full ? underStyle : { borderRadius: "var(--rb)" }} placeholder={full ? "name@example.com" : "Your email"} autoFocus={full} />;
		case "number":
			return <input type="number" inputMode="decimal" value={(value as string | number) ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={enter} className={full ? underline : cardField} style={full ? underStyle : { borderRadius: "var(--rb)" }} placeholder={full ? "Type a number..." : "Your answer"} autoFocus={full} />;
		case "date":
			return <input type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={enter} className={full ? cn(underline, "sm:w-72") : cn(cardField, "sm:w-60")} style={full ? underStyle : { borderRadius: "var(--rb)" }} />;
		case "paragraph":
			return <textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={enter} rows={full ? 3 : 4} maxLength={5000} className={full ? cn(underline, "resize-none text-xl") : cardField} style={full ? underStyle : { borderRadius: "var(--rb)" }} placeholder={full ? "Type your answer here... (Ctrl + Enter to continue)" : "Your answer"} autoFocus={full} />;
		case "dropdown":
			return (
				<>
					<select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={full ? cn(underline, "sm:w-96 [&>option]:text-gray-900") : cn(cardField, "sm:w-72")} style={full ? underStyle : { borderRadius: "var(--rb)" }}>
						<option value="">Choose</option>
						{options.map((o) => <option key={o} value={o}>{o}</option>)}
					</select>
					{value === OTHER_LABEL && otherInput}
				</>
			);
		case "choice":
			if (full) {
				return (
					<div role="radiogroup" className="space-y-2">
						{options.map((o, i) => choiceBtn(o, i, value === o, () => { onChange(o); if (o !== OTHER_LABEL) onPicked?.(); }, "radio"))}
						{value === OTHER_LABEL && otherInput}
					</div>
				);
			}
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
			if (full) {
				return (
					<div className="space-y-2">
						{options.map((o, i) => choiceBtn(o, i, list.includes(o), () => onChange(list.includes(o) ? list.filter((x) => x !== o) : [...list, o]), "check"))}
						{list.includes(OTHER_LABEL) && otherInput}
					</div>
				);
			}
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
			if (full) {
				return (
					<div>
						<div className="flex flex-wrap gap-2">
							{steps.map((n) => {
								const on = value === n;
								return (
									<button key={n} type="button" aria-pressed={on} onClick={() => { onChange(n); onPicked?.(); }} className="flex h-12 min-w-12 items-center justify-center border px-3 text-lg font-semibold transition hover:opacity-90"
										style={{ color: on ? "var(--btn-text)" : "var(--a)", background: on ? "var(--a)" : mix("var(--a)", 8), borderColor: mix("var(--a)", 55), borderRadius: "var(--rb)" }}>{n}</button>
								);
							})}
						</div>
						{(minLabel || maxLabel) && <div className="mt-2 flex justify-between text-sm opacity-80"><span>{minLabel}</span><span>{maxLabel}</span></div>}
					</div>
				);
			}
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
