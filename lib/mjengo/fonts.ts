/** Fonts the design tools offer. Google Fonts load on demand, so the list can be long without slowing the page. */

export interface FontOption { family: string; group: 'Sans' | 'Serif' | 'Display' | 'Script' | 'Mono'; weights?: string }

export const FONT_OPTIONS: FontOption[] = [
  { family: 'Inter', group: 'Sans', weights: '400;600;700;800' },
  { family: 'Poppins', group: 'Sans', weights: '400;600;700;800' },
  { family: 'Montserrat', group: 'Sans', weights: '400;600;700;800' },
  { family: 'DM Sans', group: 'Sans', weights: '400;500;700' },
  { family: 'Space Grotesk', group: 'Sans', weights: '400;500;700' },
  { family: 'Outfit', group: 'Sans', weights: '400;600;700;800' },
  { family: 'Work Sans', group: 'Sans', weights: '400;600;700;800' },
  { family: 'Nunito', group: 'Sans', weights: '400;700;800' },
  { family: 'Playfair Display', group: 'Serif', weights: '400;700;800' },
  { family: 'DM Serif Display', group: 'Serif', weights: '400' },
  { family: 'Lora', group: 'Serif', weights: '400;600;700' },
  { family: 'Fraunces', group: 'Serif', weights: '400;600;800' },
  { family: 'Merriweather', group: 'Serif', weights: '400;700;900' },
  { family: 'Bebas Neue', group: 'Display', weights: '400' },
  { family: 'Archivo Black', group: 'Display', weights: '400' },
  { family: 'Anton', group: 'Display', weights: '400' },
  { family: 'Righteous', group: 'Display', weights: '400' },
  { family: 'Caveat', group: 'Script', weights: '400;700' },
  { family: 'Pacifico', group: 'Script', weights: '400' },
  { family: 'Dancing Script', group: 'Script', weights: '400;700' },
  { family: 'Space Mono', group: 'Mono', weights: '400;700' },
  { family: 'Arial', group: 'Sans' },
  { family: 'Georgia', group: 'Serif' },
  { family: 'Impact', group: 'Display' },
];

const pending = new Map<string, Promise<void>>();
const SYSTEM = new Set(['Arial', 'Georgia', 'Impact', 'Courier New', 'Times New Roman', 'Trebuchet MS', 'system-ui']);

/** Make sure a font is available before it is drawn. Every caller waits for the same load. */
export function ensureFont(family: string): Promise<void> {
  if (typeof document === 'undefined' || SYSTEM.has(family)) return Promise.resolve();
  const have = pending.get(family);
  if (have) return have;
  const opt = FONT_OPTIONS.find((f) => f.family === family);
  const weights = opt?.weights ?? '400;700';
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weights}&display=swap`;
  if (!document.querySelector(`link[data-font="${family}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.font = family;
    document.head.appendChild(link);
  }
  const job = (async () => {
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`400 24px "${family}"`), document.fonts.load(`700 24px "${family}"`)]),
        new Promise((r) => setTimeout(r, 3500)),
      ]);
    } catch {
      /* the fallback font is used until it arrives */
    }
  })();
  pending.set(family, job);
  return job;
}
