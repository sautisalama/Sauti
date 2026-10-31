"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { apply } from "./theme";

/** Re-applies the theme when navigation moves between the signed-in app and the public site. */
export function ThemeSync() {
	const pathname = usePathname();
	useEffect(() => { apply(); }, [pathname]);
	return null;
}
