import { looseAdmin } from '@/lib/loose-db';
import { entitiesFor, entityText } from '@/lib/mjengo/entity-view';
import { fetchPageOrPdf, pageText } from '@/lib/mjengo/safe-fetch';

/** Where the call lives on the funder's own site: the address the shared link ends up at, else the application link found. */
export function funderUrl(row: Record<string, unknown>, fallback = ''): string {
  const v = (row.verification ?? null) as { finalUrl?: string | null; applyUrl?: string | null } | null;
  const ok = (u?: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : '');
  return ok(v?.finalUrl) || ok(v?.applyUrl) || ok(fallback);
}

const clip = (s: string, n: number) => s.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);

/**
 * What an AI chat about an opportunity or grant should know: the record, the funder's own page, and the notes,
 * skills and pages the team added as context. Only what this person may see of the record is used.
 */
export async function entityBrief(actor: { id: string; email: string }, kind: string, id: string): Promise<string> {
  if (kind !== 'grant' && kind !== 'opportunity') return '';
  const entity = (await entitiesFor(actor, [kind])).find((e) => e.id === id);
  if (!entity) return '';
  const out: string[] = [`The opportunity this chat is about:\n${clip(entityText(entity), 3500)}`];
  const src = String(entity.row[kind === 'grant' ? 'link' : 'source_url'] ?? '');
  const funder = funderUrl(entity.row, src);
  if (funder) {
    try {
      const p = await fetchPageOrPdf(funder);
      if (p.kind === 'html') out.push(`The funder's own page for it (${funder}):\n${clip(pageText(p.html), 6000)}`);
    } catch { /* the record is still there */ }
  }
  const { data } = await looseAdmin().from('mjengo_context_items').select('kind, title, body').eq('entity_type', kind).eq('entity_id', id).eq('include', true).in('kind', ['instruction', 'skill', 'note', 'link']).order('created_at');
  for (const r of (data ?? []) as { kind: string; title: string; body: string }[]) {
    if (r.body) out.push(`${r.kind === 'instruction' ? 'Instructions from the team' : r.kind === 'skill' ? `Skills: ${r.title}` : r.kind === 'note' ? `Note: ${r.title}` : `Linked page: ${r.title}`}:\n${clip(r.body, 2500)}`);
  }
  return clip(out.join('\n\n'), 16000);
}
