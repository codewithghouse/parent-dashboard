/**
 * useSchoolSettings
 *
 * Fetches per-school configuration from Firestore:
 *   schools/{schoolId}/settings/general
 *
 * Falls back to sensible defaults so the app works even if the doc
 * doesn't exist yet (e.g. school hasn't been configured by the owner).
 *
 * Owner dashboard can write to this doc to customise thresholds
 * per school without touching code.
 */

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

export interface SchoolSettings {
  attendanceThreshold: number;          // e.g. 85  → "85% required"
  gradeScale: { A: number; B: number; C: number }; // min % for each grade
  schoolName?: string;
  termName?: string;
  /** e.g. "2025-26" — when set by the owner this overrides the date-derived value below */
  academicYear?: string;
  /** Month (1-12) the academic year starts. Defaults to 4 (April) for IN, 6 (June)/9 (September) for other regions. */
  academicYearStartMonth?: number;
}

const DEFAULTS: SchoolSettings = {
  attendanceThreshold: 85,
  gradeScale: { A: 85, B: 70, C: 50 },
  academicYearStartMonth: 4, // April — common Indian academic-year start
};

/**
 * Resolve the current academic year as a "YYYY-YY" string.
 * Honours the school's configured `academicYear` first; otherwise derives
 * it from today's date and the configured start month.
 */
export function resolveAcademicYear(settings: SchoolSettings, today = new Date()): string {
  if (settings.academicYear) return settings.academicYear;
  const startMonth = settings.academicYearStartMonth ?? 4;
  const month = today.getMonth() + 1; // 1..12
  const fullYear = today.getFullYear();
  const startYear = month >= startMonth ? fullYear : fullYear - 1;
  const endYY = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYY}`;
}

export function useSchoolSettings(): SchoolSettings {
  const { studentData } = useAuth();
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULTS);

  useEffect(() => {
    const schoolId = studentData?.schoolId;
    if (!schoolId) return;                         // no schoolId → keep defaults

    const unsub = onSnapshot(
      doc(db, "schools", schoolId, "settings", "general"),
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULTS, ...snap.data() } as SchoolSettings);
        } else {
          setSettings(DEFAULTS);                   // doc missing → use defaults
        }
      },
      () => setSettings(DEFAULTS)                  // permission/network error → defaults
    );

    return () => unsub();
  }, [studentData?.schoolId]);

  return settings;
}
