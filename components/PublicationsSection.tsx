import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { CircledText } from "@/components/ui/CircledText";
import type { FeedItem } from "@/lib/content/feed";

/**
 * Homepage Publications bento.
 *
 * Mirrors the "Collective Change" section: three columns, the middle one
 * offset downwards, alternating image tile / white text card. Items arrive
 * newest first, so the most recent publication always leads (top-left).
 */
export function PublicationsSection({ items }: { items: FeedItem[] }) {
	const [first, second, third] = items;
	if (!first) return null;

	return (
		<section id="publications" className="py-12 md:py-24 bg-[#f8f9fb]">
			<div className="container px-4 max-w-7xl mx-auto">
				<div className="text-center mb-6 md:mb-8 relative">
					<h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-blue relative z-10 leading-tight">
						Our <CircledText circleColor="#008080">Publications</CircledText>
					</h2>
				</div>
				<p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto font-medium text-center mb-12 md:mb-20">
					Research briefs, legal guides and training modules on gender-based violence
					in Kenya — written by survivors, free for anyone to use.
				</p>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 items-stretch">
					<div className="flex flex-col gap-6 md:gap-10">
						<PublicationImage item={first} priority />
						<PublicationCard item={first} latest />
					</div>

					{second && (
						<div className="flex flex-col gap-6 md:gap-10 md:pt-16">
							<PublicationCard item={second} />
							<PublicationImage item={second} />
						</div>
					)}

					{third && (
						<div className="flex flex-col gap-6 md:gap-10">
							<PublicationImage item={third} />
							<PublicationCard item={third} />
						</div>
					)}
				</div>

				<div className="flex justify-center mt-12 md:mt-20">
					<Link
						href="/publications"
						className="inline-flex items-center gap-3 rounded-full bg-[#1a365d] text-white px-8 md:px-12 py-4 md:py-6 text-base md:text-xl font-black shadow-xl hover:bg-sauti-teal transition-colors group"
					>
						All Publications
						<ArrowRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" />
					</Link>
				</div>
			</div>
		</section>
	);
}

function PublicationImage({ item, priority }: { item: FeedItem; priority?: boolean }) {
	return (
		<Link
			href={item.href}
			tabIndex={-1}
			aria-hidden="true"
			className="rounded-xl md:rounded-2xl overflow-hidden aspect-video relative shadow-2xl hover:scale-[1.02] transition-transform duration-500 bg-gradient-to-br from-[#1a365d] to-sauti-teal flex items-center justify-center"
		>
			{item.image ? (
				<Image src={item.image} alt={item.imageAlt} fill priority={priority} sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
			) : (
				<BookOpen className="w-12 h-12 text-white/70" />
			)}
		</Link>
	);
}

function PublicationCard({ item, latest }: { item: FeedItem; latest?: boolean }) {
	return (
		<article className="bg-white rounded-xl md:rounded-2xl p-6 md:p-10 shadow-xl flex-1 flex flex-col">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 md:mb-6 text-[11px] md:text-xs font-black uppercase tracking-widest">
				{latest && (
					<span className="rounded-full bg-sauti-orange/15 px-2.5 py-0.5 text-sauti-orange">Latest</span>
				)}
				<span className="text-sauti-teal">{item.category}</span>
				<span className="text-gray-300" aria-hidden="true">
					•
				</span>
				<time dateTime={item.date} className="text-gray-400">
					{item.dateLabel}
				</time>
			</div>
			<h3 className="text-2xl md:text-3xl font-bold text-[#1a365d] mb-4 md:mb-6">{item.title}</h3>
			<p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6 md:mb-10 flex-1">{item.summary}</p>
			<Link
				href={item.href}
				className="text-[#1a365d] font-bold border-b-2 border-[#1a365d] w-fit pb-1 hover:text-sauti-orange hover:border-sauti-orange transition-all flex items-center gap-2 group/link"
			>
				<span>
					Read
					<span className="sr-only"> {item.title}</span>
				</span>
				<ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
			</Link>
		</article>
	);
}
