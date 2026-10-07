"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
	AlertTriangle, Archive, CheckCircle2, Clock, Eye, ExternalLink, FileEdit, FileUp, Loader2, Mail, Pencil,
	Plus, Save, Send, Trash2, Undo2, X,
} from "lucide-react";
import { RichEditor } from "@/components/editor/RichEditor";
import { ArticleView, KIND_LABEL } from "./ArticleView";
import { cn } from "@/lib/utils";
import { uploadToPublications } from "@/lib/content/upload-client";
import { readingStats } from "@/lib/content/reading";
import {
	deletePublication, importFromStorage, resendPublicationEmail, savePublication, setPublicationStatus,
} from "@/app/actions/publishing";
import { PUBLICATION_KINDS, type PublicationKind, type PublicationRow, type PublicationStatus } from "@/types/publishing";

type Draft = {
	kind: PublicationKind;
	title: string;
	summary: string;
	body: string;
	cover_image_url: string;
	cover_image_alt: string;
	category: string;
	tags: string;
	featured: boolean;
	links: { label: string; url: string }[];
	source_file_url: string | null;
	source_file_name: string | null;
	source_file_type: string | null;
};

const STATUS = {
	draft: { label: "Draft", icon: FileEdit, cls: "border-slate-200 bg-slate-50 text-slate-800", note: "Not visible to anyone yet." },
	in_review: { label: "In review", icon: Clock, cls: "border-amber-200 bg-amber-50 text-amber-900", note: "Waiting for a final check before it goes live." },
	published: { label: "Published", icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50 text-emerald-900", note: "Live on the website. Saving updates the live page." },
	archived: { label: "Archived", icon: Archive, cls: "border-gray-300 bg-gray-100 text-gray-700", note: "Hidden from the website. Publish again to restore." },
} as const;

const fromRow = (r?: PublicationRow): Draft => ({
	kind: r?.kind ?? "publication",
	title: r?.title ?? "",
	summary: r?.summary ?? "",
	body: r?.body ?? "",
	cover_image_url: r?.cover_image_url ?? "",
	cover_image_alt: r?.cover_image_alt ?? "",
	category: r?.category ?? "",
	tags: (r?.tags ?? []).join(", "),
	featured: r?.featured ?? false,
	links: r?.external_links ?? [],
	source_file_url: r?.source_file_url ?? null,
	source_file_name: r?.source_file_name ?? null,
	source_file_type: r?.source_file_type ?? null,
});

export function PublicationEditor({ initial }: { initial?: PublicationRow }) {
	const router = useRouter();
	const [id, setId] = useState(initial?.id);
	const [slug, setSlug] = useState(initial?.slug);
	const [status, setStatus] = useState<PublicationStatus>(initial?.status ?? "draft");
	const [token] = useState(initial?.preview_token);
	const [d, setD] = useState<Draft>(() => fromRow(initial));
	const [saved, setSaved] = useState<Draft>(() => fromRow(initial));
	const [view, setView] = useState<"edit" | "preview">("edit");
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [warnings, setWarnings] = useState<string[]>([]);
	const [emailStatus, setEmailStatus] = useState(initial?.email_status ?? null);
	const [, startTransition] = useTransition();
	const fileRef = useRef<HTMLInputElement>(null);
	const coverRef = useRef<HTMLInputElement>(null);

	const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(saved), [d, saved]);
	const set = useCallback(<K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v })), []);
	const stats = useMemo(() => readingStats(d.body), [d.body]);

	// Warn before leaving with unsaved work.
	useEffect(() => {
		if (!dirty) return;
		const h = (e: BeforeUnloadEvent) => (e.preventDefault(), (e.returnValue = ""));
		window.addEventListener("beforeunload", h);
		return () => window.removeEventListener("beforeunload", h);
	}, [dirty]);

	const flash = (m: string) => {
		setNotice(m);
		setTimeout(() => setNotice(null), 3500);
	};

	const payload = () => ({
		id,
		kind: d.kind,
		title: d.title,
		summary: d.summary,
		body: d.body,
		cover_image_url: d.cover_image_url,
		cover_image_alt: d.cover_image_alt,
		category: d.category,
		tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
		featured: d.featured,
		external_links: d.links,
		source_file_url: d.source_file_url,
		source_file_name: d.source_file_name,
		source_file_type: d.source_file_type,
	});

	const save = async (quiet = false) => {
		setBusy("save");
		setError(null);
		const res = await savePublication(payload());
		setBusy(null);
		if (!res.ok) return setError(res.error), null;
		setId(res.id);
		setSlug(res.slug);
		setSaved(d);
		if (!quiet) flash("Saved.");
		if (!id) router.replace(`/dashboard/admin/publications/${res.id}`);
		return res;
	};

	const changeStatus = async (next: PublicationStatus) => {
		setError(null);
		const s = dirty || !id ? await save(true) : { id: id! };
		if (!s) return;
		setBusy(next);
		const res = await setPublicationStatus(s.id, next);
		setBusy(null);
		if (!res.ok) return setError(res.error);
		setStatus(next);
		flash(
			next === "published"
				? res.emailed
					? "Published. A PDF and Word copy is being emailed to publications@sautisalama.org."
					: "Published."
				: `Moved to ${STATUS[next].label.toLowerCase()}.`
		);
		startTransition(() => router.refresh());
	};

	const importFile = async (file: File) => {
		setError(null);
		setWarnings([]);
		if (!/\.(docx|pdf)$/i.test(file.name)) return setError("Choose a Word (.docx) or PDF file.");
		if (file.size > 15 * 1024 * 1024) return setError("The file is larger than 15 MB.");
		if (d.body && !window.confirm("Replace the current content with the imported document?")) return;
		setBusy("import");
		try {
			const up = await uploadToPublications(file, "imports");
			const res = await importFromStorage(up.path);
			if (!res.ok) throw new Error(res.error);
			setD((p) => ({
				...p,
				title: p.title.trim() ? p.title : res.doc.title,
				body: res.doc.html,
				source_file_url: res.sourceUrl,
				source_file_name: res.fileName,
				source_file_type: res.doc.kind,
			}));
			setWarnings(res.doc.warnings);
			flash(`Imported “${file.name}”. Review it, then save as a draft.`);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Import failed.");
		} finally {
			setBusy(null);
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	const uploadCover = async (file: File) => {
		setError(null);
		if (!/^image\//.test(file.type)) return setError("The cover must be an image.");
		if (file.size > 8 * 1024 * 1024) return setError("The cover image must be under 8 MB.");
		setBusy("cover");
		try {
			set("cover_image_url", (await uploadToPublications(file, "covers")).url);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Upload failed.");
		} finally {
			setBusy(null);
			if (coverRef.current) coverRef.current.value = "";
		}
	};

	const remove = async () => {
		if (!id || !window.confirm("Delete this permanently? This cannot be undone.")) return;
		setBusy("delete");
		const res = await deletePublication(id);
		if (!res.ok) {
			setBusy(null);
			return setError(res.error);
		}
		setSaved(d); // avoid the unsaved-changes prompt
		router.push("/dashboard/admin/publications");
		router.refresh();
	};

	const resend = async () => {
		if (!id) return;
		setBusy("email");
		const res = await resendPublicationEmail(id);
		setBusy(null);
		if (!res.ok) return setError(res.error);
		setEmailStatus("sent");
		flash("Copy emailed to publications@sautisalama.org.");
	};

	const st = STATUS[status];
	const StIcon = st.icon;
	const publishable = d.title.trim().length >= 3 && stats.words > 5;
	const previewUrl = slug && token ? `/publications/${slug}?preview=${token}` : null;

	return (
		<div className="space-y-5">
			<div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3", st.cls)}>
				<StIcon className="h-5 w-5 shrink-0" aria-hidden />
				<div className="min-w-0 flex-1">
					<p className="text-sm font-bold leading-tight">
						{st.label}
						{dirty && <span className="ml-2 rounded bg-white/70 px-1.5 py-0.5 text-xs font-semibold">Unsaved changes</span>}
					</p>
					<p className="text-xs opacity-90">{st.note}</p>
				</div>
				{id && (
					<span className="hidden text-xs sm:block" aria-live="polite">
						{emailStatus === "sent" ? "Copy emailed ✓" : emailStatus?.startsWith("failed") ? "Email failed" : ""}
					</span>
				)}
			</div>

			{error && (
				<div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
					<span className="flex-1">{error}</span>
					<button type="button" aria-label="Dismiss" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
				</div>
			)}
			{notice && (
				<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{notice}</div>
			)}
			{warnings.length > 0 && (
				<ul role="status" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					{warnings.map((w) => <li key={w}>⚠ {w}</li>)}
				</ul>
			)}

			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex w-fit gap-1 rounded-xl border border-gray-200 bg-white p-1" role="tablist" aria-label="Editor view">
					{(["edit", "preview"] as const).map((v) => (
						<button
							key={v}
							role="tab"
							aria-selected={view === v}
							onClick={() => setView(v)}
							className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold capitalize transition-colors", view === v ? "bg-[#008080] text-white" : "text-gray-600 hover:bg-gray-100")}
						>
							{v === "edit" ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {v}
						</button>
					))}
				</div>
				<span className="text-xs text-gray-500">{stats.words} words · {stats.minutes} min read</span>
			</div>

			{view === "edit" ? (
				<div className="space-y-5">
					<div className="rounded-xl border border-dashed border-[#008080]/50 bg-[#f0fafa] p-4">
						<div className="flex flex-wrap items-center gap-3">
							<FileUp className="h-5 w-5 text-[#008080]" aria-hidden />
							<div className="min-w-0 flex-1">
								<p className="text-sm font-bold text-[#1a365d]">Start from a Word or PDF document</p>
								<p className="text-xs text-gray-600">We convert it to editable content — you can review and fix it before publishing.</p>
							</div>
							<input ref={fileRef} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" aria-label="Upload Word or PDF document" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
							<button type="button" disabled={busy === "import"} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-[#008080] px-4 py-2 text-sm font-bold text-white hover:bg-[#006666] disabled:opacity-60">
								{busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} {busy === "import" ? "Reading…" : "Upload document"}
							</button>
						</div>
						{d.source_file_url && (
							<p className="mt-2 text-xs text-gray-600">
								Imported from <a className="font-semibold text-[#008080] underline" href={d.source_file_url} target="_blank" rel="noopener noreferrer">{d.source_file_name}</a>
							</p>
						)}
					</div>

					<div className="grid gap-4 md:grid-cols-[1fr_14rem]">
						<Field label="Title" required>
							<input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="A clear, specific title" maxLength={160} className="input" />
						</Field>
						<Field label="Type">
							<select value={d.kind} onChange={(e) => set("kind", e.target.value as PublicationKind)} className="input">
								{PUBLICATION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
							</select>
						</Field>
					</div>
					<Field label="Summary" hint="Shown on cards and in search results. Leave empty to use the opening text.">
						<textarea value={d.summary} onChange={(e) => set("summary", e.target.value)} rows={2} maxLength={300} className="input" />
					</Field>
					<div className="grid gap-4 md:grid-cols-2">
						<Field label="Category" hint="e.g. Legal Guide, Research Brief">
							<input value={d.category} onChange={(e) => set("category", e.target.value)} className="input" />
						</Field>
						<Field label="Tags" hint="Comma separated">
							<input value={d.tags} onChange={(e) => set("tags", e.target.value)} className="input" />
						</Field>
					</div>

					<Field label="Cover image">
						<div className="flex flex-wrap items-start gap-3">
							{d.cover_image_url && (
								// eslint-disable-next-line @next/next/no-img-element
								<img src={d.cover_image_url} alt="" className="h-20 w-32 rounded-lg border border-gray-200 object-cover" />
							)}
							<div className="min-w-[14rem] flex-1 space-y-2">
								<div className="flex gap-2">
									<input value={d.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} placeholder="Paste an image link, or upload" className="input" aria-label="Cover image link" />
									<input ref={coverRef} type="file" accept="image/*" className="sr-only" aria-label="Upload cover image" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
									<button type="button" onClick={() => coverRef.current?.click()} disabled={busy === "cover"} className="btn-secondary shrink-0">
										{busy === "cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
									</button>
								</div>
								<input value={d.cover_image_alt} onChange={(e) => set("cover_image_alt", e.target.value)} placeholder="Describe the image for screen readers" className="input" aria-label="Cover image description" />
							</div>
						</div>
					</Field>

					<Field label="Content" required>
						<RichEditor
							value={d.body}
							onChange={(html) => set("body", html)}
							onUploadImage={async (f) => (await uploadToPublications(f, "images")).url}
							placeholder="Write or paste your article…"
							minHeight={420}
						/>
					</Field>

					<SourcesEditor links={d.links} onChange={(l) => set("links", l)} />

					<label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
						<input type="checkbox" checked={d.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
						Feature this on the homepage (still ordered newest first)
					</label>
				</div>
			) : (
				<div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-10">
					<ArticleView
						title={d.title}
						summary={d.summary}
						category={d.category}
						kindLabel={KIND_LABEL[d.kind]}
						coverUrl={d.cover_image_url}
						coverAlt={d.cover_image_alt}
						publishedAt={initial?.published_at ?? new Date().toISOString()}
						readMinutes={stats.words ? stats.minutes : null}
						bodyHtml={d.body}
						links={d.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label || l.url, url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}` }))}
						tags={d.tags.split(",").map((t) => t.trim()).filter(Boolean)}
					/>
				</div>
			)}

			<div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
				<button type="button" onClick={() => save()} disabled={!!busy || !d.title.trim()} className="btn-secondary">
					{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save {status === "published" ? "changes" : "draft"}
				</button>
				{previewUrl && (
					<a href={previewUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" title="Shareable link for draft review — works without signing in">
						<ExternalLink className="h-4 w-4" /> Open preview link
					</a>
				)}
				<span className="flex-1" />
				{id && (
					<button type="button" onClick={resend} disabled={!!busy} className="btn-secondary" title="Email a PDF and Word copy to publications@sautisalama.org">
						{busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email copy
					</button>
				)}
				{status === "draft" && (
					<button type="button" onClick={() => changeStatus("in_review")} disabled={!!busy || !publishable} className="btn-secondary">
						<Clock className="h-4 w-4" /> Send to review
					</button>
				)}
				{status === "published" ? (
					<>
						<button type="button" onClick={() => changeStatus("draft")} disabled={!!busy} className="btn-secondary"><Undo2 className="h-4 w-4" /> Unpublish</button>
						<button type="button" onClick={() => changeStatus("archived")} disabled={!!busy} className="btn-secondary"><Archive className="h-4 w-4" /> Archive</button>
					</>
				) : (
					<button type="button" onClick={() => changeStatus("published")} disabled={!!busy || !publishable} className="inline-flex items-center gap-2 rounded-lg bg-[#1a365d] px-5 py-2 text-sm font-bold text-white hover:bg-[#008080] disabled:opacity-50">
						{busy === "published" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish
					</button>
				)}
				{id && (
					<button type="button" onClick={remove} disabled={!!busy} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Delete permanently" title="Delete permanently">
						<Trash2 className="h-4 w-4" />
					</button>
				)}
				<Link href="/dashboard/admin/publications" className="text-sm font-semibold text-gray-500 hover:text-gray-800">Close</Link>
			</div>

			<style>{`
				.input{width:100%;border:1px solid #d1d5db;border-radius:.6rem;padding:.55rem .75rem;font-size:.95rem;background:#fff}
				.input:focus{outline:2px solid rgba(0,128,128,.35);border-color:#008080}
				.btn-secondary{display:inline-flex;align-items:center;gap:.4rem;border:1px solid #d1d5db;background:#fff;border-radius:.6rem;padding:.5rem .9rem;font-size:.875rem;font-weight:700;color:#374151}
				.btn-secondary:hover:not(:disabled){background:#f3f4f6}
				.btn-secondary:disabled{opacity:.5}
			`}</style>
		</div>
	);
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
	return (
		<div>
			<label className="mb-1 block text-sm font-bold text-[#1a365d]">
				{label} {required && <span className="text-red-600" aria-hidden>*</span>}
			</label>
			{children}
			{hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
		</div>
	);
}

function SourcesEditor({ links, onChange }: { links: { label: string; url: string }[]; onChange: (l: { label: string; url: string }[]) => void }) {
	const update = (i: number, patch: Partial<{ label: string; url: string }>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
	return (
		<fieldset className="rounded-xl border border-gray-200 p-4">
			<legend className="px-1 text-sm font-bold text-[#1a365d]">Other sources</legend>
			<p className="mb-3 text-xs text-gray-500">Link readers to related reports, laws or articles. They appear in a “Other sources” box under the article. You can also add inline links in the text with the link button.</p>
			<div className="space-y-2">
				{links.map((l, i) => (
					<div key={i} className="flex flex-wrap gap-2">
						<input value={l.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label (e.g. Sexual Offences Act)" className="input min-w-[10rem] flex-1" aria-label={`Source ${i + 1} label`} />
						<input value={l.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://…" inputMode="url" className="input min-w-[14rem] flex-[2]" aria-label={`Source ${i + 1} link`} />
						<button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} aria-label={`Remove source ${i + 1}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
					</div>
				))}
			</div>
			<button type="button" onClick={() => onChange([...links, { label: "", url: "" }])} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#008080] hover:underline">
				<Plus className="h-4 w-4" /> Add a source
			</button>
		</fieldset>
	);
}
