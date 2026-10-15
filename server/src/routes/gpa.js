import { Router } from 'express';
import { User } from '../models/index.js';
import { auth, allow } from '../middleware/auth.js';
import { ah, httpError } from '../utils/ah.js';
import { studentResults, recalcGpa, standing } from '../utils/gpa.js';
const r = Router();
r.use(auth);

r.get('/me', allow('student'), ah(async (req, res) => {
  const result = await recalcGpa(req.user._id);
  const [higher, total] = await Promise.all([
    User.countDocuments({ role: 'student', archived: false, gpa: { $gt: result.gpa ?? -1 } }),
    User.countDocuments({ role: 'student', archived: false, gpa: { $ne: null } }),
  ]);
  res.json({ ...result, rank: result.gpa == null ? null : higher + 1, rankedStudents: total });
}));

r.get('/', allow('admin'), ah(async (req, res) => {
  const list = await User.find({ role: 'student', archived: false }).sort({ studentId: 1 }).lean();
  res.json(list.map((s) => ({ _id: s._id, studentId: s.studentId, name: s.name, gpa: s.gpa, credits: s.creditsAttempted, status: standing(s.gpa), warnings: s.gpaWarnings })));
}));

r.post('/recalculate/:id', allow('admin'), ah(async (req, res) => {
  if (!(await User.exists({ _id: req.params.id, role: 'student' }))) throw httpError(404, 'Student not found.');
  const result = await recalcGpa(req.params.id);
  res.json({ gpa: result.gpa, status: standing(result.gpa), warnings: result.warnings });
}));
export default r;
