/**
 * Sign in to a mailbox with Google or Microsoft instead of a password (the only option for most
 * Microsoft 365 / Outlook.com accounts, which no longer accept passwords over IMAP/SMTP).
 * The refresh token is stored encrypted; an access token is fetched fresh for every use.
 */
export type OAuthProvider = 'google' | 'microsoft';

interface Cfg {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  idEnv: string;
  secretEnv: string;
  imap: [string, number, boolean];
  smtp: [string, number, boolean];
  extra?: Record<string, string>;
}

const tenant = () => process.env.MS_TENANT || 'common';

function cfg(p: OAuthProvider): Cfg {
  return p === 'google'
    ? {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'https://mail.google.com/ openid email',
        idEnv: 'GOOGLE_CLIENT_ID',
        secretEnv: 'GOOGLE_CLIENT_SECRET',
        imap: ['imap.gmail.com', 993, true],
        smtp: ['smtp.gmail.com', 465, true],
        extra: { access_type: 'offline', prompt: 'consent' },
      }
    : {
        authUrl: `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`,
        scope: 'offline_access openid email https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
        idEnv: 'MS_CLIENT_ID',
        secretEnv: 'MS_CLIENT_SECRET',
        imap: ['outlook.office365.com', 993, true],
        smtp: ['smtp.office365.com', 587, false],
        extra: { prompt: 'select_account' },
      };
}

export const oauthServers = (p: OAuthProvider) => ({ imap: cfg(p).imap, smtp: cfg(p).smtp });

export function oauthConfigured(p: OAuthProvider): boolean {
  const c = cfg(p);
  return !!process.env[c.idEnv] && !!process.env[c.secretEnv];
}

export const redirectUri = (origin: string, p: OAuthProvider) => `${origin}/api/mjengo/mail/oauth/${p}/callback`;

export function authorizeUrl(p: OAuthProvider, origin: string, state: string, loginHint?: string): string {
  const c = cfg(p);
  const q = new URLSearchParams({
    client_id: process.env[c.idEnv]!,
    redirect_uri: redirectUri(origin, p),
    response_type: 'code',
    scope: c.scope,
    state,
    ...(c.extra ?? {}),
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `${c.authUrl}?${q}`;
}

async function token(p: OAuthProvider, params: Record<string, string>) {
  const c = cfg(p);
  const res = await fetch(c.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env[c.idEnv]!, client_secret: process.env[c.secretEnv]!, ...params }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(json.error_description || json.error || 'The sign-in provider refused the request.');
  return json;
}

export async function exchangeCode(p: OAuthProvider, origin: string, code: string) {
  return token(p, { grant_type: 'authorization_code', code, redirect_uri: redirectUri(origin, p) });
}

export async function accessTokenFromRefresh(p: OAuthProvider, refreshToken: string): Promise<string> {
  const r = await token(p, { grant_type: 'refresh_token', refresh_token: refreshToken });
  return r.access_token!;
}

/** The signed-in address, from the (directly received, TLS-protected) id_token. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8')) as { email?: string; preferred_username?: string };
    return (payload.email || payload.preferred_username || '').toLowerCase() || null;
  } catch {
    return null;
  }
}
