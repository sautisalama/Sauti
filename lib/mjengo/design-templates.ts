/**
 * Ready-made designs, described as layers in fractions of the page. The hub draws them as real previews
 * and the editor builds the same layers on the canvas, so what you pick is what you get.
 * Sizes and wording follow what a small non-profit actually posts.
 */

export type SizeId = 'instagram' | 'story' | 'tiktok' | 'linkedin' | 'facebook' | 'x' | 'poster';

export const ASPECT: Record<SizeId, { w: number; h: number }> = {
  instagram: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  tiktok: { w: 1080, h: 1920 },
  linkedin: { w: 1200, h: 627 },
  facebook: { w: 1200, h: 630 },
  x: { w: 1600, h: 900 },
  poster: { w: 1240, h: 1754 },
};

export type Layer =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: string; r?: number }
  | { t: 'circle'; x: number; y: number; d: number; fill: string }
  /** A stand-in for a photo: a tinted block you replace with a picture. */
  | { t: 'photo'; x: number; y: number; w: number; h: number; fill: string; r?: number; scene?: Scene; /** A real picture; the scene is the fallback. */ src?: string }
  | { t: 'line'; x: number; y: number; w: number; color: string; th: number }
  | { t: 'text'; x: number; y: number; w: number; text: string; size: number; color: string; bold?: boolean; italic?: boolean; spacing?: number; align?: 'left' | 'center' | 'right'; lh?: number; font?: string };

export type Scene = 'hills' | 'portrait' | 'city' | 'people';

/**
 * Pictures that ship with the app, from Sauti Salama's own events and programmes, so a template starts with
 * real people and places instead of shapes. Replace any of them with a photo from Photos or Uploads.
 */
export const PHOTO_POOL: { src: string; label: string }[] = [
  { src: '/events/impact/climate-care/community-mobilisation.jpeg', label: 'Community meeting' },
  { src: '/events/impact/climate-care/women-solar-kits.jpeg', label: 'Women with solar kits' },
  { src: '/events/impact/climate-care/solar-demo.jpeg', label: 'Solar demonstration' },
  { src: '/events/impact/malkia teaching child.jpeg', label: 'Teaching a child' },
  { src: '/events/impact/teaching chess to children.jpeg', label: 'Children learning' },
  { src: '/events/impact/end femicide march.jpeg', label: 'March' },
  { src: '/events/impact/16-days of activism 2.jpeg', label: '16 days of activism' },
  { src: '/events/impact/oliver-teaching-tech.jpg', label: 'Digital skills' },
  { src: '/landing/landing.jpeg', label: 'Community' },
  { src: '/landing/landing2.jpeg', label: 'Together' },
  { src: '/blog/empowerment.jpeg', label: 'Empowerment' },
  { src: '/blog/justice.jpg', label: 'Justice' },
];

/** Everything the site already shows: events, programmes, learning and blog pictures. Offered in Studio and Uploads. */
export const WEBSITE_PHOTOS: { src: string; label: string; group: 'Events' | 'Programmes' | 'Learning' | 'Stories' }[] = [
  ...PHOTO_POOL.slice(0, 8).map((p) => ({ ...p, group: 'Events' as const })),
  { src: '/events/impact/Community -Letu.png', label: 'Community Letu', group: 'Events' },
  { src: '/events/impact/startegic plan meeting.png', label: 'Strategic plan meeting', group: 'Events' },
  { src: '/events/impact/at cop30.png', label: 'At COP30', group: 'Events' },
  { src: '/events/programs/community-wangu.jpeg', label: 'Community Wangu', group: 'Programmes' },
  { src: '/events/programs/survivors cafe program.png', label: 'Survivors cafe', group: 'Programmes' },
  { src: '/events/programs/16 days of activism.png', label: '16 days of activism', group: 'Programmes' },
  { src: '/events/programs/TFGBV Awareness.png', label: 'TFGBV awareness', group: 'Programmes' },
  { src: '/events/programs/AI course.png', label: 'AI course', group: 'Learning' },
  { src: '/events/impact/Learning Program - 748 registered learners.png', label: 'Learning programme', group: 'Learning' },
  { src: '/blog/empowerment.jpeg', label: 'Empowerment', group: 'Stories' },
  { src: '/blog/justice.jpg', label: 'Justice', group: 'Stories' },
  { src: '/blog/certification.jpeg', label: 'Certification', group: 'Stories' },
  { src: '/landing/landing.jpeg', label: 'Community', group: 'Stories' },
  { src: '/landing/landing2.jpeg', label: 'Together', group: 'Stories' },
];

