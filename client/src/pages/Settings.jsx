import { useState } from 'react';
import { api } from '../api.js';
import { Msg, useFlash } from '../ui.jsx';
export default function Settings() {
  const [f, setF] = useState({ current: '', next: '' }); const [m, flash] = useFlash();
  const save = async (e) => { e.preventDefault(); try { const d = await api('/auth/change-password', { method: 'POST', body: f }); flash.ok(d.message); setF({ current: '', next: '' }); } catch (x) { flash.err(x); } };
  return (<><h1>Settings</h1><form className="panel" onSubmit={save} style={{ maxWidth: 420 }}>
    <h2>Change password</h2>
    <label htmlFor="c">Current password</label><input id="c" type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
    <label htmlFor="n">New password</label><input id="n" type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
    <Msg kind={m.kind}>{m.text}</Msg><p><button className="btn">Update password</button></p>
  </form></>);
}
