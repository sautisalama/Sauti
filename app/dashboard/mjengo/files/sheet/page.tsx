"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Loader2, Save } from "lucide-react";
import * as XLSX from "xlsx";
import "@univerjs/preset-sheets-core/lib/index.css";
import { Button } from "@/components/ui/button";
import { AiStar } from "@gamine/wordcraft-react";
import { ArrowUp, X } from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { aiTable } from "@/app/actions/mjengo-assist";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { putToSignedUrl } from "@/lib/client/upload";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { finishReplace, getFileUrl, prepareReplace, prepareUpload, registerUpload } from "../../vault/api";

type Cell = { v?: string | number | boolean; f?: string };
type CellData = Record<number, Record<number, Cell>>;
interface SheetSnapshot { id: string; name: string; cellData: CellData; rowCount: number; columnCount: number }

/** Turn an Excel or CSV workbook into the sheets Univer shows, keeping values and formulas. */
function toSheets(wb: XLSX.WorkBook): SheetSnapshot[] {
	return wb.SheetNames.map((name, i) => {
		const ws = wb.Sheets[name];
		const ref = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
		const cellData: CellData = {};
		for (let r = ref.s.r; r <= ref.e.r; r++) {
			for (let c = ref.s.c; c <= ref.e.c; c++) {
				const cell = ws[XLSX.utils.encode_cell({ r, c })];
				if (!cell) continue;
				const out: Cell = {};
				if (cell.f) out.f = cell.f.startsWith("=") ? cell.f : `=${cell.f}`;
				if (cell.v !== undefined) out.v = cell.v as string | number | boolean;
				(cellData[r] ??= {})[c] = out;
			}
		}
		return { id: `sheet-${i + 1}`, name: name.slice(0, 31), cellData, rowCount: Math.max(100, ref.e.r + 20), columnCount: Math.max(26, ref.e.c + 6) };
	});
}

/** And back: Univer's snapshot to a workbook file. */
function toWorkbook(snapshot: { sheets: Record<string, { name?: string; cellData?: CellData }>; sheetOrder?: string[] }): XLSX.WorkBook {
	const wb = XLSX.utils.book_new();
	const order = snapshot.sheetOrder?.length ? snapshot.sheetOrder : Object.keys(snapshot.sheets);
	order.forEach((id, i) => {
		const s = snapshot.sheets[id];
		if (!s) return;
		const ws: XLSX.WorkSheet = {};
		let maxR = 0, maxC = 0;
		for (const [rs, row] of Object.entries(s.cellData ?? {})) {
			for (const [cs, cell] of Object.entries(row as Record<string, Cell>)) {
				const r = Number(rs), c = Number(cs);
				if (cell.v === undefined && !cell.f) continue;
				const addr = XLSX.utils.encode_cell({ r, c });
				const v = cell.v;
				ws[addr] = { t: typeof v === "number" ? "n" : typeof v === "boolean" ? "b" : "s", v: v as never, ...(cell.f ? { f: cell.f.replace(/^=/, "") } : {}) } as XLSX.CellObject;
				maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
			}
		}
		ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
		XLSX.utils.book_append_sheet(wb, ws, (s.name || `Sheet${i + 1}`).slice(0, 31));
	});
	return wb;
}

const extOf = (n: string) => n.split(".").pop()?.toLowerCase() ?? "";

