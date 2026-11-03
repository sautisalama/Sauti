"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getMyAccessLevel, setAdminStatus } from "@/app/actions/access";
import { deleteUserAccount } from "@/app/actions/admin-users";

let cached: Promise<boolean> | null = null;
const amSuperAdmin = () => (cached ??= getMyAccessLevel().then((r) => r.isSuperAdmin).catch(() => false));

/** "Make admin" / "Remove admin" for a row's action menu. Shown to super admins only; the server checks again. */
export function MakeAdminItem({ userId, name, isAdmin, onDone }: { userId: string; name: string; isAdmin?: boolean | null; onDone?: () => void }) {
	const [ok, setOk] = useState(false);
	const { toast } = useToast();
	useEffect(() => {
		let live = true;
		void amSuperAdmin().then((v) => live && setOk(v));
		return () => {
			live = false;
		};
	}, []);
	if (!ok) return null;
	const make = !isAdmin;
	return (
		<>
			<DropdownMenuSeparator className="bg-serene-neutral-50" />
			<DropdownMenuItem
				className="cursor-pointer rounded-lg"
				onClick={async (e) => {
					e.stopPropagation();
					if (!window.confirm(make ? `Make ${name} an administrator?` : `Remove ${name}'s admin access?`)) return;
					try {
						await setAdminStatus(userId, make);
						toast({ title: make ? `${name} is now an admin` : `${name} is no longer an admin` });
						onDone?.();
					} catch (err) {
						toast({ title: "That did not work", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
					}
				}}
			>
				{make ? <ShieldCheck className="mr-2 h-3.5 w-3.5" /> : <ShieldOff className="mr-2 h-3.5 w-3.5" />}
				{make ? "Make admin" : "Remove admin"}
			</DropdownMenuItem>
		</>
	);
}

/** "Delete user" for a row's action menu. Super admins only; the server checks again. */
export function DeleteUserItem({ userId, name, onDone }: { userId: string; name: string; onDone?: () => void }) {
	const [ok, setOk] = useState(false);
	const { toast } = useToast();
	useEffect(() => {
		let live = true;
		void amSuperAdmin().then((v) => live && setOk(v));
		return () => {
			live = false;
		};
	}, []);
	if (!ok) return null;
	return (
		<DropdownMenuItem
			className="cursor-pointer rounded-lg text-red-600 focus:bg-red-50 focus:text-red-700"
			onClick={async (e) => {
				e.stopPropagation();
				if (!window.confirm(`Permanently delete ${name}? This removes their account and cannot be undone.`)) return;
				const res = await deleteUserAccount(userId);
				if (!res.ok) return toast({ title: "Could not delete the account", description: res.error, variant: "destructive" });
				toast({ title: `${name} was deleted` });
				onDone?.();
			}}
		>
			<Trash2 className="mr-2 h-3.5 w-3.5" /> Delete user
		</DropdownMenuItem>
	);
}
