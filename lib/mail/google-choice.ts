import { createClient } from "@/utils/supabase/server";

export type GoogleService = "mail" | "drive" | "contacts";

/**
 * People who signed in with Google already agreed to share, so connecting is one step for everything.
 * Everyone else, when they connect one Google service, is first asked whether to connect everything or only that
 * one (everything else stays on demand). `choice=done` means they have answered.
 */
export async function mustAskGoogleChoice(request: Request): Promise<boolean> {
	const sp = new URL(request.url).searchParams;
	if (sp.get("choice") === "done") return false;
	try {
		const { data } = await createClient().then((c) => c.auth.getUser());
		return data.user?.app_metadata?.provider !== "google";
	} catch {
		return false;
	}
}

export function googleChoiceUrl(origin: string, service: GoogleService, request: Request): string {
	const u = new URL(request.url);
	const keep = new URLSearchParams();
	for (const k of ["email", "kind", "id", "return"]) { const v = u.searchParams.get(k); if (v) keep.set(k, v); }
	return `${origin}/dashboard/mjengo/connect-google?service=${service}${keep.toString() ? `&${keep.toString()}` : ""}`;
}
