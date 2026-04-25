// ISO-8601 week helpers — server-side mirror of src/lib/week.ts.
// Cron firings at "Mon 02:00 IST" should produce the SAME weekId the client
// is reading, otherwise parents see "leaderboard not yet ready" because the
// cron wrote to a different bucket.

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
  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  const weekNumber =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return { year: target.getUTCFullYear(), week: weekNumber };
}

export function getCurrentWeekId(date: Date = new Date()): string {
  const { year, week } = isoWeekParts(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function getPreviousWeekId(date: Date = new Date()): string {
  const prev = new Date(date.getTime() - 7 * MS_PER_DAY);
  return getCurrentWeekId(prev);
}

export function weekIdToRange(weekId: string): { start: number; end: number } {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(weekId);
  if (!match) throw new Error(`Invalid weekId: ${weekId}`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = startOfIsoWeek(jan4);
  const start = week1Monday.getTime() + (week - 1) * 7 * MS_PER_DAY;
  const end = start + 7 * MS_PER_DAY - 1;
  return { start, end };
}

export function formatWeekShort(weekId: string): string {
  const match = /^\d{4}-W(\d{1,2})$/.exec(weekId);
  return match ? `W${Number(match[1])}` : weekId;
}

/**
 * Produce a YYYY-MM-DD string in UTC for a given timestamp. Used to filter
 * the `attendance` collection which stores `date` as a YYYY-MM-DD string.
 */
export function toIsoDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns every YYYY-MM-DD string in [start, end] inclusive, in UTC.
 * Used to build an `in` query on the attendance.date field.
 */
export function isoDatesInRange(start: number, end: number): string[] {
  const out: string[] = [];
  const startDay = new Date(start);
  startDay.setUTCHours(0, 0, 0, 0);
  for (let t = startDay.getTime(); t <= end; t += MS_PER_DAY) {
    out.push(toIsoDate(t));
  }
  return out;
}
