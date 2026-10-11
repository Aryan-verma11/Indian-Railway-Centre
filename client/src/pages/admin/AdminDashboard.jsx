import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import Notice from '../../components/Notice.jsx';
import api from '../../services/api.js';
import { getErrorMessage } from '../../services/errors.js';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  return (
    <>
      <Header />
      <main className="content">
        <h1 className="page-title">Administration</h1>
        <Notice type="error">{error}</Notice>
        {!stats && !error && <p>Loading...</p>}
        {stats && (
          <>
            <div className="stats">
              <div className="stat"><span className="stat-value">{stats.total}</span>Total users</div>
              <div className="stat"><span className="stat-value">{stats.active}</span>Active users</div>
              <div className="stat"><span className="stat-value">{stats.admins}</span>Administrators</div>
            </div>

            <h2 className="section-title">Quick Actions</h2>
            <p className="actions">
              <Link className="button button-primary" to="/admin/users/new">Add User</Link>
              <Link className="button" to="/admin/users">Manage Users</Link>
              <Link className="button" to="/admin/audit">View Audit Log</Link>
            </p>

            <h2 className="section-title">Recently Added Users</h2>
            {stats.recent.length === 0 ? <p>No users yet.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Roll Number</th><th>Name</th><th>Role</th><th>Added</th></tr></thead>
                  <tbody>
                    {stats.recent.map((u) => (
                      <tr key={u.id}>
                        <td data-label="Roll Number"><Link to={`/admin/users/${u.id}`}>{u.roll_number}</Link></td>
                        <td data-label="Name">{u.name}</td>
                        <td data-label="Role">{u.role}</td>
                        <td data-label="Added">{u.created_at.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
