import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getCertificateByNumber } from "@/lib/courses/certificates";

export const dynamic = "force-dynamic";

/** 1200x630 badge for a certificate: used as the link preview on LinkedIn and downloadable (?download=1). */
export async function GET(req: Request, { params }: { params: Promise<{ number: string }> }) {
	const { number } = await params;
	const cert = await getCertificateByNumber(decodeURIComponent(number));
	if (!cert) return new Response("Not found", { status: 404 });
	let logo = "";
	try { logo = `data:image/png;base64,${readFileSync(path.join(process.cwd(), "public/logo-small.png")).toString("base64")}`; } catch { /* the badge is still valid without it */ }
	const issued = new Date(cert.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" });
	const img = new ImageResponse(
		(
			<div style={{ width: "100%", height: "100%", display: "flex", background: "#f8fafc", padding: 28 }}>
				<div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "6px solid #f5b017", borderRadius: 28, background: "white", padding: 40 }}>
					{logo ? <img src={logo} width={64} height={84} /> : null}
					<div style={{ marginTop: 14, fontSize: 22, letterSpacing: 6, color: "#068297", fontWeight: 700 }}>CERTIFICATE OF COMPLETION</div>
					<div style={{ marginTop: 26, fontSize: 24, color: "#6b7280" }}>This certifies that</div>
					<div style={{ marginTop: 6, fontSize: 60, fontWeight: 700, color: "#1a365d", textAlign: "center" }}>{cert.learnerName}</div>
					<div style={{ marginTop: 16, fontSize: 24, color: "#6b7280" }}>has completed</div>
					<div style={{ marginTop: 6, fontSize: 40, fontWeight: 700, color: "#111827", textAlign: "center", maxWidth: 980 }}>{cert.courseTitle}</div>
					<div style={{ marginTop: 22, fontSize: 22, color: "#4b5563" }}>{`Sauti Salama  ·  ${issued}  ·  ${cert.number}`}</div>
				</div>
			</div>
		),
		{ width: 1200, height: 630 }
	);
	if (new URL(req.url).searchParams.get("download")) img.headers.set("Content-Disposition", `attachment; filename="Sauti-Salama-Badge-${cert.number}.png"`);
	img.headers.set("Cache-Control", "public, max-age=3600");
	return img;
}
