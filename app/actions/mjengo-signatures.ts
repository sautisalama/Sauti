'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';

export interface SignatureRow { id: string; name: string; data_url: string; created_at: string }

async function list_(): Promise<SignatureRow[]> {
  const a = await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_signatures').select('id, name, data_url, created_at').eq('owner_id', a.id).order('created_at', { ascending: false }).limit(30);
  return (data ?? []) as SignatureRow[];
}

async function save_(name: string, dataUrl: string): Promise<SignatureRow> {
  const a = await requireAdminActor();
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) throw new Error('That signature image is not valid.');
  if (dataUrl.length > 600_000) throw new Error('That signature image is too large.');
  const { data, error } = await looseAdmin().from('mjengo_signatures').insert({ owner_id: a.id, name: name.trim().slice(0, 40) || 'Signature', data_url: dataUrl }).select('id, name, data_url, created_at').single();
  if (error || !data) throw new Error('Could not save the signature.');
  return data as SignatureRow;
}

async function remove_(id: string) {
  const a = await requireAdminActor();
  await looseAdmin().from('mjengo_signatures').delete().eq('id', id).eq('owner_id', a.id);
}

export const listSignatures = guard(list_);
export const saveSignatureImage = guard(save_);
export const deleteSignature = guard(remove_);

/** A one-time upload link for a picture in an email signature. The picture is public so email apps can show it. */
async function image_(fileName: string): Promise<{ signedUrl: string; publicUrl: string }> {
  const a = await requireAdminActor();
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-60) || 'image';
  const path = `signatures/${a.id}/${Date.now()}-${safe}`;
  const db = looseAdmin();
  const { data, error } = await db.storage.from('mjengo-public').createSignedUploadUrl(path);
  if (error || !data) throw new Error('Could not start the upload.');
  return { signedUrl: data.signedUrl, publicUrl: db.storage.from('mjengo-public').getPublicUrl(path).data.publicUrl };
}

export const signatureImageUpload = guard(image_);
