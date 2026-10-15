import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { Course, Assessment, Mark, User } from '../models/index.js';
import { auth, allow } from '../middleware/auth.js';
import { ah, httpError } from '../utils/ah.js';
import { recalcGpa, notify, toGrade } from '../utils/gpa.js';
import { ownedCourse } from './courses.js';
const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
r.use(auth);

const checkScore = (s) => {
  const n = Number(s);
  if (s === '' || s == null || Number.isNaN(n)) throw httpError(400, 'Please enter a numeric score.');
  if (n > 100) throw httpError(400, 'The score cannot be higher than 100 points.');
  if (n < 0) throw httpError(400, 'The score cannot be negative.');
  return n;
};
const assessmentOf = async (courseId, id) => {
  const a = await Assessment.findOne({ _id: id, course: courseId });
  if (!a) throw httpError(404, 'Assessment not found for this course.');
  return a;
};

// Student: published marks with letter grades, newest first (dashboard "Recent Grades").
r.get('/mine', allow('student'), ah(async (req, res) => {
  const marks = await Mark.find({ student: req.user._id, published: true }).populate('course', 'code name').populate('assessment', 'title weight date').sort({ publishedAt: -1 }).lean();
  res.json(marks.map((m) => ({ ...m, letter: toGrade(m.score)?.letter })));
}));

// Coordinator: roster for one assessment with each student's mark; rows without a mark form the "pending" list.
r.get('/course/:courseId', allow('admin', 'coordinator'), ah(async (req, res) => {
  const c = await ownedCourse(req.user, req.params.courseId);
  await assessmentOf(c._id, req.query.assessment);
  const [students, marks] = await Promise.all([
    User.find({ _id: { $in: c.students } }).select('name studentId').sort({ studentId: 1 }).lean(),
    Mark.find({ assessment: req.query.assessment }).lean(),
  ]);
  const map = new Map(marks.map((m) => [String(m.student), m]));
  res.json(students.map((s) => {
    const m = map.get(String(s._id));
    return { student: s, markId: m?._id, score: m?.score ?? null, letter: m ? toGrade(m.score)?.letter : null, published: !!m?.published, pending: !m };
  }));
}));

// Enter or modify one mark.
r.put('/', allow('admin', 'coordinator'), ah(async (req, res) => {
  const { course, assessment, student } = req.body;
  const c = await ownedCourse(req.user, course);
  await assessmentOf(c._id, assessment);
  if (!c.students.some((s) => String(s) === String(student))) throw httpError(400, 'Student is not enrolled in this course.');
  const score = checkScore(req.body.score);
  const m = await Mark.findOneAndUpdate({ assessment, student }, { course, score }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (m.published) await recalcGpa(student); // confirmed marks changed → GPA must follow
  res.json(m);
}));

r.delete('/:id', allow('admin', 'coordinator'), ah(async (req, res) => {
  const m = await Mark.findById(req.params.id);
  if (!m) throw httpError(404, 'Mark not found.');
  await ownedCourse(req.user, m.course);
  await m.deleteOne();
  if (m.published) await recalcGpa(m.student);
  res.json({ ok: true });
}));

// Bulk upload. CSV columns: studentId,score
r.post('/bulk', allow('admin', 'coordinator'), upload.single('file'), ah(async (req, res) => {
  const { course, assessment } = req.body;
  const c = await ownedCourse(req.user, course);
  await assessmentOf(c._id, assessment);
  if (!req.file) throw httpError(400, 'Please attach a CSV file.');
  let rows;
  try { rows = parse(req.file.buffer, { columns: (h) => h.map((x) => x.trim()), skip_empty_lines: true, trim: true, bom: true }); }
  catch { throw httpError(400, 'The file is not a valid CSV.'); }
  const enrolled = await User.find({ _id: { $in: c.students } }).select('studentId');
  const byCode = new Map(enrolled.map((s) => [s.studentId, s._id]));
  const out = { saved: 0, errors: [] };
  for (const [i, row] of rows.entries()) {
    try {
      const sid = byCode.get(row.studentId);
      if (!sid) throw new Error(`student ${row.studentId || '(blank)'} is not enrolled`);
      const score = checkScore(row.score);
      const m = await Mark.findOneAndUpdate({ assessment, student: sid }, { course, score }, { upsert: true, new: true, setDefaultsOnInsert: true });
      if (m.published) await recalcGpa(sid);
      out.saved++;
    } catch (e) { out.errors.push(`Row ${i + 2}: ${e.message}`); }
  }
  res.json(out);
}));

// Publish: every enrolled student must have a score first.
r.post('/publish', allow('admin', 'coordinator'), ah(async (req, res) => {
  const { course, assessment } = req.body;
  const c = await ownedCourse(req.user, course);
  const a = await assessmentOf(c._id, assessment);
  const students = await User.find({ _id: { $in: c.students } }).select('studentId');
  const marks = await Mark.find({ assessment });
  const have = new Set(marks.map((m) => String(m.student)));
  const blank = students.filter((s) => !have.has(String(s._id)));
  if (blank.length) return res.status(400).json({ message: `You have blank scores for student ${blank.slice(0, 5).map((s) => s.studentId).join(', ')}${blank.length > 5 ? ` and ${blank.length - 5} more` : ''}`, blank: blank.map((s) => s.studentId) });
  await Mark.updateMany({ assessment, published: false }, { published: true, publishedAt: new Date() });
  const errors = [];
  for (const s of students) {
    try { await recalcGpa(s._id); await notify(s._id, `Your ${a.title} mark for ${c.code} has been released.`); }
    catch (e) { errors.push(e.message); }
  }
  res.json({ message: `Grades for ${a.title} were published.`, errors });
}));
export default r;
