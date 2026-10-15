import { useEffect, useState } from 'react';
import { api, useLoad } from '../api.js';
import { Stat, Msg, Tabs, Table, useFlash } from '../ui.jsx';
import Reports from './Reports.jsx';

function CourseSelect({ courses, value, onChange }) {
  return (<div style={{ maxWidth: 360 }}><label htmlFor="cs">Course</label><select id="cs" value={value || ''} onChange={(e) => onChange(e.target.value)}>{(courses || []).map((c) => <option key={c._id} value={c._id}>{c.code} – {c.name}</option>)}</select></div>);
}

function GradeTable({ courseId, assessment, pendingOnly, onChanged }) {
  const { data, reload, error } = useLoad(() => (assessment ? api(`/marks/course/${courseId}?assessment=${assessment}`) : Promise.resolve([])), [courseId, assessment]);
  const [draft, setDraft] = useState({}); const [m, flash] = useFlash();
  const rows = (data || []).filter((r) => !pendingOnly || r.pending);
  const save = async (r) => {
    try { await api('/marks', { method: 'PUT', body: { course: courseId, assessment, student: r.student._id, score: draft[r.student._id] } }); setDraft((d) => ({ ...d, [r.student._id]: undefined })); flash.ok('Saved.'); await reload(); onChanged(); } catch (e) { flash.err(e); }
  };
  const del = async (r) => { try { await api(`/marks/${r.markId}`, { method: 'DELETE' }); await reload(); onChanged(); } catch (e) { flash.err(e); } };
  const publish = async () => { try { const d = await api('/marks/publish', { method: 'POST', body: { course: courseId, assessment } }); flash.ok(d.message + (d.errors.length ? ` Warnings: ${d.errors.join('; ')}` : '')); await reload(); onChanged(); } catch (e) { flash.err(e); } };
  if (!assessment) return <p className="muted">Add or choose an assessment above to start grading.</p>;
  return (<>
    <Msg>{error}</Msg><Msg kind={m.kind}>{m.text}</Msg>
    <div className="tw"><table><thead><tr><th>Student</th><th>Score (0–100)</th><th>Grade</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.student._id}><td>{r.student.name}<br /><small className="muted">{r.student.studentId}</small></td>
        <td style={{ width: 130 }}><input type="number" min="0" max="100" aria-label={`Score for ${r.student.name}`} value={draft[r.student._id] ?? r.score ?? ''} onChange={(e) => setDraft({ ...draft, [r.student._id]: e.target.value })} /></td>
        <td>{r.letter ? <span className="chip">{r.letter}</span> : '–'}</td><td>{r.published ? 'Published' : r.pending ? 'Pending' : 'Saved'}</td>
        <td><button className="btn sm" disabled={draft[r.student._id] === undefined} onClick={() => save(r)}>Save</button>{r.markId && <> <button className="btn ghost sm" onClick={() => del(r)}>Remove</button></>}</td></tr>)}
    </tbody></table></div>
    {!rows.length && <p className="muted">{pendingOnly ? 'No pending students. Everyone has a score.' : 'No students are enrolled in this course.'}</p>}
    <p><button className="btn" onClick={publish}>Publish grades</button></p>
  </>);
}

function CsvUpload({ courseId, assessment, onChanged }) {
  const [file, setFile] = useState(null); const [res, setRes] = useState(null); const [m, flash] = useFlash();
  const go = async () => { if (!file) return flash.err(new Error('Choose a CSV file first.')); const form = new FormData(); form.append('file', file); form.append('course', courseId); form.append('assessment', assessment); try { setRes(await api('/marks/bulk', { method: 'POST', form })); onChanged(); } catch (e) { flash.err(e); } };
  return (<div className="panel"><h2>Bulk upload scores</h2><p className="muted">CSV with the columns <code>studentId,score</code>. Max 10 MB. Scores are saved as pending until you publish.</p>
    <input type="file" accept=".csv" aria-label="CSV file" onChange={(e) => setFile(e.target.files[0])} /><Msg kind={m.kind}>{m.text}</Msg>
    <p><button className="btn" disabled={!assessment} onClick={go}>Upload</button></p>
    {res && <><Msg kind="ok">{res.saved} scores saved.</Msg>{res.errors.map((e) => <Msg key={e}>{e}</Msg>)}</>}</div>);
}

function FeedbackForm({ courseId }) {
  const { data: students } = useLoad(() => api(`/courses/${courseId}/students`), [courseId]);
  const [f, setF] = useState({ student: '', message: '' }); const [m, flash] = useFlash();
  const send = async (e) => { e.preventDefault(); try { await api('/issues/feedback', { method: 'POST', body: { course: courseId, student: f.student || students?.[0]?._id, message: f.message } }); setF({ student: '', message: '' }); flash.ok('Feedback sent.'); } catch (x) { flash.err(x); } };
  return (<form className="panel" onSubmit={send}><h2>Give feedback</h2>
    <label htmlFor="fs">Student</label><select id="fs" value={f.student || students?.[0]?._id || ''} onChange={(e) => setF({ ...f, student: e.target.value })}>{(students || []).map((s) => <option key={s._id} value={s._id}>{s.studentId} – {s.name}</option>)}</select>
    <label htmlFor="fm">Message</label><textarea id="fm" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
    <Msg kind={m.kind}>{m.text}</Msg><p><button className="btn">Send feedback</button></p></form>);
}

