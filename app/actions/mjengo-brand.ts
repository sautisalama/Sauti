'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { getActor } from '@/lib/access/super-admin';
import { logAudit } from '@/lib/access/audit';
import { requireModule } from '@/lib/access/permissions';
import { askAi } from '@/lib/mjengo/ai';
import { readableFile } from '@/lib/mjengo/files-text';
import { cleanBrand, loadBrandRow, type Brand } from '@/lib/mjengo/brand';

/** The tag a Files document carries when it is the organisation's official brand guidelines. */
const TAG = 'brand-guidelines';

/** The brand, for anyone signed in to the suite (it is used in documents, forms and designs by everyone). */
async function get_(): Promise<Brand> {
  const a = await getActor();
  if (!a) throw new Error('Sign in first.');
  return loadBrandRow();
}

async function persist(b: Brand, by: string, fileId: string | null): Promise<Brand> {
  const { error } = await looseAdmin().from('mjengo_brand').upsert({ id: 'org', data: b, guidelines_file_id: fileId, updated_by: by, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error('Could not save the brand.');
  return loadBrandRow();
}

/** Change the brand by hand: colours, fonts, logo and letterhead. */
async function save_(patch: Partial<Brand>): Promise<Brand> {
  const a = await requireModule('design', 'write');
  const cur = await loadBrandRow();
  const next = cleanBrand({ ...cur, ...patch, guidelines: cur.guidelines, rules: patch.rules ?? cur.rules }, cur);
  const out = await persist(next, a.id, cur.guidelines?.fileId ?? null);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'mjengo.brand.updated', targetType: 'brand', targetLabel: out.name });
  return out;
}

interface Extract {
  name?: string; tagline?: string; contact?: string; address?: string;
  colours?: string[]; primary?: string; secondary?: string; accent?: string; muted?: string;
  heading_font?: string; body_font?: string;
  letterhead_align?: string; letterhead_rule?: boolean;
  rules?: string[];
}

/** Read the guidelines document and turn it into the brand profile every tool uses. */
async function read(actorId: string, actorEmail: string, fileId: string, cur: Brand): Promise<{ brand: Brand; name: string }> {
  const f = await readableFile(actorId, actorEmail, fileId, 14000);
  if (f.text.trim().length < 80) throw new Error('That file has no readable text. Use a Word document, PDF or text file.');
  const raw = await askAi(
    'You read an organisation\'s brand guidelines and extract them for software. Reply with one JSON object: {"name": string, "tagline": string, "contact": string, "address": string, "colours": string[] (hex #RRGGBB, brand colours in order of importance), "primary": hex, "secondary": hex, "accent": hex, "muted": hex, "heading_font": string, "body_font": string, "letterhead_align": "left"|"center"|"right", "letterhead_rule": boolean, "rules": string[]}. "rules" lists every usage rule that appears in the document as one short sentence each: where the logo and letterhead go and how big, clear space, how headers, footers and page numbers are set, colour use (what is for text, backgrounds, accents), font sizes, tone of voice, and what must not be done. Use only what the document says. Leave a field out when the document does not say.',
    f.text,
    1400,
    { json: true, temperature: 0.1 }
  );
  let j: Extract = {};
  try { j = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}'); } catch { /* nothing readable came back */ }
  if (!j.colours?.length && !j.rules?.length && !j.heading_font) throw new Error('Could not find brand details in that document. Check that it is the guidelines.');
  const merged = cleanBrand({
    name: j.name || cur.name,
    tagline: j.tagline ?? cur.tagline,
    contact: j.contact ?? cur.contact,
    address: j.address ?? cur.address,
    colours: j.colours?.length ? j.colours : cur.colours,
    palette: { primary: j.primary ?? cur.palette.primary, secondary: j.secondary ?? cur.palette.secondary, accent: j.accent ?? cur.palette.accent, muted: j.muted ?? cur.palette.muted },
    fonts: { heading: j.heading_font || cur.fonts.heading, body: j.body_font || cur.fonts.body },
    letterhead: { align: (j.letterhead_align as Brand['letterhead']['align']) || cur.letterhead.align, rule: j.letterhead_rule ?? cur.letterhead.rule, logoWidth: cur.letterhead.logoWidth },
    logo: cur.logo,
    rules: j.rules?.length ? j.rules : cur.rules,
    guidelines: { fileId, name: f.name, readAt: new Date().toISOString() },
  }, cur);
  return { brand: merged, name: f.name };
}

/** Tag a document as the official brand guidelines (or clear it) and read it into the brand. */
async function tag_(fileId: string | null): Promise<Brand> {
  const a = await requireModule('design', 'write');
  const db = looseAdmin();
  const cur = await loadBrandRow();
  // Only one document carries the tag.
  const { data: tagged } = await db.from('vault_files').select('id, tags').contains('tags', [TAG]);
  for (const t of (tagged ?? []) as { id: string; tags: string[] }[]) {
    if (t.id !== fileId) await db.from('vault_files').update({ tags: t.tags.filter((x) => x !== TAG) }).eq('id', t.id);
  }
  if (!fileId) {
    const out = await persist({ ...cur, guidelines: null }, a.id, null);
    await logAudit({ actorId: a.id, actorEmail: a.email, action: 'mjengo.brand.guidelines_cleared', targetType: 'brand' });
    return out;
  }
  const { brand, name } = await read(a.id, a.email, fileId, cur);
  const { data: f } = await db.from('vault_files').select('tags').eq('id', fileId).maybeSingle();
  const tags = [...new Set([...((f?.tags ?? []) as string[]), TAG])];
  await db.from('vault_files').update({ tags }).eq('id', fileId);
  const out = await persist(brand, a.id, fileId);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'mjengo.brand.guidelines_set', targetType: 'brand', targetLabel: name });
  return out;
}

/** Read the tagged guidelines again, after the document changed. */
async function reread_(): Promise<Brand> {
  const a = await requireModule('design', 'write');
  const cur = await loadBrandRow();
  if (!cur.guidelines) throw new Error('No document is tagged as the brand guidelines yet.');
  const { brand } = await read(a.id, a.email, cur.guidelines.fileId, cur);
  return persist(brand, a.id, cur.guidelines.fileId);
}

export const getBrand = guard(get_);
export const saveBrand = guard(save_);
export const tagBrandGuidelines = guard(tag_);
export const rereadBrandGuidelines = guard(reread_);
