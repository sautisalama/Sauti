"use client";

import { R, fromCache, fresh, held } from "@/lib/client/resources";
import jsQR from "jsqr";
import { readReceiptQr, type ScannedReceipt } from "@/lib/finance/receipt-qr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Camera, QrCode, CheckCircle2, FileSpreadsheet, FileText, Loader2, Plus, Printer, Receipt, Trash2, Upload, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { trayStart } from "@/lib/client/upload-tray";
import { putToSignedUrl } from "@/lib/client/upload";
import {
	createBudgetFile, deleteFinanceInvoice, deleteFinanceReceipt, financeFiles, financeInvoices, financeReceiptUrl, financeReceipts,
	prepareReceiptUpload, saveFinanceInvoice, saveFinanceReceipt, setInvoiceStatus, tagFinanceFile, untagFinanceFile,
	type FinanceFile, type InvoiceItem, type InvoiceRow, type ReceiptRow,
} from "@/app/actions/finance";
import { deleteTemplate, listTemplates, saveTemplate, type TemplateRow } from "@/app/actions/mjengo-templates";
import { searchFiles } from "../vault/api";
import { MjengoLoader } from "../_components/MjengoLoader";

const CURRENCIES = ["KES", "USD", "EUR", "GBP"];
const fmt = (n: number, c: string) => `${c} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TONE: Record<InvoiceRow["status"], string> = { draft: "bg-slate-100 text-slate-700", sent: "bg-sky-100 text-sky-800", paid: "bg-emerald-100 text-emerald-800", void: "bg-rose-100 text-rose-700" };

export default function FinancePage() {
	const { toast } = useToast();
	const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
	const [receipts, setReceipts] = useState<ReceiptRow[] | null>(null);
	const [files, setFiles] = useState<FinanceFile[] | null>(null);
	const [templates, setTemplates] = useState<TemplateRow[]>([]);
	const [budgetTemplates, setBudgetTemplates] = useState<TemplateRow[]>([]);
	const [editing, setEditing] = useState<Partial<InvoiceRow> | null>(null);
	const [receiptSheet, setReceiptSheet] = useState(false);

	const fail = useCallback((title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : undefined, variant: "destructive" }), [toast]);
	const load = useCallback(async () => {
		const [i, r, f, t, b] = await Promise.all([
			fresh(R.invoices), fresh(R.receipts), fresh(R.financeFiles),
			fresh(R.templates("invoice")).catch(() => [] as TemplateRow[]), fresh(R.templates("budget")).catch(() => [] as TemplateRow[]),
		]);
		setInvoices(i); setReceipts(r); setFiles(f); setTemplates(t); setBudgetTemplates(b);
	}, []);
	useEffect(() => {
		// What was loaded before paints first; the fresh copy replaces it.
		const i = held(R.invoices), r = held(R.receipts), f = held(R.financeFiles);
		if (i && r && f) { setInvoices(i); setReceipts(r); setFiles(f); setTemplates(held(R.templates("invoice")) ?? []); setBudgetTemplates(held(R.templates("budget")) ?? []); }
		load().catch((e) => fail("Could not load Finance", e));
	}, [load, fail]);

	const totals = useMemo(() => {
		const inv = invoices ?? [];
		const month = new Date().toISOString().slice(0, 7);
		return {
			outstanding: inv.filter((i) => i.status === "sent").reduce((n, i) => n + i.total, 0),
			overdue: inv.filter((i) => i.status === "sent" && i.due_date && i.due_date < new Date().toISOString().slice(0, 10)).length,
			paid: inv.filter((i) => i.status === "paid" && (i.paid_at ?? "").startsWith(month)).reduce((n, i) => n + i.total, 0),
			spent: (receipts ?? []).filter((r) => r.spent_on.startsWith(month)).reduce((n, r) => n + r.amount, 0),
		};
	}, [invoices, receipts]);

	if (!invoices || !receipts || !files) return <MjengoLoader label="Opening Finance" />;

	return (
		<div className="mx-auto max-w-5xl space-y-5">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-sauti-dark">Finance</h1>
					<p className="text-sm text-serene-neutral-500">Invoices, receipts and budgets in one place.</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" className="gap-1.5" onClick={() => setReceiptSheet(true)}><Camera className="h-4 w-4" /> Add a receipt</Button>
					<Button className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => setEditing({ items: [{ description: "", qty: 1, unit: 0 }], currency: "KES", tax_pct: 0, issue_date: new Date().toISOString().slice(0, 10) })}><Plus className="h-4 w-4" /> New invoice</Button>
				</div>
			</header>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Stat label="Waiting to be paid" value={fmt(totals.outstanding, "KES")} hint={totals.overdue ? `${totals.overdue} overdue` : "Nothing overdue"} warn={totals.overdue > 0} />
				<Stat label="Paid this month" value={fmt(totals.paid, "KES")} />
				<Stat label="Spent this month" value={fmt(totals.spent, "KES")} hint={`${(receipts ?? []).filter((r) => r.spent_on.startsWith(new Date().toISOString().slice(0, 7))).length} receipts`} />
				<Stat label="Budgets and sheets" value={String(files.length)} hint="Tagged Financial or Budget" />
			</div>

			<Tabs defaultValue="invoices">
				<TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b bg-transparent p-0">
					{[["invoices", "Invoices"], ["receipts", "Receipts"], ["budgets", "Budgets"], ["templates", "Templates"]].map(([v, l]) => (
						<TabsTrigger key={v} value={v} className="h-9 rounded-none border-b-2 border-transparent px-3 text-sm data-[state=active]:border-sauti-teal data-[state=active]:bg-transparent data-[state=active]:shadow-none">{l}</TabsTrigger>
					))}
				</TabsList>

				<TabsContent value="invoices" className="mt-4">
					{invoices.length === 0 ? <Empty icon={FileText} text="No invoices yet. Start one, or reuse a template." /> : (
						<ul className="divide-y divide-serene-neutral-100 rounded-2xl border border-serene-neutral-200/70 bg-white">
							{invoices.map((i) => (
								<li key={i.id}>
									<button onClick={() => setEditing(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-serene-neutral-50">
										<span className="w-28 shrink-0 font-mono text-xs text-serene-neutral-500">{i.number}</span>
										<span className="min-w-0 flex-1 truncate text-sm font-medium text-serene-neutral-900">{i.client_name}</span>
										<span className="hidden text-xs text-serene-neutral-500 sm:block">{i.due_date ? `due ${format(parseISO(i.due_date), "d MMM")}` : ""}</span>
										<span className="w-32 text-right text-sm tabular-nums">{fmt(i.total, i.currency)}</span>
										<span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", TONE[i.status])}>{i.status}</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</TabsContent>

				<TabsContent value="receipts" className="mt-4">
					{receipts.length === 0 ? <Empty icon={Receipt} text="No receipts yet. Take a photo or upload one." /> : (
						<ul className="grid gap-3 sm:grid-cols-2">
							{receipts.map((r) => (
								<li key={r.id} className="flex items-start gap-3 rounded-2xl border border-serene-neutral-200/70 bg-white p-4">
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal"><Receipt className="h-5 w-5" /></span>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-semibold text-serene-neutral-900">{r.vendor}</p>
										<p className="text-xs text-serene-neutral-500">{format(parseISO(r.spent_on), "d MMM yyyy")}{r.category ? ` · ${r.category}` : ""}</p>
										{r.note && <p className="mt-1 line-clamp-2 text-xs text-serene-neutral-600">{r.note}</p>}
										<div className="mt-2 flex gap-3 text-xs">
											{r.file_id && <button className="font-medium text-sauti-teal hover:underline" onClick={async () => { try { window.open(await unwrap(financeReceiptUrl(r.id)), "_blank", "noopener"); } catch (e) { fail("Could not open it", e); } }}>View the photo</button>}
											<button className="text-serene-neutral-400 hover:text-red-600" onClick={async () => { if (!window.confirm("Delete this receipt?")) return; try { await unwrap(deleteFinanceReceipt(r.id)); await load(); } catch (e) { fail("Could not delete", e); } }}>Delete</button>
										</div>
									</div>
									<p className="text-sm font-semibold tabular-nums">{fmt(r.amount, r.currency)}</p>
								</li>
							))}
						</ul>
					)}
				</TabsContent>

				<TabsContent value="budgets" className="mt-4">
					<Budgets files={files} templates={budgetTemplates} reload={load} fail={fail} />
				</TabsContent>

				<TabsContent value="templates" className="mt-4">
					<div className="grid gap-5 md:grid-cols-2">
						<TemplateList title="Invoice templates" hint="Save an invoice as a template from its editor, then start new ones from it." rows={templates} onUse={(t) => setEditing({ ...(t.data as Partial<InvoiceRow>), currency: (t.data as { currency?: string }).currency ?? "KES", issue_date: new Date().toISOString().slice(0, 10) })} onDelete={async (t) => { await unwrap(deleteTemplate(t.id)); await load(); }} />
						<TemplateList title="Budget templates" hint="Lines for a budget you build often. Create the sheet from the Budgets tab." rows={budgetTemplates} onUse={() => toast({ title: "Open the Budgets tab and pick it there." })} onDelete={async (t) => { await unwrap(deleteTemplate(t.id)); await load(); }} />
					</div>
				</TabsContent>
			</Tabs>

			<InvoiceSheet value={editing} onClose={() => setEditing(null)} templates={templates} onChanged={load} fail={fail} />
			<ReceiptSheet open={receiptSheet} onClose={() => setReceiptSheet(false)} onSaved={load} fail={fail} />
		</div>
	);
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
	return (
		<div className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4">
			<p className="text-xs font-medium text-serene-neutral-500">{label}</p>
			<p className="mt-1 text-lg font-bold tabular-nums text-sauti-dark">{value}</p>
			{hint && <p className={cn("text-xs", warn ? "text-amber-700" : "text-serene-neutral-400")}>{hint}</p>}
		</div>
	);
}

function Empty({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
	return <div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-10 text-center"><Icon className="mx-auto mb-2 h-7 w-7 text-serene-neutral-300" /><p className="text-sm text-serene-neutral-500">{text}</p></div>;
}

function TemplateList({ title, hint, rows, onUse, onDelete }: { title: string; hint: string; rows: TemplateRow[]; onUse: (t: TemplateRow) => void; onDelete: (t: TemplateRow) => Promise<void> }) {
	return (
		<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
			<h2 className="text-sm font-bold text-sauti-dark">{title}</h2>
			<p className="mb-3 text-xs text-serene-neutral-500">{hint}</p>
			{rows.length === 0 ? <p className="text-sm text-serene-neutral-400">None yet.</p> : (
				<ul className="divide-y divide-serene-neutral-100">
					{rows.map((t) => (
						<li key={t.id} className="flex items-center gap-2 py-2 text-sm">
							<span className="min-w-0 flex-1 truncate">{t.name}</span>
							<Button size="sm" variant="outline" onClick={() => onUse(t)}>Use</Button>
							<button aria-label={`Delete ${t.name}`} className="rounded p-1 text-serene-neutral-400 hover:text-red-600" onClick={() => void onDelete(t)}><Trash2 className="h-4 w-4" /></button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

/* --------------------------------------------------------------- Invoices */

function InvoiceSheet({ value, onClose, templates, onChanged, fail }: { value: Partial<InvoiceRow> | null; onClose: () => void; templates: TemplateRow[]; onChanged: () => Promise<void>; fail: (t: string, e: unknown) => void }) {
	const { toast } = useToast();
	const [v, setV] = useState<Partial<InvoiceRow>>({});
	const [busy, setBusy] = useState(false);
	useEffect(() => { setV(value ?? {}); }, [value]);
	const items: InvoiceItem[] = v.items ?? [];
	const subtotal = items.reduce((n, i) => n + (Number(i.qty) || 0) * (Number(i.unit) || 0), 0);
	const tax = (subtotal * (Number(v.tax_pct) || 0)) / 100;
	const cur = v.currency ?? "KES";
	const set = (patch: Partial<InvoiceRow>) => setV((x) => ({ ...x, ...patch }));
	const setItem = (idx: number, patch: Partial<InvoiceItem>) => set({ items: items.map((i, k) => (k === idx ? { ...i, ...patch } : i)) });

	const save = async (status?: InvoiceRow["status"]) => {
		setBusy(true);
		try {
			const row = await unwrap(saveFinanceInvoice(v.id ?? null, v));
			if (status && status !== row.status) await unwrap(setInvoiceStatus(row.id, status));
			await onChanged();
			toast({ title: status === "paid" ? "Marked as paid" : status === "sent" ? "Marked as sent" : "Invoice saved", description: row.number });
			if (!status) setV(row); else onClose();
		} catch (e) { fail("Could not save the invoice", e); } finally { setBusy(false); }
	};

	return (
		<Sheet open={!!value} onOpenChange={(o) => { if (!o) onClose(); }}>
			<SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
				<SheetHeader className="border-b p-4"><SheetTitle>{v.number ? `Invoice ${v.number}` : "New invoice"}</SheetTitle></SheetHeader>
				<div className="flex-1 space-y-4 overflow-y-auto p-4">
					{!v.id && templates.length > 0 && (
						<div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-serene-neutral-500">Start from</span>
							{templates.map((t) => <button key={t.id} onClick={() => set({ ...(t.data as Partial<InvoiceRow>) })} className="rounded-full border border-serene-neutral-200 px-3 py-1 text-xs hover:bg-serene-neutral-50">{t.name}</button>)}
						</div>
					)}
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="text-xs font-medium text-serene-neutral-500 sm:col-span-2">Client<Input value={v.client_name ?? ""} onChange={(e) => set({ client_name: e.target.value })} className="mt-1" /></label>
						<label className="text-xs font-medium text-serene-neutral-500">Client email<Input type="email" value={v.client_email ?? ""} onChange={(e) => set({ client_email: e.target.value })} className="mt-1" /></label>
						<label className="text-xs font-medium text-serene-neutral-500">Address<Input value={v.client_address ?? ""} onChange={(e) => set({ client_address: e.target.value })} className="mt-1" /></label>
						<label className="text-xs font-medium text-serene-neutral-500">Issued<Input type="date" value={v.issue_date ?? ""} onChange={(e) => set({ issue_date: e.target.value })} className="mt-1" /></label>
						<label className="text-xs font-medium text-serene-neutral-500">Due<Input type="date" value={v.due_date ?? ""} onChange={(e) => set({ due_date: e.target.value })} className="mt-1" /></label>
					</div>
					<div>
						<p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Items</p>
						<div className="space-y-2">
							{items.map((i, idx) => (
								<div key={idx} className="grid grid-cols-[1fr_4.5rem_6rem_1.5rem] items-center gap-2">
									<Input placeholder="Description" value={i.description} onChange={(e) => setItem(idx, { description: e.target.value })} />
									<Input type="number" min={0} aria-label="Quantity" value={i.qty} onChange={(e) => setItem(idx, { qty: Number(e.target.value) })} />
									<Input type="number" min={0} aria-label="Unit price" value={i.unit} onChange={(e) => setItem(idx, { unit: Number(e.target.value) })} />
									<button aria-label="Remove line" onClick={() => set({ items: items.filter((_, k) => k !== idx) })} className="text-serene-neutral-400 hover:text-red-600"><X className="h-4 w-4" /></button>
								</div>
							))}
						</div>
						<Button size="sm" variant="ghost" className="mt-1 gap-1" onClick={() => set({ items: [...items, { description: "", qty: 1, unit: 0 }] })}><Plus className="h-3.5 w-3.5" /> Add a line</Button>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<label className="text-xs font-medium text-serene-neutral-500">Currency
							<select value={cur} onChange={(e) => set({ currency: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-serene-neutral-200 bg-white px-2 text-sm">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
						</label>
						<label className="text-xs font-medium text-serene-neutral-500">Tax %<Input type="number" min={0} max={100} value={v.tax_pct ?? 0} onChange={(e) => set({ tax_pct: Number(e.target.value) })} className="mt-1" /></label>
					</div>
					<label className="block text-xs font-medium text-serene-neutral-500">Notes<Textarea rows={3} value={v.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} className="mt-1" placeholder="Payment details, thanks, terms" /></label>
					<div className="space-y-1 rounded-xl bg-serene-neutral-50 p-3 text-sm">
						<p className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{fmt(subtotal, cur)}</span></p>
						<p className="flex justify-between"><span>Tax</span><span className="tabular-nums">{fmt(tax, cur)}</span></p>
						<p className="flex justify-between font-bold"><span>Total</span><span className="tabular-nums">{fmt(subtotal + tax, cur)}</span></p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2 border-t p-3">
					{v.id && <Button variant="ghost" size="sm" className="gap-1 text-red-600" onClick={async () => { if (!window.confirm("Delete this invoice?")) return; try { await unwrap(deleteFinanceInvoice(v.id!)); await onChanged(); onClose(); } catch (e) { fail("Could not delete", e); } }}><Trash2 className="h-4 w-4" /></Button>}
					{v.id && <Button asChild variant="outline" size="sm" className="gap-1"><Link href={`/dashboard/mjengo/finance/invoice/${v.id}`} target="_blank"><Printer className="h-4 w-4" /> PDF</Link></Button>}
					<Button variant="outline" size="sm" disabled={busy || !(v.client_name ?? "").trim()} onClick={async () => { try { await unwrap(saveTemplate(null, { kind: "invoice", name: `${v.client_name || "Invoice"} template`, data: { client_name: v.client_name, client_email: v.client_email, client_address: v.client_address, items, currency: cur, tax_pct: v.tax_pct ?? 0, notes: v.notes } })); await onChanged(); toast({ title: "Saved as a template" }); } catch (e) { fail("Could not save the template", e); } }}>Save as template</Button>
					<span className="flex-1" />
					{v.id && v.status !== "paid" && <Button variant="outline" size="sm" disabled={busy} onClick={() => save("paid")} className="gap-1"><CheckCircle2 className="h-4 w-4" /> Paid</Button>}
					{v.id && v.status === "draft" && <Button variant="outline" size="sm" disabled={busy} onClick={() => save("sent")}>Mark sent</Button>}
					<Button size="sm" disabled={busy} onClick={() => save()} className="bg-sauti-teal hover:bg-sauti-dark">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
}

/* --------------------------------------------------------------- Receipts */

function ReceiptSheet({ open, onClose, onSaved, fail }: { open: boolean; onClose: () => void; onSaved: () => Promise<void>; fail: (t: string, e: unknown) => void }) {
	const { toast } = useToast();
	const [vendor, setVendor] = useState("");
	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState("KES");
	const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
	const [category, setCategory] = useState("");
	const [note, setNote] = useState("");
	const [photo, setPhoto] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const cam = useRef<HTMLInputElement>(null);
	const pick = useRef<HTMLInputElement>(null);
	const [scanning, setScanning] = useState(false);
	const [scanned, setScanned] = useState<ScannedReceipt | null>(null);
	const scanVideo = useRef<HTMLVideoElement>(null);

	/** A QR code was read: fill in what it says and file it as tax when it is from KRA. */
	const applyScan = useCallback((raw: string) => {
		const r = readReceiptQr(raw);
		setScanned(r);
		setVendor((v) => v || r.vendor);
		if (r.category) setCategory(r.category);
		setNote((n) => (n ? (n.includes(r.note) ? n : `${n}
