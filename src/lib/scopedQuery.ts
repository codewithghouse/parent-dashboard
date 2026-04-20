import {
  collection,
  query,
  where,
  Query,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Build a Firestore query scoped to the caller's schoolId.
 *
 * When `schoolId` is present, prepends `where("schoolId", "==", schoolId)` so
 * tenant-isolation rules accept the query. When absent (e.g. the student doc
 * hasn't resolved yet), falls back to the query without the filter.
 *
 * The fallback exists because a small number of callsites fire before
 * studentData has been hydrated from AuthContext. It is safe to keep: on
 * production the strict Firestore rules will reject the fallback path.
 */
export function scopedQuery(
  path: string,
  schoolId: string | undefined | null,
  ...constraints: QueryConstraint[]
): Query {
  const coll = collection(db, path);
  return schoolId
    ? query(coll, where("schoolId", "==", schoolId), ...constraints)
    : query(coll, ...constraints);
}