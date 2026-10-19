import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { sendNotification } from '@/lib/notifications';
import { cleanTags } from '@/lib/mjengo/autotag';
import { runPlaybooks } from '@/lib/mjengo/playbooks';

export type WonType = 'grant' | 'project' | 'fellowship';

/** What an opportunity becomes when it is won: a grant, a fellowship, or (partnerships, tenders, anything else) a project. */
export const wonTypeFor = (kind: string | null | undefined): WonType => (kind === 'grant' ? 'grant' : kind === 'fellowship' ? 'fellowship' : 'project');

const LABEL: Record<WonType, string> = { grant: 'Grant', project: 'Project', fellowship: 'Fellowship' };
const HREF: Record<WonType, string> = { grant: '/dashboard/mjengo/grants', project: '/dashboard/mjengo/projects', fellowship: '/dashboard/mjengo/fellowships' };

/**
 * An opportunity was won: make the grant, project or fellowship it becomes (once), carry over what it knew (its link, its
 * details, who is responsible, who can see it, the calls and files linked to it) and tag it with what it is. The sections of
 * the suite for that kind of work appear for people from here on. Safe to run twice.
 */
export async function convertWonOpportunity(id: string, actorId: string): Promise<{ type: WonType; id: string } | null> {
  const db = looseAdmin();
  const { data: o } = await db.from('mjengo_opportunities').select('*').eq('id', id).maybeSingle();
  if (!o) return null;
  const opp = o as Record<string, unknown>;
  if (opp.status !== 'won' || opp.converted_to_id) return null;
  const type = wonTypeFor(opp.kind as string);
  const title = String(opp.title ?? 'Untitled');
  const owner = (opp.owner_id as string | null) ?? null;
  const by = (opp.created_by as string | null) ?? actorId;
  const link = (opp.source_url as string | null) ?? null;
  const notes = [`Won from the opportunity "${title}".`, opp.shared_url && opp.shared_url !== link ? `It was shared as ${String(opp.shared_url)}.` : '', typeof opp.notes === 'string' ? opp.notes : ''].filter(Boolean).join(' ');
  const tags = cleanTags([...((opp.tags as string[] | null) ?? []), type, 'won'], 12);
  const shared = { visibility: (opp.visibility as string) === 'restricted' ? 'restricted' : 'team', hidden_fields: (opp.hidden_fields as string[] | null) ?? [], created_by: by, tags };

  let made: { id: string } | null = null;
  if (type === 'grant') {
    const { data } = await db.from('mjengo_grants').insert({ title, funder: opp.organisation ?? null, status: 'awarded', amount: opp.value ?? null, currency: opp.currency ?? 'USD', deadline: opp.deadline ?? null, owner_id: owner, link, description: opp.description ?? null, notes, ...shared }).select('id').single();
    made = data;
  } else if (type === 'fellowship') {
    const { data } = await db.from('mjengo_fellowships').insert({ title, host: opp.organisation ?? null, status: 'accepted', stipend: opp.value ?? null, currency: opp.currency ?? 'USD', deadline: opp.deadline ?? null, owner_id: owner, link, description: opp.description ?? null, notes, ...shared }).select('id').single();
    made = data;
  } else {
    const { data } = await db.from('mjengo_projects').insert({ name: title, status: 'planning', budget: opp.value ?? null, currency: opp.currency ?? 'USD', lead_id: owner, description: [opp.organisation ? `With ${String(opp.organisation)}.` : '', opp.description ?? ''].filter(Boolean).join(' ') || null, notes, ...shared }).select('id').single();
    made = data;
  }
  if (!made) return null;

  await db.from('mjengo_opportunities').update({ converted_to_type: type, converted_to_id: made.id }).eq('id', id);
  // What the opportunity had gathered (linked calls, files, events) comes with it.
  const { data: links } = await db.from('mjengo_links').select('item_type, item_id, auto').eq('entity_type', 'opportunity').eq('entity_id', id);
  if (links?.length) await db.from('mjengo_links').upsert((links as { item_type: string; item_id: string; auto: boolean }[]).map((l) => ({ entity_type: type, entity_id: made!.id, item_type: l.item_type, item_id: l.item_id, auto: l.auto, created_by: actorId })), { onConflict: 'entity_type,entity_id,item_type,item_id', ignoreDuplicates: true });
  await logAudit({ actorId, action: `mjengo.${type}.created`, targetType: type, targetId: made.id, targetLabel: title, details: { from: 'opportunity', opportunity: id } });
  // A grant that is awarded and a project or fellowship that begins start their playbooks.
  await runPlaybooks(type, made.id, type === 'grant' ? 'awarded' : type === 'fellowship' ? 'accepted' : 'planning', actorId).catch(() => undefined);
  const who = owner ?? by;
  if (who) await sendNotification({ userId: who, type: 'system_alert', title: `Won: ${title}`, message: `It is now a ${LABEL[type].toLowerCase()}, tagged and ready to work on.`, link: HREF[type], sendEmail: false }).catch(() => undefined);
  return { type, id: made.id };
}
