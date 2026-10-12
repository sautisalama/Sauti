/**
 * A small Markdown to HTML converter for pasted notes: headings, bold, italic, strike, code, links, quotes,
 * bullet and numbered lists, task lists, horizontal rules and fenced code. No raw HTML passes through.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s: string): string {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  t = t.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_m, a, b) => `<strong>${a ?? b}</strong>`);
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
  t = t.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  t = t.replace(/!\[([^\]]*)\]\((https?:[^\s)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\[([^\]]+)\]\((https?:[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>');
  return t;
}

/** Does this look like Markdown rather than plain prose? */
export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length < 3) return false;
  const signs = [
    /^#{1,6}\s+\S/m,
    /^\s*[-*+]\s+\S/m,
    /^\s*\d+[.)]\s+\S/m,
    /\*\*[^*\n]+\*\*/,
    /^>\s+\S/m,
    /\[[^\]]+\]\(https?:[^)]+\)/,
    /^```/m,
    /^\s*---+\s*$/m,
    /^\s*[-*]\s+\[[ xX]\]\s/m,
  ];
  return signs.filter((re) => re.test(text)).length >= 1 && (text.includes('\n') || /\*\*|\]\(|^#{1,6}\s/.test(text));
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(3, h[1].length);
      out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(q.join(' '))}</p></blockquote>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      out.push(`<ul>${items.map((t) => `<li><p>${inline(t.replace(/^\[[ xX]\]\s+/, ''))}</p></li>`).join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      out.push(`<ol>${items.map((t) => `<li><p>${inline(t)}</p></li>`).join('')}</ol>`);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>\s?|\s*[-*+]\s+|\s*\d+[.)]\s+|\s*([-*_])\2{2,}\s*$)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${para.map((l) => inline(l.trim())).join('<br>')}</p>`);
  }
  return out.join('');
}
