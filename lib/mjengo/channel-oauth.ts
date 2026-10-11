import { looseAdmin } from '@/lib/loose-db';
import { encryptField } from '@/lib/security/crypto';
import type { Channel } from '@/lib/mjengo/channels';

export type Provider = 'linkedin' | 'x' | 'meta';

interface Config { id: string | undefined; secret: string | undefined; authorize: string; scope: string; pkce: boolean }

export function providerConfig(p: Provider): Config {
  switch (p) {
    case 'linkedin':
      return { id: process.env.LINKEDIN_CLIENT_ID, secret: process.env.LINKEDIN_CLIENT_SECRET, authorize: 'https://www.linkedin.com/oauth/v2/authorization', scope: 'openid profile email w_member_social', pkce: false };
    case 'x':
      return { id: process.env.X_CLIENT_ID, secret: process.env.X_CLIENT_SECRET, authorize: 'https://twitter.com/i/oauth2/authorize', scope: 'tweet.read tweet.write users.read offline.access', pkce: true };
    case 'meta':
      return {
        id: process.env.META_APP_ID,
        secret: process.env.META_APP_SECRET,
        authorize: 'https://www.facebook.com/v21.0/dialog/oauth',
        scope: 'pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management',
        pkce: false,
      };
  }
}

export const isProvider = (v: string): v is Provider => v === 'linkedin' || v === 'x' || v === 'meta';

/** Which providers have credentials on this server. */
export function availableProviders(): Record<Provider, boolean> {
  return { linkedin: !!providerConfig('linkedin').id, x: !!providerConfig('x').id, meta: !!providerConfig('meta').id };
}

async function save(row: { channel: Channel; account_id: string; account_name: string | null; access: string; refresh?: string | null; expiresIn?: number | null; meta?: Record<string, unknown>; by: string }) {
  await looseAdmin().from('mjengo_channel_connections').upsert(
    {
      channel: row.channel,
      account_id: row.account_id,
      account_name: row.account_name,
      access_token_enc: encryptField(row.access),
      refresh_token_enc: row.refresh ? encryptField(row.refresh) : null,
      expires_at: row.expiresIn ? new Date(Date.now() + row.expiresIn * 1000).toISOString() : null,
      meta: row.meta ?? {},
      connected_by: row.by,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'channel,account_id' }
  );
}

/** Exchange the code, find the accounts the person can post to, and keep them. Returns the account names. */
export async function completeConnection(p: Provider, code: string, redirectUri: string, verifier: string | null, userId: string): Promise<string[]> {
  const cfg = providerConfig(p);
  if (!cfg.id) throw new Error('This network is not set up on this site yet.');

  if (p === 'linkedin') {
    const t = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: cfg.id, client_secret: cfg.secret ?? '' }),
      signal: AbortSignal.timeout(20_000),
    });
    const tj = (await t.json()) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!t.ok || !tj.access_token) throw new Error(tj.error_description || 'LinkedIn refused the sign-in.');
    const me = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${tj.access_token}` }, signal: AbortSignal.timeout(15_000) });
    const mj = (await me.json()) as { sub?: string; name?: string };
    if (!mj.sub) throw new Error('Could not read the LinkedIn profile.');
    await save({ channel: 'linkedin', account_id: mj.sub, account_name: mj.name ?? 'LinkedIn', access: tj.access_token, expiresIn: tj.expires_in, by: userId });
    return [mj.name ?? 'LinkedIn'];
  }

  if (p === 'x') {
    const t = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cfg.secret ? { Authorization: `Basic ${Buffer.from(`${cfg.id}:${cfg.secret}`).toString('base64')}` } : {}) },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: cfg.id, code_verifier: verifier ?? '' }),
      signal: AbortSignal.timeout(20_000),
    });
    const tj = (await t.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
    if (!t.ok || !tj.access_token) throw new Error(tj.error_description || 'X refused the sign-in.');
    const me = await fetch('https://api.twitter.com/2/users/me', { headers: { Authorization: `Bearer ${tj.access_token}` }, signal: AbortSignal.timeout(15_000) });
    const mj = (await me.json()) as { data?: { id?: string; username?: string } };
    if (!mj.data?.id) throw new Error('Could not read the X account.');
    await save({ channel: 'x', account_id: mj.data.id, account_name: mj.data.username ? `@${mj.data.username}` : 'X', access: tj.access_token, refresh: tj.refresh_token, expiresIn: tj.expires_in, by: userId });
    return [mj.data.username ? `@${mj.data.username}` : 'X'];
  }

  // Meta: Facebook Pages the person manages, and the Instagram accounts linked to them.
  const t = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({ client_id: cfg.id, client_secret: cfg.secret ?? '', redirect_uri: redirectUri, code })}`, { signal: AbortSignal.timeout(20_000) });
  const tj = (await t.json()) as { access_token?: string; error?: { message?: string } };
  if (!t.ok || !tj.access_token) throw new Error(tj.error?.message || 'Meta refused the sign-in.');
  const pages = await fetch(`https://graph.facebook.com/v21.0/me/accounts?${new URLSearchParams({ fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: tj.access_token })}`, { signal: AbortSignal.timeout(20_000) });
  const pj = (await pages.json()) as { data?: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[]; error?: { message?: string } };
  if (!pages.ok) throw new Error(pj.error?.message || 'Could not list your Facebook Pages.');
  const names: string[] = [];
  for (const pg of pj.data ?? []) {
    await save({ channel: 'facebook', account_id: pg.id, account_name: pg.name, access: pg.access_token, by: userId });
    names.push(pg.name);
    if (pg.instagram_business_account) {
      const ig = pg.instagram_business_account;
      await save({ channel: 'instagram', account_id: ig.id, account_name: ig.username ? `@${ig.username}` : pg.name, access: pg.access_token, meta: { page_id: pg.id }, by: userId });
      names.push(ig.username ? `@${ig.username}` : 'Instagram');
    }
  }
  if (!names.length) throw new Error('No Facebook Pages were found for that account.');
  return names;
}
