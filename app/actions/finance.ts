'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireModule } from '@/lib/access/permissions';
import { isSuperAdminEmail } from '@/lib/access/super-admin';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';

/**
 * Finance: invoices, receipts, and the spreadsheets that were tagged Financial or Budget in Files. Everything
 * here is the organisation's, visible to people with the Finance module (view), changed with write, and deleted
 * by owners.
 */

export interface InvoiceItem { description: string; qty: number; unit: number }
export interface InvoiceRow {
  id: string; number: string; client_name: string; client_email: string | null; client_address: string | null;
  issue_date: string; due_date: string | null; currency: string; items: InvoiceItem[]; tax_pct: number; notes: string | null;
  status: 'draft' | 'sent' | 'paid' | 'void'; subtotal: number; tax: number; total: number; paid_at: string | null;
  created_by: string | null; created_at: string;
}
export interface ReceiptRow {
  id: string; vendor: string; amount: number; currency: string; spent_on: string; category: string | null; note: string | null;
  file_id: string | null; file_name: string | null; mime: string | null; created_by: string | null; created_at: string;
}
export interface FinanceFile { id: string; name: string; tags: string[]; size: number; updatedAt: string; kind: 'sheet' | 'other' }

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const money = (n: number) => Math.round(n * 100) / 100;

function cleanItems(v: unknown): InvoiceItem[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 60).map((i) => ({ description: String((i as InvoiceItem).description ?? '').trim().slice(0, 300), qty: Math.max(0, num((i as InvoiceItem).qty)), unit: Math.max(0, num((i as InvoiceItem).unit)) })).filter((i) => i.description || i.unit);
}

async function nextNumber(): Promise<string> {
  const y = new Date().getFullYear();
  const { data } = await looseAdmin().from('mjengo_invoices').select('number').like('number', `INV-${y}-%`).order('number', { ascending: false }).limit(1);
  const last = Number(String(data?.[0]?.number ?? '').split('-')[2] ?? 0) || 0;
  return `INV-${y}-${String(last + 1).padStart(4, '0')}`;
}

async function listInvoices_(): Promise<InvoiceRow[]> {
  await requireModule('finance');
  const { data } = await looseAdmin().from('mjengo_invoices').select('*').order('created_at', { ascending: false }).limit(300);
  return ((data ?? []) as InvoiceRow[]).map((r) => ({ ...r, subtotal: num(r.subtotal), tax: num(r.tax), total: num(r.total), tax_pct: num(r.tax_pct) }));
}

async function getInvoice_(id: string): Promise<InvoiceRow | null> {
  await requireModule('finance');
  const { data } = await looseAdmin().from('mjengo_invoices').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const r = data as InvoiceRow;
  return { ...r, subtotal: num(r.subtotal), tax: num(r.tax), total: num(r.total), tax_pct: num(r.tax_pct) };
}

async function saveInvoice_(id: string | null, v: Partial<InvoiceRow>): Promise<InvoiceRow> {
  const a = await requireModule('finance', 'write');
  const items = cleanItems(v.items);
  const tax_pct = Math.min(100, Math.max(0, num(v.tax_pct)));
  const subtotal = money(items.reduce((n, i) => n + i.qty * i.unit, 0));
  const tax = money((subtotal * tax_pct) / 100);
  const client = String(v.client_name ?? '').trim().slice(0, 160);
  if (!client) throw new Error('Who is the invoice for?');
  const row = {
    client_name: client,
    client_email: v.client_email ? String(v.client_email).trim().toLowerCase().slice(0, 160) : null,
    client_address: v.client_address ? String(v.client_address).slice(0, 300) : null,
    issue_date: v.issue_date || new Date().toISOString().slice(0, 10),
    due_date: v.due_date || null,
    currency: String(v.currency || 'KES').toUpperCase().slice(0, 3),
    items, tax_pct, subtotal, tax, total: money(subtotal + tax),
    notes: v.notes ? String(v.notes).slice(0, 2000) : null,
    updated_at: new Date().toISOString(),
  };
  const db = looseAdmin();
  if (id) {
    const { data, error } = await db.from('mjengo_invoices').update(row).eq('id', id).select('*').single();
    if (error || !data) throw new Error('Could not save the invoice.');
    await logAudit({ actorId: a.id, actorEmail: a.email, action: 'finance.invoice_updated', targetType: 'invoice', targetId: id, targetLabel: data.number });
    return data as InvoiceRow;
  }
  for (let i = 0; i < 4; i++) {
    const { data, error } = await db.from('mjengo_invoices').insert({ ...row, number: await nextNumber(), created_by: a.id }).select('*').single();
    if (!error && data) {
      await logAudit({ actorId: a.id, actorEmail: a.email, action: 'finance.invoice_created', targetType: 'invoice', targetId: data.id, targetLabel: data.number });
      return data as InvoiceRow;
    }
  }
  throw new Error('Could not create the invoice.');
}

