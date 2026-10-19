'use server';

import { guard } from '@/lib/action-result';
import { requireModule } from '@/lib/access/permissions';
import { looseAdmin } from '@/lib/loose-db';
import { randomUUID } from 'node:crypto';
import { askAi } from '@/lib/mjengo/ai';
import { loadBrandRow } from '@/lib/mjengo/brand';
import { loadEngagement } from '@/lib/mjengo/engagement-core';
import { CHANNEL_INFO, type Channel } from '@/lib/mjengo/channels';
import { HASHTAG_LIMIT, googleTrends, ownTags, pickHashtags, relatedWords, searchQuestions, timesFor, upcomingOccasions, type Ideas } from '@/lib/mjengo/ideas';

/** What to post about, which hashtags, and when, for the networks chosen. Read-only; nothing is posted. */
async function ideas_(topic: string, channels: Channel[]): Promise<Ideas> {
  await requireModule('design');
  const t = topic.trim().slice(0, 80);
  const chosen = (channels.length ? channels : (['instagram', 'linkedin', 'x', 'facebook'] as Channel[])).filter((c) => c in HASHTAG_LIMIT);
  const notes: string[] = [];

  const [rawTrends, questions, related, eng, brand] = await Promise.all([
    googleTrends('KE'),
    searchQuestions(t),
    relatedWords(t),
    loadEngagement().catch(() => ({ channels: [], checkedAt: '' })),
    loadBrandRow().catch(() => null),
  ]);
  if (!rawTrends.length) notes.push('Search trends could not be read just now.');
  if (!eng.channels.length) notes.push('Connect Instagram or Facebook to base the times and hashtags on how your own posts did.');
  if (eng.channels.some((c) => c.note)) notes.push(eng.channels.find((c) => c.note)!.note!);

  // Which of today's trends the organisation could credibly speak about: Jev answers yes or no for each.
  const trends = rawTrends.map((r) => ({ ...r, fits: null as boolean | null }));
  try {
    const { decideYesNo, decideConfigured } = await import('@/lib/mjengo/decide');
    if (decideConfigured() && brand) {
      const who = `${brand.name}${brand.tagline ? `, ${brand.tagline}` : ''}${t ? `. Topic of interest: ${t}` : ''}`;
      await Promise.all(trends.slice(0, 14).map(async (tr) => {
        const r = await decideYesNo(`Organisation: ${who}.\nTrending search in Kenya: ${tr.title}${tr.about ? ` (${tr.about})` : ''}`, 'Is this trend close enough to the organisation’s mission that a post about it would be natural and welcome?', 'It connects to the mission or its audience, and commenting would be appropriate.', 'It is unrelated, a sport or entertainment result, or commenting would look opportunistic or insensitive.');
        if (r) tr.fits = r.yes && r.probability >= 0.55;
      }));
    }
  } catch { /* the list is still useful unfiltered */ }
  const ranked = [...trends.slice(0, 14)].sort((a, b) => Number(b.fits === true) - Number(a.fits === true) || Number(a.fits === false) - Number(b.fits === false)).slice(0, 8);

  const own = ownTags(eng.channels);
  const ownTopics = own.filter((o) => o.uses >= 1).slice(0, 6).map((o) => o.tag.replace(/^#/, '').replace(/([a-z])([A-Z])/g, '$1 $2'));
  return {
    topic: t,
    trends: ranked,
    questions,
    related,
    occasions: upcomingOccasions(),
    hashtags: pickHashtags(t, related, ranked, own, chosen),
    times: timesFor(chosen, eng.channels),
    ownTopics,
    notes,
  };
}

export interface DraftIdea { channel: Channel; text: string; why: string }

/** Ready-to-edit posts built from the chosen signals, written for each network's style and hashtag habit. */
async function drafts_(topic: string, channels: Channel[], seeds: string[]): Promise<DraftIdea[]> {
  await requireModule('design');
  const brand = await loadBrandRow().catch(() => null);
  const chosen = channels.filter((c) => c in HASHTAG_LIMIT && c !== 'website').slice(0, 4);
  if (!chosen.length) throw new Error('Choose a network first.');
  const system = `You write social posts for ${brand?.name ?? 'a Kenyan non-profit'}${brand?.tagline ? ` (${brand.tagline})` : ''}. Plain, warm, specific, never sensational. Never invent statistics, quotes or events. Where a post could involve a survivor, keep them anonymous. Return JSON: {"posts":[{"channel":"...","text":"...","why":"one short sentence on why this should do well"}]}. Write one post per network asked for, in that network's voice. Each post respects the network's length (${chosen.map((c) => `${c} ${CHANNEL_INFO[c].limit} characters`).join(', ')}) and uses at most this many hashtags: ${chosen.map((c) => `${c} ${HASHTAG_LIMIT[c]}`).join(', ')}. Start with a hook that is a real question or a clear promise, end with one simple thing the reader can do.`;
  const raw = await askAi(system, `Topic: ${topic || 'our work'}\nBuild on these signals:\n${seeds.slice(0, 8).map((s) => `- ${s}`).join('\n')}\nNetworks: ${chosen.join(', ')}`, 1400, { json: true, temperature: 0.7 });
  try {
    const j = JSON.parse(raw) as { posts?: { channel?: string; text?: string; why?: string }[] };
    return (j.posts ?? []).filter((p) => p.text && chosen.includes(p.channel as Channel)).map((p) => ({ channel: p.channel as Channel, text: p.text!.slice(0, 2200), why: (p.why ?? '').slice(0, 200) }));
  } catch { throw new Error('The AI answer could not be read. Try again.'); }
}

/* ------------------------------------------------------------ Photos people share for posts */

async function photoUpload_(ext: string): Promise<{ path: string; signedUrl: string }> {
  const a = await requireModule('design', 'write');
  const e = ext.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(e)) throw new Error('Share a photo as JPG, PNG, WebP or GIF.');
  const path = `photos/${a.id}-${randomUUID()}.${e}`;
  const { data, error } = await looseAdmin().storage.from('mjengo-docs').createSignedUploadUrl(path);
  if (error || !data) throw new Error('Could not start the upload.');
  return { path, signedUrl: data.signedUrl };
}

async function photoRegister_(path: string, name: string, mime: string, caption: string | null): Promise<{ id: string }> {
  const a = await requireModule('design', 'write');
  if (!path.startsWith(`photos/${a.id}-`)) throw new Error('That upload is not valid.');
  const { data, error } = await looseAdmin().from('mjengo_assets').insert({ name: name.slice(0, 80) || 'Photo', path, mime: mime.startsWith('image/') ? mime : 'image/jpeg', kind: 'image', prompt: caption ? caption.slice(0, 300) : 'Shared photo', created_by: a.id }).select('id').single();
  if (error || !data) throw new Error('Could not save the photo.');
  return { id: data.id };
}

export const contentIdeas = guard(ideas_);
export const draftPosts = guard(drafts_);
export const sharePhotoUpload = guard(photoUpload_);
export const sharePhotoRegister = guard(photoRegister_);
