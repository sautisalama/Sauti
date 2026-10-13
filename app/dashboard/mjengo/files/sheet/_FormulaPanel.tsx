"use client";

import { useMemo, useState } from "react";
import { Lightbulb, Loader2, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { aiFormula, type FormulaHelp } from "@/app/actions/mjengo-assist";
import { FORMULAS } from "@/lib/mjengo/formulas";

/** The bits of the Univer facade this panel uses; the library is loaded lazily so it is typed loosely here. */
interface Facade {
	getActiveWorkbook: () => {
		getActiveSheet: () => {
			getSelection: () => { getActiveRange: () => { getA1Notation: () => string; getRow: () => number; getColumn: () => number; getValues: () => unknown[][] } | null } | null;
			getRange: (r: number, c: number) => { setFormula: (f: string) => void; setValue: (v: string) => void };
			getDataRange?: () => { getValues: () => unknown[][] };
		};
	} | null;
}

const colName = (c: number) => { let s = ""; let n = c; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; };

/**
 * The formulas side panel. Opens when "=" is typed or from the fx button: search every function with its
 * syntax and an example, put one into the selected cell, or describe what you want and get a formula written
 * against the data on the sheet, with a note about that data.
 */
export function FormulaPanel({ api, onClose }: { api: { current: Facade | null }; onClose: () => void }) {
	const { toast } = useToast();
	const [q, setQ] = useState("");
	const [cat, setCat] = useState<string>("All");
	const [ask, setAsk] = useState("");
	const [busy, setBusy] = useState(false);
	const [help, setHelp] = useState<FormulaHelp | null>(null);

	const list = useMemo(() => {
		const t = q.trim().toLowerCase();
		return FORMULAS.filter((f) => (cat === "All" || f.category === cat) && (!t || f.name.toLowerCase().includes(t) || f.about.toLowerCase().includes(t)));
	}, [q, cat]);

	const selection = () => {
		const sheet = api.current?.getActiveWorkbook()?.getActiveSheet();
		const range = sheet?.getSelection()?.getActiveRange();
		return { sheet, range };
	};

	const put = (formula: string) => {
		const { sheet, range } = selection();
		if (!sheet || !range) { toast({ title: "Click a cell first", description: "Then choose where the formula goes." }); return; }
		try {
			sheet.getRange(range.getRow(), range.getColumn()).setFormula(formula);
			toast({ title: "Formula added", description: `${colName(range.getColumn())}${range.getRow() + 1}: ${formula}` });
		} catch {
			toast({ title: "Could not put it in the cell", description: "Try typing it in the cell instead.", variant: "destructive" });
		}
	};

	/** The sheet's data with cell addresses, so the answer uses real references. */
	const snapshot = (): { data: string; cell: string } => {
		const { sheet, range } = selection();
		const values = sheet?.getDataRange?.().getValues() ?? range?.getValues() ?? [];
		const lines: string[] = [];
		for (let r = 0; r < Math.min(values.length, 40); r++) {
			const row = values[r] ?? [];
			const cells = row.slice(0, 14).map((v, c) => (v === "" || v == null ? "" : `${colName(c)}${r + 1}=${String(v).slice(0, 40)}`)).filter(Boolean);
			if (cells.length) lines.push(cells.join("\t"));
		}
		return { data: lines.join("\n"), cell: range ? `${colName(range.getColumn())}${range.getRow() + 1}` : "" };
	};

	const run = async () => {
		setBusy(true); setHelp(null);
		try {
			const s = snapshot();
			setHelp(await unwrap(aiFormula(ask, s.data, s.cell)));
		} catch (e) {
			toast({ title: "Could not write a formula", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<aside className="flex w-full max-w-[22rem] shrink-0 flex-col border-l border-black/10 bg-white max-sm:absolute max-sm:inset-y-0 max-sm:right-0 max-sm:z-30 max-sm:max-w-[88vw] max-sm:shadow-2xl" aria-label="Formulas">
			<div className="flex items-center gap-2 border-b border-black/[0.07] px-3 py-2.5">
				<span className="font-serif text-lg italic">fx</span>
				<h3 className="flex-1 text-sm font-semibold">Formulas</h3>
				<button onClick={onClose} aria-label="Close formulas" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-black/5"><X className="h-4 w-4" /></button>
			</div>

			<div className="space-y-2 border-b border-black/[0.07] p-3">
				<p className="flex items-center gap-1.5 text-xs font-semibold text-[#7c3aed]"><Sparkles className="h-3.5 w-3.5" /> Describe it, get the formula</p>
				<textarea value={ask} onChange={(e) => setAsk(e.target.value)} rows={2} placeholder="For example: total of column C where column A says Travel" className="w-full resize-none rounded-lg border border-black/10 p-2 text-sm outline-none focus:border-[#7c3aed]" />
				<Button size="sm" disabled={busy || ask.trim().length < 3} onClick={run} className="gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Write the formula</Button>
				{help && (
					<div className="space-y-2 rounded-xl bg-[#f5f0ff] p-3 text-sm">
						<code className="block break-all rounded-md bg-white p-2 font-mono text-[13px]">{help.formula}</code>
						<p className="text-[#37352f]">{help.explanation}</p>
						{help.insight && <p className="flex gap-1.5 text-xs text-[#5f5e5b]"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{help.insight}</p>}
						<div className="flex flex-wrap gap-2">
							<Button size="sm" onClick={() => put(help.formula)} className="bg-sauti-teal hover:bg-sauti-dark">Put it in the selected cell</Button>
						</div>
						{help.alternatives.map((a) => <button key={a} onClick={() => put(a)} className="block w-full break-all rounded-md border border-black/10 bg-white p-1.5 text-left font-mono text-xs hover:border-sauti-teal">{a}</button>)}
					</div>
				)}
			</div>

			<div className="space-y-2 p-3 pb-1">
				<label className="relative block">
					<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b9a97]" />
					<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search functions" aria-label="Search functions" className="h-9 w-full rounded-lg border border-black/10 pl-8 pr-2 text-sm outline-none focus:border-sauti-teal" />
				</label>
				<div className="flex flex-wrap gap-1">
					{["All", "Maths", "Statistics", "Logic", "Lookup", "Text", "Dates"].map((c) => (
						<button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", cat === c ? "bg-sauti-teal-light text-sauti-dark" : "text-[#787774] hover:bg-black/5")}>{c}</button>
					))}
				</div>
			</div>
			<ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 pt-1">
				{list.map((f) => (
					<li key={f.name} className="rounded-lg border border-black/[0.07] p-2.5 hover:border-sauti-teal/40">
						<p className="flex items-baseline gap-2"><span className="font-mono text-sm font-bold">{f.name}</span><span className="truncate font-mono text-[11px] text-[#9b9a97]">{f.syntax}</span></p>
						<p className="text-xs text-[#5f5e5b]">{f.about}</p>
						<button onClick={() => put(f.example)} className="mt-1 block max-w-full truncate rounded bg-black/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-sauti-dark hover:bg-sauti-teal-light" title="Put this example in the selected cell">{f.example}</button>
					</li>
				))}
				{list.length === 0 && <li className="p-4 text-center text-sm text-[#787774]">No function matches.</li>}
			</ul>
		</aside>
	);
}
