import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { importContacts } from "@/app/actions/mjengo-contacts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Person {
	names?: { displayName?: string }[];
	emailAddresses?: { value?: string }[];
	phoneNumbers?: { value?: string }[];
	organizations?: { name?: string; title?: string }[];
}

/** Finish "Import from Google": fetch the contacts once, add the new ones, keep no token. */
export async function GET(request: Request) {
	const origin = originOf(request);
	const done = (q: string) => {
		const r = NextResponse.redirect(`${origin}/dashboard/mjengo/contacts?${q}`);
		r.cookies.delete({ name: "ss_contacts_oauth", path: "/api/mjengo/contacts" });
		return r;
	};
	const fail = (m: string) => done("import_error=" + encodeURIComponent(m));

	const sp = new URL(request.url).searchParams;
	if (sp.get("error")) return fail(sp.get("error_description") || "The sign-in was cancelled.");

	const raw = request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith("ss_contacts_oauth="))?.slice("ss_contacts_oauth=".length);
	let cookie: string | undefined;
	try { cookie = raw ? decodeURIComponent(raw) : undefined; } catch { cookie = raw; }
	if (!cookie || cookie !== sp.get("state")) return fail("That sign-in link has expired. Please try again.");

	const actor = await getActor();
	if (!actor?.isAdmin) return fail("Please sign in again.");
	const code = sp.get("code");
	if (!code) return fail("Google did not return a sign-in code.");

	try {
		const tok = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code,
				client_id: process.env.GOOGLE_CLIENT_ID!,
				client_secret: process.env.GOOGLE_CLIENT_SECRET!,
				redirect_uri: `${origin}/api/mjengo/contacts/google/callback`,
				grant_type: "authorization_code",
			}),
			signal: AbortSignal.timeout(20_000),
		});
		const t = (await tok.json()) as { access_token?: string; error_description?: string };
		if (!tok.ok || !t.access_token) return fail(t.error_description || "Google refused the request.");

		const rows: { name: string; email: string | null; phone: string | null; organisation: string | null; title: string | null }[] = [];
		let pageToken = "";
		for (let page = 0; page < 10; page++) {
			const url = new URL("https://people.googleapis.com/v1/people/me/connections");
			url.searchParams.set("personFields", "names,emailAddresses,phoneNumbers,organizations");
			url.searchParams.set("pageSize", "1000");
			if (pageToken) url.searchParams.set("pageToken", pageToken);
			const res = await fetch(url, { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(20_000) });
			const j = (await res.json()) as { connections?: Person[]; nextPageToken?: string; error?: { message?: string; status?: string } };
			if (!res.ok) {
				const msg = j.error?.message ?? "";
				return fail(/has not been used|disabled/i.test(msg) ? "The Google People API is not switched on for this project yet." : msg || "Could not read your Google contacts.");
			}
			for (const p of j.connections ?? []) {
				const email = p.emailAddresses?.[0]?.value ?? null;
				const name = p.names?.[0]?.displayName ?? email ?? "";
				if (!name) continue;
				rows.push({ name, email, phone: p.phoneNumbers?.[0]?.value ?? null, organisation: p.organizations?.[0]?.name ?? null, title: p.organizations?.[0]?.title ?? null });
			}
			if (!j.nextPageToken) break;
			pageToken = j.nextPageToken;
		}
		const r = await importContacts(rows, "google");
		if (!r.ok) return fail(r.error);
		return done(`imported=${r.data.added}`);
	} catch (e) {
		return fail(e instanceof Error ? e.message : "Could not import from Google.");
	}
}
