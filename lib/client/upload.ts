import { createClient } from '@/utils/supabase/client';

/**
 * Upload to a private bucket with real progress (the storage client has no progress callback), by
 * PUTting to a one-time signed upload URL. Throws on failure.
 */
export async function uploadWithProgress(bucket: string, path: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
  const supabase = createClient();
  const { data: target, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !target) throw error || new Error('Could not start the upload');

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', target.signedUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    xhr.send(body);
  });
  onProgress?.(100);
}

export const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);

/** PUT a file to a signed upload URL that the server created (for paths the browser may not write to directly). */
export function putToSignedUrl(signedUrl: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', signedUrl);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				onProgress?.(100);
				resolve();
			} else reject(new Error(`Upload failed (${xhr.status})`));
		};
		xhr.onerror = () => reject(new Error('Network error during upload'));
		xhr.onabort = () => reject(new Error('Upload cancelled'));
		const body = new FormData();
		body.append('cacheControl', '3600');
		body.append('', file);
		xhr.send(body);
	});
}
