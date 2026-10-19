"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, PenTool, Plus, Presentation, Trash2, Upload, X, File as FileIcon } from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { attachMeetingDoc, detachMeetingDoc, meetingDocs, type MeetingDoc } from "@/app/actions/meet-docs";
import { getFileUrl, prepareUpload, registerUpload } from "@/app/dashboard/mjengo/vault/api";
import { VaultPicker } from "@/app/dashboard/mjengo/_components/VaultPicker";

const DOC = ["docx", "doc", "odt", "rtf", "md"];
const SHEET = ["xlsx", "xls", "csv"];
const SLIDES = ["pptx", "ppt", "deck"];
const IMG = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

export function iconFor(ext: string) {
	if (DOC.includes(ext) || ext === "pdf" || ext === "txt") return FileText;
	if (SHEET.includes(ext)) return FileSpreadsheet;
	if (SLIDES.includes(ext)) return Presentation;
	if (ext === "excalidraw") return PenTool;
	if (IMG.includes(ext)) return ImageIcon;
	return FileIcon;
}

/** Everything attached to this call, from before it started or added during it, for the side panel. */
export function useMeetingDocs(code: string, enabled: boolean) {
	const [docs, setDocs] = useState<MeetingDoc[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const refresh = useRef(async () => {});
	refresh.current = async () => {
		if (!enabled) return;
		setLoading(true);
		try { setDocs(await unwrap(meetingDocs(code))); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Could not load the documents."); } finally { setLoading(false); }
	};
	useEffect(() => { void refresh.current(); }, [code, enabled]);
	return { docs, setDocs, loading, error, refresh: () => refresh.current() };
}

export function DocsPanel({ code, docs, loading, error, canAttach, onChanged, onOpen, openId }: {
	code: string; docs: MeetingDoc[]; loading: boolean; error: string | null; canAttach: boolean;
	/** Tell the others in the call something was attached or removed. */
	onChanged: (next: MeetingDoc[]) => void; onOpen: (d: MeetingDoc) => void; openId: string | null;
}) {
	const [pick, setPick] = useState(false);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);
	const input = useRef<HTMLInputElement>(null);

	const attach = async (id: string) => {
		setBusy(true); setMsg(null);
		try { onChanged(await unwrap(attachMeetingDoc(code, id))); } catch (e) { setMsg(e instanceof Error ? e.message : "Could not attach it."); } finally { setBusy(false); }
	};
	const upload = async (files: FileList | null) => {
		if (!files?.length) return;
		setBusy(true); setMsg(null);
		try {
			for (const f of Array.from(files)) {
				const { path, signedUrl } = await prepareUpload(null, f.name, f.size);
				const put = await fetch(signedUrl, { method: "PUT", body: f, headers: { "Content-Type": f.type || "application/octet-stream" } });
				if (!put.ok) throw new Error(`Could not upload ${f.name}.`);
				const item = await registerUpload(null, path, f.name, f.size, f.type || null);
				onChanged(await unwrap(attachMeetingDoc(code, item.id)));
			}
		} catch (e) { setMsg(e instanceof Error ? e.message : "Could not upload it."); } finally { setBusy(false); if (input.current) input.current.value = ""; }
	};
	const remove = async (id: string) => {
		setBusy(true);
		try { onChanged(await unwrap(detachMeetingDoc(code, id))); } catch (e) { setMsg(e instanceof Error ? e.message : "Could not remove it."); } finally { setBusy(false); }
	};

	return (
		<div className="flex h-full flex-col text-sm">
			<div className="space-y-2 border-b border-[#dadce0] p-3">
				<p className="text-xs text-[#5f6368]">Anything attached here can be opened by everyone in the call and edited together, live. This works for documents, sheets, slides, whiteboards, PDFs and any other file.</p>
				{canAttach && (
					<div className="flex gap-2">
						<button disabled={busy} onClick={() => setPick(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#dadce0] px-3 py-2 font-medium text-[#068297] hover:bg-[#f1fafb] disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} From Files</button>
						<button disabled={busy} onClick={() => input.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#dadce0] px-3 py-2 font-medium text-[#068297] hover:bg-[#f1fafb] disabled:opacity-50"><Upload className="h-4 w-4" /> Upload</button>
						<input ref={input} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
					</div>
				)}
				{msg && <p role="alert" className="text-xs text-[#d93025]">{msg}</p>}
			</div>
			<ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
				{loading && docs.length === 0 && <li className="flex items-center gap-2 p-3 text-[#5f6368]"><Loader2 className="h-4 w-4 animate-spin" /> Loading</li>}
				{error && docs.length === 0 && <li className="p-3 text-xs text-[#5f6368]">{error}</li>}
				{!loading && !error && docs.length === 0 && <li className="p-3 text-[#5f6368]">Nothing is attached yet.</li>}
				{docs.map((d) => {
					const Icon = iconFor(d.ext);
					return (
						<li key={d.id} className={cn("group flex items-center gap-2 rounded-lg p-2 hover:bg-[#f8f9fa]", openId === d.id && "bg-[#e6f4f6]")}>
							<button onClick={() => onOpen(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
								<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e6f4f6] text-[#068297]"><Icon className="h-5 w-5" /></span>
								<span className="min-w-0"><span className="block truncate font-medium">{d.name}</span><span className="block text-xs text-[#5f6368]">{openId === d.id ? "Open now" : d.level === "edit" ? "Edit together" : d.level ? "View" : "Open"}</span></span>
							</button>
							{canAttach && <button onClick={() => void remove(d.id)} aria-label={`Take ${d.name} off the call`} title="Take off the call" className="flex h-7 w-7 items-center justify-center rounded-full text-[#5f6368] opacity-0 hover:bg-black/5 group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4" /></button>}
						</li>
					);
				})}
			</ul>
			<VaultPicker open={pick} onClose={() => setPick(false)} title="Attach to the call" max={5} already={docs.map((d) => d.id)} onPick={(items) => { setPick(false); void (async () => { for (const it of items) if (it.kind === "file") await attach(it.id); })(); }} />
		</div>
	);
}

/** The attached file, open beside the call: the same editors as the suite, so people see each other's cursors and names. */
export function DocWorkspace({ doc, docs, onSelect, onClose }: { doc: MeetingDoc; docs: MeetingDoc[]; onSelect: (d: MeetingDoc) => void; onClose: () => void }) {
	const live = DOC.includes(doc.ext) || SHEET.includes(doc.ext) || SLIDES.includes(doc.ext) || doc.ext === "excalidraw" || doc.ext === "pdf";
	const [url, setUrl] = useState<string | null>(null);
	const [fail, setFail] = useState(false);
	useEffect(() => {
		setUrl(null); setFail(false);
		if (live) return;
		let on = true;
		getFileUrl(doc.id).then((r) => on && setUrl(r.url)).catch(() => on && setFail(true));
		return () => { on = false; };
	}, [doc.id, live]);
	const src = live ? `${doc.href}${doc.href.includes("?") ? "&" : "?"}embed=1` : url;

	return (
		<section aria-label={doc.name} className="absolute inset-y-0 right-0 z-30 flex w-full flex-col bg-white text-[#202124] shadow-2xl md:w-[min(960px,64vw)]">
			<header className="flex shrink-0 items-center gap-1 border-b border-[#dadce0] px-2 py-1.5">
				<div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
					{docs.map((d) => {
						const Icon = iconFor(d.ext);
						return <button key={d.id} onClick={() => onSelect(d)} className={cn("flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", d.id === doc.id ? "bg-[#e6f4f6] font-medium text-[#068297]" : "text-[#5f6368] hover:bg-[#f1f3f4]")}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{d.name}</span></button>;
					})}
				</div>
				<a href={doc.href.includes("?") ? doc.href : undefined} target="_blank" rel="noopener noreferrer" aria-label="Open in its own tab" title="Open in its own tab" className="flex h-8 w-8 items-center justify-center rounded-full text-[#5f6368] hover:bg-black/5"><ExternalLink className="h-4 w-4" /></a>
				<button onClick={onClose} aria-label="Close the document" className="flex h-8 w-8 items-center justify-center rounded-full text-[#5f6368] hover:bg-black/5"><X className="h-4 w-4" /></button>
			</header>
			<div className="relative min-h-0 flex-1 bg-white">
				{fail && <p className="p-6 text-sm text-[#5f6368]">This file could not be opened here.</p>}
				{!src && !fail && <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#068297]" /></div>}
				{src && (IMG.includes(doc.ext) && !live
					// eslint-disable-next-line @next/next/no-img-element
					? <img src={src} alt={doc.name} className="h-full w-full object-contain" />
					: <iframe key={doc.id} src={src} title={doc.name} className="h-full w-full border-0" allow="clipboard-read; clipboard-write" />)}
			</div>
		</section>
	);
}
