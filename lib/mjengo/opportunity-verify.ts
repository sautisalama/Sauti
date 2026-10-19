import { askAi } from '@/lib/mjengo/ai';
import { AGGREGATOR_HOSTS, HUB_HOSTS, SOCIAL_HOSTS, fetchPage, hostOf, type PageMeta } from '@/lib/mjengo/page-fetch';
import { DEADLINE_NOTE, checkDeadline, checkUrl, hostMatchesName, sameIssuer } from '@/lib/mjengo/evidence';
import type { Verification, VerificationCheck, VerificationWebsite } from '@/lib/mjengo/opportunity-types';
import { instagramPost, instagramProfile, isInstagramHost, isXHost, xPost, type SocialPost } from '@/lib/mjengo/social-fetch';

/**
 * The PataNext verification workflow, for the opportunities the team collects.
 *
 *   1. read the shared link (an Instagram post through the shared lookup: its caption, account and tags; other pages as pages)
 *   2. extract the facts with AI, with the exact words behind the deadline
 *   3. check the evidence in code: a deadline only counts if the post states it, a link only if it is there
 *   4. find the organisation's own website (from the post, the page, the link in the Instagram bio, or a web search) and read ITS details
 *   5. decide how far to trust it, and say why
 *
 * The details shown for an opportunity come from the organisation's website, not from the social post.
 */

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const KIND_FROM_CATEGORY: Record<string, string> = {
  grant: 'grant', fellowship: 'fellowship', scholarship: 'fellowship', award: 'grant', conference: 'event', event: 'event', course: 'other',
  consultancy: 'tender', tender: 'tender', internship: 'other', partnership: 'partnership',
};

interface Extracted {
  is_opportunity?: boolean;
  title: string | null;
  issuer: string | null;
  issuer_website: string | null;
  category: string | null;
  deadline: string | null;
  deadline_quote: string | null;
  official_url: string | null;
  eligibility: string | null;
  deliverables: string | null;
  official_email: string | null;
}

const SYSTEM = `You extract one opportunity record (grant, fellowship, scholarship, conference, award, course, consultancy, tender, internship, partnership) from a shared post or web page. Use ONLY the text provided; you cannot browse.

Rules that matter more than completeness:
1. If a field is not in the source, use null. Never guess a deadline, organisation or link. A wrong deadline is worse than none.
2. issuer is the organisation that offers or runs the opportunity (the funder or host), not the account that reposted it.
3. deadline is YYYY-MM-DD and only when the source gives a closing date for applications. Event dates and posting dates are not deadlines. Copy the exact words that give it into deadline_quote.
4. official_url is the link to apply or read the call, and must appear in the source. issuer_website is the organisation's own website if it appears in the source. Do not invent or complete domains.
5. official_email is only an application or enquiries address printed in the source.
6. category is one of: grant, fellowship, scholarship, award, conference, event, course, consultancy, tender, internship, partnership, other.
Return only a JSON object with the keys: is_opportunity, title, issuer, issuer_website, category, deadline, deadline_quote, official_url, eligibility, deliverables, official_email.`;

const asString = (v: unknown, max = 600) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

async function extract(today: string, url: string | null, source: string, jsonLd: unknown[]): Promise<Extracted | null> {
  if (source.trim().length < 20) return null;
  const ld = jsonLd.length ? `\nStructured data on the page (JSON-LD):\n${JSON.stringify(jsonLd).slice(0, 3000)}\n` : '';
  try {
    const raw = await askAi(SYSTEM, `Today (Nairobi): ${today}\nShared link: ${url ?? '(none)'}\nSource text:\n"""\n${source.slice(0, 9000)}\n"""${ld}\nProduce the JSON now.`, 900, { json: true, temperature: 0 });
    const j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) as Record<string, unknown>;
    const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    return {
      is_opportunity: j.is_opportunity !== false,
      title: asString(j.title, 200),
      issuer: asString(j.issuer, 160),
      issuer_website: asString(j.issuer_website, 300),
      category: asString(j.category, 40)?.toLowerCase() ?? null,
      deadline: date(j.deadline),
      deadline_quote: asString(j.deadline_quote, 300),
      official_url: asString(j.official_url, 400),
      eligibility: asString(j.eligibility, 800),
      deliverables: asString(j.deliverables, 800),
      official_email: asString(j.official_email, 160),
    };
  } catch {
    return null;
  }
}

