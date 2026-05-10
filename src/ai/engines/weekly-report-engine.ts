/**
 * weekly-report-engine.ts — RULE-BASED weekly progress report.
 *
 * Was previously AI-powered (called callAI → parentAIProxy → OpenAI). Replaced
 * 2026-05-21 with deterministic rule-based generation per cost-control goal
 * in memory `parent_dashboard_ai_strategy`. Output JSON shape is byte-for-byte
 * compatible with the previous AI version, so DashboardPage consumers don't
 * change.
 *
 * Why rule-based:
 *   - Zero OpenAI cost
 *   - Instant (no network round-trip)
 *   - 100% deterministic — parent sees the same wording every refresh until
 *     the underlying data changes
 *   - No silent failures (no API key issues, no rate limits, no JSON parse
 *     errors)
 *   - Per-school control: rules can be updated without redeploying a Cloud
 *     Function or paying for AI generations
 */

export interface WeeklyReportInput {
  child_name: string;
  grade: string;
  week_start: string;
  week_end: string;
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    pct: number;
  };
  tests: { subject: string; score: number; max: number; grade: string }[];
  assignments: { total: number; submitted: number; pending: number };
  overall_avg: number;
  recent_alerts: string[];
}

export interface WeeklyReport {
  message: string;
  attendance_summary: string;
  test_analysis: string;
  assignment_status: string;
  overall_performance: {
    verdict: "Excellent" | "Good" | "Needs Attention" | "Critical";
    score_context: string;
    trend: "Improving" | "Stable" | "Declining";
  };
  improvement_tips: { tip: string; reason: string }[];
}

const firstName = (full: string): string => full.split(" ")[0] || full || "Student";

function attendanceSummary(att: WeeklyReportInput["attendance"], name: string): string {
  if (att.total === 0) {
    return `No attendance was recorded for ${name} this week.`;
  }
  if (att.pct >= 95) {
    return `Excellent attendance — ${name} was present every recorded day (${att.pct}%).`;
  }
  if (att.pct >= 90) {
    return `${name}'s attendance is strong this week at ${att.pct}% (${att.present} of ${att.total} days).`;
  }
  if (att.pct >= 85) {
    return `${name}'s attendance is on track at ${att.pct}%${att.late > 0 ? ` with ${att.late} late arrival${att.late > 1 ? "s" : ""}` : ""}.`;
  }
  if (att.pct >= 70) {
    return `${name}'s attendance has slipped to ${att.pct}% this week — ${att.absent} absence${att.absent !== 1 ? "s" : ""}${att.late > 0 ? ` and ${att.late} late arrival${att.late !== 1 ? "s" : ""}` : ""}.`;
  }
  return `${name}'s attendance is concerning at only ${att.pct}% (${att.absent} absence${att.absent !== 1 ? "s" : ""} of ${att.total} school days).`;
}

function testAnalysis(tests: WeeklyReportInput["tests"], name: string): string {
  if (tests.length === 0) {
    return `No tests were recorded for ${name} this week — focus stays on classroom work and assignments.`;
  }
  const pcts = tests.map((t) => (t.max > 0 ? (t.score / t.max) * 100 : 0));
  const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  const best = tests.reduce(
    (b, t) => ((t.score / Math.max(t.max, 1)) * 100 > (b.score / Math.max(b.max, 1)) * 100 ? t : b),
    tests[0],
  );
  const worst = tests.reduce(
    (w, t) => ((t.score / Math.max(t.max, 1)) * 100 < (w.score / Math.max(w.max, 1)) * 100 ? t : w),
    tests[0],
  );

  if (tests.length === 1) {
    const single = tests[0];
    const pct = Math.round(pcts[0]);
    return `${name} took 1 test in ${single.subject || "class"} this week — scored ${single.score}/${single.max} (${pct}%, grade ${single.grade}).`;
  }

  if (avg >= 85) {
    return `${name} performed strongly across ${tests.length} tests this week (average ${avg}%) — best result was ${Math.round((best.score / Math.max(best.max, 1)) * 100)}% in ${best.subject || "a subject"}.`;
  }
  if (avg >= 70) {
    return `${name} averaged ${avg}% across ${tests.length} tests this week — strongest in ${best.subject || "a subject"}, room to grow in ${worst.subject || "the weakest subject"}.`;
  }
  if (avg >= 50) {
    return `${name}'s test average dipped to ${avg}% across ${tests.length} tests this week — ${worst.subject || "the weakest subject"} needs the most focus.`;
  }
  return `${name}'s test average is ${avg}% across ${tests.length} tests this week — early intervention recommended, especially in ${worst.subject || "weak subjects"}.`;
}

