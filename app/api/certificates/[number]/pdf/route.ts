import { readFileSync } from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { getCertificateByNumber } from "@/lib/courses/certificates";

export const dynamic = "force-dynamic";

// jsPDF's built-in fonts are WinAnsi only; keep names printable.
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");

/** A4 landscape certificate. Public: whoever holds the number may download it (same as the web page). */
export async function GET(_req: Request, { params }: { params: Promise<{ number: string }> }) {
	const { number } = await params;
	const cert = await getCertificateByNumber(decodeURIComponent(number));
	if (!cert) return new Response("Not found", { status: 404 });

	const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
	const W = doc.internal.pageSize.getWidth();
	const H = doc.internal.pageSize.getHeight();

	// frame
	doc.setDrawColor(245, 176, 23).setLineWidth(3).roundedRect(24, 24, W - 48, H - 48, 10, 10);
	doc.setDrawColor(6, 130, 151).setLineWidth(0.6).roundedRect(36, 36, W - 72, H - 72, 6, 6);

	try {
		const logo = readFileSync(path.join(process.cwd(), "public/logo-small.png"));
		doc.addImage(`data:image/png;base64,${logo.toString("base64")}`, "PNG", W / 2 - 24, 62, 48, 63);
	} catch {
		/* the certificate is still valid without the logo */
	}

	doc.setTextColor(6, 130, 151).setFont("helvetica", "bold").setFontSize(10);
	doc.text("CERTIFICATE OF COMPLETION", W / 2, 158, { align: "center", charSpace: 3 });
	doc.setTextColor(107, 114, 128).setFont("helvetica", "normal").setFontSize(12);
	doc.text("This is to certify that", W / 2, 200, { align: "center" });
	doc.setTextColor(26, 54, 93).setFont("helvetica", "bold").setFontSize(34);
	doc.text(safe(cert.learnerName), W / 2, 248, { align: "center", maxWidth: W - 160 });
	doc.setTextColor(107, 114, 128).setFont("helvetica", "normal").setFontSize(12);
	doc.text("has successfully completed the course", W / 2, 286, { align: "center" });
	doc.setTextColor(31, 41, 55).setFont("helvetica", "bold").setFontSize(20);
	const title = doc.splitTextToSize(safe(cert.courseTitle), W - 180);
	doc.text(title, W / 2, 322, { align: "center" });
	const after = 322 + title.length * 24;
	doc.setTextColor(75, 85, 99).setFont("helvetica", "normal").setFontSize(11);
	doc.text(`${cert.lessonsCompleted} lessons completed - issued ${new Date(cert.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" })}`, W / 2, after + 8, { align: "center" });

	// footer
	doc.setDrawColor(229, 231, 235).setLineWidth(0.6).line(120, H - 110, W - 120, H - 110);
	doc.setTextColor(107, 114, 128).setFontSize(8).setFont("helvetica", "bold");
	doc.text("CERTIFICATE NUMBER", 120, H - 92);
	doc.text("ISSUED BY", W - 120, H - 92, { align: "right" });
	doc.setTextColor(31, 41, 55).setFontSize(11).setFont("courier", "bold");
	doc.text(cert.number, 120, H - 76);
	doc.setFont("helvetica", "normal");
	doc.text("Sauti Salama", W - 120, H - 76, { align: "right" });
	doc.setTextColor(107, 114, 128).setFontSize(8);
	doc.text(`Verify at sautisalama.org/learn/certificates/${cert.number}`, W / 2, H - 52, { align: "center" });

	const pdf = Buffer.from(doc.output("arraybuffer"));
	return new Response(pdf, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="Sauti-Salama-Certificate-${cert.number}.pdf"`,
			"Cache-Control": "no-store",
		},
	});
}