export const encodeSrc = (src: string) => src.split('/').map((p) => encodeURIComponent(p)).join('/');

export interface DesignTemplate {
  id: string;
  name: string;
  category: 'Quotes' | 'Announcements' | 'Awareness' | 'Fundraising' | 'Events' | 'Stories' | 'Posters';
  size: SizeId;
  bg: string;
  /** A second colour makes the background a soft top to bottom gradient. */
  bg2?: string;
  layers: Layer[];
}

const P = '#7D2AE8', T = '#00C4CC', INK = '#0E1318', Y = '#FFDE59', W = '#FFFFFF', SOFT = '#F5F0FF', ROSE = '#FF5C8A', TEAL_D = '#06505A';

export const TEMPLATES: DesignTemplate[] = [
  {
    id: 'quote', name: 'Quote card', category: 'Quotes', size: 'instagram', bg: P,
    layers: [
      { t: 'text', x: 0.08, y: 0.08, w: 0.3, text: '“', size: 0.22, color: W, bold: true },
      { t: 'text', x: 0.08, y: 0.3, w: 0.84, text: 'Write the words that matter here.', size: 0.075, color: W, bold: true, lh: 1.15 },
      { t: 'text', x: 0.08, y: 0.78, w: 0.6, text: 'Name, role', size: 0.034, color: '#EADCFF' },
    ],
  },
  {
    id: 'quote-soft', name: 'Quote on cream', category: 'Quotes', size: 'instagram', bg: '#FFF6E5',
    layers: [
      { t: 'rect', x: 0.08, y: 0.1, w: 0.12, h: 0.012, fill: ROSE },
      { t: 'text', x: 0.08, y: 0.18, w: 0.84, text: 'Healing is not a straight line, and that is okay.', size: 0.08, color: INK, bold: true, lh: 1.15 },
      { t: 'text', x: 0.08, y: 0.74, w: 0.84, text: 'A reminder from Sauti Salama', size: 0.036, color: '#6B7280' },
      { t: 'circle', x: 0.72, y: 0.72, d: 0.36, fill: Y },
    ],
  },
  {
    id: 'announce', name: 'Announcement', category: 'Announcements', size: 'instagram', bg: W,
    layers: [
      { t: 'rect', x: 0, y: 0, w: 1, h: 0.34, fill: T },
      { t: 'text', x: 0.08, y: 0.1, w: 0.6, text: 'NEWS', size: 0.07, color: W, bold: true, spacing: 200 },
      { t: 'text', x: 0.08, y: 0.42, w: 0.84, text: 'Your headline goes here', size: 0.085, color: INK, bold: true },
      { t: 'text', x: 0.08, y: 0.66, w: 0.84, text: 'One or two lines to explain it, who it is for and when.', size: 0.04, color: '#4B5563' },
    ],
  },
  {
    id: 'hiring', name: 'We are hiring', category: 'Announcements', size: 'linkedin', bg: INK,
    layers: [
      { t: 'circle', x: 0.66, y: -0.25, d: 0.55, fill: P },
      { t: 'text', x: 0.06, y: 0.12, w: 0.5, text: 'WE ARE HIRING', size: 0.07, color: T, bold: true, spacing: 250 },
      { t: 'text', x: 0.06, y: 0.28, w: 0.7, text: 'Programme Officer', size: 0.15, color: W, bold: true, lh: 1.05 },
      { t: 'text', x: 0.06, y: 0.62, w: 0.6, text: 'Nairobi  |  Full time  |  Apply by 30 November', size: 0.055, color: '#D1D5DB' },
      { t: 'text', x: 0.06, y: 0.82, w: 0.6, text: 'sautisalama.org/join', size: 0.055, color: Y, bold: true },
    ],
  },
  {
    id: 'stat', name: 'Big number', category: 'Awareness', size: 'instagram', bg: Y,
    layers: [
      { t: 'text', x: 0.08, y: 0.2, w: 0.84, text: '1,240', size: 0.26, color: INK, bold: true },
      { t: 'text', x: 0.08, y: 0.62, w: 0.84, text: 'people reached this year', size: 0.06, color: INK, bold: true },
      { t: 'text', x: 0.08, y: 0.88, w: 0.6, text: 'Sauti Salama', size: 0.035, color: INK },
    ],
  },
  {
    id: 'tip', name: 'Know your rights', category: 'Awareness', size: 'instagram', bg: SOFT,
    layers: [
      { t: 'rect', x: 0.08, y: 0.08, w: 0.84, h: 0.84, fill: W, r: 0.04 },
      { t: 'text', x: 0.13, y: 0.14, w: 0.7, text: 'KNOW YOUR RIGHTS', size: 0.035, color: P, bold: true, spacing: 200 },
      { t: 'text', x: 0.13, y: 0.24, w: 0.74, text: 'You can report abuse and you do not have to do it alone.', size: 0.07, color: INK, bold: true, lh: 1.15 },
      { t: 'text', x: 0.13, y: 0.66, w: 0.74, text: 'Free and confidential support, any time. Message us in the app.', size: 0.036, color: '#4B5563' },
      { t: 'circle', x: 0.73, y: 0.74, d: 0.16, fill: T },
    ],
  },
  {
    id: 'donate', name: 'Donation appeal', category: 'Fundraising', size: 'facebook', bg: ROSE,
    layers: [
      { t: 'photo', x: 0.58, y: 0, w: 0.42, h: 1, fill: '#FF8FB0', scene: 'people', src: PHOTO_POOL[0].src },
      { t: 'text', x: 0.06, y: 0.12, w: 0.5, text: 'Your gift keeps a safe line open', size: 0.12, color: W, bold: true, lh: 1.1 },
      { t: 'text', x: 0.06, y: 0.58, w: 0.48, text: 'KES 1,000 pays for one counselling session.', size: 0.055, color: W },
      { t: 'rect', x: 0.06, y: 0.76, w: 0.26, h: 0.13, fill: INK, r: 0.01 },
      { t: 'text', x: 0.06, y: 0.785, w: 0.26, text: 'Give today', size: 0.065, color: W, bold: true, align: 'center' },
    ],
  },
  {
    id: 'thanks', name: 'Thank you', category: 'Fundraising', size: 'instagram', bg: T,
    layers: [
      { t: 'circle', x: -0.12, y: 0.62, d: 0.6, fill: TEAL_D },
      { t: 'text', x: 0.08, y: 0.16, w: 0.84, text: 'Thank you', size: 0.14, color: W, bold: true },
      { t: 'text', x: 0.08, y: 0.4, w: 0.8, text: 'Because of you, 86 survivors found support this month.', size: 0.06, color: W, lh: 1.2 },
      { t: 'text', x: 0.08, y: 0.88, w: 0.6, text: 'With gratitude, the Sauti Salama team', size: 0.034, color: '#E6FBFC' },
    ],
  },
  {
    id: 'event', name: 'Event', category: 'Events', size: 'instagram', bg: INK,
    layers: [
      { t: 'circle', x: 0.62, y: -0.12, d: 0.64, fill: P },
      { t: 'text', x: 0.08, y: 0.12, w: 0.7, text: 'YOU ARE INVITED', size: 0.035, color: T, bold: true, spacing: 250 },
      { t: 'text', x: 0.08, y: 0.35, w: 0.84, text: 'Event name', size: 0.11, color: W, bold: true },
      { t: 'text', x: 0.08, y: 0.7, w: 0.84, text: 'Date  |  Time  |  Place', size: 0.04, color: '#D1D5DB' },
    ],
  },
  {
    id: 'workshop', name: 'Workshop flyer', category: 'Posters', size: 'poster', bg: W,
    layers: [
      { t: 'rect', x: 0, y: 0, w: 1, h: 0.46, fill: P },
      { t: 'photo', x: 0.1, y: 0.1, w: 0.8, h: 0.5, fill: '#9B5CF0', r: 0.03, scene: 'hills', src: PHOTO_POOL[3].src },
      { t: 'text', x: 0.1, y: 0.66, w: 0.8, text: 'Community safety workshop', size: 0.058, color: INK, bold: true, lh: 1.1 },
      { t: 'text', x: 0.1, y: 0.8, w: 0.8, text: 'Saturday 12 December, 10:00 am\nKibera Community Hall', size: 0.026, color: '#4B5563', lh: 1.4 },
      { t: 'text', x: 0.1, y: 0.92, w: 0.8, text: 'Free entry. Everyone is welcome.', size: 0.024, color: P, bold: true },
    ],
  },
  {
    id: 'story-day', name: '16 days story', category: 'Stories', size: 'story', bg: P,
    layers: [
      { t: 'circle', x: 0.45, y: 0.55, d: 0.9, fill: '#9B5CF0' },
      { t: 'text', x: 0.1, y: 0.12, w: 0.8, text: 'DAY', size: 0.03, color: Y, bold: true, spacing: 300 },
      { t: 'text', x: 0.1, y: 0.16, w: 0.8, text: '7', size: 0.2, color: W, bold: true },
      { t: 'text', x: 0.1, y: 0.42, w: 0.8, text: 'of 16 days of activism', size: 0.04, color: W, bold: true },
      { t: 'text', x: 0.1, y: 0.7, w: 0.8, text: 'Say it out loud: violence is never okay.', size: 0.045, color: W, bold: true, lh: 1.15 },
      { t: 'text', x: 0.1, y: 0.9, w: 0.8, text: 'Swipe up to learn more', size: 0.024, color: '#EADCFF' },
    ],
  },
  {
    id: 'story-poll', name: 'Question story', category: 'Stories', size: 'story', bg: Y,
    layers: [
      { t: 'text', x: 0.1, y: 0.18, w: 0.8, text: 'Ask us anything', size: 0.07, color: INK, bold: true, lh: 1.1 },
      { t: 'text', x: 0.1, y: 0.37, w: 0.8, text: 'Counsellors answer your questions about support and safety.', size: 0.03, color: INK, lh: 1.3 },
      { t: 'rect', x: 0.1, y: 0.55, w: 0.8, h: 0.09, fill: W, r: 0.05 },
      { t: 'text', x: 0.1, y: 0.575, w: 0.8, text: 'Type your question', size: 0.026, color: '#9CA3AF', align: 'center' },
      { t: 'circle', x: 0.7, y: 0.74, d: 0.5, fill: ROSE },
    ],
  },
  {
    id: 'testimonial', name: 'Testimonial', category: 'Quotes', size: 'linkedin', bg: W,
    layers: [
      { t: 'rect', x: 0, y: 0, w: 0.035, h: 1, fill: T },
      { t: 'photo', x: 0.08, y: 0.2, w: 0.2, h: 0.4, fill: '#00C4CC', r: 0.5, scene: 'portrait', src: PHOTO_POOL[8].src },
      { t: 'text', x: 0.34, y: 0.15, w: 0.58, text: 'I did not know where to turn until Sauti Salama answered.', size: 0.1, color: INK, bold: true, lh: 1.15 },
      { t: 'text', x: 0.34, y: 0.7, w: 0.58, text: 'A community member, shared with permission', size: 0.052, color: '#6B7280' },
    ],
  },
  {
    id: 'plain', name: 'Plain white', category: 'Posters', size: 'instagram', bg: W,
    layers: [],
  },
];

