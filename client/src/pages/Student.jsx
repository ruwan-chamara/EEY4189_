import { api, useLoad } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Stat, Msg, Tabs, Table } from '../ui.jsx';
import Reports from './Reports.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';

export function StudentOverview() {
  const { user } = useAuth();
  const gpa = useLoad(() => api('/gpa/me'), []); const marks = useLoad(() => api('/marks/mine'), []);
  const fb = useLoad(() => api('/issues/feedback/mine'), []); const notes = useLoad(() => api('/issues/notifications'), []);
  const avg = marks.data?.length ? Math.round(marks.data.reduce((s, m) => s + m.score, 0) / marks.data.length) + '%' : null;
  return (<>
    <h1>Welcome back, {user.name.split(' ').pop()}</h1><p className="muted">Here's your academic progress.</p>
    <Msg>{gpa.error}</Msg>
    <div className="stats">
      <Stat value={gpa.data?.gpa?.toFixed(2) ?? 'N/A'} label="Overall GPA (out of 4.0)" />
      <Stat value={avg} label="Average score" />
      <Stat value={gpa.data?.courses.length} label="Enrolled courses" />
      <Stat value={gpa.data?.rank ? `${gpa.data.rank} / ${gpa.data.rankedStudents}` : null} label="Class ranking by GPA" />
    </div>
    {gpa.data?.warnings.map((w) => <Msg key={w} kind="warn">{w}</Msg>)}
    <Tabs tabs={['Grades', 'Feedback', 'Reports', 'Notifications']}>{(t) => (<>
      {t === 'Grades' && <div className="panel"><h2>Recent grades</h2>
        {(marks.data || []).slice(0, 8).map((m) => <div className="grade" key={m._id}><div><strong>{m.course.code}</strong> {m.assessment.title}<br /><small className="muted">{m.course.name}</small></div><div><span className="chip">{m.letter}</span> {m.score}/100</div></div>)}
        {marks.data && !marks.data.length && <p className="muted">No grades have been released yet.</p>}</div>}
      {t === 'Feedback' && <div className="panel"><h2>Feedback from coordinators</h2>
        {(fb.data || []).map((f) => <div className="cmt" key={f._id}><strong>{f.course?.code}</strong> · {f.coordinator?.name}<p>{f.message}</p></div>)}
        {fb.data && !fb.data.length && <p className="muted">No feedback yet.</p>}</div>}
      {t === 'Reports' && <Reports role="student" />}
      {t === 'Notifications' && <div className="panel"><h2>Notifications</h2>{(notes.data || []).map((n) => <p key={n._id}>{n.message} <small className="muted">{new Date(n.createdAt).toLocaleDateString()}</small></p>)}{notes.data && !notes.data.length && <p className="muted">You're all caught up.</p>}</div>}
    </>)}</Tabs>
  </>);
}

export function StudentCourses() {
  const { data, error } = useLoad(() => api('/gpa/me'), []);
  return (<><h1>My courses</h1><Msg>{error}</Msg><div className="panel"><Table empty="You are not enrolled in any courses yet."
    cols={[{ h: 'Code', f: (c) => c.code }, { h: 'Course', f: (c) => c.name }, { h: 'Semester', f: (c) => c.semester }, { h: 'Credits', f: (c) => c.credits },
      { h: 'Assessments graded', f: (c) => `${c.graded} / ${c.total}` }, { h: 'Final', f: (c) => (c.complete ? `${c.final}% (${c.letter})` : 'In progress') }]} rows={data?.courses} /></div></>);
}

export function StudentProgress() {
  const { data, error } = useLoad(() => api('/gpa/me'), []);
  const done = (data?.courses || []).filter((c) => c.complete).map((c) => ({ name: c.code, Final: c.final }));
  const sems = Object.entries(data?.semesters || {}).map(([s, g]) => ({ name: s, GPA: g }));
  return (<><h1>Progress</h1><Msg>{error}</Msg>
    <div className="panel"><h2>Final mark by course</h2>{done.length ? <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={done}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" /><XAxis dataKey="name" stroke="var(--muted)" /><YAxis domain={[0, 100]} stroke="var(--muted)" /><Tooltip /><Bar dataKey="Final" fill="var(--accent)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="muted">Charts appear once a course has all its grades released.</p>}</div>
    <div className="panel"><h2>Semester GPA</h2>{sems.length ? <div style={{ height: 240 }}><ResponsiveContainer><LineChart data={sems}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" /><XAxis dataKey="name" stroke="var(--muted)" /><YAxis domain={[0, 4]} stroke="var(--muted)" /><Tooltip /><Line dataKey="GPA" stroke="var(--accent)" strokeWidth={3} /></LineChart></ResponsiveContainer></div> : <p className="muted">No completed semesters yet.</p>}
      {data?.gpa != null && <p>Cumulative GPA: <strong>{data.gpa.toFixed(2)}</strong></p>}</div></>);
}
