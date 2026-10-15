import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { User, Course, Assessment, Mark } from '../models/index.js';
import { auth, allow } from '../middleware/auth.js';
import { ah, httpError } from '../utils/ah.js';
import { studentResults, standing, toGrade, round2 } from '../utils/gpa.js';
const r = Router();
r.use(auth);
const REQUIRED = 'This field is required. Please enter the correct value.';
const NO_DATA = 'No data exists for the selected criteria. Please change your filters.';

const csv = (rows) => {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [keys.map(esc).join(','), ...rows.map((x) => keys.map((k) => esc(x[k])).join(','))].join('\n');
};
function send(res, format, report) {
  const name = report.title.replace(/\W+/g, '_').toLowerCase();
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', `attachment; filename=${name}.csv`);
    return res.send(csv(report.rows));
  }
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename=${name}.pdf`);
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    doc.pipe(res);
    doc.fontSize(16).text(report.title).fontSize(9).fillColor('#555').text(`Generated ${new Date().toLocaleString()}`);
    if (report.summary) doc.moveDown(0.5).fillColor('#000').fontSize(10).text(Object.entries(report.summary).map(([k, v]) => `${k}: ${v}`).join('   '));
    doc.moveDown().fillColor('#000');
    const keys = Object.keys(report.rows[0] || {});
    const w = (doc.page.width - 80) / Math.max(keys.length, 1);
    const line = (cells, bold) => {
      const y = doc.y; doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      cells.forEach((c, i) => doc.text(String(c ?? ''), 40 + i * w, y, { width: w - 4, height: 12, ellipsis: true }));
      doc.y = y + 14; if (doc.y > doc.page.height - 60) doc.addPage();
    };
    line(keys, true); report.rows.forEach((row) => line(keys.map((k) => row[k]), false));
    return doc.end();
  }
  res.json(report);
}

const builders = {
  async student(req) {
    const code = req.user.role === 'student' ? req.user.studentId : req.query.studentId;
    if (!code) throw httpError(400, REQUIRED);
    const s = await User.findOne({ studentId: code, role: 'student' });
    if (!s) throw httpError(404, NO_DATA);
    if (req.user.role === 'coordinator') {
      const shared = await Course.exists({ coordinator: req.user._id, students: s._id });
      if (!shared) throw httpError(403, 'You can only report on students in your courses.');
    }
    const res = await studentResults(s._id);
    let rows = res.courses.filter((c) => !req.query.semester || c.semester === req.query.semester);
    if (!rows.length) throw httpError(404, NO_DATA);
    return { title: `Student report ${s.studentId}`, summary: { Student: s.name, 'Cumulative GPA': res.gpa ?? 'N/A', Credits: res.credits },
      rows: rows.map((c) => ({ Course: c.code, Name: c.name, Semester: c.semester, Credits: c.credits, 'Final mark': c.complete ? c.final : 'Pending', Grade: c.letter ?? '-', Points: c.points ?? '-' })) };
  },
  async course(req) {
    if (!req.query.courseId) throw httpError(400, REQUIRED);
    const c = await Course.findOne({ code: req.query.courseId.toUpperCase() });
    if (!c) throw httpError(404, NO_DATA);
    if (req.user.role === 'coordinator' && String(c.coordinator) !== String(req.user._id)) throw httpError(403, 'You are not assigned to this course.');
    const [asm, students, marks] = await Promise.all([Assessment.find({ course: c._id }).sort({ date: 1 }), User.find({ _id: { $in: c.students } }), Mark.find({ course: c._id, published: true })]);
    if (!students.length) throw httpError(404, NO_DATA);
    const rows = students.map((s) => {
      const row = { 'Student ID': s.studentId, Name: s.name }; let final = 0;
      asm.forEach((a) => { const m = marks.find((x) => String(x.student) === String(s._id) && String(x.assessment) === String(a._id)); row[a.title] = m?.score ?? '-'; final += (m?.score ?? 0) * a.weight / 100; });
      row['Final mark'] = round2(final); row.Grade = toGrade(round2(final))?.letter ?? '-'; return row;
    }).sort((a, b) => b['Final mark'] - a['Final mark']).map((row, i) => ({ Rank: i + 1, ...row }));
    return { title: `Course report ${c.code}`, summary: { Course: c.name, Students: rows.length, Average: round2(rows.reduce((s, x) => s + x['Final mark'], 0) / rows.length) }, rows };
  },
  async 'gpa-summary'(req) {
    const list = await User.find({ role: 'student', archived: false, gpa: { $ne: null } }).sort({ gpa: -1 });
    if (!list.length) throw httpError(404, NO_DATA);
    return { title: 'GPA summary', summary: { Students: list.length }, rows: list.map((s, i) => ({ Rank: i + 1, 'Student ID': s.studentId, Name: s.name, Year: s.year ?? '', GPA: s.gpa, Credits: s.creditsAttempted, Status: standing(s.gpa) })) };
  },
  async 'deans-list'(req) {
    const min = Number(req.query.minGpa) || 3.5;
    const list = await User.find({ role: 'student', archived: false, gpa: { $gte: min } }).sort({ gpa: -1 });
    if (!list.length) throw httpError(404, NO_DATA);
    return { title: "Dean's list", summary: { 'Minimum GPA': min, Students: list.length }, rows: list.map((s, i) => ({ Rank: i + 1, 'Student ID': s.studentId, Name: s.name, Year: s.year ?? '', GPA: s.gpa })) };
  },
  async overall() {
    const courses = await Course.find().populate('coordinator', 'name');
    if (!courses.length) throw httpError(404, NO_DATA);
    const rows = [];
    for (const c of courses) {
      const [asm, marks] = await Promise.all([Assessment.find({ course: c._id }), Mark.find({ course: c._id, published: true })]);
      const wt = Object.fromEntries(asm.map((a) => [String(a._id), a.weight]));
      const per = {}; marks.forEach((m) => { per[m.student] = (per[m.student] || 0) + m.score * (wt[m.assessment] || 0) / 100; });
      const finals = Object.values(per);
      rows.push({ Course: c.code, Name: c.name, Coordinator: c.coordinator?.name ?? '-', Enrolled: c.students.length, Assessments: asm.length, 'Average final': finals.length ? round2(finals.reduce((a, b) => a + b, 0) / finals.length) : '-' });
    }
    return { title: 'Overall performance', rows };
  },
};
const roles = { student: ['student', 'coordinator', 'admin'], course: ['coordinator', 'admin'], 'gpa-summary': ['admin'], 'deans-list': ['admin'], overall: ['admin'] };

r.get('/:type', ah(async (req, res) => {
  const b = builders[req.params.type];
  if (!b) throw httpError(404, 'Unknown report type.');
  if (!roles[req.params.type].includes(req.user.role)) throw httpError(403, 'You do not have permission to generate this report.');
  try { send(res, req.query.format, await b(req)); }
  catch (e) { if (req.query.format === 'pdf' || req.query.format === 'csv') throw httpError(e.status || 500, e.status ? e.message : 'Report export failed. Please try again or contact the administrator.'); throw e; }
}));
export default r;
