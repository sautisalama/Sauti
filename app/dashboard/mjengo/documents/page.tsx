"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Circle, Download, FilePlus2, FileText, Loader2, Plus, Search, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { putToSignedUrl } from "@/lib/client/upload";
import { prepareUpload, registerUpload, searchFiles } from "../vault/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getDocumentUrl, listDocuments, type DocRow } from "@/app/actions/mjengo";
import { DeadlineChip, KIND_HREF, KIND_LABEL, fmtBytes, type Kind } from "../_components/shared";
import { cn } from "@/lib/utils";

/** Every document across grants, opportunities and projects in one place. */
export default function DocumentsPage() {
	const { toast } = useToast();
	const router = useRouter();
	const pick = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [written, setWritten] = useState<{ id: string; name: string; size: number; folder: string | null }[]>([]);
	const [docs, setDocs] = useState<DocRow[] | null>(null);
	const [q, setQ] = useState("");
	const [kind, setKind] = useState<Kind | "all">("all");
	const [state, setState] = useState<"all" | "needed" | "uploaded">("all");

	useEffect(() => {
		listDocuments().then(setDocs).catch(() => setDocs([]));
		searchFiles("")
			.then((r) => setWritten(r.filter((f) => /\.(docx|doc|odt|rtf|md|txt)$/i.test(f.name)).slice(0, 12)))
			.catch(() => setWritten([]));
	}, []);

	/** Pick a Word / OpenDocument / text file: it goes into the vault and opens in the editor. */
	const openFromComputer = async (f: File | undefined) => {
		if (!f) return;
		setUploading(true);
		try {
			const { path, signedUrl } = await prepareUpload(null, f.name, f.size);
			await putToSignedUrl(signedUrl, f);
			const created = await registerUpload(null, path, f.name, f.size, f.type || null);
			router.push(`/dashboard/mjengo/documents/editor?file=${created.id}`);
		} catch (e) {
			toast({ title: "Could not upload", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			setUploading(false);
		}
	};

	const shown = useMemo(() => {
		const term = q.trim().toLowerCase();
		return (docs ?? []).filter(
			(d) =>
				(kind === "all" || d.entity_type === kind) &&
				(state === "all" || (state === "needed" ? d.required && !d.file_path : !!d.file_path)) &&
				(!term || [d.name, d.file_name, d.entity_label].some((v) => (v ?? "").toLowerCase().includes(term)))
		);
	}, [docs, q, kind, state]);

	const open = async (d: DocRow) => {
		try {
			window.open(await getDocumentUrl(d.id), "_blank", "noopener");
		} catch (e) {
			toast({ title: "Could not open", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	};

	if (!docs) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>;

	const needed = docs.filter((d) => d.required && !d.file_path).length;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 className="text-lg font-bold text-serene-neutral-900">Documents</h2>
					<p className="text-sm text-serene-neutral-500">{docs.filter((d) => d.file_path).length} uploaded · {needed} still needed across all grants, opportunities and projects</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={uploading}>
							{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => router.push("/dashboard/mjengo/documents/editor")}><FilePlus2 className="mr-2 h-4 w-4" /> New document</DropdownMenuItem>
						<DropdownMenuItem onClick={() => pick.current?.click()}><Upload className="mr-2 h-4 w-4" /> Open a file from this device</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<input ref={pick} type="file" accept=".docx,.doc,.odt,.rtf,.md,.txt,.html" className="hidden" onChange={(e) => { openFromComputer(e.target.files?.[0]); e.target.value = ""; }} />
			</div>

			{written.length > 0 && (
				<section aria-label="Written documents">
					<h3 className="mb-2 text-sm font-semibold text-sauti-dark">Your documents</h3>
					<ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{written.map((w) => (
							<li key={w.id}>
								<Link href={`/dashboard/mjengo/documents/editor?file=${w.id}`} className="flex items-center gap-3 rounded-2xl border border-serene-neutral-100 bg-white p-3 transition hover:border-sauti-teal/40 hover:shadow-sm">
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal"><FileText className="h-5 w-5" /></span>
									<span className="min-w-0"><span className="block truncate text-sm font-medium text-serene-neutral-900">{w.name}</span><span className="block truncate text-xs text-serene-neutral-500">{w.folder ?? "Vault"} · {fmtBytes(w.size)}</span></span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}

			<div className="flex flex-col gap-2 lg:flex-row">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents or the grant, opportunity or project" className="pl-9" />
				</div>
				<Segmented value={kind} onChange={setKind} options={[["all", "All"], ["grant", "Grants"], ["opportunity", "Opportunities"], ["project", "Projects"]]} />
				<Segmented value={state} onChange={setState} options={[["all", "All"], ["needed", "Needed"], ["uploaded", "Uploaded"]]} />
			</div>

			<div className="overflow-hidden rounded-2xl border border-serene-neutral-100 bg-white">
				<ul className="divide-y divide-serene-neutral-50">
					{shown.map((d) => (
						<li key={d.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
							{d.file_path ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="h-5 w-5 shrink-0 text-serene-neutral-300" />}
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-serene-neutral-900">{d.name}</p>
								<p className="truncate text-xs text-serene-neutral-500">
									{d.file_path ? `${d.file_name} · ${fmtBytes(d.file_size)}${d.uploaded_at ? ` · ${format(new Date(d.uploaded_at), "d MMM yyyy")}` : ""}${d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ""}` : "Not uploaded yet"}
								</p>
							</div>
							<Link href={KIND_HREF[d.entity_type]} className="max-w-[40%] truncate text-xs text-sauti-teal hover:underline sm:max-w-[220px]">
								<Badge variant="secondary" className="mr-1.5">{KIND_LABEL[d.entity_type]}</Badge>
								{d.entity_label ?? "Removed"}
							</Link>
							{!d.file_path && <DeadlineChip date={d.due_date} />}
							{d.file_path && <Button size="icon" variant="ghost" onClick={() => open(d)} aria-label={`Download ${d.name}`}><Download className="h-4 w-4" /></Button>}
						</li>
					))}
					{shown.length === 0 && <li className="p-10 text-center text-sm text-serene-neutral-500">No documents match. Add them from a grant, opportunity or project.</li>}
				</ul>
			</div>
		</div>
	);
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
	return (
		<div className="inline-flex shrink-0 rounded-lg border border-serene-neutral-200 bg-white p-0.5">
			{options.map(([v, l]) => (
				<button key={v} onClick={() => onChange(v)} aria-pressed={value === v} className={cn("touch-manipulation rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", value === v ? "bg-sauti-teal text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>
					{l}
				</button>
			))}
		</div>
	);
}
