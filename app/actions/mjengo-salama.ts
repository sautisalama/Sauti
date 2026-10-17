'use server';

import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { looseAdmin } from '@/lib/loose-db';
import { answerAsSalama, type Answer } from '@/lib/mjengo/salama';
import { readableFile } from '@/lib/mjengo/files-text';

type Turn = { role: 'user' | 'assistant'; content: string };
const asker = async () => { const a = await requireAdminActor(); return { id: a.id, email: a.email }; };

/** Ask Salama anything about the organisation's own work. */
async function askSalama_(question: string, history: Turn[] = []): Promise<Answer> {
  return answerAsSalama(await asker(), question, { history: history.slice(-6) });
}

/**
 * Ask Salama during a call. She hears what has been said so far (the lines this device holds, up to the last 150),
 * so "catch me up", "what did we decide" and "what did Joseph promise" work, and she also searches the workspace.
 */
async function askSalamaInCall_(code: string, question: string, lines: { name: string; text: string }[], people: string[] = []): Promise<Answer> {
  const a = await asker();
  const { data } = await looseAdmin().from('mjengo_meetings').select('title').eq('code', code).maybeSingle();
  const said = (Array.isArray(lines) ? lines : []).slice(-150).map((l) => `${String(l.name).slice(0, 60)}: ${String(l.text).slice(0, 400)}`).join('\n');
  return answerAsSalama(a, question, {
    live: said || '(nobody has been written down yet: captions may be off)',
    liveLabel: `THE CALL RIGHT NOW${data?.title ? ` ("${data.title}")` : ''}, what has been said so far`,
    people: people.slice(0, 20),
  });
}

/** Ask Salama from a comment on a document: she reads the document as it was last saved and the passage commented on. */
async function askSalamaInDoc_(fileId: string, question: string, quote: string): Promise<Answer> {
  const a = await requireAdminActor();
  const f = await readableFile(a.id, a.email, fileId, 9000);
  return answerAsSalama({ id: a.id, email: a.email }, question, {
    live: `${quote ? `The passage the comment is on: "${quote.slice(0, 600)}"\n\n` : ''}The document "${f.name}":\n${f.text}`,
    liveLabel: 'THE DOCUMENT BEING COMMENTED ON',
  });
}

export const askSalama = guard(askSalama_);
export const askSalamaInCall = guard(askSalamaInCall_);
export const askSalamaInDoc = guard(askSalamaInDoc_);
