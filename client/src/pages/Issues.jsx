import { useState } from 'react';
import { api, useLoad } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Msg, useFlash } from '../ui.jsx';

const LABEL = { open: 'Open', in_review: 'In review', resolved: 'Resolved' };

export default function Issues() {
  const { user } = useAuth(); const staff = user.role !== 'student';
  const { data: issues, reload } = useLoad(() => api('/issues'), []);
  const { data: courses } = useLoad(() => (staff ? Promise.resolve([]) : api('/courses')), []);
  const [sel, setSel] = useState(null); const [m, flash] = useFlash();
  const [form, setForm] = useState({ course: '', title: '', description: '' }); const [comment, setComment] = useState('');
  const cur = (issues || []).find((i) => i._id === sel);
  const create = async (e) => {
    e.preventDefault(); flash.clear();
    try { const i = await api('/issues', { method: 'POST', body: { ...form, course: form.course || courses?.[0]?._id } }); setForm({ course: '', title: '', description: '' }); await reload(); setSel(i._id); flash.ok('Your issue was sent to the course coordinator.'); } catch (x) { flash.err(x); }
  };
  const act = (fn) => async () => { try { await fn(); setComment(''); await reload(); } catch (x) { flash.err(x); } };
  return (<>
    <h1>{staff ? 'Student issues' : 'Help & issues'}</h1><p className="muted">Issues are visible to everyone in the course, so classmates can add comments.</p>
    <Msg kind={m.kind}>{m.text}</Msg>
    <div className="two" style={{ marginTop: '1rem' }}>
      <div>
        {user.role === 'student' && <form className="panel" onSubmit={create} noValidate style={{ marginTop: 0 }}>
          <h2>Raise an issue</h2>
          <label htmlFor="ic">Course</label><select id="ic" value={form.course || courses?.[0]?._id || ''} onChange={(e) => setForm({ ...form, course: e.target.value })}>{(courses || []).map((c) => <option key={c._id} value={c._id}>{c.code} – {c.name}</option>)}</select>
          <label htmlFor="it">Title</label><input id="it" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short summary" />
          <label htmlFor="id">What is the problem?</label><textarea id="id" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <p><button className="btn">Send issue</button></p>
        </form>}
        {(issues || []).map((i) => <button key={i._id} className={`item ${sel === i._id ? 'on' : ''}`} onClick={() => setSel(i._id)}>
          <strong>{i.title}</strong> <span className={`pill ${i.status}`}>{LABEL[i.status]}</span><br /><small className="muted">{i.course?.code} · {i.student?.name} · {i.comments.length} comments</small></button>)}
        {issues && !issues.length && <p className="muted">No issues yet.</p>}
      </div>
      <div className="panel" style={{ marginTop: 0 }}>
        {!cur ? <p className="muted">Select an issue to read the conversation.</p> : <>
          <h2>{cur.title}</h2><p className="muted">{cur.course?.code} · raised by {cur.student?.name} · <span className={`pill ${cur.status}`}>{LABEL[cur.status]}</span></p>
          <p>{cur.description}</p>
          {staff && <div className="row" style={{ margin: '.5rem 0' }}>{Object.entries(LABEL).map(([k, v]) => <button key={k} className="btn ghost sm" disabled={cur.status === k} onClick={act(() => api(`/issues/${cur._id}/status`, { method: 'PATCH', body: { status: k } }))}>Mark {v.toLowerCase()}</button>)}</div>}
          {cur.comments.map((c) => <div className="cmt" key={c._id}><strong>{c.authorName}</strong> <small className="muted">{new Date(c.createdAt).toLocaleString()}</small><p>{c.text}</p></div>)}
          <label htmlFor="cm">Add a comment</label><textarea id="cm" value={comment} onChange={(e) => setComment(e.target.value)} />
          <p><button className="btn" onClick={act(() => api(`/issues/${cur._id}/comments`, { method: 'POST', body: { text: comment } }))}>Post comment</button></p>
        </>}
      </div>
    </div>
  </>);
}
