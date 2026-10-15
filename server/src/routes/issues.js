import { Router } from 'express';
import { Issue, Course, Feedback, Notification, User } from '../models/index.js';
import { auth, allow } from '../middleware/auth.js';
import { ah, httpError } from '../utils/ah.js';
import { notify } from '../utils/gpa.js';
const r = Router();
r.use(auth);

// Issues are public to the course: coordinator, admin and enrolled students can read and comment (FR2).
async function visible(user, issue) {
  if (user.role === 'admin') return true;
  const c = await Course.findById(issue.course);
  return c && (String(c.coordinator) === String(user._id) || c.students.some((s) => String(s) === String(user._id)));
}

r.get('/', ah(async (req, res) => {
  const u = req.user;
  let f = {};
  if (u.role !== 'admin') {
    const cs = await Course.find(u.role === 'coordinator' ? { coordinator: u._id } : { students: u._id }).select('_id');
    f = { course: { $in: cs.map((c) => c._id) } };
  }
  if (req.query.course) f.course = req.query.course;
  res.json(await Issue.find(f).populate('student', 'name studentId').populate('course', 'code name').sort({ updatedAt: -1 }));
}));

r.post('/', allow('student'), ah(async (req, res) => {
  const { course, title, description } = req.body;
  if (!description?.trim()) throw httpError(400, 'This field is required. Please describe your problem');
  const c = await Course.findOne({ _id: course, students: req.user._id });
  if (!c) throw httpError(400, 'Choose one of your enrolled courses.');
  const issue = await Issue.create({ student: req.user._id, course, title: title?.trim() || 'Grade concern', description: description.trim() });
  if (c.coordinator) await notify(c.coordinator, `${req.user.name} raised an issue in ${c.code}.`);
  res.status(201).json(issue);
}));

r.post('/:id/comments', ah(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue || !(await visible(req.user, issue))) throw httpError(404, 'Issue not found.');
  if (!req.body.text?.trim()) throw httpError(400, 'Please write a comment.');
  issue.comments.push({ author: req.user._id, authorName: req.user.name, text: req.body.text.trim() });
  await issue.save();
  if (String(issue.student) !== String(req.user._id)) await notify(issue.student, `${req.user.name} commented on your issue "${issue.title}".`);
  res.json(issue);
}));

r.patch('/:id/status', allow('admin', 'coordinator'), ah(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue || !(await visible(req.user, issue))) throw httpError(404, 'Issue not found.');
  if (!['open', 'in_review', 'resolved'].includes(req.body.status)) throw httpError(400, 'Invalid status.');
  issue.status = req.body.status; await issue.save();
  await notify(issue.student, 'Your issue has been reviewed. Please check the Help section for updated information.');
  res.json(issue);
}));

// Feedback from coordinators to students
r.post('/feedback', allow('coordinator', 'admin'), ah(async (req, res) => {
  const { course, student, message } = req.body;
  if (!message?.trim()) throw httpError(400, 'Please write some feedback.');
  const c = await Course.findOne({ _id: course, students: student });
  if (!c || (req.user.role === 'coordinator' && String(c.coordinator) !== String(req.user._id))) throw httpError(403, 'You cannot give feedback for this student.');
  const f = await Feedback.create({ course, student, coordinator: req.user._id, message: message.trim() });
  await notify(student, `New feedback in ${c.code}.`);
  res.status(201).json(f);
}));
r.get('/feedback/mine', allow('student'), ah(async (req, res) =>
  res.json(await Feedback.find({ student: req.user._id }).populate('course', 'code name').populate('coordinator', 'name').sort({ createdAt: -1 }))));

// Notifications
r.get('/notifications', ah(async (req, res) => res.json(await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50))));
r.post('/notifications/read', ah(async (req, res) => { await Notification.updateMany({ user: req.user._id }, { read: true }); res.json({ ok: true }); }));
export default r;
