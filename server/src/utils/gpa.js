import { Course, Assessment, Mark, User, Notification } from '../models/index.js';
import { httpError } from './ah.js';

// University grading scale (FR3). Adjust to CIU's official policy.
export const SCALE = [[90, 'A+', 4.0], [85, 'A', 4.0], [80, 'A-', 3.7], [75, 'B+', 3.3], [70, 'B', 3.0],
  [65, 'B-', 2.7], [60, 'C+', 2.3], [55, 'C', 2.0], [50, 'C-', 1.7], [40, 'D', 1.0], [0, 'F', 0]];
export const toGrade = (m) => {
  if (typeof m !== 'number' || Number.isNaN(m) || m < 0 || m > 100) return null;
  const r = SCALE.find(([min]) => m >= min);
  return { letter: r[1], points: r[2] };
};
export const round2 = (n) => Math.round(n * 100) / 100;
export const standing = (gpa) => (gpa == null ? 'N/A' : gpa >= 3.5 ? "Dean's List" : gpa >= 2 ? 'Good Standing' : 'Probation');
export const notify = (user, message) => Notification.create({ user, message });

const gpaOf = (rows) => {
  const cr = rows.reduce((s, r) => s + r.credits, 0);
  return cr ? round2(rows.reduce((s, r) => s + r.points * r.credits, 0) / cr) : null;
};

/** Per-course final marks + semester/cumulative GPA from PUBLISHED marks only. */
export async function studentResults(studentId) {
  const courses = await Course.find({ students: studentId }).lean();
  const ids = courses.map((c) => c._id);
  const [asm, marks] = await Promise.all([
    Assessment.find({ course: { $in: ids } }).lean(),
    Mark.find({ student: studentId, course: { $in: ids }, published: true }).lean(),
  ]);
  const rows = [], warnings = [];
  for (const c of courses) {
    const a = asm.filter((x) => String(x.course) === String(c._id));
    const m = new Map(marks.filter((x) => String(x.course) === String(c._id)).map((x) => [String(x.assessment), x.score]));
    const weights = a.reduce((s, x) => s + x.weight, 0);
    const complete = a.length > 0 && Math.round(weights) === 100 && a.every((x) => m.has(String(x._id)));
    const final = round2(a.reduce((s, x) => s + (m.get(String(x._id)) ?? 0) * x.weight / 100, 0));
    const row = { courseId: c._id, code: c.code, name: c.name, credits: c.credits, semester: c.semester || 'N/A',
      complete, final, graded: m.size, total: a.length };
    if (complete) {
      const g = toGrade(final);
      if (!g) throw httpError(422, `Error: Invalid grade found for ${c.code}. Please check the grading data.`);
      Object.assign(row, g);
    } else warnings.push(`${c.code} has no confirmed final grade, so the GPA is based on incomplete data.`);
    rows.push(row);
  }
  const done = rows.filter((r) => r.complete);
  const bySem = {};
  done.forEach((r) => (bySem[r.semester] ||= []).push(r));
  return {
    courses: rows, gpa: gpaOf(done), credits: done.reduce((s, r) => s + r.credits, 0),
    semesters: Object.fromEntries(Object.entries(bySem).map(([k, v]) => [k, gpaOf(v)])), warnings,
  };
}

export async function recalcGpa(studentId) {
  const r = await studentResults(studentId);
  await User.updateOne({ _id: studentId }, { gpa: r.gpa, creditsAttempted: r.credits, gpaWarnings: r.warnings });
  return r;
}
