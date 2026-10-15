import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { User, Course } from '../models/index.js';
import { auth, allow } from '../middleware/auth.js';
import { ah, httpError } from '../utils/ah.js';
import { sendMail } from '../utils/mailer.js';
import { tempPassword } from './auth.js';
const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
r.use(auth, allow('admin'));

const welcome = (u, pw) => sendMail(u.email, 'Your UniEdTrack account',
  `Hi ${u.name},\n\nYour UniEdTrack account is ready.\nUsername: ${u.email}\nPassword: ${pw}\n\nUse "Forgot password" any time to reset it.`);

r.get('/', ah(async (req, res) => {
  const { role, q, archived } = req.query;
  const f = { archived: archived === 'true' };
  if (role) f.role = role;
  if (q) f.$or = ['name', 'email', 'studentId'].map((k) => ({ [k]: new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }));
  res.json(await User.find(f).sort({ role: 1, name: 1 }).limit(500));
}));

r.post('/', ah(async (req, res) => {
  const { name, email, role, studentId, registrationNumber, year } = req.body;
  if (!name || !email || !role) throw httpError(400, 'Name, email and role are required.');
  if (await User.findOne({ email: email.toLowerCase() })) throw httpError(409, 'A user with this email already exists.');
  const pw = tempPassword();
  const u = await User.create({ name, email, role, studentId: studentId || undefined, registrationNumber, year, password: pw });
  await welcome(u, pw);
  res.status(201).json(u);
}));

r.put('/:id', ah(async (req, res) => {
  const allowed = ['name', 'email', 'role', 'studentId', 'registrationNumber', 'year', 'archived', 'graduatedAt'];
  const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const u = await User.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
  if (!u) throw httpError(404, 'User not found.');
  res.json(u);
}));

r.delete('/:id', ah(async (req, res) => {
  if (String(req.user._id) === req.params.id) throw httpError(400, 'You cannot delete your own account.');
  await User.findByIdAndDelete(req.params.id);
  await Course.updateMany({}, { $pull: { students: req.params.id } });
  res.json({ ok: true });
}));

// Bulk import. CSV columns: name,email,studentId,registrationNumber,year,courses (course codes separated by ;)
r.post('/import', upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw httpError(400, 'Please attach a CSV file.');
  let rows;
  try { rows = parse(req.file.buffer, { columns: (h) => h.map((x) => x.trim()), skip_empty_lines: true, trim: true, bom: true }); }
  catch { throw httpError(400, 'The file is not a valid CSV.'); }
  const result = { created: 0, updated: 0, errors: [] };
  for (const [i, row] of rows.entries()) {
    try {
      if (!row.name || !row.email || !row.studentId) throw new Error('name, email and studentId are required');
      let u = await User.findOne({ email: row.email.toLowerCase() });
      const data = { name: row.name, studentId: row.studentId, registrationNumber: row.registrationNumber, year: Number(row.year) || undefined };
      if (u) { Object.assign(u, data); await u.save(); result.updated++; }
      else {
        const pw = tempPassword();
        u = await User.create({ ...data, email: row.email, role: 'student', password: pw });
        await welcome(u, pw); result.created++;
      }
      const codes = (row.courses || '').split(';').map((c) => c.trim().toUpperCase()).filter(Boolean);
      if (codes.length) {
        const found = await Course.find({ code: { $in: codes } });
        const missing = codes.filter((c) => !found.some((f) => f.code === c));
        if (missing.length) throw new Error(`unknown course(s): ${missing.join(', ')}`);
        await Course.updateMany({ _id: { $in: found.map((c) => c._id) } }, { $addToSet: { students: u._id } });
        await User.updateOne({ _id: u._id }, { lastEnrolledAt: new Date() });
      }
    } catch (e) { result.errors.push(`Row ${i + 2}: ${e.message}`); }
  }
  res.json(result);
}));

// Archive students inactive > 2 years or graduated > 1 year ago (SRS 3.1.2). Archived accounts are read-only and admin-visible.
export async function runArchival() {
  const y = (n) => new Date(Date.now() - n * 365 * 864e5);
  const r = await User.updateMany({ role: 'student', archived: false, $or: [{ lastEnrolledAt: { $lt: y(2) } }, { graduatedAt: { $lt: y(1) } }] }, { archived: true });
  return r.modifiedCount;
}
r.post('/archive-run', ah(async (req, res) => res.json({ archived: await runArchival() })));
export default r;
