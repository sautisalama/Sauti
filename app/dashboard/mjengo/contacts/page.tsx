"use client";

import { SHARE_EMAIL_UI } from "@/lib/client/flags";
import { MjengoLoader } from "../_components/MjengoLoader";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Globe, Loader2, Lock, Mail, MoreVertical, Pencil, Phone, Plus, Search, Share2, Tag, Trash2, Upload, UserRound } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RecipientField } from "../mail/_components/RecipientField";
import { listAdmins, type AdminLite } from "@/app/actions/mjengo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import * as raw from "@/app/actions/mjengo-contacts";
import type { ContactRow } from "@/app/actions/mjengo-contacts";

const api = {
	list: (...a: Parameters<typeof raw.listContacts>) => unwrap(raw.listContacts(...a)),
	save: (...a: Parameters<typeof raw.saveContact>) => unwrap(raw.saveContact(...a)),
	remove: (...a: Parameters<typeof raw.deleteContact>) => unwrap(raw.deleteContact(...a)),
	import: (...a: Parameters<typeof raw.importContacts>) => unwrap(raw.importContacts(...a)),
};

const SOURCE: Record<ContactRow["source"], string> = { manual: "Added by hand", google: "Google", csv: "Imported", mail: "From email" };

/** Minimal CSV parser (quotes, commas, newlines). */
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cur = "";
	let q = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (q) {
			if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
			else if (c === '"') q = false;
			else cur += c;
		} else if (c === '"') q = true;
		else if (c === ",") { row.push(cur); cur = ""; }
		else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(cur); cur = "";
			if (row.some((x) => x.trim())) rows.push(row);
			row = [];
		} else cur += c;
	}
	row.push(cur);
	if (row.some((x) => x.trim())) rows.push(row);
	return rows;
}

/** Works with Google Contacts and Outlook exports: picks the columns it recognises. */
function contactsFromCsv(text: string) {
	const [head, ...body] = parseCsv(text);
	if (!head) return [];
	const h = head.map((x) => x.trim().toLowerCase());
	const find = (...names: string[]) => h.findIndex((x) => names.some((n) => x === n || x.startsWith(n)));
	const iFirst = find("first name", "given name");
	const iLast = find("last name", "family name");
	const iName = find("name", "display name", "full name");
	const iEmail = find("e-mail 1 - value", "email 1 - value", "e-mail address", "email address", "email", "e-mail");
	const iPhone = find("phone 1 - value", "mobile phone", "primary phone", "phone");
	const iOrg = find("organization name", "organization 1 - name", "company", "organisation");
	const iTitle = find("organization title", "organization 1 - title", "job title", "title");
	return body.map((r) => {
		const full = [r[iFirst], r[iLast]].filter(Boolean).join(" ").trim();
		return { name: (iName >= 0 && r[iName]) || full || r[iEmail] || "", email: r[iEmail] || null, phone: r[iPhone] || null, organisation: r[iOrg] || null, title: r[iTitle] || null };
	});
}