async function invoiceStatus_(id: string, status: InvoiceRow['status']): Promise<void> {
  const a = await requireModule('finance', 'write');
  if (!['draft', 'sent', 'paid', 'void'].includes(status)) throw new Error('Unknown status.');
  const { data } = await looseAdmin().from('mjengo_invoices').update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id).select('number').single();
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'finance.invoice_status', targetType: 'invoice', targetId: id, targetLabel: data?.number, details: { status } });
}

async function deleteInvoice_(id: string): Promise<void> {
  const a = await requireModule('finance', 'owner');
  const { data } = await looseAdmin().from('mjengo_invoices').delete().eq('id', id).select('number').maybeSingle();
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'finance.invoice_deleted', targetType: 'invoice', targetId: id, targetLabel: data?.number });
}

async function listReceipts_(): Promise<ReceiptRow[]> {
  await requireModule('finance');
  const db = looseAdmin();
  const { data } = await db.from('mjengo_receipts').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false }).limit(400);
  const rows = (data ?? []) as (Omit<ReceiptRow, 'file_name' | 'mime'>)[];
  const ids = [...new Set(rows.map((r) => r.file_id).filter(Boolean))] as string[];
  const { data: files } = ids.length ? await db.from('vault_files').select('id, name, mime').in('id', ids) : { data: [] };
  const byId = new Map(((files ?? []) as { id: string; name: string; mime: string | null }[]).map((f) => [f.id, f]));
  return rows.map((r) => ({ ...r, amount: num(r.amount), file_name: r.file_id ? byId.get(r.file_id)?.name ?? null : null, mime: r.file_id ? byId.get(r.file_id)?.mime ?? null : null }));
}

/** A receipt with the photo or file already uploaded to Files (it is tagged Receipt and Financial there). */
async function saveReceipt_(id: string | null, v: { vendor: string; amount: number; currency?: string; spent_on?: string; category?: string | null; note?: string | null; file_id?: string | null; upload?: { path: string; name: string; size: number; mime: string | null } }): Promise<void> {
  const a = await requireModule('finance', 'write');
  const vendor = String(v.vendor ?? '').trim().slice(0, 120);
  if (!vendor) throw new Error('Who was it paid to?');
  const db = looseAdmin();
  const row = {
    vendor, amount: money(Math.max(0, num(v.amount))), currency: String(v.currency || 'KES').toUpperCase().slice(0, 3),
    spent_on: v.spent_on || new Date().toISOString().slice(0, 10), category: v.category ? String(v.category).trim().slice(0, 60) : null,
    note: v.note ? String(v.note).slice(0, 500) : null, file_id: v.file_id || null,
  };
  if (v.upload) {
    // A photo or file that was just sent through prepareReceiptUpload becomes a file in Files, tagged for Finance.
    if (!v.upload.path.startsWith(`receipts/${a.id}/`)) throw new Error('That upload does not belong to you.');
    const { data: made, error: ferr } = await db.from('vault_files').insert({ folder_id: null, name: v.upload.name.trim().slice(0, 200) || 'Receipt', storage_path: v.upload.path, mime: v.upload.mime, size: v.upload.size, owner_id: a.id, tags: ['Receipt', 'Financial'] }).select('id').single();
    if (ferr || !made) throw new Error('Could not keep the receipt photo.');
    row.file_id = made.id as string;
  }
  if (row.file_id) {
    const { data: f } = await db.from('vault_files').select('tags').eq('id', row.file_id).maybeSingle();
    const tags = [...new Set([...((f?.tags ?? []) as string[]), 'Receipt', 'Financial'])];
    await db.from('vault_files').update({ tags }).eq('id', row.file_id);
  }
  const q = id ? db.from('mjengo_receipts').update(row).eq('id', id) : db.from('mjengo_receipts').insert({ ...row, created_by: a.id });
  const { error } = await q;
  if (error) throw new Error('Could not save the receipt.');
  await logAudit({ actorId: a.id, actorEmail: a.email, action: id ? 'finance.receipt_updated' : 'finance.receipt_added', targetType: 'receipt', targetLabel: vendor, details: { amount: row.amount } });
}

