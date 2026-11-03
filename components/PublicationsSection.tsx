import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { CircledText } from "@/components/ui/CircledText";
import type { FeedItem } from "@/lib/content/feed";

/**
 * Homepage Publications.
 *
 * One card per publication (image and words together, the whole card is the link). The newest
 * leads as a large card; the next two sit beside it as compact cards, so the section stays short
 * and every item shows its image, type, date, reading time and a clear summary.
 */
export function PublicationsSection({ items }: { items: FeedItem[] }) {
	const [first, ...rest] = items;
	if (!first) return null;
	const side = rest.slice(0, 2);

	return (
		<section id="publications" className="bg-[#f8f9fb] py-12 md:py-24" aria-labelledby="publications-heading">
			<div className="container mx-auto max-w-7xl px-4">
				<div className="relative mb-6 text-center md:mb-8">
					<h2 id="publications-heading" className="relative z-10 text-3xl font-black leading-tight text-sauti-blue md:text-5xl lg:text-7xl">
						Our <CircledText circleColor="#008080">Publications</CircledText>
					</h2>
				</div>
				<p className="mx-auto mb-10 max-w-2xl text-center text-lg font-medium text-gray-600 md:mb-16 md:text-xl">
					Research briefs, legal guides and training modules on gender-based violence in Kenya — written by survivors, free for anyone to use.
				</p>

				<div className={side.length ? "grid gap-6 lg:grid-cols-5 lg:gap-8" : "mx-auto grid max-w-3xl gap-6"}>
					<LeadCard item={first} wide={side.length > 0} />
					{side.length > 0 && (
						<div className="flex flex-col gap-6 lg:col-span-2 lg:gap-8">
							{side.map((item) => (
								<CompactCard key={item.slug} item={item} />
							))}
						</div>
					)}
				</div>

				<div className="mt-10 flex justify-center md:mt-16">
					<Link
						href="/publications"
						className="group inline-flex items-center gap-3 rounded-full bg-[#1a365d] px-8 py-4 text-base font-black text-white shadow-xl transition-colors hover:bg-sauti-teal md:px-12 md:py-5 md:text-xl"
					>
						All publications
						<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2 md:h-6 md:w-6" aria-hidden />
					</Link>
				</div>
			</div>
		</section>
	);
}

function Thumb({ item, sizes, priority }: { item: FeedItem; sizes: string; priority?: boolean }) {
	return item.image ? (
		<Image src={item.image} alt="" fill priority={priority} sizes={sizes} className="object-cover transition-transform duration-700 group-hover:scale-105" />
	) : (
		<span className="flex h-full w-full items-center justify-center">
			<BookOpen className="h-10 w-10 text-white/70" aria-hidden />
		</span>
	);
}

function Meta({ item, latest }: { item: FeedItem; latest?: boolean }) {
	return (
		<div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-black uppercase tracking-widest md:text-xs">
			{latest && <span className="rounded-full bg-sauti-orange/15 px-2.5 py-0.5 text-sauti-orange">Latest</span>}
			<span className="text-sauti-teal">{item.category}</span>
			<span className="text-gray-300" aria-hidden>•</span>
			<time dateTime={item.date} className="text-gray-400">{item.dateLabel}</time>
		</div>
	);
}

/** The whole card is one link: the title carries it, stretched over the card. */
function TitleLink({ item, className }: { item: FeedItem; className: string }) {
	return (
		<h3 className={className}>
			<Link href={item.href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-4 focus-visible:after:ring-sauti-teal/40 focus-visible:after:rounded-2xl">
				{item.title}
			</Link>
		</h3>
	);
}

function LeadCard({ item, wide }: { item: FeedItem; wide: boolean }) {
	return (
		<article className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-shadow duration-500 hover:shadow-2xl ${wide ? "lg:col-span-3" : ""}`}>
			<div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#1a365d] to-sauti-teal">
				<Thumb item={item} sizes={wide ? "(min-width: 1024px) 58vw, 100vw" : "(min-width: 768px) 768px, 100vw"} priority />
			</div>
			<div className="flex flex-1 flex-col p-6 md:p-10">
				<Meta item={item} latest />
				<TitleLink item={item} className="mb-4 text-2xl font-bold leading-snug text-[#1a365d] transition-colors group-hover:text-sauti-orange md:text-3xl" />
				<p className="mb-6 line-clamp-4 flex-1 text-base leading-relaxed text-gray-500 md:text-lg">{item.summary}</p>
				<div className="flex items-center justify-between text-sm font-bold text-[#1a365d]">
					<span className="inline-flex items-center gap-1.5 text-gray-400">
						<Clock className="h-4 w-4" aria-hidden /> {item.readTime}
					</span>
					<span className="inline-flex items-center gap-2 transition-all group-hover:gap-3 group-hover:text-sauti-orange">
						Read <ArrowRight className="h-4 w-4" aria-hidden />
					</span>
				</div>
			</div>
		</article>
	);
}

function CompactCard({ item }: { item: FeedItem }) {
	return (
		<article className="group relative flex flex-1 overflow-hidden rounded-2xl bg-white shadow-lg transition-shadow duration-500 hover:shadow-2xl max-sm:flex-col">
			<div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#1a365d] to-sauti-teal sm:aspect-auto sm:w-2/5 sm:shrink-0">
				<Thumb item={item} sizes="(min-width: 1024px) 18vw, (min-width: 640px) 35vw, 100vw" />
			</div>
			<div className="flex flex-1 flex-col p-5 md:p-6">
				<Meta item={item} />
				<TitleLink item={item} className="mb-2 text-lg font-bold leading-snug text-[#1a365d] transition-colors group-hover:text-sauti-orange md:text-xl" />
				<p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-gray-500">{item.summary}</p>
				<span className="inline-flex items-center gap-2 text-sm font-bold text-[#1a365d] transition-all group-hover:gap-3 group-hover:text-sauti-orange">
					Read <ArrowRight className="h-4 w-4" aria-hidden />
				</span>
			</div>
		</article>
	);
}
