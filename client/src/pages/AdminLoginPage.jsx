import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../services/errors.js';

export default function AdminLoginPage() {
  const { user, loading, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [roll, setRoll] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading) return <p className="status">Loading...</p>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/details'} replace />;
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const logged = await adminLogin(roll.trim(), password); if (logged.role !== 'admin') throw new Error('Administrator access only.'); navigate('/admin', { replace: true }); }
    catch (err) { setError(getErrorMessage(err)); setBusy(false); }
  }
  return <main className="login-page"><div className="login-shell"><header className="login-brand"><h1>INDIAN RAILWAY CENTRE</h1><p>Safety <span>|</span> Security <span>|</span> Punctuality</p></header><form className="login-card admin-login-card" onSubmit={submit}><h2 className="login-card-heading"><span>Administrator Login</span></h2><div className="login-card-body">{error && <p className="error" role="alert">{error}</p>}<label htmlFor="admin-roll">Administrator Registration Number</label><input id="admin-roll" value={roll} onChange={e=>setRoll(e.target.value)} autoComplete="username" required maxLength={30}/><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required maxLength={72}/><button className="primary-button" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button></div></form><a className="admin-entry" href="/login">Back to candidate login</a></div></main>;
}
