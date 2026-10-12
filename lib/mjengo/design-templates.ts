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
  | { t: 'photo'; x: number; y: number; w: number; h: number; fill: string; r?: number }
  | { t: 'text'; x: number; y: number; w: number; text: string; size: number; color: string; bold?: boolean; italic?: boolean; spacing?: number; align?: 'left' | 'center' | 'right'; lh?: number };

export interface DesignTemplate {
  id: string;
  name: string;
  category: 'Quotes' | 'Announcements' | 'Awareness' | 'Fundraising' | 'Events' | 'Stories' | 'Posters';
  size: SizeId;
  bg: string;
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
      { t: 'photo', x: 0.58, y: 0, w: 0.42, h: 1, fill: '#FFB3C8' },
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
      { t: 'text', x: 0.08, y: 0.16, w: 0.84, text: 'Thank you', size: 0.17, color: W, bold: true },
      { t: 'text', x: 0.08, y: 0.42, w: 0.8, text: 'Because of you, 86 survivors found support this month.', size: 0.06, color: W, lh: 1.2 },
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
      { t: 'photo', x: 0.1, y: 0.1, w: 0.8, h: 0.5, fill: '#C9A6FF', r: 0.03 },
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
      { t: 'text', x: 0.1, y: 0.3, w: 0.8, text: 'Counsellors answer your questions about support and safety.', size: 0.03, color: INK, lh: 1.3 },
      { t: 'rect', x: 0.1, y: 0.5, w: 0.8, h: 0.09, fill: W, r: 0.05 },
      { t: 'text', x: 0.1, y: 0.525, w: 0.8, text: 'Type your question', size: 0.026, color: '#9CA3AF', align: 'center' },
      { t: 'circle', x: 0.7, y: 0.74, d: 0.5, fill: ROSE },
    ],
  },
  {
    id: 'testimonial', name: 'Testimonial', category: 'Quotes', size: 'linkedin', bg: W,
    layers: [
      { t: 'rect', x: 0, y: 0, w: 0.035, h: 1, fill: T },
      { t: 'photo', x: 0.08, y: 0.2, w: 0.2, h: 0.4, fill: '#CFF6F8', r: 0.5 },
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
