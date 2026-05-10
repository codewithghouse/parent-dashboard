/**
 * alertBuilder.ts — shared alert synthesis used by both AlertsPage and
 * DashboardPage's "Recent Alerts" card.
 *
 * Why this exists
 * ───────────────
 * Originally the synthesis lived inline in AlertsPage.tsx. DashboardPage
 * read ONLY the `risks` collection — so when a student had an empty risks
 * collection but real signals (great test scores, occasional absence,
 * upcoming due assignments), the Dashboard card said "No alerts right now"
 * while AlertsPage was full of meaningful alerts. User correctly flagged
 * the inconsistency 2026-05-21.
 *
 * Five synthesis sources, in priority order:
 *   1. risks         — teacher-flagged issues (Critical → High Priority)
 *   2. attendance    — absences (High) + late arrivals (Medium)
 *   3. test_scores   — high (≥85% Good News) and low (<60% High Priority)
 *   4. assignments   — overdue (High) + due-soon (Medium)
 *   5. parent_notes  — teacher remarks (positive = Good News, else Medium)
 *
 * Sort order within result: priority (High → Medium → Good News → General).
 * Dedup by alert id. Caller filters by dismissed-set + slices for display.
 */

export interface ParsedAlert {
  id: string;
  title: string;
  description: string;
  category: "Academic" | "Attendance" | "General";
  priority: "High Priority" | "Medium Priority" | "Good News" | "General";
  createdAt: any;
  teacherName?: string;
  date?: string;
  arrivalTime?: string;
  source: string;
  sourceId?: string;
  subject?: string;
}

export interface AlertSources {
  studentName: string;
  risks: any[];
  attendance: any[];
  scores: any[];        // merged test_scores + gradebook_scores
  assignments: any[];
  submissions: any[];
  notes: any[];         // parent_notes from teacher
}

const fmtDateStr = (dateStr: string) => {
  if (!dateStr) return "Recent";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  return dateStr;
};

