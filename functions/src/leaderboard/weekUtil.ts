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
 * Produce a YYYY-MM-DD string in IST (Asia/Kolkata) for a given timestamp.
 * Must match the format teachers' MarkAttendance.tsx writes:
 *   `new Date().toLocaleDateString("en-CA")` — local timezone, en-CA = YYYY-MM-DD.
 *
 * For Indian schools the local TZ is IST. The CRON runs in asia-south1 region
 * but Node.js inside Cloud Functions defaults to UTC — so naive `getUTCDate()`
 * shifts by 5h30m and a Monday morning IST mark gets read as the previous
 * Sunday UTC. Result: this week's attendance silently drops out of the filter.
 *
 * This is the leaderboard equivalent of the bug AlertsPage / DashboardPage
 * had with date string handling — caught 2026-05-21.
 */
export function toIsoDate(ts: number): string {
  // en-CA returns YYYY-MM-DD; timeZone option pins to IST.
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Returns every YYYY-MM-DD string in [start, end] inclusive, in IST.
 * Used to build an `in` query on the attendance.date field — and since
 * MarkAttendance writes IST date strings, this MUST also be IST or filter
 * misses early-IST-morning marks.
 *
 * Uses an inflated step (1 day) and IST-aware comparison so we don't lose a
 * day at the DST boundary (India doesn't observe DST, but defensive anyway).
 */
export function isoDatesInRange(start: number, end: number): string[] {
  const out: string[] = [];
  // Step at exact-day granularity. Use IST midnight as the cursor advance
  // base to keep keys stable regardless of host TZ.
  const seen = new Set<string>();
  let cursor = start;
  while (cursor <= end) {
    const key = toIsoDate(cursor);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
    cursor += MS_PER_DAY;
  }
  // One more lookup at `end` exactly, in case the loop's last step was just
  // before midnight IST and missed the final day.
  const tail = toIsoDate(end);
  if (!seen.has(tail)) out.push(tail);
  return out;
}
