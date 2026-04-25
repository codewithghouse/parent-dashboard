// ISO-week helpers for the leaderboard. We use ISO-8601 weeks with Monday
// as the first day so cron firings at "Monday 02:00 IST" align with the
// week boundary written into Firestore documents.

const MS_PER_DAY = 86_400_000;

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // 0 = Sun, 1 = Mon, ... → shift so Mon = 0
  const dayOffset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayOffset);
  return d;
}

function isoWeekParts(date: Date): { year: number; week: number } {
  // Algorithm per ISO-8601: the week containing the year's first Thursday
  // is week 1.
  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  const weekNumber =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return { year: target.getUTCFullYear(), week: weekNumber };
}

/** Returns an ID like "2026-W17" for the week containing `date` (default: now). */
export function getCurrentWeekId(date: Date = new Date()): string {
  const { year, week } = isoWeekParts(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Returns the previous ISO week ID. */
export function getPreviousWeekId(date: Date = new Date()): string {
  const prev = new Date(date.getTime() - 7 * MS_PER_DAY);
  return getCurrentWeekId(prev);
}

/** Returns the [start, end] timestamps (Mon 00:00 → Sun 23:59:59.999 UTC) for a week ID. */
export function weekIdToRange(weekId: string): { start: number; end: number } {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(weekId);
  if (!match) throw new Error(`Invalid weekId: ${weekId}`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  // Jan 4th is always in week 1. Find that week's Monday, then add (week-1)*7 days.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = startOfIsoWeek(jan4);
  const start = week1Monday.getTime() + (week - 1) * 7 * MS_PER_DAY;
  const end = start + 7 * MS_PER_DAY - 1;
  return { start, end };
}

/** Human-friendly label like "Week 17" — just the week number, used in UI. */
export function formatWeekLabel(weekId: string): string {
  const match = /^\d{4}-W(\d{1,2})$/.exec(weekId);
  return match ? `Week ${Number(match[1])}` : weekId;
}

/** Compact label like "W17" for chart x-axis tick marks. */
export function formatWeekShort(weekId: string): string {
  const match = /^\d{4}-W(\d{1,2})$/.exec(weekId);
  return match ? `W${Number(match[1])}` : weekId;
}

/** Date-range label like "Apr 21 – Apr 27". */
export function formatWeekRange(weekId: string): string {
  const { start, end } = weekIdToRange(weekId);
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
}

/** Compact countdown like "5d 12h" or "3h 20m". Returns "Now" if past `until`. */
export function formatCountdown(until: number, now: number = Date.now()): string {
  const diff = until - now;
  if (diff <= 0) return 'Now';
  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** "Updated Mon Apr 21 · 2:00 AM" footer label. Returns "Updated recently"
 *  when the timestamp is missing/invalid (defensive — Intl.DateTimeFormat
 *  would otherwise throw RangeError for `new Date(undefined)`). */
export function formatGeneratedAt(timestamp: number | undefined | null): string {
  if (timestamp == null || !Number.isFinite(timestamp)) return 'Updated recently';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Updated recently';
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  return `Updated ${day} · ${time}`;
}
