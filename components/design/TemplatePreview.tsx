"use client";

import { useEffect, useState } from "react";
import { ASPECT, encodeSrc, sceneDataUrl, type DesignTemplate } from "@/lib/mjengo/design-templates";
import { ensureFont } from "@/lib/mjengo/fonts";
import { cn } from "@/lib/utils";

/**
 * A true-to-layout preview of a template: the same layers the editor builds, drawn at card size. Text sizes use
 * container-height units, so the preview scales with the card like the real page does.
 */
export function TemplatePreview({ template, className }: { template: DesignTemplate; className?: string }) {
	const a = ASPECT[template.size];
	const [, setReady] = useState(0);
	// Web fonts load on demand; draw again once they are here.
	useEffect(() => {
		const fams = Array.from(new Set(template.layers.flatMap((l) => (l.t === "text" && l.font ? [l.font] : []))));
		let on = true;
		Promise.all(fams.map((f) => ensureFont(f))).then(() => on && fams.length && setReady((n) => n + 1));
		return () => { on = false; };
	}, [template]);

	return (
		<div
			className={cn("relative w-full overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5", className)}
			style={{ aspectRatio: `${a.w} / ${a.h}`, background: template.bg2 ? `linear-gradient(180deg, ${template.bg}, ${template.bg2})` : template.bg, containerType: "size" }}
			aria-hidden
		>
			{template.layers.map((l, i) => {
				const base: React.CSSProperties = { position: "absolute", left: `${l.x * 100}%`, top: `${l.y * 100}%` };
				const pct = (v: number) => `${v * 100}%`;
				// Corner radius is a fraction of the shorter side, the same rule the editor uses.
				const radius = (r: { w: number; h: number; r?: number }) => (r.r ? `${((r.r * Math.min(r.w * a.w, r.h * a.h)) / a.w) * 100}cqw` : undefined);
				if (l.t === "rect") {
					const ghost = l.fill === "transparent";
					return <div key={i} style={{ ...base, width: pct(l.w), height: pct(l.h), background: ghost ? undefined : l.fill, border: ghost ? "1.5px solid currentColor" : undefined, opacity: ghost ? 0.3 : 1, borderRadius: radius(l) }} />;
				}
				if (l.t === "line") return <div key={i} style={{ ...base, width: pct(l.w), height: `${l.th * 100}cqh`, background: l.color }} />;
				if (l.t === "photo") {
					return (
						// eslint-disable-next-line @next/next/no-img-element
						<img key={i} alt="" loading="lazy" src={l.src ? encodeSrc(l.src) : sceneDataUrl(l.scene ?? "hills", l.fill, 400, Math.max(120, Math.round((400 * (l.h * a.h)) / (l.w * a.w))))} style={{ ...base, width: pct(l.w), height: pct(l.h), objectFit: "cover", borderRadius: radius(l) }} />
					);
				}
				if (l.t === "circle") return <div key={i} style={{ ...base, width: `${l.d * 100}cqw`, height: `${l.d * 100}cqw`, background: l.fill, borderRadius: "9999px" }} />;
				return (
					<div
						key={i}
						style={{
							...base,
							width: pct(l.w),
							color: l.color,
							fontFamily: `${l.font ? `"${l.font}", ` : ""}Inter, system-ui, sans-serif`,
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
