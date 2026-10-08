import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ImageDown, Linkedin, MessageCircle, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getCertificateByNumber } from "@/lib/courses/certificates";
import { PrintButton } from "@/components/courses/PrintButton";
import { certificateUrl, linkedInAddToProfileUrl, linkedInShareUrl, siteUrl, whatsAppShareUrl, xShareUrl } from "@/lib/courses/linkedin";

type Props = { params: Promise<{ number: string }> };

// Certificates are verified by number, not indexed by search engines. Link previews (LinkedIn, WhatsApp) still work from these tags.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { number } = await params;
	const cert = await getCertificateByNumber(decodeURIComponent(number));
	if (!cert) return { title: "Certificate of completion", robots: { index: false, follow: false } };
	const title = `${cert.learnerName} completed ${cert.courseTitle}`;
	const description = `Certificate of completion from Sauti Salama. Certificate number ${cert.number}.`;
	const image = `${siteUrl()}/api/certificates/${cert.number}/badge`;
	return {
		title: "Certificate of completion",
		robots: { index: false, follow: false },
		openGraph: { title, description, url: certificateUrl(cert.number), type: "website", siteName: "Sauti Salama", images: [{ url: image, width: 1200, height: 630, alt: title }] },
		twitter: { card: "summary_large_image", title, description, images: [image] },
	};
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" });

export default async function CertificatePage({ params }: Props) {
	const { number } = await params;
	const cert = await getCertificateByNumber(decodeURIComponent(number));
	if (!cert) notFound();

	return (
		<div className="flex min-h-screen flex-col bg-serene-neutral-50 print:bg-white">
			<div className="print:hidden"><Nav /></div>
			<main id="main-content" className="flex-1 px-4 py-8 md:py-14">
				<div className="mx-auto max-w-4xl">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
						<p className="flex items-center gap-2 text-sm font-semibold text-serene-green-700"><ShieldCheck className="size-4" aria-hidden /> Verified by Sauti Salama</p>
						<div className="flex flex-wrap gap-2">
							{!cert.anonymous && (
								<>
									<a href={linkedInAddToProfileUrl(cert)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-[#0a66c2] px-4 text-sm font-semibold text-white transition-[transform,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.98]">
										<Linkedin className="size-4" aria-hidden /> Add to LinkedIn profile
									</a>
									<a href={linkedInShareUrl(cert.number)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-serene-neutral-200 bg-white px-4 text-sm font-semibold text-serene-neutral-800 transition-[transform,background-color] duration-150 ease-out hover:bg-serene-neutral-50 active:scale-[0.98]">
										<Linkedin className="size-4" aria-hidden /> Share post
									</a>
									<a href={whatsAppShareUrl(cert)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-[#25d366] px-4 text-sm font-semibold text-white transition-[transform,filter] duration-150 ease-out hover:brightness-95 active:scale-[0.98]">
										<MessageCircle className="size-4" aria-hidden /> WhatsApp
									</a>
									<a href={xShareUrl(cert)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-black px-4 text-sm font-semibold text-white transition-[transform,filter] duration-150 ease-out hover:brightness-125 active:scale-[0.98]">
										<svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden><path d="M18.9 2H22l-7.5 8.6L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8-9.2L1.3 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L6.7 3.9H4.6L17.7 20Z" /></svg> Post on X
									</a>
									<a href={`/api/certificates/${cert.number}/badge?download=1`} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-serene-neutral-200 bg-white px-4 text-sm font-semibold text-serene-neutral-800 transition-[transform,background-color] duration-150 ease-out hover:bg-serene-neutral-50 active:scale-[0.98]">
										<ImageDown className="size-4" aria-hidden /> Badge image
									</a>
								</>
							)}
							<PrintButton />
							<a href={`/api/certificates/${cert.number}/pdf`} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-sauti-teal px-4 text-sm font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-sauti-dark active:scale-[0.98]">
								<Download className="size-4" aria-hidden /> Download PDF
							</a>
						</div>
					</div>

					<article className="relative overflow-hidden rounded-2xl border border-serene-neutral-100 bg-white p-8 shadow-sm md:p-14 print:border-0 print:shadow-none" aria-label="Certificate of completion">
						<div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-sauti-yellow/70" aria-hidden />
						<div className="pointer-events-none absolute inset-5 rounded-lg border border-sauti-teal/25" aria-hidden />
						<div className="relative flex flex-col items-center text-center">
							<Image src="/logo-small.png" alt="Sauti Salama" width={56} height={73} className="h-16 w-auto" />
							<p className="mt-4 text-[11px] font-bold uppercase tracking-[0.25em] text-sauti-teal">Certificate of completion</p>
							<p className="mt-8 text-sm text-serene-neutral-500">This is to certify that</p>
							<h1 className="mt-2 text-3xl font-semibold text-[#1a365d] md:text-5xl">{cert.learnerName}</h1>
							<p className="mt-6 text-sm text-serene-neutral-500">has successfully completed the course</p>
							<h2 className="mt-2 max-w-2xl text-xl font-semibold text-serene-neutral-900 md:text-3xl">{cert.courseTitle}</h2>
							<p className="mt-4 text-sm text-serene-neutral-600">{cert.lessonsCompleted} lessons completed · issued {fmt(cert.issuedAt)}</p>
							<div className="mt-10 grid w-full max-w-xl grid-cols-2 gap-6 border-t border-serene-neutral-100 pt-6 text-left text-xs text-serene-neutral-500">
								<div>
									<p className="font-semibold uppercase tracking-wide">Certificate number</p>
									<p className="mt-1 font-mono text-sm text-serene-neutral-900">{cert.number}</p>
								</div>
								<div className="text-right">
									<p className="font-semibold uppercase tracking-wide">Issued by</p>
									<p className="mt-1 text-sm text-serene-neutral-900">Sauti Salama</p>
								</div>
							</div>
						</div>
					</article>

					<p className="mt-4 text-center text-xs text-serene-neutral-500 print:hidden">
						Anyone can check this certificate by opening <span className="font-mono">/learn/certificates/{cert.number}</span>.{" "}
						{cert.courseSlug && <Link href={`/learn/courses/${cert.courseSlug}`} className="font-semibold text-sauti-teal underline">View the course</Link>}
					</p>
				</div>
			</main>
			<div className="bg-[#00473e] print:hidden"><Footer /></div>
		</div>
	);
}