export const CATEGORIES = ['All', 'Quotes', 'Announcements', 'Awareness', 'Fundraising', 'Events', 'Stories', 'Posters'] as const;

/* ---- placeholder scenes: a photo stand-in that looks like a picture, drawn from one colour */

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => clamp(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** An SVG picture for a photo slot. Used by the preview cards and placed in the editor as a real image. */
export function sceneSvg(scene: Scene, base: string, w = 400, h = 300): string {
  const sky = shade(base, 0.55), far = shade(base, 0.15), near = shade(base, -0.25), dark = shade(base, -0.5), sun = shade(base, 0.85);
  const body = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><rect width="${w}" height="${h}" fill="${sky}"/>${inner}</svg>`;
  if (scene === 'portrait') {
    return body(`<rect width="${w}" height="${h}" fill="${sky}"/><circle cx="${w * 0.5}" cy="${h * 0.38}" r="${h * 0.17}" fill="${dark}"/><path d="M${w * 0.18} ${h} C${w * 0.2} ${h * 0.66} ${w * 0.8} ${h * 0.66} ${w * 0.82} ${h} Z" fill="${near}"/><circle cx="${w * 0.5}" cy="${h * 0.36}" r="${h * 0.15}" fill="${shade(base, -0.15)}"/>`);
  }
  if (scene === 'city') {
    const bars = Array.from({ length: 9 }, (_, i) => {
      const bw = w / 9, bh = h * (0.35 + ((i * 37) % 40) / 100);
      return `<rect x="${i * bw + 2}" y="${h - bh}" width="${bw - 4}" height="${bh}" fill="${i % 2 ? near : far}"/>` + Array.from({ length: 3 }, (_, j) => `<rect x="${i * bw + 8}" y="${h - bh + 12 + j * 22}" width="${bw - 20}" height="8" fill="${sun}" opacity=".7"/>`).join('');
    }).join('');
    return body(`<circle cx="${w * 0.8}" cy="${h * 0.2}" r="${h * 0.09}" fill="${sun}"/>${bars}`);
  }
  if (scene === 'people') {
    const p = (cx: number, r: number, c: string) => `<circle cx="${cx}" cy="${h * 0.42}" r="${r}" fill="${c}"/><path d="M${cx - r * 1.6} ${h} C${cx - r * 1.5} ${h * 0.62} ${cx + r * 1.5} ${h * 0.62} ${cx + r * 1.6} ${h} Z" fill="${c}"/>`;
    return body(`<rect y="${h * 0.7}" width="${w}" height="${h * 0.3}" fill="${far}"/>${p(w * 0.28, h * 0.1, near)}${p(w * 0.72, h * 0.1, dark)}${p(w * 0.5, h * 0.13, shade(base, -0.1))}`);
  }
  return body(`<circle cx="${w * 0.74}" cy="${h * 0.28}" r="${h * 0.12}" fill="${sun}"/><path d="M0 ${h * 0.75} C${w * 0.2} ${h * 0.45} ${w * 0.4} ${h * 0.5} ${w * 0.55} ${h * 0.68} C${w * 0.7} ${h * 0.5} ${w * 0.9} ${h * 0.5} ${w} ${h * 0.7} V${h} H0 Z" fill="${far}"/><path d="M0 ${h * 0.88} C${w * 0.25} ${h * 0.66} ${w * 0.55} ${h * 0.8} ${w} ${h * 0.74} V${h} H0 Z" fill="${near}"/>`);
}

export const sceneDataUrl = (scene: Scene, base: string, w = 400, h = 300) => `data:image/svg+xml;utf8,${encodeURIComponent(sceneSvg(scene, base, w, h))}`;
