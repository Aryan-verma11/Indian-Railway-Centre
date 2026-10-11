import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../services/format.js';

export default function DetailsPage() {
  const { user } = useAuth();
  const rows = [['name','Name'],['father_name',"Father's Name"],['gender','Gender'],['date_of_birth','Date of Birth']];
  return <div className="student-page"><Header studentMinimal /><main className="student-content"><section className="student-card" aria-label="Student details">
    <div className="roll-banner"><strong>Roll Number</strong><span>{user.roll_number || '-'}</span></div>
    <dl className="student-details">{rows.map(([key,label])=><div className="student-detail-row" key={key}><dt>{label}</dt><dd>{key === 'date_of_birth' ? formatDate(user[key]) : (user[key] || '-')}</dd></div>)}</dl>
  </section></main></div>;
}
