"use client";

import { MjengoLoader } from "../_components/MjengoLoader";
import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2, Lock, Search, ShieldCheck, ShieldOff, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
	addSuperAdmin, getAccessOverview, removeSuperAdmin, searchPeople, setAccountType, setAdminStatus,
	type AccessOverview, type PersonView,
} from "@/app/actions/access";

const initials = (s: string) => s.trim().charAt(0).toUpperCase() || "?";

export function PeoplePanel() {
	const { toast } = useToast();
	const [data, setData] = useState<AccessOverview | null>(null);
	const [identifier, setIdentifier] = useState("");
	const [adding, setAdding] = useState(false);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<PersonView[]>([]);
	const [searching, setSearching] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [selected, setSelected] = useState<{ id: string; name: string; email: string | null; isSuperAdmin: boolean } | null>(null);

	const load = useCallback(async () => {
		try {
			setData(await getAccessOverview());
		} catch (e) {
			toast({ title: "Could not load", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	}, [toast]);
	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		if (query.trim().length < 2) {
			setResults([]);
			return;
		}
		const t = setTimeout(async () => {
			setSearching(true);
			try {
				setResults(await searchPeople(query));
			} catch {
				setResults([]);
			} finally {
				setSearching(false);
			}
		}, 300);
		return () => clearTimeout(t);
	}, [query]);

	const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
		setBusyId(key);
		try {
			await fn();
			toast({ title: ok });
			await load();
			if (query.trim().length >= 2) setResults(await searchPeople(query));
		} catch (e) {
			toast({ title: "That did not work", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusyId(null);
		}
	};

	const add = async () => {
		setAdding(true);
		try {
			await addSuperAdmin(identifier);
			setIdentifier("");
			toast({ title: "Super admin added" });
			await load();
		} catch (e) {
			toast({ title: "Could not add", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setAdding(false);
		}
	};

	if (!data) {
		return (
			<MjengoLoader label="Loading people and access" />
		);
	}

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			{/* Super admins */}
			<Card className="rounded-2xl">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Crown className="h-5 w-5 text-sauti-teal" /> Super admins
					</CardTitle>
					<CardDescription>
						Only super admins can open this page, change anyone&apos;s role and read the logs. Each super admin can add {data.me.limit} more. Protected accounts can never be removed.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<ul className="divide-y divide-serene-neutral-100 rounded-xl border border-serene-neutral-100">
						{data.superAdmins.map((s) => (
							<li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sauti-teal-light text-sm font-bold text-sauti-teal">{initials(s.name || s.email)}</div>
								<div className="min-w-0 flex-1 basis-[10rem]">
									<p className="truncate text-sm font-semibold text-serene-neutral-900">{s.name || s.email}</p>
									<p className="truncate text-xs text-serene-neutral-500">
										{s.name ? `${s.email} · ` : ""}
										{s.added_by ? `added by ${s.added_by}` : "founding super admin"}
										{!s.hasAccount && " · no account yet"}
									</p>
								</div>
								{s.is_protected && (
									<Badge className="gap-1 bg-sauti-teal-light text-sauti-teal hover:bg-sauti-teal-light">
										<Lock className="h-3 w-3" /> Protected
									</Badge>
								)}
								{s.canRemove && (
									<Button
										size="sm"
										variant="ghost"
										className="text-red-600 hover:bg-red-50 hover:text-red-700"
										disabled={busyId === s.id}
										onClick={() => window.confirm(`Remove ${s.email} as a super admin?`) && run(s.id, () => removeSuperAdmin(s.id), "Super admin removed")}
									>
										{busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
										<span className="sr-only">Remove</span>
									</Button>
								)}
							</li>
						))}
					</ul>

					<div>
						<p className="mb-1.5 text-xs font-semibold text-serene-neutral-600">
							Add a super admin ({data.me.added} of {data.me.limit} used by you)
						</p>
						<div className="flex flex-col gap-2 sm:flex-row">
							<Input
								value={identifier}
								onChange={(e) => setIdentifier(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && identifier.trim() && data.me.canAdd && add()}
								placeholder="Email address or Sauti ID (SS-XXXX-XXXX)"
								disabled={!data.me.canAdd || adding}
								autoComplete="off"
							/>
							<Button onClick={add} disabled={!data.me.canAdd || adding || !identifier.trim()} className="gap-1.5">
								{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add
							</Button>
						</div>
						{!data.me.canAdd && <p className="mt-1.5 text-xs text-amber-700">You have used all {data.me.limit} of your additions. Remove one you added to free a slot.</p>}
					</div>
				</CardContent>
			</Card>

			{/* Roles */}
			<Card className="rounded-2xl">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<ShieldCheck className="h-5 w-5 text-sauti-teal" /> Roles
					</CardTitle>
					<CardDescription>Make someone an admin, or return them to a regular account (survivor, professional or NGO). Every change is logged.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
						<Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email or Sauti ID" className="pl-9" autoComplete="off" />
					</div>
					{searching && <p className="text-xs text-serene-neutral-400">Searching...</p>}
					<ul className="space-y-2">
						{results.map((p) => (
							<PersonRow key={p.id} p={p} busy={busyId === p.id} onAdmin={(v) => run(p.id, () => setAdminStatus(p.id, v), v ? "Made an admin" : "Admin access removed")} onType={(t) => run(p.id, () => setAccountType(p.id, t), "Account type changed")} />
						))}
					</ul>
					{query.trim().length >= 2 && !searching && results.length === 0 && <p className="text-sm text-serene-neutral-500">No one found.</p>}
				</CardContent>
			</Card>

			{/* All admins */}
			<Card className="rounded-2xl lg:col-span-2">
				<CardHeader>
					<CardTitle className="text-base">All admin accounts ({data.admins.length})</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{data.admins.map((a) => (
							<li key={a.id}>
								<button type="button" onClick={() => setSelected(a)} className="flex w-full items-center gap-3 rounded-xl border border-serene-neutral-100 p-3 text-left transition hover:border-sauti-teal/40 hover:bg-serene-neutral-50/60">
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sauti-teal-light text-sm font-bold text-sauti-teal">{initials(a.name)}</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-semibold">{a.name}</p>
										<p className="truncate text-xs text-serene-neutral-500">{a.email}</p>
									</div>
									{a.isSuperAdmin ? <Badge className="bg-sauti-teal-light text-sauti-teal hover:bg-sauti-teal-light">Super</Badge> : <Badge variant="secondary">Admin</Badge>}
								</button>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>

			<Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
				<SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
					{selected && (() => {
						const sa = data.superAdmins.find((x) => x.email.toLowerCase() === (selected.email ?? "").toLowerCase());
						const live = data.admins.find((x) => x.id === selected.id) ?? selected;
						return (
							<>
								<SheetHeader className="border-b p-5">
									<div className="flex items-center gap-3">
										<span className="flex h-12 w-12 items-center justify-center rounded-full bg-sauti-teal-light text-lg font-bold text-sauti-teal">{initials(live.name)}</span>
										<div className="min-w-0 text-left">
											<SheetTitle className="truncate">{live.name}</SheetTitle>
											<SheetDescription className="truncate">{live.email}</SheetDescription>
										</div>
									</div>
									<div className="pt-2">{live.isSuperAdmin ? <Badge className="bg-sauti-teal-light text-sauti-teal hover:bg-sauti-teal-light">Super admin</Badge> : <Badge variant="secondary">Admin</Badge>}</div>
								</SheetHeader>
								<div className="flex-1 space-y-5 overflow-y-auto p-5">
									<section className="space-y-2">
										<h4 className="text-sm font-semibold">Role in the suite</h4>
										{live.isSuperAdmin ? (
											<>
												<p className="text-sm text-serene-neutral-600">Super admins manage people and access and can read the logs.</p>
												{sa?.is_protected ? (
													<p className="flex items-center gap-1.5 text-sm text-serene-neutral-500"><Lock className="h-4 w-4" /> This account is protected and cannot be changed.</p>
												) : sa?.canRemove ? (
													<Button variant="outline" className="gap-1.5 text-red-600" disabled={busyId === sa.id} onClick={() => window.confirm(`Remove ${live.email} as a super admin?`) && run(sa.id, () => removeSuperAdmin(sa.id), "Super admin removed")}>
														<ShieldOff className="h-4 w-4" /> Remove as super admin
													</Button>
												) : <p className="text-sm text-serene-neutral-500">Only the person who added them can remove them.</p>}
											</>
										) : (
											<>
												<p className="text-sm text-serene-neutral-600">Admins can use every part of the suite except people, access and logs.</p>
												<div className="flex flex-wrap gap-2">
													<Button variant="outline" className="gap-1.5" disabled={!data.me.canAdd || adding} onClick={() => window.confirm(`Make ${live.name} a super admin?`) && run(live.id, () => addSuperAdmin(live.email ?? ""), "Made a super admin")}>
														<Crown className="h-4 w-4" /> Make super admin
													</Button>
													<Button variant="outline" className="gap-1.5" disabled={busyId === live.id} onClick={() => window.confirm(`Remove admin access for ${live.name}?`) && run(live.id, async () => { await setAdminStatus(live.id, false); setSelected(null); }, "Admin access removed")}>
														<ShieldOff className="h-4 w-4" /> Make regular member
													</Button>
												</div>
												{!data.me.canAdd && <p className="text-xs text-amber-700">You have used all of your super admin additions.</p>}
											</>
										)}
									</section>
									<section className="space-y-2">
										<h4 className="text-sm font-semibold">Account type</h4>
										<Select onValueChange={(v) => window.confirm(`Change ${live.name}'s account type to ${v}?`) && run(live.id, () => setAccountType(live.id, v as "survivor" | "professional" | "ngo"), "Account type changed")} disabled={live.isSuperAdmin || busyId === live.id}>
											<SelectTrigger><SelectValue placeholder="Keep as it is" /></SelectTrigger>
											<SelectContent>
												<SelectItem value="survivor">Survivor</SelectItem>
												<SelectItem value="professional">Professional</SelectItem>
												<SelectItem value="ngo">NGO</SelectItem>
											</SelectContent>
										</Select>
									</section>
									<section className="space-y-2">
										<h4 className="text-sm font-semibold">More</h4>
										<div className="flex flex-wrap gap-2">
											<Button asChild variant="outline" size="sm"><Link href={`/dashboard/mjengo/mail?to=${encodeURIComponent(live.email ?? "")}`}>Write an email</Link></Button>
											<Button asChild variant="outline" size="sm"><Link href="/dashboard/mjengo/logs">See activity in the logs</Link></Button>
										</div>
									</section>
									{busyId === live.id && <p className="flex items-center gap-2 text-xs text-serene-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Saving...</p>}
								</div>
							</>
						);
					})()}
				</SheetContent>
			</Sheet>
		</div>
	);
}

function PersonRow({ p, busy, onAdmin, onType }: { p: PersonView; busy: boolean; onAdmin: (v: boolean) => void; onType: (t: "survivor" | "professional" | "ngo") => void }) {
	return (
		<li className="rounded-xl border border-serene-neutral-100 p-3">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-serene-neutral-100 text-sm font-bold text-serene-neutral-700">{initials(p.name)}</div>
				<div className="min-w-0 flex-1 basis-[10rem]">
					<p className="truncate text-sm font-semibold">{p.name}</p>
					<p className="truncate text-xs text-serene-neutral-500">
						{p.email}
						{p.sautiId ? ` · ${p.sautiId}` : ""}
					</p>
				</div>
				{p.isSuperAdmin ? (
					<Badge className="bg-sauti-teal-light text-sauti-teal hover:bg-sauti-teal-light">Super admin</Badge>
				) : p.isAdmin ? (
					<Badge variant="secondary">Admin</Badge>
				) : (
					<Badge variant="outline" className="capitalize">{(p.userType ?? "member").replace(/_/g, " ")}</Badge>
				)}
			</div>
			{p.isSuperAdmin ? (
				<p className="mt-2 text-xs text-serene-neutral-500">Remove them as a super admin before changing their role.</p>
			) : (
				<div className="mt-3 flex flex-wrap items-center gap-2">
					{p.isAdmin ? (
						<Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => window.confirm(`Remove admin access for ${p.name}?`) && onAdmin(false)}>
							<ShieldOff className="h-4 w-4" /> Make regular member
						</Button>
					) : (
						<Button size="sm" disabled={busy} className="gap-1.5" onClick={() => window.confirm(`Make ${p.name} an admin? They will see everything admins see.`) && onAdmin(true)}>
							<ShieldCheck className="h-4 w-4" /> Make admin
						</Button>
					)}
					<Select value={p.userType ?? undefined} onValueChange={(v) => window.confirm(`Change ${p.name}'s account type to ${v}?`) && onType(v as "survivor" | "professional" | "ngo")} disabled={busy}>
						<SelectTrigger className="h-9 w-full sm:w-[150px]">
							<SelectValue placeholder="Account type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="survivor">Survivor</SelectItem>
							<SelectItem value="professional">Professional</SelectItem>
							<SelectItem value="ngo">NGO</SelectItem>
						</SelectContent>
					</Select>
					{busy && <Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" />}
				</div>
			)}
		</li>
	);
}
