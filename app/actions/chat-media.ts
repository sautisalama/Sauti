'use server';

import { createClient } from '@/utils/supabase/server';

// Since we can't easily add packages, I'll write a simple fetch-based scraper or assume a utility is available.
// For now, I'll implement a basic fetch mechanism.


export async function uploadChatFile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const file = formData.get('file') as File;
  const chatId = formData.get('chatId') as string;
  
  if (!file || !chatId) throw new Error('Missing file or chat ID');

  const fileExt = file.name.split('.').pop();
  const fileName = `${chatId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('chat-media')
    .upload(fileName, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('chat-media')
    .getPublicUrl(fileName);

    // If bucket is private, we should use createSignedUrl instead, 
    // but typically chat media is often public or using signed URLs with long expiration.
    // For WhatsApp style security, signed URLs are better, but let's stick to publicUrl for simplicity 
    // unless the bucket is strictly private (which we set to false in SQL).
    // Actually, SQL set public to false. So we MUST use signed URLs or make it public.
    // Let's use signed URL for 10 years or something effectively permanent for the chat context, 
    // or better, change bucket to public if strict privacy isn't the #1 specific constraint over usability.
    // Given "sensitive information" in prompt, let's keep it private and generate signed URLs on fetch? 
    // No, standard practice for these apps often involves a token authenticating access to the resource.
    // Supabase storage generic flow: 
    // If we want permanent access for chat participants, we might need a proxy. 
    // For now, let's assume we use signed URLs dynamically or just public for MVP speed if safe.
    // Re-reading SQL: "public: false". Okay, let's use signed URL.
  
  const { data: signedData, error: signedError } = await supabase.storage
    .from('chat-media')
    .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year validity

  if (signedError) throw signedError;

  return {
    url: signedData.signedUrl,
    path: fileName,
    type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
    name: file.name,
    size: file.size
  };
}

export async function fetchLinkMetadata(url: string) {
  // Basic server-side scraping
  try {
     // Validate URL
     new URL(url); 
     
     const response = await fetch(url, { headers: { 'User-Agent': 'bot' } });
     const html = await response.text();
     
     // Simple regex extraction (production should use cheerio or jsdom)
     const getMeta = (prop: string) => {
       const match = html.match(new RegExp(`<meta property="${prop}" content="(.*?)"`)) || 
                     html.match(new RegExp(`<meta name="${prop}" content="(.*?)"`));
       return match ? match[1] : undefined;
     };

     const title = getMeta('og:title') || getMeta('twitter:title') || (html.match(/<title>(.*?)<\/title>/)?.[1]);
     const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description');
     const image = getMeta('og:image') || getMeta('twitter:image');

     return {
       title: title || url,
       description,
       image,
       url
     };
  } catch (e) {
    console.error('Link preview failed', e);
    return null;
  }
}

export async function getChatMedia(chatId: string, type: 'media' | 'docs' | 'links') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  let query = supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false });

  if (type === 'media') {
     query = query.in('type', ['image', 'video']);
  } else if (type === 'docs') {
     query = query.eq('type', 'file');
  } else if (type === 'links') {
     // Use the GIN index we added!
     // @> is the "contains" operator for JSONB
     query = query.not('metadata->link_preview', 'is', 'null');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
