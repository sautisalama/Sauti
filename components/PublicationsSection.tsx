import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CircledText } from "@/components/ui/CircledText";
import { FEATURED_PUBLICATIONS } from "@/lib/publications";

/**
 * Homepage Publications bento.
 *
 * Deliberately mirrors the "Collective Change" section: three columns, the
 * middle one offset downwards, alternating image tile / white text card.
 */
export function PublicationsSection() {
	const [first, second, third] = FEATURED_PUBLICATIONS;

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
					{/* Column 1 — image on top */}
					<div className="flex flex-col gap-6 md:gap-10">
						<PublicationImage
							src={first.image}
							alt={first.imageAlt}
							href={first.href}
						/>
						<PublicationCard publication={first} />
					</div>

					{/* Column 2 — offset, card on top */}
					<div className="flex flex-col gap-6 md:gap-10 md:pt-16">
						<PublicationCard publication={second} />
						<PublicationImage
							src={second.image}
							alt={second.imageAlt}
							href={second.href}
						/>
					</div>

					{/* Column 3 — image on top */}
					<div className="flex flex-col gap-6 md:gap-10">
						<PublicationImage
							src={third.image}
							alt={third.imageAlt}
							href={third.href}
						/>
						<PublicationCard publication={third} />
					</div>
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

function PublicationImage({
	src,
	alt,
	href,
}: {
	src: string;
	alt: string;
	href: string;
}) {
	return (
		<Link
			href={href}
			tabIndex={-1}
			aria-hidden="true"
			className="rounded-xl md:rounded-2xl overflow-hidden aspect-video relative shadow-2xl hover:scale-[1.02] transition-transform duration-500"
		>
			<Image src={src} alt={alt} fill className="object-cover" />
		</Link>
	);
}

function PublicationCard({
	publication,
}: {
	publication: (typeof FEATURED_PUBLICATIONS)[number];
}) {
	return (
		<article className="bg-white rounded-xl md:rounded-2xl p-6 md:p-10 shadow-xl flex-1 flex flex-col">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 md:mb-6 text-[11px] md:text-xs font-black uppercase tracking-widest">
				<span className="text-sauti-teal">{publication.category}</span>
				<span className="text-gray-300" aria-hidden="true">
					•
				</span>
				<time dateTime={publication.date} className="text-gray-400">
					{publication.dateLabel}
				</time>
			</div>
			<h3 className="text-2xl md:text-3xl font-bold text-[#1a365d] mb-4 md:mb-6">
				{publication.title}
			</h3>
			<p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6 md:mb-10 flex-1">
				{publication.summary}
			</p>
			<Link
				href={publication.href}
				className="text-[#1a365d] font-bold border-b-2 border-[#1a365d] w-fit pb-1 hover:text-sauti-orange hover:border-sauti-orange transition-all flex items-center gap-2 group/link"
			>
				<span>
					Read
					<span className="sr-only"> {publication.title}</span>
				</span>
				<ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
			</Link>
		</article>
	);
}