/** A one-time address to send a receipt photo or file to. Needs only the Finance module. */
async function prepareReceiptUpload_(fileName: string, size: number): Promise<{ path: string; signedUrl: string }> {
  const a = await requireModule('finance', 'write');
  if (!(size > 0) || size > 25 * 1024 * 1024) throw new Error('Receipts can be up to 25 MB.');
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-100) || 'receipt';
  const path = `receipts/${a.id}/${crypto.randomUUID()}-${safe}`;
  const { data, error } = await looseAdmin().storage.from('mjengo-docs').createSignedUploadUrl(path);
  if (error || !data) throw new Error('Could not start the upload.');
  return { path, signedUrl: data.signedUrl };
}

/** A viewing address for a receipt's photo, valid for ten minutes. */
async function receiptUrl_(receiptId: string): Promise<string> {
  await requireModule('finance');
  const db = looseAdmin();
  const { data: r } = await db.from('mjengo_receipts').select('file_id').eq('id', receiptId).maybeSingle();
  if (!r?.file_id) throw new Error('This receipt has no photo.');
  const { data: f } = await db.from('vault_files').select('storage_path').eq('id', r.file_id).maybeSingle();
  if (!f) throw new Error('The file is gone.');
  const { data, error } = await db.storage.from('mjengo-docs').createSignedUrl(f.storage_path, 600);
  if (error || !data) throw new Error('Could not open the file.');
  return data.signedUrl;
}

async function deleteReceipt_(id: string): Promise<void> {
  const a = await requireModule('finance', 'owner');
  await looseAdmin().from('mjengo_receipts').delete().eq('id', id);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'finance.receipt_deleted', targetType: 'receipt', targetId: id });
}

const FIN_TAGS = ['financial', 'budget', 'budgeting', 'finance'];

/** Files the person may open that carry a Financial or Budget tag (spreadsheets first). */
async function files_(): Promise<FinanceFile[]> {
  const a = await requireModule('finance');
  const [ix, oversight] = await Promise.all([loadIndex(), isSuperAdminEmail(a.email).then((x) => x || oversightFor(a.email))]);
  return [...ix.files.values()]
    .filter((f) => (f.tags ?? []).some((t) => FIN_TAGS.includes(t.toLowerCase())) && !(f.tags ?? []).some((t) => t.toLowerCase() === 'receipt'))
    .filter((f) => atLeast(levelFor(ix, a.id, 'file', f.id, oversight), 'view'))
    .sort((x, y) => y.updated_at.localeCompare(x.updated_at))
    .map((f) => ({ id: f.id, name: f.name, tags: f.tags ?? [], size: f.size, updatedAt: f.updated_at, kind: /\.(xlsx|xls|csv)$/i.test(f.name) ? 'sheet' as const : 'other' as const }));
}

