// A funder's call that is a PDF: downloaded from a public address, read, kept in the vault (replaced, not
// duplicated, when saved again) and tagged; PDF links on a page are found; the application saves as a Word file.
//   npx tsx --env-file=.env.local scripts/test-pdf-call.mts
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import mammoth from 'mammoth';
import { fetchPageOrPdf, guidelinePdfLinks } from '../lib/mjengo/safe-fetch';
import { textFromBytes } from '../lib/mjengo/files-text';
import { saveToVault } from '../lib/mjengo/vault-save';
import { indexSource } from '../lib/mjengo/search-index';
import { applicationDocx, extractRequirements } from '../lib/mjengo/grant-agent';

let bad = 0;
const ok = (n: string, c: unknown) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };

// 1. A real public PDF.
const live = await fetchPageOrPdf('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
ok('a PDF at a public address is downloaded as bytes', live.kind === 'pdf' && live.bytes.byteLength > 200);
ok('its text is read', live.kind === 'pdf' && /dummy pdf/i.test(await textFromBytes(live.bytes, 'x.pdf', 'application/pdf')));
let refused = false;
try { await fetchPageOrPdf('http://127.0.0.1:3000/'); } catch { refused = true; }
ok('a private address is refused', refused);

// 2. A call written as a PDF.
const lines = [
  'Harmony Trust: Survivor Safety Fund 2027',
  'Who can apply: organisations registered in Kenya with an annual income under USD 500,000.',
  'Section 1, The need (maximum 300 words): describe the problem and who is affected.',
  'Section 2, Your approach (maximum 400 words): what you will do and why it will work.',
  'You must attach: your registration certificate and a safeguarding policy.',
  'How we score: Likely impact 60%, Safeguarding 40%.',
];
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const page = pdf.addPage([595, 842]);
lines.forEach((l, i) => page.drawText(l, { x: 40, y: 780 - i * 22, size: 10, font }));
const bytes = new Uint8Array(await pdf.save());
const text = await textFromBytes(bytes, 'call.pdf', 'application/pdf', 14000);
ok('the text of a PDF call is read', /Section 1/.test(text) && /maximum 300 words/.test(text));
const req = await extractRequirements({ title: 'Safety Fund', funder: 'Harmony Trust', pageText: '', docs: [{ name: 'call.pdf', text }] });
ok('the sections and limits are found from the PDF', req.sections.length >= 2 && req.sections.some((s) => s.wordLimit === 300) && req.criteria.some((c) => c.weight === 60));

// 3. PDF links on a page.
const html = '<a href="/files/Call-Guidelines-2027.pdf">Download the call guidelines</a> <a href="/news/newsletter.pdf">Our newsletter</a> <a href="https://x.org/apply/form.pdf?v=2">Application form</a>';
const links = guidelinePdfLinks(html, 'https://funder.org/calls/safety');
ok('the guideline PDFs on a page are found and the newsletter is not', links.length === 2 && links[0].url === 'https://funder.org/files/Call-Guidelines-2027.pdf' && !links.some((l) => /newsletter/.test(l.url)));

// 4. Saved to the vault, replaced on a second save, tagged.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const { data: ad } = await db.from('profiles').select('id, email').eq('is_admin', true).limit(1);
const a = ad![0] as { id: string; email: string };
const tag = `zq${Date.now()}`;
const name = `Harmony Trust guidelines ${tag}.pdf`;
let fileId = '';
let docxId = '';
try {
  const one = await saveToVault(a, { name, bytes, mime: 'application/pdf', folder: 'Funder guidelines' });
  const two = await saveToVault(a, { name, bytes, mime: 'application/pdf', folder: 'Funder guidelines' });
  fileId = one.id;
  ok('saving the same file again replaces it', !one.replaced && two.replaced && one.id === two.id);
  const { data: folder } = await db.from('vault_folders').select('id, general_access').eq('owner_id', a.id).eq('name', 'Funder guidelines').is('parent_id', null).single();
  const { data: row } = await db.from('vault_files').select('folder_id, owner_id').eq('id', fileId).single();
  ok('it is in a private Funder guidelines folder of the owner', row?.folder_id === folder?.id && folder?.general_access === 'restricted' && row?.owner_id === a.id);
  const r = await indexSource('file', fileId);
  ok('the autotagger tags it (so similar guidelines and applications can be found together)', r.tags.length >= 2);
  console.log('tags:', r.tags);
  const { count } = await db.from('mjengo_search_chunks').select('*', { count: 'exact', head: true }).eq('source_id', fileId);
  ok('its text is in the search index', (count ?? 0) > 0);

  // 5. The application as a Word file.
  const docx = await applicationDocx('Safety Fund', 'Harmony Trust', req, { [req.sections[0].id]: { text: 'We support survivors.\n\n- Legal aid\n- Counselling', updatedAt: '' } });
  const back = (await mammoth.extractRawText({ buffer: Buffer.from(docx) })).value;
  ok('the application opens as a Word file with its heading and text', back.includes(req.sections[0].title) && back.includes('We support survivors') && back.includes('Legal aid'));
  const d = await saveToVault(a, { name: `Application ${tag}.docx`, bytes: docx, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', folder: 'Grant applications' });
  docxId = d.id;
  ok('it is saved in Grant applications', !!(await db.from('vault_files').select('id').eq('id', d.id).maybeSingle()).data);
} finally {
  for (const id of [fileId, docxId].filter(Boolean)) {
    const { data: f } = await db.from('vault_files').select('storage_path').eq('id', id).maybeSingle();
    if (f) await db.storage.from('mjengo-docs').remove([f.storage_path]);
    await db.from('mjengo_search_chunks').delete().eq('source_id', id);
    await db.from('mjengo_search_sources').delete().eq('source_id', id);
    await db.from('vault_files').delete().eq('id', id);
  }
}
process.exit(bad ? 1 : 0);