const fmtTs = (ts: any): string => {
  if (!ts) return "Recent";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "Recent";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const PRIORITY_ORDER: Record<string, number> = {
  "High Priority": 0,
  "Medium Priority": 1,
  "Good News": 2,
  General: 3,
};

export function buildAlerts(opts: AlertSources): ParsedAlert[] {
  const result: ParsedAlert[] = [];
  const { studentName: name, risks, attendance, scores, assignments, submissions, notes } = opts;
  const now = Date.now();

  // ── SOURCE 1: risks collection (teacher-created flags) ──
  risks
    .filter(r => !r.resolved)
    .forEach(r => {
      const catMap: Record<string, ParsedAlert["category"]> = {
        Attendance: "Attendance", Grades: "Academic",
        Submissions: "Academic", Behavior: "General",
      };
      const priMap: Record<string, ParsedAlert["priority"]> = {
        Critical: "High Priority", "High Priority": "High Priority",
        "Medium Priority": "Medium Priority",
      };
      result.push({
        id: `risk_${r.id}`,
        title: r.issue || "Risk Flag",
        description: Array.isArray(r.details) ? r.details.join(" · ") : (r.issue || ""),
        category: catMap[r.type] || "General",
        priority: priMap[r.severity] || "Medium Priority",
        createdAt: r.createdAt || null,
        teacherName: r.teacherName || "",
        source: "risks",
        sourceId: r.id,
        subject: r.subject || "",
      });
    });

  // ── SOURCE 2: attendance (absent = High, late = Medium) ──
  const absentRecords = attendance.filter(a => a.status === "absent");
  const totalAbsences = absentRecords.length;
  const absentDayNums = absentRecords.map(a => {
    const parts = (a.date || "").split("-");
    return parts.length === 3 ? new Date(+parts[0], +parts[1] - 1, +parts[2]).getDay() : -1;
  }).filter(d => d >= 0);
  const dayTally = absentDayNums.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc; }, {} as Record<number, number>);
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const topAbsentDays = Object.entries(dayTally).sort((a, b) => +b[1] - +a[1]).slice(0, 2).map(([d]) => DAYS[+d]);
  const dayPattern = topAbsentDays.length > 0 ? ` (mostly ${topAbsentDays.join(" and ")})` : "";
  const lowScoreSubjects = scores.filter(s => {
    const pct = s.percentage ?? (s.maxScore > 0 ? s.score / s.maxScore * 100 : 0);
    return pct < 60;
  });
  const academicImpact = lowScoreSubjects.length > 0
    ? ` This is directly affecting grades — ${lowScoreSubjects.length} subject${lowScoreSubjects.length > 1 ? "s are" : " is"} currently below the passing threshold.`
    : " Regular attendance is essential to stay on top of the curriculum.";
  const totalLates = attendance.filter(a => a.status === "late").length;

  attendance.forEach(a => {
    if (a.status === "absent") {
      const absenceStory = totalAbsences === 1
        ? `${name} was absent on ${fmtDateStr(a.date)}. This is their first recorded absence this term — please ensure it doesn't become a pattern.`
        : `${name} has been absent ${totalAbsences} time${totalAbsences > 1 ? "s" : ""} this term${dayPattern}.${academicImpact}`;
      result.push({
        id: `att_absent_${a.id}`,
        title: totalAbsences > 2 ? `Repeated Absences — ${totalAbsences} This Term` : "Absence Recorded",
        description: absenceStory,
        category: "Attendance",
        priority: "High Priority",
        createdAt: a.createdAt || null,
        teacherName: a.teacherName || "",
        date: a.date,
        source: "attendance",
        subject: "Attendance",
      });
    } else if (a.status === "late") {
      const lateStory = `${name} arrived late on ${fmtDateStr(a.date)}${a.arrivalTime || a.time ? ` at ${a.arrivalTime || a.time}` : ""}. This is their ${totalLates === 1 ? "first" : `${totalLates}th`} late arrival this term — arriving on time ensures ${name.split(" ")[0]} doesn't miss the start of lessons.`;
      result.push({
        id: `att_late_${a.id}`,
        title: "Late Arrival Recorded",
        description: lateStory,
        category: "Attendance",
        priority: "Medium Priority",
        createdAt: a.createdAt || null,
        teacherName: a.teacherName || "",
        date: a.date,
        arrivalTime: a.arrivalTime || a.time || "",
        source: "attendance",
        subject: "Attendance",
      });
    }
  });

  // ── SOURCE 3: test_scores / gradebook_scores ──
  const submittedIds = new Set(
    submissions.flatMap(s => [s.homeworkId, s.assignmentId].filter(Boolean)),
  );
  scores.forEach(s => {
    const pct = s.percentage ?? (s.maxScore > 0 ? (s.score / s.maxScore * 100) : 0);
    const sub = s.subject || "a subject";
    const testName = s.testName || "a test";

    if (pct >= 85) {
      const subjectHighScores = scores.filter(s2 => s2.subject === sub && (s2.percentage ?? (s2.maxScore > 0 ? s2.score/s2.maxScore*100 : 0)) >= 85).length;
      const story = subjectHighScores > 1
        ? `${name} scored ${Math.round(pct)}% in "${testName}" — their ${subjectHighScores === 2 ? "second" : `${subjectHighScores}th`} strong result in ${sub} this term. This consistent excellence is worth celebrating and encouraging at home!`
        : `${name} scored an impressive ${Math.round(pct)}% in "${testName}" (${sub}). Hard work is clearly paying off — keep encouraging this momentum!`;
      result.push({
        id: `score_good_${s.id}`,
        title: `Excellent in ${sub}! 🎉`,
        description: story,
        category: "Academic",
        priority: "Good News",
        createdAt: s.timestamp || s.createdAt || null,
        teacherName: s.teacherName || "",
        source: "test_scores",
        subject: sub,
      });
    } else if (pct < 60 && pct > 0) {
      const subScores = scores.filter(s2 => s2.subject === sub).map(s2 => s2.percentage ?? (s2.maxScore > 0 ? s2.score/s2.maxScore*100 : 0));
      const subAvg = subScores.length > 0 ? Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length) : Math.round(pct);
      const isTrending = subScores.length > 1 && subScores[subScores.length - 1] < subScores[0];
      const trendNote = isTrending ? ` Performance in ${sub} has been declining — early intervention is key.` : ` Focused revision before the next assessment can make a significant difference.`;
      const story = `${name} scored ${Math.round(pct)}% in "${testName}" (${sub}). The current subject average is ${subAvg}%.${trendNote}`;
      result.push({
        id: `score_low_${s.id}`,
        title: `Below Passing — ${sub}`,
        description: story,
        category: "Academic",
        priority: "High Priority",
        createdAt: s.timestamp || s.createdAt || null,
        teacherName: s.teacherName || "",
        source: "test_scores",
        subject: sub,
      });
    }
  });

  // ── SOURCE 4: assignments (overdue + due soon) ──
  assignments.forEach(a => {
    if (!a.dueDate) return;
    const due = a.dueDate?.toMillis?.() || new Date(a.dueDate).getTime();
    if (!due) return;
    const alreadySubmitted = submittedIds.has(a.id);
    if (alreadySubmitted) return;

    const diffMs = due - now;
    const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));

    if (diffMs < 0) {
      const daysOverdue = Math.abs(Math.ceil(diffMs / (1000 * 3600 * 24)));
      const urgency = daysOverdue > 7 ? "This significantly impacts the term grade and requires immediate attention." : daysOverdue > 3 ? "Submitting it now — even late — is better than leaving it incomplete. Contact the teacher if an extension is needed." : "This was just missed — submitting it now with a brief apology note to the teacher may still earn partial credit.";
      result.push({
        id: `assign_overdue_${a.id}`,
        title: `Assignment Overdue — ${daysOverdue} Day${daysOverdue > 1 ? "s" : ""}`,
        description: `"${a.title}" was due on ${fmtTs(a.dueDate)} and remains unsubmitted. ${urgency}`,
        category: "Academic",
        priority: "High Priority",
        createdAt: a.dueDate,
        teacherName: a.teacherName || "",
        source: "assignments",
        subject: a.subject || "Assignments",
      });
    } else if (diffDays <= 3) {
      const urgency = diffDays === 1 ? "Due TOMORROW — action needed today." : `Due in ${diffDays} days — plan time tonight to complete it.`;
      result.push({
        id: `assign_soon_${a.id}`,
        title: `Due ${diffDays === 1 ? "Tomorrow" : `in ${diffDays} Days`} — ${a.title}`,
        description: `"${a.title}" is due on ${fmtTs(a.dueDate)}. ${urgency} Submitting on time keeps ${name.split(" ")[0]}'s completion record strong.`,
        category: "Academic",
        priority: "Medium Priority",
        createdAt: a.createdAt || null,
        teacherName: a.teacherName || "",
        source: "assignments",
        subject: a.subject || "Assignments",
      });
    }
  });

  // ── SOURCE 5: parent_notes (teacher notes to parent) ──
  notes.forEach(n => {
    const isPositive = (n.category || "").toLowerCase().includes("positive") || (n.category || "").toLowerCase().includes("praise");
    result.push({
      id: `note_${n.id}`,
      title: isPositive ? "Positive Note from Teacher" : "Teacher Note",
      description: n.content || "A note from your teacher.",
      category: "General",
      priority: isPositive ? "Good News" : "Medium Priority",
      createdAt: n.createdAt || null,
      teacherName: n.teacherName || "",
      source: "parent_notes",
      subject: n.subject || "",
    });
  });

  // Dedup + sort by priority
  const seen = new Set<string>();
  return result
    .filter(a => !seen.has(a.id) && seen.add(a.id))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
}