function assignmentStatus(a: WeeklyReportInput["assignments"], name: string): string {
  if (a.total === 0) {
    return `No assignments were due this week.`;
  }
  if (a.pending === 0) {
    return `${name} submitted all ${a.total} assignment${a.total !== 1 ? "s" : ""} on time this week — full credit retained.`;
  }
  const completion = Math.round((a.submitted / a.total) * 100);
  if (completion >= 80) {
    return `${name} submitted ${a.submitted} of ${a.total} assignments (${completion}%) — ${a.pending} still pending.`;
  }
  if (completion >= 50) {
    return `${name} has completed ${a.submitted} of ${a.total} assignments this week (${completion}%); ${a.pending} pending need attention before grades are affected.`;
  }
  return `${name} has only completed ${a.submitted} of ${a.total} assignments (${completion}%) — ${a.pending} pending. Falling behind on submissions impacts term grades.`;
}

function overallPerformance(
  d: WeeklyReportInput,
): WeeklyReport["overall_performance"] {
  const avg = d.overall_avg;
  const att = d.attendance.pct;
  const submissionRate = d.assignments.total > 0 ? (d.assignments.submitted / d.assignments.total) * 100 : 100;

  let verdict: WeeklyReport["overall_performance"]["verdict"];
  if (avg >= 85 && att >= 90 && submissionRate >= 90) verdict = "Excellent";
  else if (avg >= 70 && att >= 85 && submissionRate >= 70) verdict = "Good";
  else if (avg >= 50 || att >= 70) verdict = "Needs Attention";
  else verdict = "Critical";

  let score_context: string;
  if (avg === 0) {
    score_context = "No graded data this week — verdict based on attendance and assignment completion only.";
  } else if (avg >= 85) {
    score_context = `An average of ${avg}% places ${firstName(d.child_name)} in the top performance band.`;
  } else if (avg >= 70) {
    score_context = `${avg}% average — comfortably above the passing threshold, with room to push toward 80%+.`;
  } else if (avg >= 50) {
    score_context = `${avg}% average — passing but trending toward concern. Targeted practice in weakest subjects can lift this quickly.`;
  } else {
    score_context = `${avg}% average is below passing — coordination with teachers on a recovery plan is recommended.`;
  }

  // Trend heuristic — without prior-week data we infer from absolute signals.
  // (Real week-over-week trend is computed at the dashboard level via
  // processResults' lastWeek/priorWeek bucketing in DashboardPage.tsx.)
  let trend: WeeklyReport["overall_performance"]["trend"];
  if (verdict === "Excellent") trend = "Improving";
  else if (verdict === "Critical" || (avg > 0 && avg < 50)) trend = "Declining";
  else trend = "Stable";

  return { verdict, score_context, trend };
}

