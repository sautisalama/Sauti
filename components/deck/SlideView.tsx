"use client";

import type { CSSProperties } from "react";
import { H, W, resolve, type El, type Slide, type Theme } from "@/lib/deck/model";

/** Pictures kept in the library are written "asset:<id>"; this turns them into links. */
export const srcOf = (src: string | undefined, urls: Record<string, string>) => (src?.startsWith("asset:") ? urls[src.slice(6)] : src);

export function elStyle(e: El, t: Theme, scale: number): CSSProperties {
	return { position: "absolute", left: e.x * scale, top: e.y * scale, width: e.w * scale, height: e.h * scale, opacity: e.opacity ?? 1 };
}

/** The words of a text box, drawn at the slide's scale. */
export function textStyle(e: El, t: Theme, scale: number): CSSProperties {
	return {
		fontFamily: `${e.font === "heading" ? t.heading : t.body}, system-ui, sans-serif`,
		fontSize: (e.size ?? 24) * scale,
		fontWeight: e.bold ? 700 : 400,
		fontStyle: e.italic ? "italic" : "normal",
		textAlign: e.align ?? "left",
		color: resolve(t, e.color),
		lineHeight: 1.22,
		whiteSpace: "pre-wrap",
		wordBreak: "break-word",
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
		justifyContent: e.valign === "middle" ? "center" : e.valign === "bottom" ? "flex-end" : "flex-start",
	};
}

/** One slide, drawn at a width (the page is 960 x 540 and scales down). Not interactive: the editor lays its own handles over it. */
export function SlideView({ slide, theme, width, urls = {}, hide }: { slide: Slide; theme: Theme; width: number; urls?: Record<string, string>; hide?: string | null }) {
	const scale = width / W;
	return (
		<div className="relative shrink-0 overflow-hidden" style={{ width, height: H * scale, background: resolve(theme, slide.bg, "@bg") }}>
			{slide.els.map((e) => {
				if (e.id === hide) return null;
				if (e.type === "text") return <div key={e.id} style={{ ...elStyle(e, theme, scale), ...textStyle(e, theme, scale) }}>{e.text}</div>;
				if (e.type === "image") {
					const src = srcOf(e.src, urls);
					// eslint-disable-next-line @next/next/no-img-element
					return src ? <img key={e.id} src={src} alt={e.alt ?? ""} draggable={false} style={{ ...elStyle(e, theme, scale), objectFit: e.fit ?? "cover" }} /> : <div key={e.id} style={{ ...elStyle(e, theme, scale), background: resolve(theme, "@surface") }} />;
				}
				return <div key={e.id} style={{ ...elStyle(e, theme, scale), background: resolve(theme, e.fill, "@surface"), borderRadius: e.shape === "ellipse" ? "50%" : e.shape === "round" ? 18 * scale : 0 }} />;
			})}
		</div>
	);
}
