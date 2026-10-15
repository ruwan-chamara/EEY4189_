import { useCallback, useEffect, useState } from 'react';

export async function api(path, { method = 'GET', body, form, blob } = {}) {
  const headers = {}; const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form; else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  if (res.status === 401 && token && !path.startsWith('/auth/login')) { localStorage.clear(); window.location.href = '/login?expired=1'; }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw Object.assign(new Error(d.message || 'Request failed'), { data: d }); }
  return blob ? res.blob() : res.json();
}
export async function download(path, filename) {
  const b = await api(path, { blob: true });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => fn().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload, setData };
}
