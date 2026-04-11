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
}

const DEFAULTS: SchoolSettings = {
  attendanceThreshold: 85,
  gradeScale: { A: 85, B: 70, C: 50 },
};

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
