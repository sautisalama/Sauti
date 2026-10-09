"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

const COOKIE_AGE = 60 * 60 * 24 * 365;

/**
 * Remembers, per person, whether they were last in the app, the Admin suite or the Mjengo suite, so
 * the next time THEY sign in they land there. It is stored under their own id: someone else signing in
 * on the same device is not sent to an admin area, and a stale admin mode never carries over.
 */
export function SuiteTracker() {
	const pathname = usePathname() ?? "";
	const dash = useDashboardData();
	const userId = dash?.data?.userId;
	const isAdmin = !!(dash?.data?.profile as { is_admin?: boolean } | undefined)?.is_admin;

	// On arrival: restore this person's mode, or clear admin mode left behind by someone else.
	useEffect(() => {
		if (!userId) return;
		const inSuite = pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/mjengo");
		try {
			const saved = document.cookie.split("; ").find((c) => c.startsWith(`ss_suite_${userId}=`))?.split("=")[1];
			const wantAdmin = isAdmin && (saved === "admin" || saved === "mjengo");
			if (!inSuite && (localStorage.getItem("adminMode") === "true") !== wantAdmin) {
				localStorage.setItem("adminMode", wantAdmin ? "true" : "false");
				window.dispatchEvent(new Event("adminModeChanged"));
			}
		} catch {}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId, isAdmin]);

	// As they move around: record where they are.
	useEffect(() => {
		if (!userId) return;
		let mode: "app" | "admin" | "mjengo" = "app";
		if (isAdmin && pathname.startsWith("/dashboard/mjengo")) mode = "mjengo";
		else if (isAdmin && pathname.startsWith("/dashboard/admin")) mode = "admin";
		else {
			try {
				// Chat, profile and the like keep the mode they switched to.
				if (isAdmin && localStorage.getItem("adminMode") === "true") mode = "admin";
			} catch {}
		}
		if (mode !== "app") {
			try {
				if (localStorage.getItem("adminMode") !== "true") {
					localStorage.setItem("adminMode", "true");
					window.dispatchEvent(new Event("adminModeChanged"));
				}
			} catch {}
		}
		document.cookie = `ss_suite_${userId}=${mode}; path=/; max-age=${COOKIE_AGE}; SameSite=Lax`;
	}, [userId, isAdmin, pathname]);

	return null;
}
