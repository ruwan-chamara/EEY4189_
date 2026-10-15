import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api, useLoad } from '../api.js';
import { Stat, Msg, Tabs, Table, useFlash } from '../ui.jsx';
import Reports from './Reports.jsx';

const COLORS = ['#b3261e', '#d9a441', '#3f8ca8', '#1d7a4b'];

export function AdminOverview() {
  const ov = useLoad(() => api('/analytics/overview'), []); const gpa = useLoad(() => api('/gpa'), []); const dist = useLoad(() => api('/analytics/grade-distribution'), []);
  const [m, flash] = useFlash();
  const recalc = async (s) => { try { await api(`/gpa/recalculate/${s._id}`, { method: 'POST' }); flash.ok(`Recalculated ${s.name}.`); gpa.reload(); } catch (e) { flash.err(e); } };
  return (<>
    <h1>System overview</h1><p className="muted">Monitor overall system performance and statistics.</p>
    <div className="stats"><Stat value={ov.data?.total} label="Total users" /><Stat value={ov.data?.courses} label="Courses" /><Stat value={ov.data?.students} label="Students" /><Stat value={ov.data?.coordinators} label="Coordinators" /><Stat value={ov.data?.newThisMonth} label="New users in 30 days" /></div>
    <Tabs tabs={['GPA Management', 'Analytics', 'Reports']}>{(t) => (<>
      {t === 'GPA Management' && <div className="panel"><h2>GPA management and computation</h2><Msg kind={m.kind}>{m.text}</Msg><Msg>{gpa.error}</Msg>
        <Table rows={gpa.data} empty="No students yet." cols={[{ h: 'Student ID', f: (s) => s.studentId }, { h: 'Name', f: (s) => s.name }, { h: 'GPA', f: (s) => s.gpa?.toFixed(2) ?? '–' }, { h: 'Credits', f: (s) => s.credits }, { h: 'Academic status', f: (s) => s.status },
          { h: 'Actions', f: (s) => <button className="btn ghost sm" onClick={() => recalc(s)}>Recalculate</button> }]} /></div>}
      {t === 'Analytics' && <div className="panel"><h2>GPA distribution</h2>{dist.data?.some((d) => d.count) ? <div style={{ height: 300 }}><ResponsiveContainer><PieChart><Pie data={dist.data} dataKey="count" nameKey="label" label={(d) => `${d.pct}%`}>{dist.data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div> : <p className="muted">The chart appears once students have a GPA.</p>}</div>}
      {t === 'Reports' && <Reports role="admin" />}
    </>)}</Tabs>
  </>);
}

export function AdminUsers() {
  const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [archived, setArchived] = useState(false);
  const { data, reload, error } = useLoad(() => api(`/users?${new URLSearchParams({ q, role, archived })}`), [q, role, archived]);
  const [f, setF] = useState({ name: '', email: '', role: 'student', studentId: '', registrationNumber: '', year: '' }); const [file, setFile] = useState(null); const [imp, setImp] = useState(null); const [m, flash] = useFlash();
  const add = async (e) => { e.preventDefault(); try { await api('/users', { method: 'POST', body: f }); flash.ok('User created. Login details were emailed.'); setF({ ...f, name: '', email: '', studentId: '', registrationNumber: '' }); reload(); } catch (x) { flash.err(x); } };
  const del = async (u) => { if (!window.confirm(`Delete ${u.name}?`)) return; try { await api(`/users/${u._id}`, { method: 'DELETE' }); reload(); } catch (x) { flash.err(x); } };
  const setRoleOf = async (u, r) => { try { await api(`/users/${u._id}`, { method: 'PUT', body: { role: r } }); reload(); } catch (x) { flash.err(x); } };
  const doImport = async () => { if (!file) return flash.err(new Error('Choose a CSV file first.')); const form = new FormData(); form.append('file', file); try { setImp(await api('/users/import', { method: 'POST', form })); reload(); } catch (x) { flash.err(x); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (<>
    <h1>User management</h1><Msg kind={m.kind}>{m.text}</Msg>
    <form className="panel" onSubmit={add}><h2>Add a user</h2><div className="row">
      <div><label htmlFor="un">Name</label><input id="un" value={f.name} onChange={set('name')} /></div><div><label htmlFor="ue">Email</label><input id="ue" type="email" value={f.email} onChange={set('email')} /></div>
      <div><label htmlFor="ur">Role</label><select id="ur" value={f.role} onChange={set('role')}><option value="student">Student</option><option value="coordinator">Course coordinator</option><option value="admin">Administrator</option></select></div>
      {f.role === 'student' && <><div><label htmlFor="us">Student ID</label><input id="us" value={f.studentId} onChange={set('studentId')} /></div><div><label htmlFor="ug">Registration no.</label><input id="ug" value={f.registrationNumber} onChange={set('registrationNumber')} /></div><div><label htmlFor="uy">Year</label><input id="uy" type="number" value={f.year} onChange={set('year')} /></div></>}
      <button className="btn">Create user</button></div></form>
    <div className="panel"><h2>Bulk import students</h2><p className="muted">CSV columns: <code>name,email,studentId,registrationNumber,year,courses</code> (course codes separated by <code>;</code>). Existing students are updated.</p>
      <div className="row"><input type="file" accept=".csv" aria-label="Student CSV" onChange={(e) => setFile(e.target.files[0])} /><button className="btn" onClick={doImport}>Import</button></div>
      {imp && <><Msg kind="ok">{imp.created} created, {imp.updated} updated.</Msg>{imp.errors.map((e) => <Msg key={e}>{e}</Msg>)}</>}</div>
    <div className="panel"><div className="row"><div><label htmlFor="sq">Search</label><input id="sq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or student ID" /></div>
      <div><label htmlFor="sr">Role</label><select id="sr" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All</option><option value="student">Students</option><option value="coordinator">Coordinators</option><option value="admin">Administrators</option></select></div>
      <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flex: '0 0 auto' }}><input type="checkbox" style={{ width: 'auto' }} checked={archived} onChange={(e) => setArchived(e.target.checked)} />Show archived</label></div>
      <Msg>{error}</Msg>
      <Table rows={data} empty="No users match." cols={[{ h: 'Name', f: (u) => u.name }, { h: 'Email', f: (u) => u.email }, { h: 'ID', f: (u) => u.studentId || '–' },
        { h: 'Role', f: (u) => <select aria-label={`Role of ${u.name}`} value={u.role} onChange={(e) => setRoleOf(u, e.target.value)}><option value="student">Student</option><option value="coordinator">Coordinator</option><option value="admin">Admin</option></select> },
        { h: 'Actions', f: (u) => <button className="btn danger sm" onClick={() => del(u)}>Delete</button> }]} /></div>
  </>);
}

export function AdminCourses() {
  const { data, reload, error } = useLoad(() => api('/courses'), []);
  const coords = useLoad(() => api('/users?role=coordinator'), []); const studs = useLoad(() => api('/users?role=student'), []);
  const [f, setF] = useState({ code: '', name: '', credits: 3, semester: '', coordinator: '' }); const [m, flash] = useFlash();
  const [enroll, setEnroll] = useState({ course: '', ids: [] });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async (e) => { e.preventDefault(); try { await api('/courses', { method: 'POST', body: f }); setF({ code: '', name: '', credits: 3, semester: '', coordinator: '' }); flash.clear(); reload(); } catch (x) { flash.err(x); } };
  const assign = async (c, coordinator) => { try { await api(`/courses/${c._id}`, { method: 'PUT', body: { ...c, coordinator } }); reload(); } catch (x) { flash.err(x); } };
  const del = async (c) => { if (!window.confirm(`Delete ${c.code} and all its marks?`)) return; try { await api(`/courses/${c._id}`, { method: 'DELETE' }); reload(); } catch (x) { flash.err(x); } };
  const doEnroll = async () => { try { await api(`/courses/${enroll.course || data[0]._id}/enroll`, { method: 'POST', body: { studentIds: enroll.ids } }); flash.ok('Students enrolled.'); reload(); } catch (x) { flash.err(x); } };
  return (<>
    <h1>Course management</h1><Msg kind={m.kind}>{m.text}</Msg><Msg>{error}</Msg>
    <form className="panel" onSubmit={add}><h2>Add a course</h2><div className="row">
      <div><label htmlFor="cc">Code</label><input id="cc" value={f.code} onChange={set('code')} /></div><div><label htmlFor="cn">Name</label><input id="cn" value={f.name} onChange={set('name')} /></div>
      <div style={{ maxWidth: 100 }}><label htmlFor="cr">Credits</label><input id="cr" type="number" step="0.5" value={f.credits} onChange={set('credits')} /></div><div><label htmlFor="cm">Semester</label><input id="cm" value={f.semester} onChange={set('semester')} placeholder="2025-S1" /></div>
      <div><label htmlFor="co">Coordinator</label><select id="co" value={f.coordinator} onChange={set('coordinator')}><option value="">Unassigned</option>{(coords.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
      <button className="btn">Add course</button></div></form>
    <div className="panel"><Table rows={data} empty="No courses yet." cols={[{ h: 'Code', f: (c) => c.code }, { h: 'Name', f: (c) => c.name }, { h: 'Semester', f: (c) => c.semester }, { h: 'Credits', f: (c) => c.credits }, { h: 'Students', f: (c) => c.students },
      { h: 'Coordinator', f: (c) => <select aria-label={`Coordinator for ${c.code}`} value={c.coordinator?._id || ''} onChange={(e) => assign(c, e.target.value)}><option value="">Unassigned</option>{(coords.data || []).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select> },
      { h: 'Actions', f: (c) => <button className="btn danger sm" onClick={() => del(c)}>Delete</button> }]} /></div>
    {!!data?.length && <div className="panel"><h2>Enrol students</h2><p className="muted">Hold Ctrl/Cmd to select several students.</p><div className="row">
      <div><label htmlFor="ec">Course</label><select id="ec" value={enroll.course || data[0]._id} onChange={(e) => setEnroll({ ...enroll, course: e.target.value })}>{data.map((c) => <option key={c._id} value={c._id}>{c.code}</option>)}</select></div>
      <div style={{ flex: 2 }}><label htmlFor="es">Students</label><select id="es" multiple size="6" value={enroll.ids} onChange={(e) => setEnroll({ ...enroll, ids: [...e.target.selectedOptions].map((o) => o.value) })}>{(studs.data || []).map((s) => <option key={s._id} value={s._id}>{s.studentId} – {s.name}</option>)}</select></div>
      <button className="btn" onClick={doEnroll} disabled={!enroll.ids.length}>Enrol</button></div></div>}
  </>);
}
