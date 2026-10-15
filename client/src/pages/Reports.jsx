import { useState } from 'react';
import { api, download } from '../api.js';
import { Msg, Table } from '../ui.jsx';

const ALL = { student: 'Student report', course: 'Course report', 'gpa-summary': 'GPA summary', 'deans-list': "Dean's list", overall: 'Overall performance' };
const BY_ROLE = { student: ['student'], coordinator: ['course', 'student'], admin: ['gpa-summary', 'deans-list', 'overall', 'course', 'student'] };

export default function Reports({ role, courseCode }) {
  const types = BY_ROLE[role];
  const [type, setType] = useState(types[0]); const [f, setF] = useState({ studentId: '', courseId: courseCode || '', semester: '', minGpa: '3.5' });
  const [report, setReport] = useState(null); const [err, setErr] = useState('');
  const qs = (fmt) => new URLSearchParams({ format: fmt, ...(type === 'student' && role !== 'student' ? { studentId: f.studentId } : {}), ...(type === 'course' ? { courseId: f.courseId || courseCode || '' } : {}), ...(f.semester ? { semester: f.semester } : {}), ...(type === 'deans-list' ? { minGpa: f.minGpa } : {}) }).toString();
  const preview = async () => { setErr(''); setReport(null); try { setReport(await api(`/reports/${type}?${qs('json')}`)); } catch (e) { setErr(e.message); } };
  const get = async (fmt) => { setErr(''); try { await download(`/reports/${type}?${qs(fmt)}`, `${type}-report.${fmt}`); } catch (e) { setErr(e.message); } };
  const cols = report?.rows?.length ? Object.keys(report.rows[0]).map((k) => ({ h: k, f: (r) => r[k] })) : [];
  return (<div className="panel">
    <h2>Generate a report</h2>
    <div className="row">
      <div><label htmlFor="rt">Report type</label><select id="rt" value={type} onChange={(e) => { setType(e.target.value); setReport(null); setErr(''); }}>{types.map((t) => <option key={t} value={t}>{ALL[t]}</option>)}</select></div>
      {type === 'student' && role !== 'student' && <div><label htmlFor="sid">Student ID</label><input id="sid" value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })} placeholder="e.g. s2201" /></div>}
      {type === 'course' && <div><label htmlFor="cc">Course code</label><input id="cc" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })} placeholder="e.g. CS101" /></div>}
      {type === 'student' && <div><label htmlFor="sm">Semester (optional)</label><input id="sm" value={f.semester} onChange={(e) => setF({ ...f, semester: e.target.value })} placeholder="2025-S1" /></div>}
      {type === 'deans-list' && <div><label htmlFor="mg">Minimum GPA</label><input id="mg" type="number" step="0.1" min="0" max="4" value={f.minGpa} onChange={(e) => setF({ ...f, minGpa: e.target.value })} /></div>}
      <button className="btn" onClick={preview}>Preview</button>
      <button className="btn ghost" onClick={() => get('pdf')}>Download PDF</button>
      <button className="btn ghost" onClick={() => get('csv')}>Download CSV</button>
    </div>
    <Msg>{err}</Msg>
    {report && <><h2 style={{ marginTop: '1rem' }}>{report.title}</h2>{report.summary && <p className="muted">{Object.entries(report.summary).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}<Table cols={cols} rows={report.rows} /></>}
  </div>);
}
