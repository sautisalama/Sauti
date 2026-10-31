"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * One place that knows which "workspace" a signed-in person is in. The URL is the truth (so back, links and
 * refresh all agree); the stored values only decide where to land and which sidebar shows on shared pages.
 *   personal: your own dashboard (survivor, professional or NGO)
 *   admin:    platform management
 *   suite:    the Mjengo suite (mail, grants, projects, meetings)
 */
export type WorkspaceId = "personal" | "admin" | "suite";

export const WORKSPACE_HOME: Record<WorkspaceId, string> = { personal: "/dashboard", admin: "/dashboard/admin", suite: "/dashboard/mjengo" };

export function workspaceOf(pathname: string | null | undefined): WorkspaceId | null {
	if (!pathname) return null;
	if (pathname.startsWith("/dashboard/mjengo") || pathname.startsWith("/meet")) return "suite";
	if (pathname.startsWith("/dashboard/admin")) return "admin";
	if (pathname === "/dashboard") return "personal";
	return null; // shared pages (profile, chat, ...) belong to whichever workspace you came from
}

const lastKey = (userId: string) => `ss_workspace:${userId}`;
const LANDED = "ss_landed";

export function setAdminFlag(on: boolean) {
	try {
		if ((localStorage.getItem("adminMode") === "true") === on) return;
		localStorage.setItem("adminMode", on ? "true" : "false");
		window.dispatchEvent(new Event("adminModeChanged"));
	} catch {}
}

/**
 * Keeps the stored workspace in step with the URL, and on the first visit of a browser session sends you
 * back to the workspace you were last in (Slack, Linear and GitHub all reopen where you left off).
 * Going to /dashboard yourself is always respected: it opens your personal overview.
 */
export function useWorkspaceSync(userId: string | null | undefined, canSwitch: boolean) {
	const pathname = usePathname();
	const router = useRouter();

	useEffect(() => {
		if (!userId) return;
		const ws = workspaceOf(pathname);
		try {
			// Until we know this person can switch, do not touch what they last used (it may be needed to land).
			if (!canSwitch) return;
			const first = !sessionStorage.getItem(LANDED);
			sessionStorage.setItem(LANDED, "1");
			if (first && pathname === "/dashboard") {
				const last = localStorage.getItem(lastKey(userId)) as WorkspaceId | null;
				if (last === "admin" || last === "suite") {
					router.replace(WORKSPACE_HOME[last]);
					return;
				}
			}
			if (ws) {
				localStorage.setItem(lastKey(userId), ws);
				if (ws === "admin") setAdminFlag(true);
				else if (ws === "personal") setAdminFlag(false);
			}
		} catch {}
	}, [pathname, userId, canSwitch, router]);
}

/** Current workspace plus a function to move between them. */
export function useWorkspace() {
	const pathname = usePathname();
	const router = useRouter();
	let current = workspaceOf(pathname);
	if (!current) {
		try {
			current = localStorage.getItem("adminMode") === "true" ? "admin" : "personal";
		} catch {
			current = "personal";
		}
	}
	const go = useCallback(
		(ws: WorkspaceId) => {
			if (ws === "admin") setAdminFlag(true);
			if (ws === "personal") setAdminFlag(false);
			router.push(WORKSPACE_HOME[ws]);
		},
		[router]
	);
	return { current, go };
}
