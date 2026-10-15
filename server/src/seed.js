import 'dotenv/config';
import mongoose from 'mongoose';
import { User, Course, Assessment, Mark, Issue } from './models/index.js';
import { recalcGpa } from './utils/gpa.js';
await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniedtrack');
await Promise.all([User, Course, Assessment, Mark, Issue].map((m) => m.deleteMany({})));
const pw = 'Passw0rd!';
const admin = await User.create({ name: 'W.S. Dias', email: 'admin@ciu.edu', role: 'admin', password: pw });
const coord = await User.create({ name: 'Dr. V. Amarasekara', email: 'coordinator@ciu.edu', role: 'coordinator', password: pw });
const names = ['R. Perera', 'W.W.D. Perera', 'A.A. Jayalath', 'S.L. Silva', 'N. Fernando', 'K. Bandara'];
const students = [];
for (const [i, n] of names.entries())
  students.push(await User.create({ name: n, email: `s${2201 + i}@ciu.edu`, role: 'student', password: pw, studentId: `s${2201 + i}`, registrationNumber: `REG${100 + i}`, year: 2, lastEnrolledAt: new Date() }));
const c1 = await Course.create({ code: 'CS101', name: 'Introduction to Programming', credits: 3, semester: '2025-S1', coordinator: coord._id, students: students.map((s) => s._id) });
const c2 = await Course.create({ code: 'CS102', name: 'Data Structures and Algorithms', credits: 4, semester: '2025-S2', coordinator: coord._id, students: students.map((s) => s._id) });
for (const c of [c1, c2]) {
  const asm = await Assessment.insertMany([{ course: c._id, title: 'Assignment 1', weight: 20 }, { course: c._id, title: 'Quiz 1', weight: 20 }, { course: c._id, title: 'Final Exam', weight: 60 }]);
  if (c === c1) for (const a of asm) for (const s of students)
    await Mark.create({ course: c._id, assessment: a._id, student: s._id, score: 55 + Math.floor(Math.random() * 45), published: true, publishedAt: new Date() });
  else await Mark.create({ course: c._id, assessment: asm[0]._id, student: students[0]._id, score: 88, published: true, publishedAt: new Date() });
}
await Issue.create({ student: students[0]._id, course: c2._id, title: 'Assignment 1 total', description: 'I think my Assignment 1 marks were added up wrongly.' });
for (const s of students) await recalcGpa(s._id);
console.log(`Seeded. Log in with admin@ciu.edu / coordinator@ciu.edu / s2201@ciu.edu — password: ${pw}`);
await mongoose.disconnect();
