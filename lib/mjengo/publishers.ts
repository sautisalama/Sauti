import { looseAdmin } from '@/lib/loose-db';
import { decryptField, encryptField } from '@/lib/security/crypto';
import { CHANNEL_INFO, CHANNELS, textFor, withUtm, type Channel, type Variant } from '@/lib/mjengo/channels';

export interface PostForPublish {
  id: string;
  title: string | null;
  body: string;
  channels: Channel[];
  media: string[];
  variants: Partial<Record<Channel, Variant>>;
  link_url: string | null;
  results: Record<string, { ok: boolean; message: string; at: string; url?: string }>;
}

interface Connection {
  id: string;
  channel: Channel;
  account_id: string | null;
  account_name: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  meta: Record<string, unknown>;
}

const BUCKET = 'mjengo-docs';

async function connectionsFor(channel: Channel): Promise<Connection[]> {
  const { data } = await looseAdmin().from('mjengo_channel_connections').select('id, channel, account_id, account_name, access_token_enc, refresh_token_enc, expires_at, meta').eq('channel', channel);
  return (data ?? []) as Connection[];
}

/** Signed links for the post images, valid long enough for the networks to fetch them. */
async function imageUrls(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const db = looseAdmin();
  const { data } = await db.from('mjengo_assets').select('id, path').in('id', ids);
  const out: string[] = [];
  for (const r of (data ?? []) as { id: string; path: string }[]) {
    const s = await db.storage.from(BUCKET).createSignedUrl(r.path, 3600);
    if (s.data?.signedUrl) out.push(s.data.signedUrl);
  }
  return out;
}

async function token(c: Connection): Promise<string> {
  if (c.channel === 'x' && c.refresh_token_enc && c.expires_at && new Date(c.expires_at).getTime() < Date.now() + 60_000) {
    const id = process.env.X_CLIENT_ID;
    const secret = process.env.X_CLIENT_SECRET;
    if (id) {
      const r = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(secret ? { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}` } : {}) },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decryptField(c.refresh_token_enc) ?? '', client_id: id }),
        signal: AbortSignal.timeout(15_000),
      });
      if (r.ok) {
        const t = (await r.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
        await looseAdmin().from('mjengo_channel_connections').update({
          access_token_enc: encryptField(t.access_token),
          refresh_token_enc: t.refresh_token ? encryptField(t.refresh_token) : c.refresh_token_enc,
          expires_at: new Date(Date.now() + (t.expires_in ?? 7200) * 1000).toISOString(),
        }).eq('id', c.id);
        return t.access_token;
      }
    }
  }
  return decryptField(c.access_token_enc) ?? '';
}

const fail = (m: string) => { throw new Error(m); };

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

async function postLinkedIn(c: Connection, text: string, images: string[]): Promise<string | undefined> {
  const t = await token(c);
  const author = `urn:li:person:${c.account_id}`;
  const media: { status: string; media: string }[] = [];
  for (const url of images.slice(0, 4)) {
    const reg = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerUploadRequest: { recipes: ['urn:li:digitalmediaRecipe:feedshare-image'], owner: author, serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }] } }),
      signal: AbortSignal.timeout(20_000),
    });
    const rj = (await json(reg)) as { value?: { asset?: string; uploadMechanism?: Record<string, { uploadUrl?: string }> } };
    const uploadUrl = rj.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    if (!reg.ok || !uploadUrl || !rj.value?.asset) fail('LinkedIn would not accept the image.');
    const bytes = await (await fetch(url)).arrayBuffer();
    const up = await fetch(uploadUrl!, { method: 'PUT', headers: { Authorization: `Bearer ${t}` }, body: Buffer.from(bytes), signal: AbortSignal.timeout(30_000) });
    if (!up.ok) fail('LinkedIn would not accept the image.');
    media.push({ status: 'READY', media: rj.value!.asset! });
  }
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text }, shareMediaCategory: media.length ? 'IMAGE' : 'NONE', ...(media.length ? { media } : {}) } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await json(res);
  if (!res.ok) fail(String(j.message ?? 'LinkedIn did not accept the post.'));
  const id = String(j.id ?? res.headers.get('x-restli-id') ?? '');
  return id ? `https://www.linkedin.com/feed/update/${id}` : undefined;
}

async function postX(c: Connection, text: string): Promise<string | undefined> {
  const t = await token(c);
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await json(res)) as { data?: { id?: string }; detail?: string; title?: string };
  if (!res.ok) fail(j.detail || j.title || 'X did not accept the post.');
  return j.data?.id ? `https://x.com/i/web/status/${j.data.id}` : undefined;
}

async function postFacebook(c: Connection, text: string, images: string[], link: string | null): Promise<string | undefined> {
  const t = decryptField(c.access_token_enc) ?? '';
  const base = `https://graph.facebook.com/v21.0/${c.account_id}`;
  const res = images.length
    ? await fetch(`${base}/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: images[0], caption: text, access_token: t }), signal: AbortSignal.timeout(30_000) })
    : await fetch(`${base}/feed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, ...(link ? { link } : {}), access_token: t }), signal: AbortSignal.timeout(20_000) });
  const j = (await json(res)) as { id?: string; post_id?: string; error?: { message?: string } };
  if (!res.ok) fail(j.error?.message || 'Facebook did not accept the post.');
  const id = j.post_id ?? j.id;
  return id ? `https://www.facebook.com/${id}` : undefined;
}

