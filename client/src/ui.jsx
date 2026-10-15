import { useState } from 'react';
export const Stat = ({ value, label }) => <div className="stat"><div className="v">{value ?? '–'}</div><div className="l">{label}</div></div>;
export const Msg = ({ kind = 'err', children }) => (children ? <p className={`msg ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</p> : null);
export function Tabs({ tabs, children }) {
  const [on, setOn] = useState(tabs[0]);
  return (<>
    <div className="tabs" role="tablist">{tabs.map((t) => <button key={t} role="tab" aria-selected={on === t} className={on === t ? 'on' : ''} onClick={() => setOn(t)}>{t}</button>)}</div>
    {children(on)}
  </>);
}
export const Table = ({ cols, rows, empty = 'Nothing to show yet.' }) => rows?.length ? (
  <div className="tw"><table><thead><tr>{cols.map((c) => <th key={c.h}>{c.h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r._id || i}>{cols.map((c) => <td key={c.h}>{c.f(r)}</td>)}</tr>)}</tbody></table></div>
) : <p className="muted">{empty}</p>;
export const useFlash = () => {
  const [m, setM] = useState({ kind: 'ok', text: '' });
  return [m, { ok: (text) => setM({ kind: 'ok', text }), err: (e) => setM({ kind: 'err', text: e.message || String(e) }), clear: () => setM({ kind: 'ok', text: '' }) }];
};