/** Tag a file as Financial and/or Budget so it appears here. */
async function tagFile_(fileId: string, tags: ('Financial' | 'Budget')[]): Promise<void> {
  const a = await requireModule('finance', 'write');
  const ix = await loadIndex();
  const oversight = await oversightFor(a.email);
  if (!atLeast(levelFor(ix, a.id, 'file', fileId, oversight), 'edit')) throw new Error('You can only tag files you can edit.');
  const f = ix.files.get(fileId);
  if (!f) throw new Error('That file no longer exists.');
  const next = [...new Set([...(f.tags ?? []), ...tags.filter((t) => t === 'Financial' || t === 'Budget')])].slice(0, 12);
  await looseAdmin().from('vault_files').update({ tags: next }).eq('id', fileId);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'finance.file_tagged', targetType: 'file', targetId: fileId, targetLabel: f.name, details: { tags } });
}

async function untag_(fileId: string): Promise<void> {
  const a = await requireModule('finance', 'write');
  const ix = await loadIndex();
  const oversight = await oversightFor(a.email);
  if (!atLeast(levelFor(ix, a.id, 'file', fileId, oversight), 'edit')) throw new Error('You can only change files you can edit.');
  const f = ix.files.get(fileId);
  if (!f) return;
  await looseAdmin().from('vault_files').update({ tags: (f.tags ?? []).filter((t) => !FIN_TAGS.includes(t.toLowerCase())) }).eq('id', fileId);
}

/** A new budget spreadsheet in Files from a list of lines: Planned, Actual and Variance with working formulas. */
async function createBudget_(name: string, rows: { category: string; planned: number }[], currency = 'KES'): Promise<{ id: string }> {
  const a = await requireModule('finance', 'write');
  const title = name.trim().slice(0, 120) || 'Budget';
  const lines = rows.slice(0, 200).map((r) => ({ category: String(r.category ?? '').trim().slice(0, 120), planned: Math.max(0, num(r.planned)) })).filter((r) => r.category);
  if (!lines.length) throw new Error('Add at least one budget line.');
  const XLSX = await import('xlsx');
  const aoa: (string | number | { f: string })[][] = [['Category', `Planned (${currency})`, `Actual (${currency})`, 'Variance']];
  lines.forEach((l, i) => aoa.push([l.category, l.planned, 0, { f: `B${i + 2}-C${i + 2}` }]));
  const last = lines.length + 1;
  aoa.push(['Total', { f: `SUM(B2:B${last})` }, { f: `SUM(C2:C${last})` }, { f: `B${last + 1}-C${last + 1}` }]);
  const ws = XLSX.utils.aoa_to_sheet(aoa.map((r) => r.map((c) => (typeof c === 'object' ? null : c))));
  aoa.forEach((r, ri) => r.forEach((c, ci) => { if (typeof c === 'object') ws[XLSX.utils.encode_cell({ r: ri, c: ci })] = { t: 'n', f: c.f }; }));
  ws['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Budget');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const fileName = `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim()}.xlsx`;
  const path = `vault/${a.id}/${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
  const db = looseAdmin();
  const up = await db.storage.from('mjengo-docs').upload(path, buf, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if (up.error) throw new Error('Could not create the file.');
  const { data, error } = await db.from('vault_files').insert({ folder_id: null, name: fileName, storage_path: path, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: buf.length, owner_id: a.id, tags: ['Budget', 'Financial'] }).select('id').single();
  if (error || !data) throw new Error('Could not save the file.');
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'finance.budget_created', targetType: 'file', targetId: data.id, targetLabel: fileName });
  return { id: data.id as string };
}

export const financeInvoices = guard(listInvoices_);
export const financeInvoice = guard(getInvoice_);
export const saveFinanceInvoice = guard(saveInvoice_);
export const setInvoiceStatus = guard(invoiceStatus_);
export const deleteFinanceInvoice = guard(deleteInvoice_);
export const financeReceipts = guard(listReceipts_);
export const saveFinanceReceipt = guard(saveReceipt_);
export const deleteFinanceReceipt = guard(deleteReceipt_);
export const prepareReceiptUpload = guard(prepareReceiptUpload_);
export const financeReceiptUrl = guard(receiptUrl_);
export const financeFiles = guard(files_);
export const tagFinanceFile = guard(tagFile_);
export const untagFinanceFile = guard(untag_);
export const createBudgetFile = guard(createBudget_);