export function CoordOverview() {
  const { data: courses, error } = useLoad(() => api('/courses'), []);
  const [courseId, setCourseId] = useState('');
  const cid = courseId || courses?.[0]?._id; const course = (courses || []).find((c) => c._id === cid);
  const sum = useLoad(() => (cid ? api(`/courses/${cid}/summary`) : Promise.resolve(null)), [cid]);
  const asm = useLoad(() => (cid ? api(`/courses/${cid}/assessments`) : Promise.resolve([])), [cid]);
  const [assessment, setAssessment] = useState(''); const [a, setA] = useState({ title: '', weight: '' }); const [m, flash] = useFlash();
  useEffect(() => { setAssessment(asm.data?.[0]?._id || ''); }, [asm.data]);
  const addAsm = async (e) => { e.preventDefault(); try { await api(`/courses/${cid}/assessments`, { method: 'POST', body: a }); setA({ title: '', weight: '' }); flash.clear(); await asm.reload(); sum.reload(); } catch (x) { flash.err(x); } };
  if (error) return <Msg>{error}</Msg>;
  if (courses && !courses.length) return <><h1>Course overview</h1><p className="muted">No courses are assigned to you yet. Ask an administrator to assign one.</p></>;
  return (<>
    <h1>Course overview{course ? ` – ${course.code}` : ''}</h1><p className="muted">Monitor your course performance and student progress.</p>
    <CourseSelect courses={courses} value={cid} onChange={setCourseId} />
    <div className="stats"><Stat value={sum.data?.totalStudents} label="Students enrolled" /><Stat value={sum.data?.pendingGrades} label="Assessments to grade" /><Stat value={sum.data?.gradedAssessments} label="Assessments graded" /><Stat value={sum.data?.courseAverage != null ? `${sum.data.courseAverage}%` : null} label="Course average" /></div>
    <div className="panel" style={{ marginTop: 0 }}>
      <div className="row"><div><label htmlFor="as">Assessment</label><select id="as" value={assessment} onChange={(e) => setAssessment(e.target.value)}>{(asm.data || []).map((x) => <option key={x._id} value={x._id}>{x.title} ({x.weight}%)</option>)}</select></div>
        <form className="row" onSubmit={addAsm} style={{ flex: 3 }}><div><label htmlFor="at">New assessment</label><input id="at" value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="e.g. Midterm" /></div>
          <div style={{ maxWidth: 110 }}><label htmlFor="aw">Weight %</label><input id="aw" type="number" min="1" max="100" value={a.weight} onChange={(e) => setA({ ...a, weight: e.target.value })} /></div><button className="btn">Add</button></form></div>
      <Msg kind={m.kind}>{m.text}</Msg>
    </div>
    <div style={{ marginTop: '1rem' }}><Tabs tabs={['Manage Grades', 'Pending', 'CSV Upload', 'Reports', 'Feedback']}>{(t) => (<>
      {t === 'Manage Grades' && <div className="panel"><GradeTable key={`g${cid}${assessment}`} courseId={cid} assessment={assessment} onChanged={sum.reload} /></div>}
      {t === 'Pending' && <div className="panel"><GradeTable key={`p${cid}${assessment}`} courseId={cid} assessment={assessment} pendingOnly onChanged={sum.reload} /></div>}
      {t === 'CSV Upload' && <CsvUpload courseId={cid} assessment={assessment} onChanged={sum.reload} />}
      {t === 'Reports' && <Reports key={cid} role="coordinator" courseCode={course?.code} />}
      {t === 'Feedback' && <FeedbackForm key={cid} courseId={cid} />}
    </>)}</Tabs></div>
  </>);
}

export function CoordStudents() {
  const { data: courses } = useLoad(() => api('/courses'), []);
  const [courseId, setCourseId] = useState(''); const cid = courseId || courses?.[0]?._id;
  const { data, error } = useLoad(() => (cid ? api(`/courses/${cid}/students`) : Promise.resolve([])), [cid]);
  return (<><h1>Student management</h1><p className="muted">Enrolment is managed by administrators. Coordinators can view their class list.</p>
    <CourseSelect courses={courses} value={cid} onChange={setCourseId} /><Msg>{error}</Msg>
    <div className="panel"><Table rows={data} empty="No students are enrolled." cols={[{ h: 'Student ID', f: (s) => s.studentId }, { h: 'Name', f: (s) => s.name }, { h: 'Email', f: (s) => s.email }, { h: 'Year', f: (s) => s.year ?? '–' }, { h: 'GPA', f: (s) => s.gpa ?? '–' }]} /></div></>);
}
