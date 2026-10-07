import { ExternalLink } from "lucide-react";
import type { ExternalLink as Source } from "@/types/publishing";

export interface ArticleViewProps {
	title: string;
	summary?: string | null;
	category?: string | null;
	kindLabel?: string;
	coverUrl?: string | null;
	coverAlt?: string | null;
	publishedAt?: string | null;
	readMinutes?: number | null;
	bodyHtml: string;
	links?: Source[];
	tags?: string[];
}

export const KIND_LABEL: Record<string, string> = {
	blog: "Blog",
	publication: "Publication",
	resource: "Resource",
	learn: "Learn",
};

/** Shared by the public article page and the editor preview, so what you preview is what ships. */
export function ArticleView({ title, summary, category, kindLabel, coverUrl, coverAlt, publishedAt, readMinutes, bodyHtml, links = [], tags = [] }: ArticleViewProps) {
	const date = publishedAt ? new Date(publishedAt) : null;
	return (
		<article className="mx-auto max-w-3xl">
			<header className="mb-8">
				<div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-black uppercase tracking-widest">
					{kindLabel && <span className="text-sauti-teal">{kindLabel}</span>}
					{category && (
						<>
							<span className="text-gray-300" aria-hidden>•</span>
							<span className="text-sauti-orange">{category}</span>
						</>
					)}
					{date && (
						<>
							<span className="text-gray-300" aria-hidden>•</span>
							<time dateTime={date.toISOString()} className="text-gray-400">
								{date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
							</time>
						</>
					)}
					{readMinutes ? (
						<>
							<span className="text-gray-300" aria-hidden>•</span>
							<span className="text-gray-400">{readMinutes} min read</span>
						</>
					) : null}
				</div>
				<h1 className="text-3xl font-black leading-tight text-[#1a365d] md:text-5xl">{title || "Untitled"}</h1>
				{summary && <p className="mt-4 text-lg font-medium leading-relaxed text-gray-600 md:text-xl">{summary}</p>}
			</header>

			{coverUrl && (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={coverUrl} alt={coverAlt ?? ""} className="mb-10 aspect-video w-full rounded-2xl object-cover shadow-xl" />
			)}

			{bodyHtml ? (
				<div className="rich-content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
			) : (
				<p className="text-gray-400">Nothing to preview yet.</p>
			)}

			{links.length > 0 && (
				<aside className="mt-12 rounded-2xl border border-gray-200 bg-[#f8f9fb] p-6" aria-labelledby="other-sources">
					<h2 id="other-sources" className="mb-3 text-lg font-black text-[#1a365d]">Other sources</h2>
					<ul className="space-y-2">
						{links.map((l) => (
							<li key={l.url}>
								<a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 font-semibold text-sauti-teal underline underline-offset-4 hover:text-sauti-orange">
									{l.label}
									<ExternalLink className="h-4 w-4" aria-hidden />
									<span className="sr-only">(opens in a new tab)</span>
								</a>
							</li>
						))}
					</ul>
				</aside>
			)}

			{tags.length > 0 && (
				<ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
					{tags.map((t) => (
						<li key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">{t}</li>
					))}
				</ul>
			)}
		</article>
	);
}
