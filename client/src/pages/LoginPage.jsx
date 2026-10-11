import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../services/errors.js';

const homeFor = (user) => (user.role === 'admin' ? '/admin' : '/details');
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const currentYear = new Date().getFullYear();
function validDate(year, month, day) {
  if (!year || !month || !day) return false;
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return d.getUTCFullYear() === Number(year) && d.getUTCMonth() === Number(month) - 1 && d.getUTCDate() === Number(day) && d <= new Date();
}
export default function LoginPage() {
  const { user, loading, login } = useAuth(); const navigate = useNavigate();
  const [rollNumber, setRollNumber] = useState(''); const [day, setDay] = useState(''); const [month, setMonth] = useState(''); const [year, setYear] = useState('');
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  const days = useMemo(() => month && year ? new Date(Number(year), Number(month), 0).getDate() : 31, [month, year]);
  if (loading) return <p className="status">Loading...</p>;
  if (user) return <Navigate to={homeFor(user)} replace />;
  async function handleSubmit(event) {
    event.preventDefault();
    if (!rollNumber.trim() || !day || !month || !year) { setError('Please enter your registration number and complete date of birth.'); return; }
    if (!validDate(year, month, day)) { setError('Please select a valid date of birth.'); return; }
    setError(''); setSubmitting(true);
    try { const loggedIn = await login(rollNumber.trim(), `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`); navigate(homeFor(loggedIn), { replace: true }); }
    catch (err) { setError(getErrorMessage(err)); setSubmitting(false); }
  }
  return <main className="login-page irc-page"><div className="login-shell"><header className="login-brand"><h1>INDIAN RAILWAY CENTRE</h1><p><span>Safety</span><b>|</b><span>Security</span><b>|</b><span>Punctuality</span></p></header>
    <form className="login-card candidate-card" onSubmit={handleSubmit} noValidate><h2 className="login-card-heading"><span>अभ्यर्थी लॉग इन / Candidate Login</span></h2><div className="login-card-body">
      {error && <p className="error" role="alert">{error}</p>}
      <div className="candidate-field"><label htmlFor="registration-number"><span>पंजीकरण संख्या</span><span>Registration Number</span></label><input id="registration-number" type="text" autoComplete="username" autoCapitalize="characters" value={rollNumber} onChange={e=>setRollNumber(e.target.value)} maxLength={30} required placeholder="Registration Number" /></div>
      <div className="candidate-field"><label htmlFor="dob-day"><span>जन्म तिथि</span><span>Date of Birth</span></label><div className="dob-selects"><select id="dob-day" value={day} onChange={e=>setDay(e.target.value)} required aria-label="Day"><option value="">Day</option>{Array.from({length:days},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select><select value={month} onChange={e=>{setMonth(e.target.value);if(day && Number(day)>new Date(Number(year)||2000,Number(e.target.value),0).getDate())setDay('')}} required aria-label="Month"><option value="">Month</option>{MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select><select value={year} onChange={e=>{setYear(e.target.value);setDay('')}} required aria-label="Year"><option value="">Year</option>{Array.from({length:currentYear-1899},(_,i)=>currentYear-i).map(y=><option key={y} value={y}>{y}</option>)}</select></div></div>
      <button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'दाखिल हो रहा है / Signing in...' : 'दाखिल करना / Sign in'}</button>
    </div></form></div></main>;
}
