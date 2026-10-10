import { promises as dns } from 'node:dns';

type Server = [host: string, port: number, secure: boolean];

export interface Detected {
  /** google / microsoft use one-click sign-in; password means a mailbox password on a normal mail server. */
  kind: 'google' | 'microsoft' | 'password';
  /** Friendly name for the provider, e.g. "Gmail". */
  label: string;
  imap?: Server;
  smtp?: Server;
  pop?: Server;
  /** Shown to the person for providers that need an app password. */
  hint?: string;
}

const SAUTI: Detected = {
  kind: 'password',
  label: 'Sauti Salama mail',
  imap: ['mail.sautisalama.org', 993, true],
  smtp: ['mail.sautisalama.org', 465, true],
  pop: ['mail.sautisalama.org', 995, true],
};

const GOOGLE_HINT = 'Google asks for an app password when sign-in is not available: Google Account > Security > 2-Step Verification > App passwords.';

const KNOWN: Record<string, Detected> = {
  'gmail.com': { kind: 'google', label: 'Gmail', imap: ['imap.gmail.com', 993, true], smtp: ['smtp.gmail.com', 465, true], hint: GOOGLE_HINT },
  'googlemail.com': { kind: 'google', label: 'Gmail', imap: ['imap.gmail.com', 993, true], smtp: ['smtp.gmail.com', 465, true], hint: GOOGLE_HINT },
  'outlook.com': { kind: 'microsoft', label: 'Outlook', imap: ['outlook.office365.com', 993, true], smtp: ['smtp.office365.com', 587, false] },
  'hotmail.com': { kind: 'microsoft', label: 'Outlook', imap: ['outlook.office365.com', 993, true], smtp: ['smtp.office365.com', 587, false] },
  'live.com': { kind: 'microsoft', label: 'Outlook', imap: ['outlook.office365.com', 993, true], smtp: ['smtp.office365.com', 587, false] },
  'msn.com': { kind: 'microsoft', label: 'Outlook', imap: ['outlook.office365.com', 993, true], smtp: ['smtp.office365.com', 587, false] },
  'yahoo.com': { kind: 'password', label: 'Yahoo Mail', imap: ['imap.mail.yahoo.com', 993, true], smtp: ['smtp.mail.yahoo.com', 465, true], hint: 'Yahoo needs an app password.' },
  'zoho.com': { kind: 'password', label: 'Zoho Mail', imap: ['imap.zoho.com', 993, true], smtp: ['smtp.zoho.com', 465, true] },
  'sautisalama.org': SAUTI,
};

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function mxHosts(domain: string): Promise<string[]> {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 4000);
    return mx.sort((a, b) => a.priority - b.priority).map((m) => m.exchange.toLowerCase().replace(/\.$/, ''));
  } catch {
    return [];
  }
}

function pickServer(xml: string, tag: 'incomingServer' | 'outgoingServer', type: string, domain: string, local: string): Server | null {
  const re = new RegExp(`<${tag}[^>]*type="${type}"[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = re.exec(xml);
  if (!m) return null;
  const grab = (t: string) => new RegExp(`<${t}>\\s*([^<]+?)\\s*</${t}>`, 'i').exec(m[1])?.[1];
  const host = grab('hostname')?.replace(/%EMAILDOMAIN%/gi, domain).replace(/%EMAILLOCALPART%/gi, local);
  const port = Number(grab('port'));
  const socket = (grab('socketType') ?? 'SSL').toUpperCase();
  if (!host || !/^[a-z0-9.-]+$/i.test(host) || !(port > 0 && port < 65536)) return null;
  return [host.toLowerCase(), port, socket === 'SSL'];
}

/** The standard "autoconfig" files that mail hosts publish (the same ones Thunderbird uses). */
async function autoconfig(domain: string, local: string): Promise<Detected | null> {
  const urls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(`${local}@${domain}`)}`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`,
    `https://autoconfig.thunderbird.net/v1.1/${domain}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'error', headers: { Accept: 'application/xml,text/xml' } });
      if (!res.ok) continue;
      const xml = (await res.text()).slice(0, 100_000);
      const imap = pickServer(xml, 'incomingServer', 'imap', domain, local);
      const smtp = pickServer(xml, 'outgoingServer', 'smtp', domain, local);
      const pop = pickServer(xml, 'incomingServer', 'pop3', domain, local) ?? undefined;
      if (imap && smtp) return { kind: 'password', label: domain, imap, smtp, pop };
    } catch {
      /* try the next one */
    }
  }
  return null;
}

const resolves = async (host: string) => {
  try {
    return (await withTimeout(dns.resolve4(host), 3000)).length > 0;
  } catch {
    return false;
  }
};

/**
 * Work out how to reach a mailbox from the address alone, so no one has to know server names:
 * known providers, then the domain's MX records (Google, Microsoft, our own server), then the
 * host's published autoconfig, then a mail.<domain> guess.
 */
export async function detectMailbox(email: string): Promise<Detected> {
  const [local, domainRaw] = email.trim().toLowerCase().split('@');
  const domain = (domainRaw ?? '').trim();
  if (!local || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error('Enter a valid email address.');

  if (KNOWN[domain]) return KNOWN[domain];

  const mx = await mxHosts(domain);
  if (mx.some((h) => /(^|\.)(google|googlemail)\.com$/.test(h))) return { ...KNOWN['gmail.com'], label: 'Google Workspace' };
  if (mx.some((h) => /(^|\.)(outlook|protection\.outlook|office365)\.com$/.test(h))) return { ...KNOWN['outlook.com'], label: 'Microsoft 365' };
  if (mx.some((h) => /(^|\.)sautisalama\.org$/.test(h))) return { ...SAUTI, label: `${domain} (Sauti Salama mail)` };
  if (mx.some((h) => /(^|\.)zoho\.(com|eu|in)$/.test(h))) return { ...KNOWN['zoho.com'], label: `${domain} (Zoho Mail)` };

  const auto = await autoconfig(domain, local);
  if (auto) return auto;

  // Last resort: the usual naming. The connection test afterwards confirms or rejects it.
  const candidates = [`mail.${domain}`, `imap.${domain}`, `webmail.${domain}`, ...mx.slice(0, 1)];
  for (const host of candidates) {
    if (await resolves(host)) return { kind: 'password', label: domain, imap: [host, 993, true], smtp: [host, 465, true], pop: [host, 995, true] };
  }
  return { kind: 'password', label: domain };
}