function improvementTips(d: WeeklyReportInput): { tip: string; reason: string }[] {
  const tips: { tip: string; reason: string }[] = [];
  const name = firstName(d.child_name);

  // Attendance signals
  if (d.attendance.total > 0 && d.attendance.pct < 85) {
    tips.push({
      tip: `Set a fixed wake-up and school-prep routine`,
      reason: `${name}'s attendance is ${d.attendance.pct}% this week; consistent routines reduce both absences and late arrivals.`,
    });
  } else if (d.attendance.late > 0 && d.attendance.late >= d.attendance.absent) {
    tips.push({
      tip: `Aim to arrive 5 minutes before the first bell`,
      reason: `${d.attendance.late} late arrival${d.attendance.late !== 1 ? "s" : ""} this week — early arrivals reset the start of the day calmly.`,
    });
  }

  // Score signals
  if (d.tests.length > 0) {
    const scoreRows = d.tests.map((t) => ({
      subject: t.subject || "a subject",
      pct: t.max > 0 ? (t.score / t.max) * 100 : 0,
    }));
    const weakest = scoreRows.reduce((w, r) => (r.pct < w.pct ? r : w), scoreRows[0]);
    if (weakest.pct < 70) {
      tips.push({
        tip: `Block 20 minutes daily for ${weakest.subject}`,
        reason: `Score in ${weakest.subject} was ${Math.round(weakest.pct)}% this week — short focused review beats long cramming sessions.`,
      });
    }
  }
  if (d.overall_avg > 0 && d.overall_avg < 60) {
    tips.push({
      tip: `Schedule a brief check-in with the class teacher`,
      reason: `Overall average of ${d.overall_avg}% suggests targeted clarification on weak topics will move the needle faster than independent study.`,
    });
  }

  // Assignment signals
  if (d.assignments.pending > 0) {
    if (d.assignments.pending >= 3) {
      tips.push({
        tip: `Tackle the oldest pending assignment first`,
        reason: `${d.assignments.pending} assignments are pending — clearing them in due-date order prevents grade penalties from compounding.`,
      });
    } else {
      tips.push({
        tip: `Block tonight to finish ${d.assignments.pending} pending assignment${d.assignments.pending !== 1 ? "s" : ""}`,
        reason: `Catching up before the next school day keeps ${name}'s submission record clean.`,
      });
    }
  }

  // Positive reinforcement when nothing's broken
  if (tips.length === 0) {
    if (d.overall_avg >= 85) {
      tips.push({
        tip: `Stretch ${name} with one challenge problem per subject`,
        reason: `Strong ${d.overall_avg}% average means standard work is comfortable — variety keeps engagement high.`,
      });
    }
    tips.push({
      tip: `Acknowledge ${name}'s strong week out loud`,
      reason: `Clear positive feedback this week reinforces the routines that are working.`,
    });
  }

  // Cap at 3 tips for UI compactness.
  return tips.slice(0, 3);
}

function buildMessage(d: WeeklyReportInput, perf: WeeklyReport["overall_performance"]): string {
  const name = firstName(d.child_name);
  const parts: string[] = [];

  if (perf.verdict === "Excellent") {
    parts.push(`Great week for ${name} — performance is at the top of the class.`);
  } else if (perf.verdict === "Good") {
    parts.push(`${name} had a solid week.`);
  } else if (perf.verdict === "Needs Attention") {
    parts.push(`${name}'s week needs a closer look.`);
  } else {
    parts.push(`${name}'s week shows signals that need quick action.`);
  }

  if (d.overall_avg > 0) {
    parts.push(`Average score is ${d.overall_avg}%${d.tests.length > 0 ? ` across ${d.tests.length} test${d.tests.length !== 1 ? "s" : ""}` : ""}.`);
  } else if (d.tests.length === 0) {
    parts.push(`No tests this week — focus stayed on classroom work.`);
  }

  if (d.attendance.total > 0) {
    if (d.attendance.pct >= 90) {
      parts.push(`Attendance was strong (${d.attendance.pct}%).`);
    } else if (d.attendance.pct >= 85) {
      parts.push(`Attendance is on track (${d.attendance.pct}%).`);
    } else {
      parts.push(`Attendance has slipped to ${d.attendance.pct}% — worth addressing this week.`);
    }
  }

  if (d.assignments.pending === 0 && d.assignments.total > 0) {
    parts.push(`All ${d.assignments.total} assignment${d.assignments.total !== 1 ? "s were" : " was"} submitted on time.`);
  } else if (d.assignments.pending > 0) {
    parts.push(`${d.assignments.pending} assignment${d.assignments.pending !== 1 ? "s are" : " is"} still pending.`);
  }

  return parts.join(" ");
}

/**
 * Generate the weekly progress report. Pure synchronous logic — no network,
 * no AI, no failures (other than caller passing malformed input).
 *
 * Kept the function signature `Promise<...>` so it remains drop-in compatible
 * with the previous AI-powered version (callers `await` the result).
 */
export async function generateWeeklyReport(data: WeeklyReportInput): Promise<WeeklyReport> {
  const perf = overallPerformance(data);
  const name = firstName(data.child_name);
  return {
    message: buildMessage(data, perf),
    attendance_summary: attendanceSummary(data.attendance, name),
    test_analysis: testAnalysis(data.tests, name),
    assignment_status: assignmentStatus(data.assignments, name),
    overall_performance: perf,
    improvement_tips: improvementTips(data),
  };
}