async function postInstagram(c: Connection, text: string, images: string[]): Promise<string | undefined> {
  if (!images.length) fail('Instagram posts need an image.');
  const t = decryptField(c.access_token_enc) ?? '';
  const base = `https://graph.facebook.com/v21.0/${c.account_id}`;
  const make = await fetch(`${base}/media`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_url: images[0], caption: text, access_token: t }), signal: AbortSignal.timeout(30_000) });
  const mj = (await json(make)) as { id?: string; error?: { message?: string } };
  if (!make.ok || !mj.id) fail(mj.error?.message || 'Instagram did not accept the image.');
  const pub = await fetch(`${base}/media_publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creation_id: mj.id, access_token: t }), signal: AbortSignal.timeout(30_000) });
  const pj = (await json(pub)) as { id?: string; error?: { message?: string } };
  if (!pub.ok) fail(pj.error?.message || 'Instagram did not publish the post.');
  return undefined;
}

/** Publish one post to every channel it names that has a connected account. Records what happened per channel. */
export async function publishPost(post: PostForPublish): Promise<PostForPublish['results']> {
  const results = { ...(post.results ?? {}) };
  const images = await imageUrls(post.media);
  for (const channel of post.channels) {
    if (results[channel]?.ok) continue;
    const at = new Date().toISOString();
    try {
      const conns = await connectionsFor(channel);
      if (!conns.length) throw new Error(`${CHANNEL_INFO[channel].label} is not connected yet.`);
      const text = textFor(post, channel);
      if (text.length > CHANNEL_INFO[channel].limit) throw new Error(`The text is over the ${CHANNEL_INFO[channel].limit} character limit.`);
      const c = conns[0];
      const url =
        channel === 'linkedin' ? await postLinkedIn(c, text, images)
        : channel === 'x' ? await postX(c, text)
        : channel === 'facebook' ? await postFacebook(c, text, images, post.link_url ? withUtm(post.link_url, 'facebook', post.title) : null)
        : await postInstagram(c, text, images);
      results[channel] = { ok: true, message: `Posted to ${c.account_name ?? CHANNEL_INFO[channel].label}`, at, url };
    } catch (e) {
      results[channel] = { ok: false, message: e instanceof Error ? e.message : 'Could not publish.', at };
    }
  }
  const all = post.channels.length > 0 && post.channels.every((c) => results[c]?.ok);
  await looseAdmin().from('mjengo_posts').update({ results, ...(all ? { status: 'posted', posted_at: new Date().toISOString() } : {}) }).eq('id', post.id);
  return results;
}

/** Everything scheduled for now or earlier. Run by the daily job and by the publish-now button. */
export async function publishDue(): Promise<{ due: number; posted: number }> {
  const { data } = await looseAdmin()
    .from('mjengo_posts')
    .select('id, title, body, channels, media, variants, link_url, results')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .limit(20);
  let posted = 0;
  for (const p of (data ?? []) as PostForPublish[]) {
    const r = await publishPost(p);
    if (p.channels.every((c) => r[c]?.ok)) posted += 1;
  }
  return { due: data?.length ?? 0, posted };
}

export { CHANNELS };