${r.note}`) : r.note));
		toast({ title: r.tax ? "KRA receipt found: filed as tax" : "QR code read", description: r.link ?? undefined });
	}, [toast]);

	// Live camera scan: look for a code a few times a second until one is read.
	useEffect(() => {
		if (!scanning) return;
		let stop = false;
		let stream: MediaStream | null = null;
		let timer: ReturnType<typeof setInterval> | undefined;
		(async () => {
			try {
				stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
				if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
				const v = scanVideo.current;
				if (!v) return;
				v.srcObject = stream;
				await v.play().catch(() => undefined);
				const c = document.createElement("canvas");
				timer = setInterval(() => {
					if (!v.videoWidth) return;
					const k = Math.min(1, 720 / v.videoWidth);
					c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
					const x = c.getContext("2d", { willReadFrequently: true })!;
					x.drawImage(v, 0, 0, c.width, c.height);
					const hit = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
					if (hit?.data) { setScanning(false); applyScan(hit.data); }
				}, 250);
			} catch {
				setScanning(false);
				toast({ title: "The camera could not be opened", description: "Allow the camera, or choose a photo of the code instead.", variant: "destructive" });
			}
		})();
		return () => { stop = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
	}, [scanning, applyScan, toast]);

	// A photo or picture of the receipt is also checked for a code, so a KRA receipt is filed without scanning.
	useEffect(() => {
		if (!photo || !photo.type.startsWith("image/")) return;
		let dead = false;
		const url = URL.createObjectURL(photo);
		const img = new Image();
		img.onload = () => {
			if (dead) return;
			for (const k of [1, 0.5]) {
				const w = Math.round(Math.min(img.naturalWidth, 1600) * k), h = Math.round((img.naturalHeight * w) / img.naturalWidth);
				const c = document.createElement("canvas");
				c.width = w; c.height = h;
				const x = c.getContext("2d", { willReadFrequently: true })!;
				x.drawImage(img, 0, 0, w, h);
				const hit = jsQR(x.getImageData(0, 0, w, h).data, w, h);
				if (hit?.data) { applyScan(hit.data); break; }
			}
			URL.revokeObjectURL(url);
		};
		img.src = url;
		return () => { dead = true; };
	}, [photo, applyScan]);

	useEffect(() => { if (!open) { setVendor(""); setAmount(""); setNote(""); setCategory(""); setPhoto(null); setPreview(null); setScanning(false); setScanned(null); } }, [open]);
	useEffect(() => {
		if (!photo || !photo.type.startsWith("image/")) { setPreview(null); return; }
		const u = URL.createObjectURL(photo);
		setPreview(u);
		return () => URL.revokeObjectURL(u);
	}, [photo]);

	const save = async () => {
		setBusy(true);
		try {
			let upload: { path: string; name: string; size: number; mime: string | null } | undefined;
			if (photo) {
				const tray = trayStart(photo.name, photo.size);
				try {
					const { path, signedUrl } = await unwrap(prepareReceiptUpload(photo.name, photo.size));
					await putToSignedUrl(signedUrl, photo, (p) => tray.progress(p));
					tray.done();
					upload = { path, name: photo.name, size: photo.size, mime: photo.type || null };
				} catch (e) { tray.fail(e instanceof Error ? e.message : "Upload failed"); throw e; }
			}
			await unwrap(saveFinanceReceipt(null, { vendor, amount: Number(amount) || 0, currency, spent_on: date, category: category || null, note: note || null, upload }));
			await onSaved();
			toast({ title: "Receipt added" });
			onClose();
		} catch (e) { fail("Could not add the receipt", e); } finally { setBusy(false); }
	};

	return (
		<Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
			<SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
				<SheetHeader className="border-b p-4"><SheetTitle>Add a receipt</SheetTitle></SheetHeader>
				<div className="flex-1 space-y-4 overflow-y-auto p-4">
					<div className="rounded-2xl border border-dashed border-serene-neutral-300 p-4 text-center">
						{preview ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={preview} alt="Receipt" className="mx-auto max-h-56 rounded-lg object-contain" />
						) : photo ? <p className="flex items-center justify-center gap-2 text-sm"><FileText className="h-4 w-4" /> {photo.name}</p> : <p className="text-sm text-serene-neutral-500">Take a photo of the receipt, or choose a file.</p>}
						<div className="mt-3 flex justify-center gap-2">
							<Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => cam.current?.click()}><Camera className="h-4 w-4" /> Take a photo</Button>
							<Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => pick.current?.click()}><Upload className="h-4 w-4" /> Choose a file</Button>
							<Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setScanning((v) => !v)}><QrCode className="h-4 w-4" /> {scanning ? "Stop" : "Scan QR"}</Button>
						</div>
						{scanning && (
							<div className="mt-3 overflow-hidden rounded-xl bg-black">
								<video ref={scanVideo} playsInline muted className="mx-auto max-h-56 w-full object-cover" />
								<p className="bg-black/70 py-1.5 text-xs text-white">Hold the receipt&apos;s QR code in view</p>
							</div>
						)}
						{scanned && (
							<p className={"mt-3 rounded-lg px-3 py-2 text-left text-xs " + (scanned.tax ? "bg-emerald-50 text-emerald-800" : "bg-serene-neutral-50 text-serene-neutral-700")}>
								{scanned.tax ? "KRA receipt: filed as tax." : "Code read."}{scanned.pin ? ` Seller PIN ${scanned.pin}.` : ""} Check the amount and date, then save.
							</p>
						)}
						<input ref={cam} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
						<input ref={pick} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
					</div>
					<label className="block text-xs font-medium text-serene-neutral-500">Paid to<Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1" /></label>
					<div className="grid grid-cols-[1fr_6rem] gap-3">
						<label className="text-xs font-medium text-serene-neutral-500">Amount<Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></label>
						<label className="text-xs font-medium text-serene-neutral-500">Currency<select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-serene-neutral-200 bg-white px-2 text-sm">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<label className="text-xs font-medium text-serene-neutral-500">Date<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" /></label>
						<label className="text-xs font-medium text-serene-neutral-500">Category<Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Travel, supplies" className="mt-1" /></label>
					</div>
					<label className="block text-xs font-medium text-serene-neutral-500">Note<Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" /></label>
				</div>
				<div className="flex justify-end gap-2 border-t p-3">
					<Button variant="ghost" onClick={onClose}>Cancel</Button>
					<Button disabled={busy || !vendor.trim()} onClick={save} className="bg-sauti-teal hover:bg-sauti-dark">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save receipt"}</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
}

/* ---------------------------------------------------------------- Budgets */

function Budgets({ files, templates, reload, fail }: { files: FinanceFile[]; templates: TemplateRow[]; reload: () => Promise<void>; fail: (t: string, e: unknown) => void }) {
	const { toast } = useToast();
	const [name, setName] = useState("");
	const [lines, setLines] = useState<{ category: string; planned: number }[]>([{ category: "Personnel", planned: 0 }, { category: "Travel", planned: 0 }, { category: "Supplies", planned: 0 }]);
	const [busy, setBusy] = useState(false);
	const [q, setQ] = useState("");
	const [hits, setHits] = useState<{ id: string; name: string }[]>([]);
	useEffect(() => {
		if (q.trim().length < 2) { setHits([]); return; }
		const t = setTimeout(() => { searchFiles(q).then((r) => setHits(r.filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name)).slice(0, 8))).catch(() => setHits([])); }, 200);
		return () => clearTimeout(t);
	}, [q]);

	return (
		<div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,22rem)]">
			<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
				<h2 className="text-sm font-bold text-sauti-dark">Spreadsheets tagged Financial or Budget</h2>
				<p className="mb-3 text-xs text-serene-neutral-500">Tag an Excel file once and it is available here.</p>
				{files.length === 0 ? <p className="text-sm text-serene-neutral-400">Nothing tagged yet.</p> : (
					<ul className="divide-y divide-serene-neutral-100">
						{files.map((f) => (
							<li key={f.id} className="flex items-center gap-3 py-2.5">
								<FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
								<div className="min-w-0 flex-1">
									<Link href={f.kind === "sheet" ? `/dashboard/mjengo/files/sheet?file=${f.id}` : `/dashboard/mjengo/vault?open=${f.id}`} className="block truncate text-sm font-medium hover:underline">{f.name}</Link>
									<p className="text-xs text-serene-neutral-400">{f.tags.join(", ")} · updated {format(parseISO(f.updatedAt), "d MMM")}</p>
								</div>
								<button className="text-xs text-serene-neutral-400 hover:text-red-600" onClick={async () => { try { await unwrap(untagFinanceFile(f.id)); await reload(); } catch (e) { fail("Could not untag", e); } }}>Untag</button>
							</li>
						))}
					</ul>
				)}
				<div className="mt-4 border-t border-serene-neutral-100 pt-3">
					<p className="mb-1 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Tag a file</p>
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an Excel file by name" className="h-9" />
					{hits.map((h) => (
						<div key={h.id} className="flex items-center gap-2 py-1.5 text-sm">
							<span className="min-w-0 flex-1 truncate">{h.name}</span>
							<Button size="sm" variant="outline" onClick={async () => { try { await unwrap(tagFinanceFile(h.id, ["Financial"])); toast({ title: "Tagged Financial" }); setQ(""); await reload(); } catch (e) { fail("Could not tag it", e); } }}>Financial</Button>
							<Button size="sm" variant="outline" onClick={async () => { try { await unwrap(tagFinanceFile(h.id, ["Financial", "Budget"])); toast({ title: "Tagged Budget" }); setQ(""); await reload(); } catch (e) { fail("Could not tag it", e); } }}>Budget</Button>
						</div>
					))}
				</div>
			</section>

			<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
				<h2 className="flex items-center gap-2 text-sm font-bold text-sauti-dark"><Wallet className="h-4 w-4 text-sauti-teal" /> New budget</h2>
				{templates.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1.5">{templates.map((t) => <button key={t.id} onClick={() => { setName(t.name.replace(/ template$/i, "")); setLines(((t.data as { rows?: { category: string; planned: number }[] }).rows ?? []).map((r) => ({ ...r }))); }} className="rounded-full border border-serene-neutral-200 px-2.5 py-1 text-xs hover:bg-serene-neutral-50">{t.name}</button>)}</div>
				)}
				<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Budget name" className="mt-3 h-9" />
				<div className="mt-2 space-y-1.5">
					{lines.map((l, i) => (
						<div key={i} className="grid grid-cols-[1fr_6rem_1.25rem] items-center gap-1.5">
							<Input value={l.category} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, category: e.target.value } : x)))} className="h-8 text-sm" aria-label="Line" />
							<Input type="number" min={0} value={l.planned} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, planned: Number(e.target.value) } : x)))} className="h-8 text-sm" aria-label="Planned" />
							<button aria-label="Remove line" onClick={() => setLines(lines.filter((_, k) => k !== i))} className="text-serene-neutral-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
						</div>
					))}
				</div>
				<Button size="sm" variant="ghost" className="mt-1 gap-1" onClick={() => setLines([...lines, { category: "", planned: 0 }])}><Plus className="h-3.5 w-3.5" /> Add a line</Button>
				<div className="mt-3 flex gap-2">
					<Button size="sm" disabled={busy || !name.trim()} className="flex-1 bg-sauti-teal hover:bg-sauti-dark" onClick={async () => {
						setBusy(true);
						try { const r = await unwrap(createBudgetFile(name, lines)); toast({ title: "Budget created", description: "It is in Files, tagged Budget." }); await reload(); window.location.assign(`/dashboard/mjengo/files/sheet?file=${r.id}`); } catch (e) { fail("Could not create the budget", e); } finally { setBusy(false); }
					}}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create the sheet"}</Button>
					<Button size="sm" variant="outline" disabled={!name.trim()} onClick={async () => { try { await unwrap(saveTemplate(null, { kind: "budget", name: `${name} template`, data: { rows: lines } })); toast({ title: "Saved as a template" }); await reload(); } catch (e) { fail("Could not save the template", e); } }}>Save as template</Button>
				</div>
			</section>
		</div>
	);
}
