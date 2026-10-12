import type { Channel } from './channels';
import { holidayOn } from './holidays-ke';

/**
 * When each network tends to work best for an organisation in Kenya (East Africa Time). These come from the
 * published engagement studies the networks and scheduling tools share, narrowed to Nairobi working life:
 * mornings before work, lunch, and early evening. They are starting points; the organisation's own insights
 * should replace them once there is history.
 *   days: 0 = Sunday ... 6 = Saturday; hours are local (EAT).
 */
interface Window { days: number[]; hours: number[]; why: string }

const WINDOWS: Record<Channel, Window[]> = {
  linkedin: [
    { days: [2, 3, 4], hours: [8, 12], why: 'Professionals read LinkedIn before work and at lunch, Tuesday to Thursday.' },
    { days: [1, 5], hours: [9], why: 'Early on Monday and Friday, when people are catching up.' },
  ],
  x: [
    { days: [1, 2, 3, 4, 5], hours: [8, 12, 17], why: 'X is read in short bursts on weekdays: morning, lunch and the commute home.' },
  ],
  facebook: [
    { days: [3, 4, 5], hours: [11, 13], why: 'Facebook peaks late morning and early afternoon, midweek.' },
    { days: [0, 6], hours: [10], why: 'Weekend mornings suit community and event posts.' },
  ],
  instagram: [
    { days: [1, 2, 3, 4, 5], hours: [12, 19], why: 'Instagram is busiest at lunch and in the evening.' },
    { days: [0], hours: [18], why: 'Sunday evening, when people plan the week.' },
  ],
  tiktok: [
    { days: [2, 3, 4], hours: [19, 20], why: 'TikTok audiences are most active on weekday evenings.' },
    { days: [0, 6], hours: [15], why: 'Weekend afternoons.' },
  ],
  website: [
    { days: [2, 3, 4], hours: [9], why: 'Articles are found most on weekday mornings.' },
  ],
};

export interface TimeSuggestion { iso: string; label: string; why: string; channels: Channel[] }

/** Local (EAT, UTC+3) date parts for an instant. */
const eat = (d: Date) => new Date(d.getTime() + 3 * 3600_000);

/**
 * The next few good slots for the chosen channels, never in the past, never on a public holiday and not within
 * two hours of something already scheduled. Slots that suit more of the chosen channels come first.
 */
export function suggestTimes(channels: Channel[], taken: Date[] = [], from: Date = new Date(), count = 5): TimeSuggestion[] {
  const chosen = channels.length ? channels : (['linkedin'] as Channel[]);
  const found = new Map<string, { at: Date; why: string; channels: Set<Channel> }>();
  const start = new Date(from.getTime() + 30 * 60_000);
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    for (const ch of chosen) {
      for (const w of WINDOWS[ch]) {
        const base = eat(new Date(start.getTime() + dayOffset * 86400_000));
        if (!w.days.includes(base.getUTCDay())) continue;
        for (const h of w.hours) {
          // The local time h:00 EAT as an instant.
          const at = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h - 3, 0, 0));
          if (at.getTime() < start.getTime()) continue;
          const asLocalDate = new Date(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
          if (holidayOn(asLocalDate)) continue;
          if (taken.some((t) => Math.abs(t.getTime() - at.getTime()) < 2 * 3600_000)) continue;
          const key = at.toISOString();
          const e = found.get(key) ?? { at, why: w.why, channels: new Set<Channel>() };
          e.channels.add(ch);
          found.set(key, e);
        }
      }
    }
  }
  return [...found.values()]
    .sort((a, b) => b.channels.size - a.channels.size || a.at.getTime() - b.at.getTime())
    .slice(0, count * 2)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, count)
    .map((e) => ({
      iso: e.at.toISOString(),
      label: e.at.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Nairobi' }),
      why: e.why,
      channels: [...e.channels],
    }));
}
