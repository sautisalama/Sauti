import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

/** **bold** and *italic* runs inside one line. */
function runs(line: string): TextRun[] {
  const out: TextRun[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index! > last) out.push(new TextRun(line.slice(last, m.index)));
    const t = m[0];
    out.push(t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true }) : new TextRun({ text: t.slice(1, -1), italics: true }));
    last = m.index! + t.length;
  }
  if (last < line.length) out.push(new TextRun(line.slice(last)));
  return out.length ? out : [new TextRun('')];
}

/**
 * Plain markdown (headings, bullets, bold, italic, paragraphs) as a Word file. The first line starting with "# " is
 * the name or title and is centred; "## " are section headings.
 */
export async function markdownDocx(md: string): Promise<Uint8Array> {
  const children: Paragraph[] = [];
  let first = true;
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      if (level === 1 && first) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: h[2], bold: true, size: 36 })] }));
      else children.push(new Paragraph({ heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 }, children: runs(h[2]) }));
    } else if (/^\s*[-*•]\s+/.test(line)) {
      children.push(new Paragraph({ bullet: { level: /^\s{2,}/.test(raw) ? 1 : 0 }, spacing: { after: 40 }, children: runs(line.replace(/^\s*[-*•]\s+/, '')) }));
    } else {
      children.push(new Paragraph({ spacing: { after: 140 }, children: runs(line) }));
    }
    first = false;
  }
  return new Uint8Array(await Packer.toBuffer(new Document({ styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } }, sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }] })));
}
