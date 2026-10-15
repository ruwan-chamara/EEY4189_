import { createContext, useContext, useState } from 'react';
import { api } from './api.js';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const login = async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user)); setUser(d.user);
  };
  const logout = () => { localStorage.clear(); setUser(null); };
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}
