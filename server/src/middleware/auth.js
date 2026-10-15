import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
export const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '8h' });
export async function auth(req, res, next) {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const { id } = jwt.verify(t, process.env.JWT_SECRET);
    const u = await User.findById(id);
    if (!u || u.archived) throw new Error('no user');
    req.user = u; next();
  } catch { res.status(401).json({ message: 'Your session has expired please log in again' }); }
}
export const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have permission to do this.' });
