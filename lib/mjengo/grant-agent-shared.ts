/** What the browser and the server both need for the grant agent: its shapes, word counting and the Word hand-over. */
export interface Section { id: string; title: string; guidance: string; wordLimit: number | null }
export interface Criterion { name: string; weight: number | null; description: string }
export interface Requirements { sections: Section[]; criteria: Criterion[]; eligibility: string[]; attachments: string[]; notes: string }
export interface Draft { text: string; updatedAt: string }
export interface Review {
  at: string;
  /** 0 to 100, from the criteria weights; null when nothing could be scored. */
  overall: number | null;
  criteria: { name: string; score: number; max: number; feedback: string }[];
  checks: { ok: boolean; text: string }[];
}

export const EMPTY_REQUIREMENTS: Requirements = { sections: [], criteria: [], eligibility: [], attachments: [], notes: '' };

export const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The application as HTML, section by section, for opening as a Word document. */
export function applicationHtml(title: string, funder: string | null, req: Requirements, drafts: Record<string, Draft>): string {
  const body = req.sections.map((s) => {
    const t = drafts[s.id]?.text?.trim();
    if (!t) return '';
    const paras = t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    return `<h2>${esc(s.title)}</h2>${paras}`;
  }).join('');
  return `<h1>${esc(title)}</h1>${funder ? `<p><em>Application to ${esc(funder)}</em></p>` : ''}${body}`;
}
