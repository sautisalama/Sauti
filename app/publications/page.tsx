import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CircledText } from "@/components/ui/CircledText";
import { getFeed, type FeedItem } from "@/lib/content/feed";
import { ORGANIZATION } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

// Re-render at most every 5 minutes; publishing also revalidates this page immediately.
export const revalidate = 300;

export const metadata: Metadata = {
	title: "Publications — GBV Research, Legal Guides & Training from Kenya",
	description:
		"Free publications from Sauti Salama: research briefs, legal literacy guides and training modules on gender-based violence in Kenya. Written by survivors, open to everyone.",
	keywords: [
		"GBV research Kenya",
		"gender based violence publications",
		"GBV legal guide Kenya",
		"survivor training materials",
		"GBV toolkit Kenya",
		"Sauti Salama publications",
	],
	alternates: { canonical: "/publications" },
	openGraph: {
		title: "Publications | Sauti Salama",
		description:
			"Research briefs, legal guides and training modules on gender-based violence in Kenya — free to read and share.",
		url: `${ORGANIZATION.url}/publications`,
		type: "website",
	},
};

function collectionSchema(items: FeedItem[]) {
	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"@id": `${ORGANIZATION.url}/publications`,
		name: "Sauti Salama Publications",
		description: "Research briefs, legal literacy guides and training modules on gender-based violence in Kenya.",
		inLanguage: "en-KE",
		isPartOf: { "@id": `${ORGANIZATION.url}/#website` },
		publisher: { "@id": `${ORGANIZATION.url}/#organization` },
		about: { "@type": "Thing", name: "Gender-based violence in Kenya" },
		mainEntity: {
			"@type": "ItemList",
			itemListElement: items.map((item, index) => ({
				"@type": "ListItem",
				position: index + 1,
				url: `${ORGANIZATION.url}${item.href}`,
				item: {
					"@type": "Article",
					name: item.title,
					headline: item.title,
					description: item.summary,
					url: `${ORGANIZATION.url}${item.href}`,
					...(item.image && { image: item.image.startsWith("http") ? item.image : `${ORGANIZATION.url}${item.image}` }),
					datePublished: item.date,
					inLanguage: "en-KE",
					isAccessibleForFree: true,
					author: { "@id": `${ORGANIZATION.url}/#organization` },
					publisher: { "@id": `${ORGANIZATION.url}/#organization` },
				},
			})),
		},
	};
}

export default async function PublicationsPage() {
	const items = await getFeed();

	return (
		<div className="flex min-h-screen flex-col bg-white">
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collectionSchema(items)) }} />
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: jsonLd(
						breadcrumbSchema([
							{ name: "Home", path: "/" },
							{ name: "Publications", path: "/publications" },
						])
					),
				}}
			/>
			<Nav />
			<main id="main-content" className="flex-1">
				<section className="py-12 md:py-24">
					<div className="container px-4 max-w-7xl mx-auto">
						<div className="mb-8 md:mb-12">
							<h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-dark leading-tight">
								Our <CircledText circleColor="#008080">Publications</CircledText>
							</h1>
						</div>
						<p className="text-gray-600 text-lg md:text-2xl max-w-3xl font-medium leading-relaxed mb-12 md:mb-20">
							Everything we learn, we publish. These briefs, legal guides and
							training modules document what survivor-led GBV response looks like
							in Kenya — how survivors navigate the health and justice systems,
							what community responders get right and wrong, and what has to
							change. All of it is free to read, share and adapt.
						</p>

						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
							{items.map((item) => (
								<Link
									key={item.slug}
									href={item.href}
									className="group flex flex-col bg-white rounded-xl md:rounded-2xl overflow-hidden shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-500"
								>
									<div className="aspect-video relative overflow-hidden bg-gradient-to-br from-[#1a365d] to-sauti-teal flex items-center justify-center">
										{item.image ? (
											<Image
												src={item.image}
												alt={item.imageAlt}
												fill
												sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
												className="object-cover group-hover:scale-105 transition-transform duration-700"
											/>
										) : (
											<BookOpen className="w-12 h-12 text-white/70" aria-hidden />
										)}
									</div>
									<div className="p-6 md:p-8 flex flex-col flex-1">
										<div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-[11px] font-black uppercase tracking-widest">
											<span className="text-sauti-teal">{item.category}</span>
											<span className="text-gray-300" aria-hidden="true">•</span>
											<time dateTime={item.date} className="text-gray-400">
												{item.dateLabel}
											</time>
										</div>
										<h2 className="text-xl md:text-2xl font-bold text-[#1a365d] mb-3 group-hover:text-sauti-orange transition-colors">
											{item.title}
										</h2>
										<p className="text-gray-500 text-base leading-relaxed mb-6 flex-1">{item.summary}</p>
										<div className="flex items-center justify-between pt-4 border-t border-gray-100">
											<span className="text-xs font-bold uppercase tracking-widest text-gray-400">{item.readTime}</span>
											<span className="text-[#1a365d] font-black flex items-center gap-2 group-hover:gap-3 transition-all">
												Read <ArrowRight className="w-4 h-4 text-sauti-orange" />
											</span>
										</div>
									</div>
								</Link>
							))}
						</div>

						<div className="mt-16 md:mt-24 rounded-2xl md:rounded-[48px] bg-sauti-teal-light/30 p-8 md:p-16">
							<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-4">Using our work?</h2>
							<p className="text-gray-700 text-base md:text-xl font-medium max-w-3xl leading-relaxed mb-8">
								Our publications are free for community organisations, health
								workers, legal aid providers and researchers across Kenya to use
								and adapt. If you would like the source materials, a
								facilitator&apos;s pack, or a session run with your team, get in
								touch.
							</p>
							<Link
								href="/contact"
								className="inline-flex items-center gap-3 rounded-full bg-sauti-dark text-white px-8 py-4 md:py-5 text-base md:text-lg font-black hover:bg-sauti-teal transition-colors group"
							>
								Contact Us
								<ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
							</Link>
						</div>
					</div>
				</section>
			</main>
			<div className="bg-[#00473e]">
				<Footer />
			</div>
		</div>
	);
}
