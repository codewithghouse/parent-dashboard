/**
 * school_holidays subscription + lookup helpers.
 *
 * Architecture
 * ────────────
 * Holiday = SCHOOL-WIDE off-day declared by principal/admin. Lives in a
 * separate collection from per-student attendance:
 *
 *   school_holidays/{schoolId}_{YYYY-MM-DD}
 *     ├─ schoolId, date (YYYY-MM-DD IST)
 *     ├─ reason: string  (e.g. "Diwali", "Republic Day")
 *     ├─ branchId?: string  (optional — branch-scoped holiday)
 *     ├─ declaredBy: string, declaredByName: string
 *     └─ createdAt: serverTimestamp()
 *
 * Why separate from `attendance` docs (per-student status:"holiday"):
 *   • Holiday is a SCOPE statement, not a per-student fact. School-wide
 *     applies to all classes / all students automatically.
 *   • Survives the multi-teacher loophole — a subject teacher can't
 *     overwrite a school holiday by marking present (they're in different
 *     collections).
 *   • One write per school per holiday (vs 50+ per-student docs).
 *
 * The per-class "Mark Day as Holiday" flow (teacher MarkAttendance) is
 * still supported as a fallback for class-specific off-days (e.g. one class
 * out on a field trip). Both layers compose: a date is treated as off-day
 * if EITHER the school declared it OR the class teacher marked all
 * students "holiday" in attendance.
 */

import {
  collection,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

export interface SchoolHoliday {
  id: string;
  schoolId: string;
  date: string; // YYYY-MM-DD IST
  reason: string;
  branchId?: string;
  declaredBy?: string;
  declaredByName?: string;
  createdAt?: unknown;
}

/**
 * Subscribe to all school_holidays for a school. Returns an unsubscribe
 * function. The callback fires with the latest snapshot whenever the
 * collection changes.
 */
export function subscribeSchoolHolidays(
  schoolId: string,
  onChange: (holidays: SchoolHoliday[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  if (!schoolId) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, "school_holidays"), where("schoolId", "==", schoolId)),
    (snap) => {
      const out: SchoolHoliday[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SchoolHoliday, "id">),
      }));
      onChange(out);
    },
    (err) => {
      console.error("[schoolHolidays] listener error:", err);
      onError?.(err);
    },
  );
}

/**
 * Build a fast lookup Map from a holidays list. Key is the IST YYYY-MM-DD
 * string, value is the holiday doc. Used by readers to ask
 * `isSchoolHoliday(dateKey)` in O(1).
 */
export function buildHolidayMap(
  holidays: SchoolHoliday[],
): Map<string, SchoolHoliday> {
  const m = new Map<string, SchoolHoliday>();
  holidays.forEach((h) => {
    if (h.date) m.set(h.date, h);
  });
  return m;
}

/**
 * Check if a date string is a declared school holiday.
 * dateKey must be IST YYYY-MM-DD format (matches `istKey` writers).
 */
export function isSchoolHoliday(
  dateKey: string | undefined | null,
  holidayMap: Map<string, SchoolHoliday>,
): boolean {
  if (!dateKey) return false;
  return holidayMap.has(dateKey);
}
