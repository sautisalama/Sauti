"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Circle, Download, Loader2, Search } from "lucide-react";
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
	const [docs, setDocs] = useState<DocRow[] | null>(null);
	const [q, setQ] = useState("");
	const [kind, setKind] = useState<Kind | "all">("all");
	const [state, setState] = useState<"all" | "needed" | "uploaded">("all");

	useEffect(() => {
		listDocuments().then(setDocs).catch(() => setDocs([]));
	}, []);

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
			</div>

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
							<Link href={KIND_HREF[d.entity_type]} className="max-w-[40%] truncate text-xs text-purple-700 hover:underline sm:max-w-[220px]">
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
				<button key={v} onClick={() => onChange(v)} aria-pressed={value === v} className={cn("touch-manipulation rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", value === v ? "bg-purple-600 text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>
					{l}
				</button>
			))}
		</div>
	);
}
