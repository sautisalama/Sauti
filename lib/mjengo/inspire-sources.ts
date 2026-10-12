export type InspireSource = 'unsplash' | 'pexels' | 'pixabay' | 'openverse' | 'iconify' | 'giphy';

/** Where design inspiration comes from. `env` is the site setting that switches a source on (none needed when absent). */
export const SOURCE_INFO: Record<InspireSource, { label: string; env?: string; kind: 'photos' | 'icons' | 'stickers' }> = {
  unsplash: { label: 'Unsplash', env: 'UNSPLASH_ACCESS_KEY', kind: 'photos' },
  pexels: { label: 'Pexels', env: 'PEXELS_API_KEY', kind: 'photos' },
  pixabay: { label: 'Pixabay', env: 'PIXABAY_API_KEY', kind: 'photos' },
  openverse: { label: 'Openverse', kind: 'photos' },
  iconify: { label: 'Icons', kind: 'icons' },
  giphy: { label: 'Stickers', env: 'GIPHY_API_KEY', kind: 'stickers' },
};
