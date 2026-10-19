"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { AlertTriangle, Bell, CheckCheck, FileSignature, FileText, Inbox, Lightbulb, Loader2, Mail, Phone, Plus, Smartphone, Sparkles, SquareCheck, Activity, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unwrap } from "@/lib/action-result";
import { catchUp, digestBrief, getDigest, type DigestItem } from "@/app/actions/mjengo-workflow";
import { confirmSharedFile, getCaughtUp, getMailToAnswer, type CaughtUp, type MailToAnswer } from "@/app/actions/mjengo-caughtup";
import type { DigestKind } from "@/lib/mjengo/digest";
import { Markdown } from "./Markdown";

const ICON: Record<DigestKind, typeof Bell> = { approval: FileSignature, task: SquareCheck, status: Activity, call: Phone, note: Bell, record: Plus };

/** One block of the card: a title, a count and the rows. Left out entirely when there is nothing to show. */
function Block({ icon: Icon, title, count, tone, children }: { icon: typeof Bell; title: string; count: number; tone?: "warn"; children: React.ReactNode }) {
	return (
		<div>
			<h4 className={`mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${tone === "warn" ? "text-amber-700" : "text-serene-neutral-500"}`}>
				<Icon className="h-3.5 w-3.5" /> {title} <span className="rounded-full bg-white px-1.5 text-[11px] tabular-nums text-serene-neutral-600">{count}</span>
			</h4>
			<ul className="space-y-1.5">{children}</ul>
		</div>
	);
}

