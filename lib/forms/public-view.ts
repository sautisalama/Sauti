import type { PublicForm } from "@/app/actions/public-forms";
import type { FormSettings, FormTheme, Question } from "@/lib/forms/schema";

/** The form as the public sees it, built from what the builder holds (nothing is saved or sent). */
export function toPublicForm(f: { slug: string; title: string; description: string | null; questions: Question[]; settings: FormSettings }): PublicForm {
	const s = f.settings ?? {};
	return {
		slug: f.slug,
		title: f.title || "Untitled form",
		description: f.description || null,
		questions: f.questions,
		collectEmail: !!s.collectEmail,
		unavailable: null,
		confirmation: s.confirmation || "Thank you.",
		layout: s.layout === "single" ? "single" : "page",
		allowAnonymous: s.allowAnonymous !== false,
		images: s.images ?? [],
		accent: s.style?.accent || "#068297",
		background: s.style?.background || "#f4f7f8",
		theme: s.theme ?? {},
		welcome: s.welcome?.enabled ? s.welcome : null,
		responder: null,
	};
}

export interface ThemePreset { id: string; name: string; accent: string; background: string; theme: FormTheme }

/** Starting points, like a theme gallery. Each can be changed afterwards. */
export const THEME_PRESETS: ThemePreset[] = [
	{ id: "sauti", name: "Sauti", accent: "#068297", background: "#f4f7f8", theme: { font: "sans", radius: "md" } },
	{ id: "midnight", name: "Midnight", accent: "#fbbf24", background: "#0f172a", theme: { font: "sans", radius: "md", background: { kind: "color", value: "#0f172a" }, questionColor: "#ffffff", answerColor: "#fde68a", buttonColor: "#fbbf24", buttonText: "#0f172a" } },
	{ id: "sunrise", name: "Sunrise", accent: "#ea580c", background: "#fff7ed", theme: { font: "rounded", radius: "full", background: { kind: "color", value: "#fff7ed" }, questionColor: "#7c2d12", answerColor: "#c2410c", buttonColor: "#ea580c", buttonText: "#ffffff" } },
	{ id: "paper", name: "Paper", accent: "#111827", background: "#fafaf9", theme: { font: "serif", radius: "none", background: { kind: "color", value: "#fafaf9" }, questionColor: "#1c1917", answerColor: "#44403c", buttonColor: "#1c1917", buttonText: "#fafaf9" } },
	{ id: "forest", name: "Forest", accent: "#a7f3d0", background: "#14532d", theme: { font: "sans", radius: "md", background: { kind: "color", value: "#14532d" }, questionColor: "#ecfdf5", answerColor: "#a7f3d0", buttonColor: "#a7f3d0", buttonText: "#14532d" } },
	{ id: "violet", name: "Violet", accent: "#7c3aed", background: "#f5f3ff", theme: { font: "rounded", radius: "md", background: { kind: "color", value: "#f5f3ff" }, questionColor: "#2e1065", answerColor: "#6d28d9", buttonColor: "#7c3aed", buttonText: "#ffffff" } },
];
