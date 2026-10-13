import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getPreview, type PreviewKind } from "@/lib/seo/previews";

export const dynamic = "force-dynamic";

const KINDS: PreviewKind[] = ["form", "doc", "meet", "user", "group", "schedule"];

/**
 * The picture shown when a link is shared. It is drawn from the thing the link points to (a person's photo, a
 * form's cover, the meeting's host), never from text in the address, so the card cannot be forged.
 */
export async function GET(req: Request) {
	const q = new URL(req.url).searchParams;
	const kind = q.get("k") as PreviewKind;
	const id = q.get("id") ?? "";
	if (!KINDS.includes(kind) || !id || id.length > 120) return new Response("Not found", { status: 404 });
	const p = await getPreview(kind, id);
	if (!p) return new Response("Not found", { status: 404 });
	let logo = "";
	try { logo = `data:image/png;base64,${readFileSync(path.join(process.cwd(), "public/logo-small.png")).toString("base64")}`; } catch { /* the card is fine without it */ }
	const size = 300;
	const img = new ImageResponse(
		(
			<div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff" }}>
				<div style={{ width: 18, height: "100%", background: p.accent, display: "flex" }} />
				<div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px" }}>
					<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
						{logo ? <img src={logo} width={40} height={52} /> : null}
						<div style={{ fontSize: 26, fontWeight: 700, color: p.accent, letterSpacing: 2, textTransform: "uppercase" }}>{p.label}</div>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 48 }}>
						{p.image && p.round ? <img src={p.image} width={size} height={size} style={{ borderRadius: size, objectFit: "cover", border: `8px solid ${p.accent}` }} /> : null}
						{p.round && !p.image ? <div style={{ width: size, height: size, borderRadius: size, background: p.accent, color: "white", fontSize: 120, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.title.slice(0, 1).toUpperCase()}</div> : null}
						<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<div style={{ fontSize: p.title.length > 40 ? 52 : 68, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>{p.title}</div>
							<div style={{ marginTop: 20, fontSize: 30, color: "#4b5563", lineHeight: 1.35 }}>{p.description}</div>
						</div>
						{p.image && !p.round ? <img src={p.image} width={360} height={360} style={{ borderRadius: 28, objectFit: "cover" }} /> : null}
					</div>
					<div style={{ fontSize: 24, color: "#6b7280" }}>Sauti Salama</div>
				</div>
			</div>
		),
		{ width: 1200, height: 630 },
	);
	img.headers.set("Cache-Control", "public, max-age=600, s-maxage=600");
	return img;
}
