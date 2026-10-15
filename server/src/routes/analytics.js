import { Router } from 'express';
import { User, Course } from '../models/index.js';
import { auth, allow } from '../middleware/auth.js';
import { ah } from '../utils/ah.js';
const r = Router();
r.use(auth, allow('admin'));
const since = () => new Date(Date.now() - 30 * 864e5);
r.get('/overview', ah(async (req, res) => {
  const count = (f) => User.countDocuments({ archived: false, ...f });
  const [total, students, coordinators, courses, newThisMonth] = await Promise.all([count({}), count({ role: 'student' }), count({ role: 'coordinator' }), Course.countDocuments(), count({ createdAt: { $gte: since() } })]);
  res.json({ total, students, coordinators, courses, newThisMonth });
}));
r.get('/grade-distribution', ah(async (req, res) => {
  const gpas = (await User.find({ role: 'student', archived: false, gpa: { $ne: null } }).select('gpa')).map((s) => s.gpa);
  const buckets = [['Below 2.0', (g) => g < 2], ['2.0 – 2.99', (g) => g >= 2 && g < 3], ['3.0 – 3.69', (g) => g >= 3 && g < 3.7], ['3.7 and above', (g) => g >= 3.7]];
  res.json(buckets.map(([label, fn]) => ({ label, count: gpas.filter(fn).length, pct: gpas.length ? Math.round(gpas.filter(fn).length * 100 / gpas.length) : 0 })));
}));
export default r;
