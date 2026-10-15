import nodemailer from 'nodemailer';
const t = process.env.SMTP_USER
  ? nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
  : null;
export async function sendMail(to, subject, text) {
  if (!t) { console.log(`\n[mail → ${to}] ${subject}\n${text}\n`); return false; }
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
  return true;
}
