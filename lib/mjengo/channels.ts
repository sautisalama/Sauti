export type Channel = 'linkedin' | 'x' | 'facebook' | 'instagram';

export const CHANNELS: Channel[] = ['linkedin', 'x', 'facebook', 'instagram'];

export const CHANNEL_INFO: Record<Channel, { label: string; limit: number; needsImage: boolean; color: string; composeUrl: (text: string) => string }> = {
  linkedin: { label: 'LinkedIn', limit: 3000, needsImage: false, color: '#0a66c2', composeUrl: () => 'https://www.linkedin.com/feed/' },
  x: { label: 'X', limit: 280, needsImage: false, color: '#111827', composeUrl: (t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}` },
  facebook: { label: 'Facebook', limit: 63206, needsImage: false, color: '#1877f2', composeUrl: () => 'https://www.facebook.com/' },
  instagram: { label: 'Instagram', limit: 2200, needsImage: true, color: '#c13584', composeUrl: () => 'https://www.instagram.com/' },
};
