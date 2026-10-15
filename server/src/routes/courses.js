import { Router } from 'express';
import { Course, Assessment, Mark, User } from '../models/index.js';
import { auth, allow } from '../middleware/auth.js';
import { ah, httpError } from '../utils/ah.js';
import { recalcGpa } from '../utils/gpa.js';
const r = Router();
r.use(auth);

export async function courseFor(user, id) {
  const c = await Course.findById(id);
  if (!c) throw httpError(404, 'Course not found.');
  const mine = user.role === 'admin' || String(c.coordinator) === String(user._id) || c.students.some((s) => String(s) === String(user._id));
  if (!mine) throw httpError(403, 'You do not have access to this course.');
  return c;
}
export async function ownedCourse(user, id) {
  const c = await Course.findById(id);
  if (!c) throw httpError(404, 'Course not found.');
  if (user.role !== 'admin' && String(c.coordinator) !== String(user._id)) throw httpError(403, 'You are not assigned to this course.');
  return c;
}

r.get('/', ah(async (req, res) => {
  const f = req.user.role === 'admin' ? {} : req.user.role === 'coordinator' ? { coordinator: req.user._id } : { students: req.user._id };
  const list = await Course.find(f).populate('coordinator', 'name email').sort({ code: 1 }).lean();
  res.json(list.map((c) => ({ ...c, students: req.user.role === 'student' ? undefined : c.students.length })));
}));

r.post('/', allow('admin'), ah(async (req, res) => {
  const { code, name, credits, semester, coordinator } = req.body;
  if (!code || !name) throw httpError(400, 'Course code and name are required.');
  res.status(201).json(await Course.create({ code, name, credits, semester, coordinator: coordinator || undefined }));
}));

r.put('/:id', allow('admin'), ah(async (req, res) => {
  const { name, credits, semester, coordinator } = req.body;
  res.json(await Course.findByIdAndUpdate(req.params.id, { name, credits, semester, coordinator: coordinator || null }, { new: true }));
}));

r.delete('/:id', allow('admin'), ah(async (req, res) => {
  await Promise.all([Course.findByIdAndDelete(req.params.id), Assessment.deleteMany({ course: req.params.id }), Mark.deleteMany({ course: req.params.id })]);
  res.json({ ok: true });
}));

// Enrolment is managed by admins; coordinators cannot add/remove students.
r.post('/:id/enroll', allow('admin'), ah(async (req, res) => {
  const ids = req.body.studentIds || [];
  await Course.updateOne({ _id: req.params.id }, { $addToSet: { students: { $each: ids } } });
  await User.updateMany({ _id: { $in: ids } }, { lastEnrolledAt: new Date() });
  res.json({ ok: true });
}));
r.delete('/:id/enroll/:studentId', allow('admin'), ah(async (req, res) => {
  await Course.updateOne({ _id: req.params.id }, { $pull: { students: req.params.studentId } });
  await recalcGpa(req.params.studentId);
  res.json({ ok: true });
}));

r.get('/:id/students', allow('admin', 'coordinator'), ah(async (req, res) => {
  const c = await ownedCourse(req.user, req.params.id);
  res.json(await User.find({ _id: { $in: c.students } }).select('name email studentId registrationNumber year gpa').sort({ studentId: 1 }));
}));

r.get('/:id/assessments', ah(async (req, res) => {
  await courseFor(req.user, req.params.id);
  res.json(await Assessment.find({ course: req.params.id }).sort({ date: 1 }));
}));
r.post('/:id/assessments', allow('admin', 'coordinator'), ah(async (req, res) => {
  await ownedCourse(req.user, req.params.id);
  const { title, weight } = req.body;
  if (!title || !weight) throw httpError(400, 'Title and weight are required.');
  const used = (await Assessment.find({ course: req.params.id })).reduce((s, a) => s + a.weight, 0);
  if (used + Number(weight) > 100) throw httpError(400, `Weights cannot exceed 100%. ${100 - used}% is still available.`);
  res.status(201).json(await Assessment.create({ course: req.params.id, title, weight: Number(weight) }));
}));
r.delete('/:id/assessments/:aid', allow('admin', 'coordinator'), ah(async (req, res) => {
  await ownedCourse(req.user, req.params.id);
  await Assessment.deleteOne({ _id: req.params.aid, course: req.params.id });
  await Mark.deleteMany({ assessment: req.params.aid });
  res.json({ ok: true });
}));

r.get('/:id/summary', allow('admin', 'coordinator'), ah(async (req, res) => {
  const c = await ownedCourse(req.user, req.params.id);
  const [asm, marks] = await Promise.all([Assessment.find({ course: c._id }), Mark.find({ course: c._id })]);
  const gradedAssessments = asm.filter((a) => marks.filter((m) => String(m.assessment) === String(a._id) && m.published).length >= c.students.length && c.students.length).length;
  const pub = marks.filter((m) => m.published);
  res.json({
    totalStudents: c.students.length, pendingGrades: asm.length - gradedAssessments, gradedAssessments,
    courseAverage: pub.length ? Math.round((pub.reduce((s, m) => s + m.score, 0) / pub.length) * 10) / 10 : null,
  });
}));
export default r;
