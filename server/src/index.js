import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes, { runArchival } from './routes/users.js';
import courseRoutes from './routes/courses.js';
import markRoutes from './routes/marks.js';
import issueRoutes from './routes/issues.js';
import gpaRoutes from './routes/gpa.js';
import reportRoutes from './routes/reports.js';
import analyticsRoutes from './routes/analytics.js';

if (!process.env.JWT_SECRET) { console.error('Set JWT_SECRET in server/.env'); process.exit(1); }
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }), authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/marks', markRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/gpa', gpaRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve the built React app in production
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') err.status = 400;
  if (err.code === 11000) { err.status = 409; err.message = 'That value is already in use.'; }
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Something went wrong on the server.' });
});

const port = process.env.PORT || 4000;
connectDB().then(() => {
  app.listen(port, () => console.log(`UniEdTrack API on :${port}`));
  runArchival().catch(() => {});
  setInterval(() => runArchival().catch(() => {}), 24 * 3600 * 1000);
}).catch((e) => { console.error('DB connection failed:', e.message); process.exit(1); });
