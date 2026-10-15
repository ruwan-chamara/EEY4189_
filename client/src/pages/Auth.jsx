import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Msg } from '../ui.jsx';

export function Login() {
  const { login } = useAuth(); const [q] = useSearchParams();
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(q.get('expired') ? 'Your session has expired please log in again' : '');
  const [req, setReq] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    const missing = { email: !f.email.trim(), password: !f.password }; setReq(missing);
    if (missing.email || missing.password) return setErr('');
    try { await login(f.email, f.password); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="login"><form className="card" onSubmit={submit} noValidate>
      <h1>Welcome back</h1><p className="muted">Enter your credentials to access your dashboard.</p>
      <label htmlFor="e">Username</label><input id="e" type="email" placeholder="Enter your university email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="username" />
      {req.email && <Msg>! This is a required field</Msg>}
      <label htmlFor="p">Password</label><input id="p" type="password" placeholder="Enter your password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" />
      {req.password && <Msg>! This is a required field</Msg>}
      <Msg>{err}</Msg>
      <p style={{ marginTop: '1rem' }}><button className="btn" style={{ width: '100%' }}>Sign in</button></p>
      <p style={{ textAlign: 'center' }}><Link to="/forgot">Forgot your password?</Link></p>
    </form></div>
  );
}

export function Forgot() {
  const [email, setEmail] = useState(''); const [m, setM] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setM({ err: '! This is a required field' });
    try { const d = await api('/auth/forgot-password', { method: 'POST', body: { email } }); setM({ ok: d.message }); } catch (x) { setM({ err: x.message }); }
  };
  return (
    <div className="login"><form className="card" onSubmit={submit} noValidate>
      <h1>Reset password</h1><p className="muted">Enter your email address and we'll send you a new password.</p>
      <label htmlFor="fe">Email</label><input id="fe" type="email" placeholder="Enter your confirmation email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Msg>{m.err}</Msg><Msg kind="ok">{m.ok}</Msg>
      <p style={{ marginTop: '1rem' }}><button className="btn" style={{ width: '100%' }}>Continue</button></p>
      <p style={{ textAlign: 'center' }}><Link to="/login">Back to sign in</Link></p>
    </form></div>
  );
}
