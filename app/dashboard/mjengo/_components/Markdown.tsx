import { Fragment, type ReactNode } from "react";

/** Inline: **bold**, *italic*, `code` and [links](https://...). Everything else is plain text (React escapes it). */
function inline(s: string, key: string): ReactNode[] {
	const out: ReactNode[] = [];
	const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
	let last = 0;
	let m: RegExpExecArray | null;
	let i = 0;
	while ((m = re.exec(s))) {
		if (m.index > last) out.push(s.slice(last, m.index));
		const t = m[0];
		const k = `${key}-${i++}`;
		if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
		else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-black/[0.06] px-1 py-0.5 text-[0.9em]">{t.slice(1, -1)}</code>);
		else if (t.startsWith("[")) {
			const l = /^\[([^\]]+)\]\((.+)\)$/.exec(t)!;
			out.push(<a key={k} href={l[2]} target="_blank" rel="noopener noreferrer" className="text-sauti-teal underline underline-offset-2">{l[1]}</a>);
		} else out.push(<em key={k}>{t.slice(1, -1)}</em>);
		last = m.index + t.length;
	}
	if (last < s.length) out.push(s.slice(last));
	return out;
}

/** Small Markdown renderer for assistant replies: paragraphs, headings, lists, code blocks. No raw HTML. */
export function Markdown({ text }: { text: string }) {
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	const blocks: ReactNode[] = [];
	let i = 0;
	let n = 0;
	while (i < lines.length) {
		const l = lines[i];
		if (l.startsWith("```")) {
			const code: string[] = [];
			i++;
			while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
			i++;
			blocks.push(<pre key={n++} className="my-3 overflow-x-auto rounded-xl bg-[#1f1f1f] p-4 text-[13px] leading-relaxed text-white"><code>{code.join("\n")}</code></pre>);
			continue;
		}
		const h = /^(#{1,3})\s+(.*)$/.exec(l);
		if (h) {
			blocks.push(<p key={n++} className="mb-2 mt-4 text-base font-semibold">{inline(h[2], `h${n}`)}</p>);
			i++;
			continue;
		}
		if (/^\s*[-*]\s+/.test(l)) {
			const items: string[] = [];
			while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
			blocks.push(<ul key={n++} className="my-2 list-disc space-y-1 pl-6">{items.map((t, k) => <li key={k}>{inline(t, `u${n}-${k}`)}</li>)}</ul>);
			continue;
		}
		if (/^\s*\d+[.)]\s+/.test(l)) {
			const items: string[] = [];
			while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
			blocks.push(<ol key={n++} className="my-2 list-decimal space-y-1 pl-6">{items.map((t, k) => <li key={k}>{inline(t, `o${n}-${k}`)}</li>)}</ol>);
			continue;
		}
		if (!l.trim()) { i++; continue; }
		const para: string[] = [];
		while (i < lines.length && lines[i].trim() && !lines[i].startsWith("```") && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) para.push(lines[i++]);
		blocks.push(
			<p key={n++} className="my-2">
				{para.map((t, k) => <Fragment key={k}>{k > 0 && <br />}{inline(t, `p${n}-${k}`)}</Fragment>)}
			</p>
		);
	}
	return <>{blocks}</>;
}
