import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
const { Schema, model } = mongoose;
const ref = (r) => ({ type: Schema.Types.ObjectId, ref: r });

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'coordinator', 'student'], required: true },
  studentId: { type: String, unique: true, sparse: true },
  registrationNumber: String,
  year: Number,
  gpa: { type: Number, default: null },
  creditsAttempted: { type: Number, default: 0 },
  gpaWarnings: [String],
  archived: { type: Boolean, default: false },
  lastEnrolledAt: Date,
  graduatedAt: Date,
}, { timestamps: true });
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
  next();
});
userSchema.methods.matches = function (plain) { return bcrypt.compare(plain, this.password); };

const courseSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true },
  credits: { type: Number, default: 3, min: 0.5 },
  semester: { type: String, default: '' },
  coordinator: ref('User'),
  students: [ref('User')],
}, { timestamps: true });

const assessmentSchema = new Schema({
  course: { ...ref('Course'), required: true },
  title: { type: String, required: true },
  weight: { type: Number, required: true, min: 1, max: 100 }, // % of final mark
  date: { type: Date, default: Date.now },
}, { timestamps: true });

const markSchema = new Schema({
  course: { ...ref('Course'), required: true },
  assessment: { ...ref('Assessment'), required: true },
  student: { ...ref('User'), required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  published: { type: Boolean, default: false },
  publishedAt: Date,
}, { timestamps: true });
markSchema.index({ assessment: 1, student: 1 }, { unique: true });

const issueSchema = new Schema({
  student: { ...ref('User'), required: true },
  course: { ...ref('Course'), required: true },
  title: { type: String, default: 'Grade concern' },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_review', 'resolved'], default: 'open' },
  comments: [{ author: ref('User'), authorName: String, text: String, createdAt: { type: Date, default: Date.now } }],
}, { timestamps: true });

const feedbackSchema = new Schema({
  course: ref('Course'), student: ref('User'), coordinator: ref('User'), message: { type: String, required: true },
}, { timestamps: true });

const notificationSchema = new Schema({
  user: { ...ref('User'), index: true }, message: String, read: { type: Boolean, default: false },
}, { timestamps: true });

export const User = model('User', userSchema);
export const Course = model('Course', courseSchema);
export const Assessment = model('Assessment', assessmentSchema);
export const Mark = model('Mark', markSchema);
export const Issue = model('Issue', issueSchema);
export const Feedback = model('Feedback', feedbackSchema);
export const Notification = model('Notification', notificationSchema);
