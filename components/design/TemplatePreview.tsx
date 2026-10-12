import { ASPECT, type DesignTemplate } from "@/lib/mjengo/design-templates";
import { cn } from "@/lib/utils";

/**
 * A true-to-layout preview of a template: the same layers the editor builds, drawn at card size. Text sizes use
 * container-height units, so the preview scales with the card like the real page does.
 */
export function TemplatePreview({ template, className }: { template: DesignTemplate; className?: string }) {
	const a = ASPECT[template.size];
	return (
		<div
			className={cn("relative w-full overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5", className)}
			style={{ aspectRatio: `${a.w} / ${a.h}`, background: template.bg, containerType: "size" }}
			aria-hidden
		>
			{template.layers.map((l, i) => {
				const base: React.CSSProperties = { position: "absolute", left: `${l.x * 100}%`, top: `${l.y * 100}%` };
				// Fractions of the page height become % of width for squares and circles, so they stay round.
				const wFrac = (v: number) => `${v * 100}%`;
				// Corner radius is a fraction of the shorter side, the same rule the editor uses.
				const radius = (l: { w: number; h: number; r?: number }) => (l.r ? `${((l.r * Math.min(l.w * a.w, l.h * a.h)) / a.w) * 100}cqw` : undefined);
				if (l.t === "rect") return <div key={i} style={{ ...base, width: wFrac(l.w), height: wFrac(l.h), background: l.fill, borderRadius: radius(l) }} />;
				if (l.t === "photo") {
					return (
						<div key={i} style={{ ...base, width: wFrac(l.w), height: wFrac(l.h), background: `linear-gradient(135deg, ${l.fill}, ${l.fill}99)`, borderRadius: radius(l) }}>
							<svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-1/4 w-1/4 text-white/70" fill="currentColor"><path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z" /></svg>
						</div>
					);
				}
				if (l.t === "circle") return <div key={i} style={{ ...base, width: `${l.d * 100}cqw`, height: `${l.d * 100}cqw`, background: l.fill, borderRadius: "9999px" }} />;
				return (
					<div
						key={i}
						style={{
							...base,
							width: wFrac(l.w),
							color: l.color,
							fontFamily: "Inter, system-ui, sans-serif",
							fontSize: `${l.size * 100}cqh`,
							fontWeight: l.bold ? 700 : 400,
							fontStyle: l.italic ? "italic" : "normal",
							letterSpacing: l.spacing ? `${l.spacing / 1000}em` : undefined,
							textAlign: l.align ?? "left",
							lineHeight: l.lh ?? 1.2,
							whiteSpace: "pre-wrap",
						}}
					>
						{l.text}
					</div>
				);
			})}
		</div>
	);
}