export default function ContactsPage() {
	const { toast } = useToast();
	const [rows, setRows] = useState<ContactRow[] | null>(null);
	const [q, setQ] = useState("");
	const [edit, setEdit] = useState<Partial<ContactRow> | null>(null);
	const [busy, setBusy] = useState(false);
	const [importing, setImporting] = useState(false);
	const csv = useRef<HTMLInputElement>(null);
	const [tag, setTag] = useState<string | null>(null);
	const [sharing, setSharing] = useState<ContactRow | null>(null);

	const load = useCallback(async (term: string) => {
		try { setRows(await api.list(term)); } catch (e) { setRows([]); toast({ title: "Could not load contacts", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	}, [toast]);

	useEffect(() => {
		const t = setTimeout(() => load(q), 200);
		return () => clearTimeout(t);
	}, [q, load]);

	// Back from "Import from Google".
	useEffect(() => {
		const p = new URLSearchParams(window.location.search);
		const added = p.get("imported");
		const err = p.get("import_error");
		if (!added && !err) return;
		if (added) toast({ title: `Imported ${added} contact${added === "1" ? "" : "s"} from Google` });
		if (err) toast({ title: "Could not import from Google", description: err, variant: "destructive" });
		window.history.replaceState(null, "", window.location.pathname);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onCsv = async (file: File | undefined) => {
		if (!file) return;
		setBusy(true);
		try {
			const r = await api.import(contactsFromCsv(await file.text()), "csv");
			toast({ title: `Imported ${r.added} contact${r.added === 1 ? "" : "s"}`, description: r.skipped ? `${r.skipped} skipped (duplicates or no email).` : undefined });
			load(q);
		} catch (e) {
			toast({ title: "Could not import", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
			if (csv.current) csv.current.value = "";
		}
	};

	const tagCounts = new Map<string, number>();
	for (const r of rows ?? []) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
	const shown = (rows ?? []).filter((r) => !tag || r.tags.includes(tag));

	return (
		<div className="mx-auto max-w-6xl space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl font-bold tracking-tight text-sauti-dark">Contacts</h2>
					<p className="text-sm text-serene-neutral-500">People you work with, shared by the team. They appear as suggestions when you write an email.</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" className="gap-2" disabled={busy} onClick={() => setImporting(true)}>
						{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import
					</Button>
					<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={() => setEdit({})}><Plus className="h-4 w-4" /> Add contact</Button>
					<input ref={csv} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onCsv(e.target.files?.[0])} />
				</div>
			</div>

			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
				<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or organisation" className="bg-white pl-9" aria-label="Search contacts" />
			</div>

			{tagCounts.size > 0 && (
				<div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by tag">
					<Tag className="mr-0.5 h-4 w-4 text-serene-neutral-400" />
					<button onClick={() => setTag(null)} aria-pressed={tag === null} className={cn("rounded-full border px-3 py-1 text-xs font-medium", tag === null ? "border-sauti-teal bg-sauti-teal-light/60 text-sauti-dark" : "border-serene-neutral-200 bg-white text-serene-neutral-600")}>All {rows?.length ?? 0}</button>
					{[...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
						<button key={t} onClick={() => setTag((cur) => (cur === t ? null : t))} aria-pressed={tag === t} className={cn("rounded-full border px-3 py-1 text-xs font-medium", tag === t ? "border-sauti-teal bg-sauti-teal-light/60 text-sauti-dark" : "border-serene-neutral-200 bg-white text-serene-neutral-600")}>{t} <span className="text-serene-neutral-400">{n}</span></button>
					))}
				</div>
			)}

			<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
				{!rows ? (
					<MjengoLoader label="Loading contacts" />
				) : shown.length === 0 ? (
					<div className="p-12 text-center">
						<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sauti-teal-light text-sauti-teal"><UserRound className="h-6 w-6" /></span>
						<p className="text-sm font-medium text-sauti-dark">{q ? "No contacts match." : "No contacts yet"}</p>
						{!q && <p className="mt-1 text-sm text-serene-neutral-500">Add one, import a CSV or your Google contacts, or add people from an email you received.</p>}
					</div>
				) : (
					<ul className="divide-y divide-serene-neutral-100">
						{shown.map((c) => (
							<li key={c.id} className="flex items-center gap-3 p-3 hover:bg-serene-neutral-50/60">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sauti-teal-light text-sm font-bold text-sauti-teal">{(c.name || "?").charAt(0).toUpperCase()}</span>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-semibold text-serene-neutral-900">{c.name}</p>
									<p className="flex flex-wrap items-center gap-x-3 text-xs text-serene-neutral-500">
										{c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
										{c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
										{(c.organisation || c.title) && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{[c.title, c.organisation].filter(Boolean).join(", ")}</span>}
									</p>
									{c.tags.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{c.tags.map((t) => <button key={t} onClick={() => setTag(t)} className="rounded-full bg-sauti-teal-light/60 px-2 py-0.5 text-[10px] font-medium text-sauti-dark hover:bg-sauti-teal-light">{t}</button>)}</p>}
								</div>
								<button type="button" onClick={() => setSharing(c)} title={c.visibility === "private" ? `Only the people it is shared with${c.sharedWith ? ` (${c.sharedWith})` : ""}` : "Everyone on the team"} className={cn("hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] sm:flex", c.visibility === "private" ? "bg-amber-50 text-amber-800" : "bg-serene-neutral-100 text-serene-neutral-600")}>
									{c.visibility === "private" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}{c.visibility === "private" ? `Shared with ${c.sharedWith}` : "Team"}
								</button>
								<span className="hidden rounded-full bg-serene-neutral-100 px-2 py-0.5 text-[11px] text-serene-neutral-600 md:inline">{SOURCE[c.source]}</span>
								{c.email && (
									<Button asChild size="icon" variant="ghost" aria-label={`Write to ${c.name}`}>
										<Link href={`/dashboard/mjengo/mail?to=${encodeURIComponent(c.email)}`}><Mail className="h-4 w-4" /></Link>
									</Button>
								)}
								<DropdownMenu>
									<DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${c.name}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => setEdit(c)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setSharing(c)}><Share2 className="mr-2 h-4 w-4" /> Share</DropdownMenuItem>
										<DropdownMenuItem className="text-red-600" onClick={async () => {
											if (!window.confirm(`Delete ${c.name}?`)) return;
											try { await api.remove(c.id); load(q); } catch (e) { toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
										}}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</li>
						))}
					</ul>
				)}
			</div>

			<Dialog open={importing} onOpenChange={setImporting}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Import contacts</DialogTitle>
						<DialogDescription>Choose where your contacts are. People already in the book are skipped.</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<a href="/api/mjengo/contacts/google/start" className="flex items-center gap-3 rounded-xl border border-serene-neutral-200 bg-white p-3 transition hover:border-sauti-teal/40 hover:bg-sauti-teal-light/30">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-bold text-[#4285F4] ring-1 ring-serene-neutral-200">G</span>
							<span className="min-w-0"><span className="block text-sm font-semibold text-sauti-dark">Continue with Google</span><span className="block text-xs text-serene-neutral-500">Read-only, once. Nothing is kept after the import.</span></span>
						</a>
						<button type="button" onClick={() => { setImporting(false); csv.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl border border-serene-neutral-200 bg-white p-3 text-left transition hover:border-sauti-teal/40 hover:bg-sauti-teal-light/30">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal"><Upload className="h-5 w-5" /></span>
							<span className="min-w-0"><span className="block text-sm font-semibold text-sauti-dark">A CSV file</span><span className="block text-xs text-serene-neutral-500">From Google Contacts, Outlook or a spreadsheet.</span></span>
						</button>
					</div>
				</DialogContent>
			</Dialog>

			<ContactShareDialog contact={sharing} onClose={() => { setSharing(null); load(q); }} />
			<ContactDialog
				contact={edit}
				onClose={() => setEdit(null)}
				onSave={async (v) => {
					await api.save((edit?.id as string | undefined) ?? null, v);
					setEdit(null);
					load(q);
				}}
			/>
		</div>
	);
}

function ContactDialog({ contact, onClose, onSave }: { contact: Partial<ContactRow> | null; onClose: () => void; onSave: (v: { name: string; email: string; phone: string; organisation: string; title: string; tags: string[]; notes: string }) => Promise<void> }) {
	const { toast } = useToast();
	const [f, setF] = useState({ name: "", email: "", phone: "", organisation: "", title: "", tags: "", notes: "" });
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		if (contact) setF({ name: contact.name ?? "", email: contact.email ?? "", phone: contact.phone ?? "", organisation: contact.organisation ?? "", title: contact.title ?? "", tags: (contact.tags ?? []).join(", "), notes: contact.notes ?? "" });
	}, [contact]);
	const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

	return (
		<Dialog open={!!contact} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{contact?.id ? "Edit contact" : "Add contact"}</DialogTitle>
					<DialogDescription>Visible to every administrator in the suite.</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={f.name} onChange={set("name")} autoFocus /></div>
					<div className="space-y-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" value={f.email} onChange={set("email")} /></div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5"><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" value={f.phone} onChange={set("phone")} /></div>
						<div className="space-y-1.5"><Label htmlFor="c-title">Role</Label><Input id="c-title" value={f.title} onChange={set("title")} /></div>
					</div>
					<div className="space-y-1.5"><Label htmlFor="c-org">Organisation</Label><Input id="c-org" value={f.organisation} onChange={set("organisation")} /></div>
					<div className="space-y-1.5"><Label htmlFor="c-tags">Tags</Label><Input id="c-tags" value={f.tags} onChange={set("tags")} placeholder="funder, partner, media" /></div>
					<div className="space-y-1.5"><Label htmlFor="c-notes">Notes</Label><Textarea id="c-notes" rows={3} value={f.notes} onChange={set("notes")} /></div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || (!f.name.trim() && !f.email.trim())} onClick={async () => {
						setBusy(true);
						try {
							await onSave({ ...f, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean) });
						} catch (e) {
							toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
						} finally {
							setBusy(false);
						}
					}}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}


/** Who can see a contact: everyone on the team, or only the people it is shared with (like a file). */
function ContactShareDialog({ contact, onClose }: { contact: ContactRow | null; onClose: () => void }) {
	const { toast } = useToast();
	const [view, setView] = useState<raw.ContactAccess | null>(null);
	const [team, setTeam] = useState<AdminLite[]>([]);
	const [adding, setAdding] = useState("");
	const [level, setLevel] = useState<"view" | "edit">("view");
	const [notify, setNotify] = useState(SHARE_EMAIL_UI);
	const [busy, setBusy] = useState(false);

	const refresh = useCallback(async () => {
		if (!contact) return;
		try { setView(await unwrap(raw.contactAccess(contact.id))); } catch (e) { toast({ title: "Could not load sharing", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	}, [contact, toast]);
	useEffect(() => {
		setView(null); setAdding("");
		if (contact) { void refresh(); listAdmins().then(setTeam).catch(() => setTeam([])); }
	}, [contact, refresh]);

	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		try { await fn(); await refresh(); } catch (e) { toast({ title: "Could not update sharing", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	const emails = adding.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
	const byEmail = new Map(team.map((t) => [t.email ?? "", t]));
	const add = () => run(async () => {
		const outside = emails.filter((e) => !byEmail.has(e));
		if (outside.length) throw new Error(`${outside.join(", ")} ${outside.length === 1 ? "is" : "are"} not on the team. Contacts are shared with team members only.`);
		for (const e of emails) await unwrap(raw.setContactAccess(contact!.id, byEmail.get(e)!.id, level, notify));
		setAdding("");
	});

	return (
		<Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="truncate pr-6">Share {contact?.name}</DialogTitle>
					<DialogDescription>Contacts made from your email are private to the people on that message. Share them with others like a file.</DialogDescription>
				</DialogHeader>
				{!view ? <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /></div> : (
					<div className="space-y-4">
						<label className="flex items-center justify-between gap-4 rounded-xl bg-serene-neutral-50 p-3 text-sm">
							<span><span className="font-medium">Everyone on the team can see this contact</span><span className="block text-xs text-serene-neutral-500">{view.visibility === "team" ? "Switch off to keep it to the people below." : "Switch on to put it in the shared contact book."}</span></span>
							<Switch checked={view.visibility === "team"} disabled={busy || !view.canManage} onCheckedChange={(on) => run(() => unwrap(raw.setContactVisibility(contact!.id, on ? "team" : "private")))} aria-label="Visible to the whole team" />
						</label>
						{view.visibility === "private" && (
							<>
								<div className="space-y-2">
									<div className="min-h-11 rounded-xl border border-serene-neutral-200 bg-white px-2.5 focus-within:border-sauti-teal"><RecipientField value={adding} onChange={setAdding} placeholder="Add teammates by name or email" /></div>
									{emails.length > 0 && (
										<div className="flex flex-wrap items-center gap-3">
											<select value={level} onChange={(e) => setLevel(e.target.value as "view" | "edit")} aria-label="Access" className="h-9 rounded-md border border-serene-neutral-200 bg-white px-2 text-sm"><option value="view">Can view</option><option value="edit">Can edit</option></select>
											{SHARE_EMAIL_UI && <label className="flex items-center gap-2 text-sm"><Switch checked={notify} onCheckedChange={setNotify} aria-label="Email them" /> Email them</label>}
											<Button size="sm" disabled={busy} onClick={add} className="ml-auto bg-sauti-teal hover:bg-sauti-dark">Share</Button>
										</div>
									)}
								</div>
								<ul className="divide-y divide-serene-neutral-100">
									{view.owner && <li className="flex items-center gap-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-medium">{view.owner.name} <span className="font-normal text-serene-neutral-500">(owner)</span></span><span className="text-xs text-serene-neutral-500">Full access</span></li>}
									{view.people.map((p) => (
										<li key={p.id} className="flex items-center gap-3 py-2 text-sm">
											<span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.name}</span><span className="block truncate text-xs text-serene-neutral-500">{p.email}</span></span>
											<select value={p.level} disabled={busy || !view.canManage} onChange={(e) => run(() => e.target.value === "none" ? unwrap(raw.setContactAccess(contact!.id, p.id, null)) : unwrap(raw.setContactAccess(contact!.id, p.id, e.target.value as "view" | "edit", false)))} aria-label={`Access for ${p.name}`} className="h-8 rounded-md border border-serene-neutral-200 bg-white px-1.5 text-xs">
												<option value="view">Can view</option><option value="edit">Can edit</option><option value="none">Remove</option>
											</select>
										</li>
									))}
									{view.people.length === 0 && <li className="py-3 text-xs text-serene-neutral-500">Nobody else has this contact yet.</li>}
								</ul>
							</>
						)}
					</div>
				)}
				<DialogFooter><Button onClick={onClose} className="bg-sauti-teal hover:bg-sauti-dark">Done</Button></DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