function SheetScreen() {
	const { toast } = useToast();
	const params = useSearchParams();
	const initialFile = params.get("file");
	const folderParam = params.get("folder");

	const host = useRef<HTMLDivElement>(null);
	const api = useRef<{ getActiveWorkbook: () => { save: () => never } | null } | null>(null);
	const disposer = useRef<(() => void) | null>(null);
	const [fileId, setFileId] = useState<string | null>(initialFile);
	const [name, setName] = useState("Untitled spreadsheet.xlsx");
	const [level, setLevel] = useState<"view" | "share" | "edit">("edit");
	const [folderId, setFolderId] = useState<string | null>(folderParam);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [ask, setAsk] = useState(false);
	const [askText, setAskText] = useState("");
	const [asking, setAsking] = useState(false);

	// Open the file, then start the spreadsheet.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				let sheets: SheetSnapshot[] = [{ id: "sheet-1", name: "Sheet1", cellData: {}, rowCount: 100, columnCount: 26 }];
				if (initialFile) {
					const info = await getFileUrl(initialFile);
					const res = await fetch(info.url);
					if (!res.ok) throw new Error("Could not download the file.");
					const wb = XLSX.read(await res.arrayBuffer(), { type: "array", cellFormula: true });
					sheets = toSheets(wb);
					if (cancelled) return;
					setName(info.name);
					setLevel(info.level);
					setFolderId(info.folderId);
				}
				if (cancelled || !host.current) return;
				const [{ createUniver, LocaleType, mergeLocales }, { UniverSheetsCorePreset }, locale] = await Promise.all([
					import("@univerjs/presets"),
					import("@univerjs/preset-sheets-core"),
					import("@univerjs/preset-sheets-core/locales/en-US"),
				]);
				if (cancelled || !host.current) return;
				const { univer, univerAPI } = createUniver({
					locale: LocaleType.EN_US,
					locales: { [LocaleType.EN_US]: mergeLocales(locale.default) },
					presets: [UniverSheetsCorePreset({ container: host.current })],
				});
				univerAPI.createWorkbook({
					id: "workbook-1",
					name: "Workbook",
					sheetOrder: sheets.map((s) => s.id),
					sheets: Object.fromEntries(sheets.map((s) => [s.id, s])),
				} as never);
				api.current = univerAPI as never;
				disposer.current = () => univer.dispose();
			} catch (e) {
				toast({ title: "Could not open the spreadsheet", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; disposer.current?.(); disposer.current = null; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialFile]);

	const bytes = useCallback((): Uint8Array => {
		const snap = api.current?.getActiveWorkbook()?.save() as unknown as { sheets: Record<string, { name?: string; cellData?: CellData }>; sheetOrder?: string[] } | undefined;
		if (!snap) throw new Error("The spreadsheet is not ready yet.");
		const asCsv = extOf(name) === "csv";
		const wb = toWorkbook(snap);
		if (asCsv) return new TextEncoder().encode(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]));
		return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
	}, [name]);

	const mime = extOf(name) === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
	const finalName = /\.(xlsx|csv|xls)$/i.test(name) ? name.replace(/\.xls$/i, ".xlsx") : `${name}.xlsx`;

	const save = async () => {
		setSaving(true);
		try {
			const data = bytes();
			const blob = new File([data as BlobPart], finalName, { type: mime });
			if (fileId && level === "edit") {
				const { signedUrl } = await prepareReplace(fileId);
				await putToSignedUrl(signedUrl, blob);
				await finishReplace(fileId, blob.size);
			} else {
				const target = level === "edit" || !fileId ? folderId : null;
				const { path, signedUrl } = await prepareUpload(target, finalName, blob.size);
				await putToSignedUrl(signedUrl, blob);
				const created = await registerUpload(target, path, finalName, blob.size, mime);
				setFileId(created.id);
				setLevel("edit");
				setName(finalName);
				window.history.replaceState(null, "", `/dashboard/mjengo/files/sheet?file=${created.id}`);
			}
			toast({ title: "Saved to Files", description: finalName });
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setSaving(false);
		}
	};

	/** Let the AI draft a block of cells, placed under whatever is on the sheet already. */
	const fillWithAi = async () => {
		setAsking(true);
		try {
			const snap = api.current?.getActiveWorkbook()?.save() as unknown as { sheets: Record<string, { cellData?: CellData }>; sheetOrder?: string[] } | undefined;
			const first = snap?.sheets[snap.sheetOrder?.[0] ?? Object.keys(snap.sheets)[0]];
			const rowsUsed = Object.keys(first?.cellData ?? {}).map(Number);
			const lastRow = rowsUsed.length ? Math.max(...rowsUsed) : -1;
			const context = Array.from({ length: Math.min(lastRow + 1, 30) }, (_, r) => {
				const row = first?.cellData?.[r] ?? {};
				const cols = Object.keys(row).map(Number);
				return Array.from({ length: cols.length ? Math.max(...cols) + 1 : 0 }, (_, c) => String(row[c]?.v ?? "")).join("\t");
			}).join("\n");
			const out = await unwrap(aiTable(askText, context));
			const sheet = (api.current as unknown as { getActiveWorkbook: () => { getActiveSheet: () => { getRange: (r: number, c: number, nr: number, nc: number) => { setValues: (v: (string | number)[][]) => void } } } }).getActiveWorkbook().getActiveSheet();
			const width = Math.max(...out.rows.map((r) => r.length));
			const padded = out.rows.map((r) => [...r, ...Array(width - r.length).fill("")]);
			sheet.getRange(lastRow >= 0 ? lastRow + 2 : 0, 0, padded.length, width).setValues(padded);
			toast({ title: "Added to the sheet", description: out.note });
			setAsk(false);
			setAskText("");
		} catch (e) {
			toast({ title: "Could not fill the sheet", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setAsking(false);
		}
	};

	const download = () => {
		try {
			const url = URL.createObjectURL(new Blob([bytes() as BlobPart], { type: mime }));
			const a = document.createElement("a");
			a.href = url;
			a.download = finalName;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			toast({ title: "Could not download", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	};

	return (
		<div className="relative flex h-full min-h-0 flex-col bg-white">
			<div className="flex shrink-0 items-center gap-2 border-b border-black/[0.07] px-3 py-1.5">
				<Button asChild variant="ghost" size="icon" aria-label="Back to Files"><Link href="/dashboard/mjengo/vault"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>
				<Input value={name} onChange={(e) => setName(e.target.value)} aria-label="File name" className="h-9 min-w-0 flex-1 border-transparent sm:max-w-xs sm:flex-none bg-transparent px-2 text-[15px] font-medium shadow-none hover:border-black/10 focus-visible:ring-1" />
				{level !== "edit" && <span className="hidden text-xs text-[#787774] sm:inline">View only: saving makes your own copy</span>}
				<span className="hidden flex-1 sm:block" />
				<Button variant="ghost" size="sm" className="gap-1.5" onClick={download} disabled={loading}><Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span></Button>
				<Button size="sm" className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={save} disabled={loading || saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
			</div>
			<div className="relative min-h-0 flex-1">
				{loading && <div className="absolute inset-0 z-10 bg-white"><MjengoLoader label="Opening the spreadsheet" className="h-full" /></div>}
				<div ref={host} className="univer-host h-full w-full" />
			</div>
			{/* The same sparkle at the bottom centre as the document editor, opening a prompt bar. */}
			{!loading && (
				<div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
					{ask ? (
						<form
							onSubmit={(e) => { e.preventDefault(); if (askText.trim().length >= 4 && !asking) fillWithAi(); }}
							className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-black/10 bg-white py-1.5 pl-4 pr-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.16)]"
						>
							<span className="text-[#7c3aed]"><AiStar size={20} /></span>
							<input
								autoFocus
								value={askText}
								onChange={(e) => setAskText(e.target.value)}
								onKeyDown={(e) => { if (e.key === "Escape") setAsk(false); }}
								placeholder="Describe a table, budget or tracker to add to this sheet"
								aria-label="Ask AI"
								className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9b9a97]"
							/>
							<button type="submit" disabled={asking || askText.trim().length < 4} aria-label="Add to the sheet" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7c3aed] text-white disabled:opacity-40">{asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</button>
							<button type="button" onClick={() => setAsk(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-[#787774] hover:bg-black/5"><X className="h-4 w-4" /></button>
						</form>
					) : (
						<button onClick={() => setAsk(true)} aria-label="Ask AI" title="Ask AI" className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-white text-[#7c3aed] shadow-[0_8px_30px_rgba(0,0,0,0.16)] transition hover:scale-105"><AiStar size={22} /></button>
					)}
				</div>
			)}
		</div>
	);
}

export default function SheetPage() {
	return (
		<Suspense fallback={<MjengoLoader label="Opening the spreadsheet" className="h-full min-h-0" />}>
			<SheetScreen />
		</Suspense>
	);
}