/** The organisation's own website, found with a web search when the post does not link to it. */
async function searchWebsite(issuer: string, title: string | null): Promise<{ url: string; cited: boolean } | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !issuer) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(40_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sauti Salama Suite' },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.7-flash',
        reasoning: { enabled: false },
        temperature: 0,
        max_tokens: 300,
        plugins: [{ id: 'web', max_results: 4 }],
        messages: [
          { role: 'system', content: 'Find the official website of the organisation named by the user, the one it runs itself, not a news article, a social profile or a repost site. Answer with only the bare URL of its homepage, or the word NONE.' },
          { role: 'user', content: `Organisation: ${issuer}${title ? `\nIt offers: ${title}` : ''}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { choices?: { message?: { content?: string; annotations?: { type?: string; url_citation?: { url?: string } }[] } }[] };
    const msg = j.choices?.[0]?.message;
    const answer = /https?:\/\/[^\s)>\]]+/i.exec(msg?.content ?? '')?.[0];
    if (!answer) return null;
    const h = hostOf(answer);
    if (!h || SOCIAL_HOSTS.test(h) || AGGREGATOR_HOSTS.test(h) || HUB_HOSTS.test(h)) return null;
    // A site the search itself cited is trusted as found. An answer with no citation is only a lead: the caller opens it and
    // keeps it only if the page's own name matches the organisation.
    const cited = (msg?.annotations ?? []).some((a) => a.url_citation?.url && hostOf(a.url_citation.url) === h);
    return { url: new URL(answer).origin, cited };
  } catch {
    return null;
  }
}

const SCAM_WORDS = /\b(registration fee|processing fee|application fee|pay (?:a )?fee|send (?:money|mpesa|m-pesa)|mpesa|m-pesa|till number|paybill|western union|bitcoin|gift card|guaranteed (?:grant|loan|visa))\b/i;

function accountFrom(page: PageMeta | null, host: string | null): string | null {
  if (!page || !host || !SOCIAL_HOSTS.test(host)) return null;
  const t = page.title ?? '';
  const handle = /\(@([\w.]{2,40})\)/.exec(t)?.[1] ?? /@([\w.]{2,40})/.exec(page.description ?? '')?.[1];
  const name = /^(.*?)\s*(?:\(@|on (?:Instagram|TikTok|Facebook|X|LinkedIn))/i.exec(t)?.[1]?.trim();
  if (name && handle) return `${name} (@${handle})`;
  return name || (handle ? `@${handle}` : null);
}

function websiteOf(p: PageMeta): VerificationWebsite {
  const host = hostOf(p.finalUrl) ?? '';
  return { url: p.finalUrl, host, title: p.title, description: p.description, image: p.image, favicon: p.favicon, siteName: p.siteName };
}

export async function runVerification(input: { url: string | null; text: string | null; title?: string | null; today: string }): Promise<Verification> {
  const now = new Date().toISOString();
  const text = (input.text ?? '').trim();
  const fromText = text.match(URL_RE) ?? [];
  let shared = input.url?.trim() || fromText[0] || null;
  if (shared && !/^https?:\/\//i.test(shared)) shared = `https://${shared}`;

  // 1. Read the shared link.
  let page: PageMeta | null = null;
  let ig: SocialPost | null = null;
  let fetchError: string | null = null;
  if (shared && isInstagramHost(shared)) {
    // Instagram asks for a sign-in, so it is never read as a page: the caption, author and tags come from the shared lookup.
    const r = await instagramPost(shared);
    ig = r.post;
    if (!ig) fetchError = r.message;
  } else if (shared && isXHost(shared) && (await xPost(shared).then((x) => { if (x) ig = { url: x.url, author: x.handle, caption: x.text, image: null, takenAt: null, kind: 'post', source: 'oembed', mentions: [], tagged: [] }; return !!x; }))) {
    // An X post is read through X's own embed endpoint: its words and where its links really go.
  } else if (shared) {
    try { page = await fetchPage(shared); } catch (e) { fetchError = e instanceof Error ? e.message : 'Could not open that link.'; }
  }
  const sharedHost = hostOf(page?.finalUrl ?? shared);
  const isSocial = !!sharedHost && SOCIAL_HOSTS.test(sharedHost);
  const isAggregator = !!sharedHost && AGGREGATOR_HOSTS.test(sharedHost);
  const account = ig ? (ig.author ? `@${ig.author}` : null) : accountFrom(page, sharedHost);

  const source = [text, ig?.caption, ig?.author ? `Posted by @${ig.author} on ${shared && isXHost(shared) ? 'X' : 'Instagram'}` : '', ig?.tagged.length ? `Accounts tagged in the post: ${ig.tagged.map((h) => `@${h}`).join(', ')}` : '', page?.title, page?.description, !isSocial ? page?.text : '']
    .map((s) => (s ?? '').trim()).filter(Boolean).join('\n\n').slice(0, 14_000);

  // 2. Extract the facts.
  const ex = await extract(input.today, shared, source, page?.jsonLd ?? []);
  const checks: VerificationCheck[] = [];

  // 3. Evidence in code.
  const deadlineEvidence = ex ? checkDeadline(ex.deadline, ex.deadline_quote, source) : 'no_quote';
  const deadline = deadlineEvidence === 'stated' ? ex!.deadline : page?.deadline ?? null;
  const links = [...(page?.links ?? []), ...(source.match(URL_RE) ?? [])];
  const applyEvidence = ex ? checkUrl(ex.official_url, source, links) : 'no_url';
  const applyUrl = ex?.official_url && applyEvidence === 'stated' ? ex.official_url : null;

  // 4. The organisation's own website.
  const organisationHint = ex?.issuer ?? null;
  const candidates: { url: string; via: NonNullable<Verification['foundBy']> }[] = [];
  const push = (u: string | null | undefined, via: NonNullable<Verification['foundBy']>) => {
    if (!u) return;
    const abs = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    const h = hostOf(abs);
    if (!h || SOCIAL_HOSTS.test(h) || AGGREGATOR_HOSTS.test(h)) return;
    if (!candidates.some((c) => hostOf(c.url) === h)) candidates.push({ url: abs, via });
  };
  if (ex?.issuer_website && checkUrl(ex.issuer_website, source, links) === 'stated') push(ex.issuer_website, 'post');
  if (applyUrl) push(applyUrl, 'post');
  if (page && !isSocial && !isAggregator && sharedHost && !HUB_HOSTS.test(sharedHost)) push(page.finalUrl, 'page');
  for (const l of links) {
    const h = hostOf(l);
    if (h && !HUB_HOSTS.test(h)) push(l, 'link');
    else if (h) push(l, 'link'); // shorteners are followed by the fetch
    if (candidates.length >= 5) break;
  }

  const matches = (p: PageMeta) => sameIssuer(organisationHint, p.organisation ?? p.siteName) || hostMatchesName(hostOf(p.finalUrl), organisationHint);
  const tried = new Set<string>();
  // Open candidates in turn. A link hub (Linktree and the like) is never the website itself: its own links are tried instead.
  const attempt = async (list: typeof candidates): Promise<{ page: PageMeta; via: NonNullable<Verification['foundBy']> } | null> => {
    for (let i = 0; i < list.length && i < 8; i++) {
      const c = list[i];
      const key = hostOf(c.url) ?? c.url;
      if (tried.has(key)) continue;
      tried.add(key);
      try {
        const p = await fetchPage(c.url);
        const h = hostOf(p.finalUrl);
        if (!h || p.status >= 400 || SOCIAL_HOSTS.test(h) || AGGREGATOR_HOSTS.test(h)) continue;
        if (HUB_HOSTS.test(h)) {
          for (const l of p.links) {
            const lh = hostOf(l);
            if (lh && !SOCIAL_HOSTS.test(lh) && !AGGREGATOR_HOSTS.test(lh) && !HUB_HOSTS.test(lh) && !list.some((x) => hostOf(x.url) === lh) && list.length < 8) list.push({ url: l, via: c.via });
          }
          continue;
        }
        return { page: p, via: c.via };
      } catch { /* try the next one */ }
    }
    return null;
  };
  let found = await attempt(candidates);

  // The link in the Instagram bio: the poster's own profile first, then the accounts the post tags or mentions (when an
  // aggregator reposts, the organisation behind it is usually named there). Only when the caption's links did not settle it.
  if (ig && shared && isInstagramHost(shared) && (!found || !matches(found.page))) {
    const accounts = [...new Set([ig.author, ...ig.tagged, ...ig.mentions].filter((h): h is string => !!h))].slice(0, 3);
    for (const handle of accounts) {
      const prof = await instagramProfile(handle);
      const fromBio: typeof candidates = [];
      for (const w of prof?.websites ?? []) {
        const wh = hostOf(w);
        if (wh && !SOCIAL_HOSTS.test(wh) && !AGGREGATOR_HOSTS.test(wh)) fromBio.push({ url: w, via: 'bio' });
      }
      for (const w of prof?.websites ?? []) { const wh = hostOf(w); if (wh && HUB_HOSTS.test(wh) && !fromBio.some((c) => c.url === w)) fromBio.push({ url: w, via: 'bio' }); }
      if (!fromBio.length) continue;
      const f = await attempt(fromBio);
      // The poster's own site is only taken when it belongs to the organisation the post is about (an aggregator's bio link
      // is not the funder's website). With no organisation named there is nothing to check it against.
      if (f && (matches(f.page) || !organisationHint) && !found) { found = f; if (matches(f.page)) break; }
      else if (f && matches(f.page)) { found = f; break; }
    }
  }
  let website: PageMeta | null = found?.page ?? null;
  let foundBy: Verification['foundBy'] = found?.via ?? null;
  if (!website && organisationHint) {
    const lead = await searchWebsite(organisationHint, ex?.title ?? null);
    if (lead) {
      try {
        const p = await fetchPage(lead.url);
        if (p.status < 400 && (lead.cited || matches(p))) { website = p; foundBy = 'search'; }
      } catch { /* not reachable */ }
    }
  }

  const siteHost = website ? hostOf(website.finalUrl) : null;
  const organisation = website?.organisation ?? website?.siteName ?? organisationHint ?? (siteHost ? siteHost : null);
  const orgMatch = !!website && (sameIssuer(organisationHint, website.organisation ?? website.siteName) || hostMatchesName(siteHost, organisationHint));

  // 5. Trust.
  let sourceKind: Verification['sourceKind'] = 'unknown';
  if (isSocial) sourceKind = 'social_post';
  else if (isAggregator) sourceKind = 'repost';
  else if (website && siteHost && siteHost === sharedHost) sourceKind = 'official';
  else if (sharedHost) sourceKind = candidates.some((c) => hostOf(c.url) === sharedHost) ? 'official' : 'repost';

  const asksForMoney = SCAM_WORDS.test(source);
  let trust: Verification['trust'] = 'unverified';
  let reason = 'No official website could be found for this yet.';
  if (website) {
    if (orgMatch && foundBy !== 'search') { trust = 'verified'; reason = `The organisation's own website (${siteHost}) was found and its name matches.`; }
    else if (orgMatch) { trust = 'likely'; reason = `A web search points to ${siteHost} as the organisation's site and the name matches.`; }
    else { trust = 'likely'; reason = `A website (${siteHost}) was found, but the organisation name could not be matched to it.`; }
  }
  if (sourceKind === 'repost' && trust !== 'verified') { trust = 'repost'; reason = 'This is a repost on another site. Use the organisation\'s own page.'; }
  if (asksForMoney && trust !== 'verified') { trust = 'suspicious'; reason = 'The post talks about fees or money transfers, and no official source was confirmed.'; }

  checks.push({ id: 'source', label: sourceKind === 'social_post' ? `Posted on ${sharedHost}` : sourceKind === 'official' ? 'Shared from the organisation itself' : sharedHost ? `Shared from ${sharedHost}` : 'No link was shared', ok: sourceKind === 'official' || sourceKind === 'social_post', note: account ?? undefined });
  checks.push({ id: 'website', label: website ? `Original website found: ${siteHost}` : 'Original website not found', ok: !!website, note: foundBy === 'search' ? 'Found with a web search.' : foundBy === 'bio' ? 'Found from the link in the Instagram profile.' : undefined });
  checks.push({ id: 'org', label: organisation ? `From ${organisation}` : 'Organisation not named', ok: !!website && orgMatch });
  checks.push({ id: 'deadline', label: deadline ? `Deadline ${deadline}` : 'No deadline found', ok: deadlineEvidence === 'stated', note: DEADLINE_NOTE[deadlineEvidence] });
  checks.push({ id: 'apply', label: applyUrl ? 'Apply link is in the post' : 'No apply link in the post', ok: !!applyUrl });
  if (asksForMoney) checks.push({ id: 'money', label: 'Mentions fees or money transfers', ok: false });

  return {
    status: 'done',
    at: now,
    trust,
    trustReason: reason,
    sourceKind,
    sourceHost: sharedHost,
    account,
    organisation: organisation ?? null,
    website: website ? websiteOf(website) : null,
    applyUrl,
    title: ex?.title ?? null,
    category: ex?.category ?? null,
    deadline,
    deadlineQuote: deadlineEvidence === 'stated' ? ex!.deadline_quote : null,
    eligibility: ex?.eligibility ?? null,
    deliverables: ex?.deliverables ?? null,
    email: ex?.official_email && source.toLowerCase().includes(ex.official_email.toLowerCase()) ? ex.official_email : null,
    checks,
    foundBy,
    ...(fetchError && !website ? { error: fetchError } : {}),
  };
}

export const kindFromCategory = (category: string | null): string | null => (category ? KIND_FROM_CATEGORY[category] ?? null : null);
