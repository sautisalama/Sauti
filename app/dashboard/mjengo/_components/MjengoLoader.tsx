import { cn } from "@/lib/utils";

type Variant = "page" | "list" | "cards" | "reader" | "editor";

const Bar = ({ className }: { className?: string }) => <div className={cn("mj-skel rounded-md", className)} />;

/** Rows like an inbox or a table: avatar, two lines, a short time. */
export function ListSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
	return (
		<div className={cn("space-y-1 p-2", className)} aria-hidden>
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
					<div className="mj-skel h-8 w-8 shrink-0 rounded-full" />
					<div className="min-w-0 flex-1 space-y-2"><Bar className="h-3 w-1/3" /><Bar className="h-3 w-4/5" /></div>
					<Bar className="h-3 w-10" />
				</div>
			))}
		</div>
	);
}

/** A grid of cards with a picture and a title. */
export function CardsSkeleton({ cards = 8, className }: { cards?: number; className?: string }) {
	return (
		<div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)} aria-hidden>
			{Array.from({ length: cards }).map((_, i) => (
				<div key={i} className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white p-2">
					<div className="mj-skel aspect-[4/3] w-full rounded-xl" />
					<div className="space-y-2 p-2"><Bar className="h-3 w-3/4" /><Bar className="h-3 w-1/2" /></div>
				</div>
			))}
		</div>
	);
}

/** A message being read: heading, sender line and paragraphs. */
export function ReaderSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("mx-auto max-w-3xl space-y-5 px-6 py-6", className)} aria-hidden>
			<Bar className="h-7 w-2/3" />
			<div className="flex items-center gap-3"><div className="mj-skel h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Bar className="h-3 w-40" /><Bar className="h-3 w-56" /></div></div>
			<div className="space-y-3 pt-2">
				{[100, 96, 92, 100, 70, 0, 98, 90, 60].map((w, i) => (w === 0 ? <div key={i} className="h-3" /> : <div key={i} style={{ width: `${w}%` }}><Bar className="h-3" /></div>))}
			</div>
		</div>
	);
}

/** An editor opening: a toolbar strip over a page. */
export function EditorSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("flex h-full min-h-0 w-full flex-col bg-[#f4f4f2]", className)} aria-hidden>
			<div className="flex items-center gap-2 border-b border-black/[0.06] bg-white px-3 py-2.5">
				<div className="mj-skel h-8 w-8 rounded-lg" /><Bar className="h-5 w-40" /><div className="flex-1" /><Bar className="h-8 w-20" /><Bar className="h-8 w-20" />
			</div>
			<div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden p-6">
				<div className="mj-skel aspect-[3/4] h-full max-h-[80%] rounded-xl shadow-sm" />
			</div>
		</div>
	);
}

/** A whole section opening: a title, a row of stat cards and a list. */
export function PageSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("mx-auto w-full max-w-6xl space-y-5", className)} aria-hidden>
			<div className="space-y-2"><Bar className="h-6 w-48" /><Bar className="h-3 w-80 max-w-full" /></div>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="mj-skel h-24 rounded-2xl" />)}</div>
			<div className="rounded-2xl border border-serene-neutral-200/70 bg-white"><ListSkeleton rows={5} /></div>
		</div>
	);
}

/**
 * What every Mjengo screen shows while it loads: a skeleton in the shape of what is coming, so the page does
 * not jump when it arrives. The label is read out by screen readers.
 */
export function MjengoLoader({ label = "Loading", hint, compact, className, variant }: { label?: string; hint?: string; compact?: boolean; className?: string; variant?: Variant }) {
	const v: Variant = variant ?? (className?.includes("h-full") ? "editor" : compact ? "list" : "page");
	return (
		<div role="status" aria-live="polite" aria-busy="true" className={cn("w-full", className)}>
			<span className="sr-only">{label}{hint ? `. ${hint}` : ""}</span>
			{v === "editor" ? <EditorSkeleton /> : v === "list" ? <ListSkeleton rows={compact ? 4 : 8} /> : v === "cards" ? <CardsSkeleton /> : v === "reader" ? <ReaderSkeleton /> : <PageSkeleton />}
		</div>
	);
}
