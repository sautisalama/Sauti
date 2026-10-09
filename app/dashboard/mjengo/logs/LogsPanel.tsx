"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Eye, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAuditLogs, getPlatformEmailBody, getPlatformEmails, type AuditRow, type PlatformEmailRow } from "@/app/actions/access";

const AREAS = [
	{ v: "all", l: "Everything" },
	{ v: "super_admin", l: "Super admins" },
	{ v: "role", l: "Roles" },
	{ v: "mjengo", l: "Mjengo" },
	{ v: "mail", l: "Mail" },
	{ v: "email_log", l: "Email log access" },
];

const when = (iso: string) => format(new Date(iso), "d MMM yyyy, HH:mm");

export function LogsPanel() {
	return (
		<Tabs defaultValue="activity">
			<TabsList>
				<TabsTrigger value="activity">Activity</TabsTrigger>
				<TabsTrigger value="emails">Platform emails</TabsTrigger>
			</TabsList>
			<TabsContent value="activity" className="mt-4">
				<Activity />
			</TabsContent>
			<TabsContent value="emails" className="mt-4">
				<Emails />
			</TabsContent>
		</Tabs>
	);
}

function Activity() {
	const [rows, setRows] = useState<AuditRow[]>([]);
	const [q, setQ] = useState("");
	const [area, setArea] = useState("all");
	const [loading, setLoading] = useState(true);
	const [more, setMore] = useState(true);

	const load = useCallback(async (append = false, before?: string) => {
		setLoading(true);
		try {
			const data = await getAuditLogs({ q, area: area === "all" ? undefined : area, before });
			setRows((prev) => (append ? [...prev, ...data] : data));
			setMore(data.length >= 50);
		} finally {
			setLoading(false);
		}
	}, [q, area]);

	useEffect(() => {
		const t = setTimeout(() => load(false), 250);
		return () => clearTimeout(t);
	}, [load]);

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-2 sm:flex-row">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by person, action or target" className="pl-9" />
				</div>
				<Select value={area} onValueChange={setArea}>
					<SelectTrigger className="sm:w-[190px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{AREAS.map((a) => (
							<SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="overflow-hidden rounded-2xl border border-serene-neutral-100 bg-white">
				<ul className="divide-y divide-serene-neutral-50">
					{rows.map((r) => (
						<li key={r.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
							<span className="w-40 shrink-0 text-xs text-serene-neutral-500">{when(r.created_at)}</span>
							<Badge variant="secondary" className="w-fit font-mono text-[11px]">{r.action}</Badge>
							<span className="min-w-0 flex-1 text-sm text-serene-neutral-800">
								<span className="font-medium">{r.actor_email ?? "system"}</span>
								{r.target_label ? <> → <span className="text-serene-neutral-600">{r.target_label}</span></> : null}
								{r.details && Object.keys(r.details).length > 0 && <span className="ml-2 text-xs text-serene-neutral-400">{JSON.stringify(r.details)}</span>}
							</span>
						</li>
					))}
					{!loading && rows.length === 0 && <li className="p-8 text-center text-sm text-serene-neutral-500">Nothing logged yet.</li>}
				</ul>
				<div className="flex justify-center p-3">
					{loading ? <Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /> : more && rows.length > 0 && <Button variant="ghost" size="sm" onClick={() => load(true, rows[rows.length - 1].created_at)}>Load older</Button>}
				</div>
			</div>
		</div>
	);
}

function Emails() {
	const [rows, setRows] = useState<PlatformEmailRow[]>([]);
	const [q, setQ] = useState("");
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState<{ subject: string; html: string | null } | null>(null);

	const load = useCallback(async (before?: string, append = false) => {
		setLoading(true);
		try {
			const data = await getPlatformEmails({ q, before });
			setRows((prev) => (append ? [...prev, ...data] : data));
		} finally {
			setLoading(false);
		}
	}, [q]);
	useEffect(() => {
		const t = setTimeout(() => load(), 250);
		return () => clearTimeout(t);
	}, [load]);

	const view = async (r: PlatformEmailRow) => setOpen({ subject: r.subject, html: await getPlatformEmailBody(r.id) });

	return (
		<div className="space-y-3">
			<p className="text-sm text-serene-neutral-600">Every email the platform sends to people. Opening one is recorded in the activity log.</p>
			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
				<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject or kind" className="pl-9" />
			</div>
			<div className="overflow-hidden rounded-2xl border border-serene-neutral-100 bg-white">
				<ul className="divide-y divide-serene-neutral-50">
					{rows.map((r) => (
						<li key={r.id} className="flex items-center gap-3 p-3">
							<span className="hidden w-40 shrink-0 text-xs text-serene-neutral-500 sm:block">{when(r.created_at)}</span>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-serene-neutral-900">{r.subject}</p>
								<p className="truncate text-xs text-serene-neutral-500">to {r.to_addresses.join(", ")}{r.category ? ` · ${r.category}` : ""}</p>
							</div>
							<Badge variant={r.status === "failed" ? "destructive" : r.status === "skipped" ? "outline" : "secondary"}>{r.status === "skipped" ? "skipped (opted out)" : r.status}</Badge>
							<Button variant="ghost" size="icon" onClick={() => view(r)} aria-label="Read email"><Eye className="h-4 w-4" /></Button>
						</li>
					))}
					{!loading && rows.length === 0 && <li className="p-8 text-center text-sm text-serene-neutral-500">No emails recorded yet.</li>}
				</ul>
				<div className="flex justify-center p-3">
					{loading ? <Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /> : rows.length >= 50 && <Button variant="ghost" size="sm" onClick={() => load(rows[rows.length - 1].created_at, true)}>Load older</Button>}
				</div>
			</div>

			<Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
				<DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
					<DialogHeader className="border-b p-4">
						<DialogTitle className="truncate text-base">{open?.subject}</DialogTitle>
					</DialogHeader>
					{/* Sandboxed: scripts, forms and navigation inside a logged email never run. */}
					<iframe title="Email" sandbox="" srcDoc={open?.html ?? "<p style='font-family:sans-serif;padding:16px'>No content stored.</p>"} className="h-[65vh] w-full bg-white" />
				</DialogContent>
			</Dialog>
		</div>
	);
}
