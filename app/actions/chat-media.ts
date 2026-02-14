'use server';

import { createClient } from '@/utils/supabase/server';

// Since we can't easily add packages, I'll write a simple fetch-based scraper or assume a utility is available.
// For now, I'll implement a basic fetch mechanism.




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
