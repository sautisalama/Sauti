import type { Metadata } from "next";
import { sectionFor, sectionHeadline } from "@/lib/seo/sections";
import { sectionImage, socialMeta } from "@/lib/seo/meta";
import { SignInRedirect } from "./SignInRedirect";

/**
 * Where a signed-out visit to a dashboard link lands (the proxy rewrites to here). It describes the section the link
 * points at, so shared Mjengo, blog, learning and calendar links show their own title, text and picture in chats,
 * mail and social feeds, then it sends people to sign in and back. Nothing private is read: the text is per section.
 */
export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
	const { path } = await params;
	const { key, info, record } = sectionFor(path);
	const headline = sectionHeadline(info);
	const title = record && info.one ? `${info.one} · ${headline}` : headline;
	const description = record && info.one ? `${info.one} shared with you on Sauti Salama. Sign in to open it. ${info.description}` : info.description;
	return { title: { absolute: title }, ...socialMeta({ path: `/${path.join("/")}`, title, description, image: sectionImage(key), alt: info.title }) };
}

export default async function SharePreviewPage({ params }: { params: Promise<{ path: string[] }> }) {
	const { path } = await params;
	const { info } = sectionFor(path);
	const next = `/${path.map(encodeURIComponent).join("/")}`;
	return (
		<main className="flex min-h-[100dvh] items-center justify-center bg-serene-neutral-50 px-4 py-10">
			<div className="w-full max-w-md rounded-2xl border border-serene-neutral-100 bg-white p-8 text-center shadow-sm">
				<p className="text-xs font-semibold uppercase tracking-widest text-sauti-teal">{info.label}</p>
				<h1 className="mt-2 text-xl font-bold text-serene-neutral-900">{info.title}</h1>
				<p className="mt-2 text-sm text-serene-neutral-600">{info.description}</p>
				<SignInRedirect next={next} />
			</div>
		</main>
	);
}
