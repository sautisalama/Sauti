"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Loader2, Save } from "lucide-react";
import * as XLSX from "xlsx";
import "@univerjs/preset-sheets-core/lib/index.css";
import { Button } from "@/components/ui/button";
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
		<div className="flex h-full min-h-0 flex-col bg-white">
			<div className="flex shrink-0 items-center gap-2 border-b border-black/[0.07] px-3 py-1.5">
				<Button asChild variant="ghost" size="icon" aria-label="Back to Files"><Link href="/dashboard/mjengo/vault"><ArrowLeft className="h-[18px] w-[18px]" /></Link></Button>
				<Input value={name} onChange={(e) => setName(e.target.value)} aria-label="File name" className="h-9 max-w-xs border-transparent bg-transparent px-2 text-[15px] font-medium shadow-none hover:border-black/10 focus-visible:ring-1" />
				{level !== "edit" && <span className="text-xs text-[#787774]">View only: saving makes your own copy</span>}
				<span className="flex-1" />
				<Button variant="ghost" size="sm" className="gap-1.5" onClick={download} disabled={loading}><Download className="h-4 w-4" /> Download</Button>
				<Button size="sm" className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={save} disabled={loading || saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
			</div>
			<div className="relative min-h-0 flex-1">
				{loading && <div className="absolute inset-0 z-10 bg-white"><MjengoLoader label="Opening the spreadsheet" className="h-full" /></div>}
				<div ref={host} className="h-full w-full" />
			</div>
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