const Row = ({ children, tone }: { children: React.ReactNode; tone?: "warn" }) => (
	<li className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${tone === "warn" ? "bg-amber-50" : "bg-white/70"}`}>{children}</li>
);

/** A document that came in from a phone: its labels, to read, change and confirm. */
function SharedDoc({ f, onDone }: { f: CaughtUp["documents"][number]; onDone: (id: string) => void }) {
	const [tags, setTags] = useState(f.tags);
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	// The labels are made a moment after the file arrives; take them when they appear.
	useEffect(() => { setTags((cur) => (cur.length ? cur : f.tags)); }, [f.tags]);
	const add = () => { const t = draft.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); if (t.length >= 2 && !tags.includes(t)) setTags([...tags, t]); setDraft(""); };
	const confirm = async () => {
		setBusy(true); setErr("");
		try { await unwrap(confirmSharedFile(f.id, tags)); onDone(f.id); } catch (e) { setErr(e instanceof Error ? e.message : "Could not confirm."); } finally { setBusy(false); }
	};
	return (
		<Row>
			<FileText className="mt-0.5 h-4 w-4 shrink-0 text-sauti-teal" />
			<span className="min-w-0 flex-1">
				<Link href={`/dashboard/mjengo/vault?open=${f.id}`} className="block truncate text-sm font-medium text-serene-neutral-900 hover:underline">{f.name}</Link>
				<span className="mt-1 flex flex-wrap items-center gap-1">
					{tags.length === 0 && <span className="text-xs text-serene-neutral-500">Reading the document to label it...</span>}
					{tags.map((t) => (
						<span key={t} className="inline-flex items-center gap-1 rounded-full bg-sauti-teal-light/60 px-2 py-0.5 text-xs text-sauti-dark">
							{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="rounded-full hover:bg-black/10"><X className="h-3 w-3" /></button>
						</span>
					))}
					<input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} onBlur={add} placeholder="Add a label" className="w-24 rounded-full border border-dashed border-serene-neutral-300 bg-transparent px-2 py-0.5 text-xs outline-none focus:border-sauti-teal" />
				</span>
				{err && <span className="mt-1 block text-xs text-rose-600">{err}</span>}
			</span>
			<Button size="sm" className="h-8 shrink-0 gap-1 rounded-full bg-sauti-teal text-xs hover:bg-sauti-dark" disabled={busy} onClick={() => void confirm()}>
				{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />} Confirm
			</Button>
		</Row>
	);
}

/**
 * The top of the Overview: what needs this person, and "all caught up" once it does not. Urgent items come first, then
 * mail from people that is waiting for an answer, opportunities added (also from the phone), documents shared in from
 * the phone whose labels need confirming, and what changed while they were away. The card cannot be closed with
 * "I'm caught up" while a document is still waiting for its labels to be confirmed.
 */
export function DigestCard() {
	const [c, setC] = useState<CaughtUp | null>(null);
	const [changes, setChanges] = useState<DigestItem[]>([]);
	const [mail, setMail] = useState<MailToAnswer[] | null>(null);
	const [brief, setBrief] = useState<string | null>(null);
	const [busy, setBusy] = useState<"brief" | "done" | null>(null);
	const [all, setAll] = useState(false);

	const load = useCallback(() => {
		unwrap(getCaughtUp()).then(setC).catch(() => setC({ since: new Date().toISOString(), urgent: [], opportunities: [], documents: [] }));
		unwrap(getDigest()).then((d) => setChanges(d.items)).catch(() => setChanges([]));
		// Mail talks to the mail server, so it fills in when it can.
		unwrap(getMailToAnswer()).then(setMail).catch(() => setMail([]));
	}, []);
	useEffect(load, [load]);

	if (!c) return <div className="h-24 animate-pulse rounded-2xl border border-[#b6e0e6] bg-[#f1fafb]" aria-hidden />;

	const pending = c.documents.length;
	const items = changes;
	const nothing = c.urgent.length === 0 && c.opportunities.length === 0 && pending === 0 && (mail?.length ?? 0) === 0 && items.length === 0;
	const shownChanges = all ? items : items.slice(0, 5);
	const finish = async () => { setBusy("done"); try { await unwrap(catchUp()); setC({ ...c, urgent: [], opportunities: [] }); setChanges([]); } finally { setBusy(null); } };

	if (nothing && mail !== null) {
		return (
			<section aria-label="All caught up" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
				<span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-600"><CheckCheck className="h-5 w-5" /></span>
				<div>
					<p className="text-sm font-bold text-sauti-dark">All caught up</p>
					<p className="text-xs text-serene-neutral-600">Nothing urgent, no mail waiting for an answer, no new opportunities or documents to confirm.</p>
				</div>
			</section>
		);
	}

	return (
		<section aria-label="Needs you" className="rounded-2xl border border-[#b6e0e6] bg-[#f1fafb] p-4">
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<h3 className="mr-auto flex items-center gap-2 text-sm font-bold text-sauti-dark"><Sparkles className="h-4 w-4 text-sauti-teal" /> Needs you <span className="text-xs font-normal text-serene-neutral-500">since {format(parseISO(c.since), "d MMM")}</span></h3>
				<Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full bg-white text-xs" disabled={busy !== null || items.length === 0} onClick={async () => { setBusy("brief"); try { setBrief(await unwrap(digestBrief())); } catch { setBrief("I could not write the summary just now."); } finally { setBusy(null); } }}>
					{busy === "brief" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-sauti-teal" />} Catch me up
				</Button>
				<Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-full text-xs" disabled={busy !== null || pending > 0} title={pending ? `Confirm the ${pending} shared ${pending === 1 ? "document" : "documents"} first` : undefined} onClick={() => void finish()}>
					<CheckCheck className="h-3.5 w-3.5" /> I&apos;m caught up
				</Button>
			</div>
			{brief && <div className="mb-3 rounded-lg bg-white p-3 text-sm text-serene-neutral-800"><Markdown text={brief} /></div>}

			<div className="space-y-4">
				{c.urgent.length > 0 && (
					<Block icon={AlertTriangle} title="Urgent" count={c.urgent.length} tone="warn">
						{c.urgent.map((u) => (
							<Row key={u.id} tone="warn">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
								<Link href={u.href} className="min-w-0 flex-1 hover:underline"><span className="block truncate text-sm font-medium text-serene-neutral-900">{u.title}</span><span className="block truncate text-xs text-serene-neutral-600">{u.detail}</span></Link>
							</Row>
						))}
					</Block>
				)}

				{mail === null ? (
					<p className="flex items-center gap-2 text-xs text-serene-neutral-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your mail...</p>
				) : mail.length > 0 && (
					<Block icon={Mail} title="Emails waiting for an answer" count={mail.length}>
						{mail.map((m) => (
							<Row key={`${m.accountId}-${m.uid}`}>
								<Mail className="mt-0.5 h-4 w-4 shrink-0 text-sauti-teal" />
								<Link href={`/dashboard/mjengo/mail?account=${m.accountId}&box=${encodeURIComponent(m.mailbox)}&uid=${m.uid}`} className="min-w-0 flex-1 hover:underline"><span className="block truncate text-sm font-medium text-serene-neutral-900">{m.from}: {m.subject}</span><span className="block truncate text-xs text-serene-neutral-600">{m.account}{m.date ? `, ${formatDistanceToNowStrict(parseISO(m.date))} ago` : ""}</span></Link>
							</Row>
						))}
					</Block>
				)}

				{c.opportunities.length > 0 && (
					<Block icon={Lightbulb} title="Opportunities added" count={c.opportunities.length}>
						{c.opportunities.map((o) => (
							<Row key={o.id}>
								{o.fromPhone ? <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-sauti-teal" /> : <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-sauti-teal" />}
								<Link href={`/dashboard/mjengo/opportunities/${o.id}`} className="min-w-0 flex-1 hover:underline"><span className="block truncate text-sm font-medium text-serene-neutral-900">{o.title}</span><span className="block truncate text-xs text-serene-neutral-600">{o.fromPhone ? "Shared from the phone" : "Added"} {format(parseISO(o.at), "d MMM")}{o.deadline ? `, deadline ${o.deadline}` : ""}</span></Link>
							</Row>
						))}
					</Block>
				)}

				{c.documents.length > 0 && (
					<Block icon={Inbox} title="Documents to confirm" count={c.documents.length}>
						{c.documents.map((f) => <SharedDoc key={f.id} f={f} onDone={(id) => setC({ ...c, documents: c.documents.filter((d) => d.id !== id) })} />)}
					</Block>
				)}

				{items.length > 0 && (
					<Block icon={Bell} title="While you were away" count={items.length}>
						{shownChanges.map((i, n) => {
							const Icon = ICON[i.kind];
							const body = <><span className="block truncate text-sm font-medium text-serene-neutral-900">{i.title}</span>{i.detail && <span className="block truncate text-xs text-serene-neutral-600">{i.detail}</span>}</>;
							return (
								<Row key={`${i.at}-${n}`}>
									<Icon className={`mt-0.5 h-4 w-4 shrink-0 ${i.kind === "approval" ? "text-amber-600" : "text-sauti-teal"}`} />
									<span className="min-w-0 flex-1">{i.link ? <Link href={i.link} className="block hover:underline">{body}</Link> : body}</span>
									<span className="shrink-0 text-[11px] text-serene-neutral-500">{format(parseISO(i.at), "d MMM")}</span>
								</Row>
							);
						})}
						{items.length > 5 && <li><button type="button" onClick={() => setAll((v) => !v)} className="text-xs font-medium text-sauti-teal hover:underline">{all ? "Show fewer" : `Show all ${items.length}`}</button></li>}
					</Block>
				)}
			</div>
			{pending > 0 && <p className="mt-3 text-xs text-serene-neutral-600">Confirm the labels on shared documents to finish catching up.</p>}
		</section>
	);
}
