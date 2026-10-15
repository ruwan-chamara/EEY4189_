import { Router } from 'express';
import crypto from 'crypto';
import { User } from '../models/index.js';
import { auth, sign } from '../middleware/auth.js';
import { ah } from '../utils/ah.js';
import { sendMail } from '../utils/mailer.js';
const r = Router();
export const pub = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, studentId: u.studentId });
export const tempPassword = () => crypto.randomBytes(6).toString('base64url');

r.post('/login', ah(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: '! This is a required field', fields: { email: !email, password: !password } });
  const u = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  if (!u || u.archived || !(await u.matches(password)))
    return res.status(401).json({ message: '! Please enter correct credentials.' });
  res.json({ token: sign(u), user: pub(u) });
}));

r.post('/forgot-password', ah(async (req, res) => {
  const u = await User.findOne({ email: String(req.body.email || '').toLowerCase().trim() });
  if (!u || u.archived) return res.status(404).json({ message: 'Please enter a valid student/course coordinator email address.' });
  const pw = tempPassword();
  u.password = pw; await u.save();
  await sendMail(u.email, 'UniEdTrack – your new password', `Hi ${u.name},\n\nYour new password is: ${pw}\nPlease change it after signing in.`);
  res.json({ message: 'A new password has been sent to your email.' });
}));

r.get('/me', auth, (req, res) => res.json({ user: pub(req.user) }));

r.post('/change-password', auth, ah(async (req, res) => {
  const u = await User.findById(req.user._id).select('+password');
  if (!(await u.matches(req.body.current || ''))) return res.status(400).json({ message: 'Current password is incorrect.' });
  if ((req.body.next || '').length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  u.password = req.body.next; await u.save();
  res.json({ message: 'Password updated.' });
}));
export default r;
