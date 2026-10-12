import { looseAdmin } from '@/lib/loose-db';
import { runVerification, kindFromCategory } from '@/lib/mjengo/opportunity-verify';
import type { Verification } from '@/lib/mjengo/opportunity-types';

const todayNairobi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const GENERIC_TITLE = /^(shared opportunity|untitled|new opportunity)$/i;

/**
 * Verify a saved opportunity and keep the result with it. Empty fields are filled from what was found
 * (the organisation, a stated deadline, a better title, a short description); what people typed is never overwritten.
 */
export async function verifyOpportunityRow(id: string, override?: { url?: string; text?: string }): Promise<{ verification: Verification; filled: string[] }> {
  const db = looseAdmin();
  const { data: row } = await db.from('mjengo_opportunities').select('id, title, organisation, kind, deadline, source_url, description').eq('id', id).maybeSingle();
  if (!row) throw new Error('That opportunity no longer exists.');
  const r = row as { title: string | null; organisation: string | null; kind: string; deadline: string | null; source_url: string | null; description: string | null };

  const verification = await runVerification({
    url: override?.url?.trim() || r.source_url,
    text: override?.text ?? r.description,
    title: r.title,
    today: todayNairobi(),
  });

  const patch: Record<string, unknown> = { verification, verified_at: verification.at };
  const filled: string[] = [];
  const hostTitle = r.source_url ? (() => { try { return new URL(r.source_url!).hostname.replace(/^www\./, ''); } catch { return ''; } })() : '';
  if (verification.title && (!r.title || GENERIC_TITLE.test(r.title) || r.title === hostTitle)) { patch.title = verification.title.slice(0, 200); filled.push('title'); }
  if (!r.organisation && verification.organisation) { patch.organisation = verification.organisation.slice(0, 160); filled.push('organisation'); }
  if (!r.deadline && verification.deadline && verification.checks.find((c) => c.id === 'deadline')?.ok) { patch.deadline = verification.deadline; filled.push('deadline'); }
  const mapped = kindFromCategory(verification.category);
  if (r.kind === 'other' && mapped && mapped !== 'other') { patch.kind = mapped; filled.push('type'); }
  if ((!r.description || r.description.length < 40) && (verification.eligibility || verification.website?.description)) {
    patch.description = [verification.website?.description, verification.eligibility && `Who can apply: ${verification.eligibility}`, verification.deliverables && `What is expected: ${verification.deliverables}`].filter(Boolean).join('\n\n').slice(0, 4000);
    filled.push('details');
  }
  await db.from('mjengo_opportunities').update(patch).eq('id', id);
  return { verification, filled };
}
