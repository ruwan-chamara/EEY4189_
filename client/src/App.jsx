import { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { api, useLoad } from './api.js';
import { Login, Forgot } from './pages/Auth.jsx';
import { StudentOverview, StudentCourses, StudentProgress } from './pages/Student.jsx';
import { CoordOverview, CoordStudents } from './pages/Coordinator.jsx';
import { AdminOverview, AdminUsers, AdminCourses } from './pages/Admin.jsx';
import Issues from './pages/Issues.jsx';
import Settings from './pages/Settings.jsx';

const NAV = {
  student: [['/', 'Overview'], ['/courses', 'My Courses'], ['/progress', 'Progress'], ['/help', 'Help & Issues']],
  coordinator: [['/', 'Overview'], ['/students', 'Student Management'], ['/issues', 'Student Issues']],
  admin: [['/', 'System Overview'], ['/users', 'User Management'], ['/courses', 'Course Management'], ['/issues', 'Help & Issues']],
};
const TITLE = { student: 'Student Portal', coordinator: 'Coordinator Portal', admin: 'Admin Portal' };

function Bell() {
  const { data, reload } = useLoad(() => api('/issues/notifications'), []);
  const [open, setOpen] = useState(false);
  const unread = (data || []).filter((n) => !n.read).length;
  const toggle = async () => { setOpen(!open); if (!open && unread) { await api('/issues/notifications/read', { method: 'POST' }); setTimeout(reload, 1500); } };
  return (<div>
    <button className="bell" onClick={toggle} aria-label={`Notifications, ${unread} unread`}>Notifications{unread > 0 && <b>{unread}</b>}</button>
    {open && <div className="pop">{(data || []).length ? data.map((n) => <p key={n._id}><strong>{n.read ? '' : '● '}</strong>{n.message}<br /><small className="muted">{new Date(n.createdAt).toLocaleString()}</small></p>) : <p className="muted">No notifications yet.</p>}</div>}
  </div>);
}

function Shell() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  const role = user.role;
  const Home = { student: StudentOverview, coordinator: CoordOverview, admin: AdminOverview }[role];
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">UniEd<span>Track</span><small>{TITLE[role]}</small></div>
        {NAV[role].map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
        <div className="grow" />
        <NavLink to="/settings">Settings</NavLink>
        <button onClick={() => { logout(); nav('/login'); }}>Log out</button>
      </nav>
      <main className="main">
        <div className="top"><Bell /><div className="who">{user.name}<small>{user.studentId || role}</small></div></div>
        <Routes>
          <Route path="/" element={<Home />} />
          {role === 'student' && <><Route path="/courses" element={<StudentCourses />} /><Route path="/progress" element={<StudentProgress />} /><Route path="/help" element={<Issues />} /></>}
          {role === 'coordinator' && <><Route path="/students" element={<CoordStudents />} /><Route path="/issues" element={<Issues />} /></>}
          {role === 'admin' && <><Route path="/users" element={<AdminUsers />} /><Route path="/courses" element={<AdminCourses />} /><Route path="/issues" element={<Issues />} /></>}
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/*" element={user ? <Shell /> : <Navigate to="/login" />} />
    </Routes>
  );
}
