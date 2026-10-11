import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import Notice from '../../components/Notice.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import api from '../../services/api.js';
import { getErrorMessage } from '../../services/errors.js';
import { formatDate, formatDateTime } from '../../services/format.js';

const ROWS = [
  ['roll_number', 'Roll Number'], ['name', 'Name'], ['father_name', "Father's Name"], ['gender', 'Gender'],
  ['date_of_birth', 'Date of Birth'], ['course', 'Course'], ['branch', 'Branch'], ['year', 'Year'],
  ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'], ['role', 'Role'], ['status', 'Account Status'],
  ['last_login_at', 'Last Login'], ['created_at', 'Created'], ['updated_at', 'Last Updated'],
];

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [role, setRole] = useState('user');
  const [newPassword, setNewPassword] = useState('');
  const [temporary, setTemporary] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/admin/users/${id}`)
      .then((r) => { setUser(r.data.user); setRole(r.data.user.role); })
      .catch((e) => setError(getErrorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  async function confirmPending() {
    setBusy(true);
    setTemporary('');
    try {
      const result = await pending.run();
      setError('');
      setMessage(pending.done);
      if (result?.data?.temporary_password) setTemporary(result.data.temporary_password);
      setNewPassword('');
      if (pending.leave) navigate('/admin/users', { replace: true });
      else load();
    } catch (e) {
      setError(getErrorMessage(e));
      setMessage('');
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  if (!user) {
    return (<><Header /><main className="content"><Notice type="error">{error}</Notice>{!error && <p>Loading...</p>}<Link to="/admin/users">Back to users</Link></main></>);
  }

  const display = { ...user, status: user.is_active ? 'Active' : 'Disabled', date_of_birth: formatDate(user.date_of_birth),
    last_login_at: formatDateTime(user.last_login_at), created_at: formatDateTime(user.created_at), updated_at: formatDateTime(user.updated_at) };

  return (
    <>
      <Header />
      <main className="content">
        <div className="title-row">
          <h1 className="page-title">{user.name}</h1>
          <Link className="button" to={`/admin/users/${user.id}/edit`}>Edit</Link>
        </div>
        <Notice type="error">{error}</Notice>
        <Notice type="success">{message}</Notice>
        {temporary && (
          <p className="notice-box" role="status">
            Temporary password (shown once, share it privately): <code>{temporary}</code>
          </p>
        )}

        <dl className="details">
          {ROWS.map(([key, label]) => (
            <div className="detail-row" key={key}><dt>{label}</dt><dd>{display[key] || '-'}</dd></div>
          ))}
        </dl>

        <h2 className="section-title">Account Actions</h2>
        <div className="panel">
          <p className="actions">
            <button type="button" className={`button ${user.is_active ? 'button-danger' : 'button-primary'}`} onClick={() => setPending({
              title: user.is_active ? 'Disable account' : 'Enable account',
              body: user.is_active ? `Disable ${user.roll_number}? They will be signed out and unable to log in.` : `Enable ${user.roll_number}?`,
              label: user.is_active ? 'Disable' : 'Enable', danger: user.is_active,
              done: `Account ${user.is_active ? 'disabled' : 'enabled'}.`,
              run: () => api.patch(`/admin/users/${id}/status`, { is_active: !user.is_active }),
            })}>{user.is_active ? 'Disable Account' : 'Enable Account'}</button>
            <button type="button" className="button button-danger" onClick={() => setPending({
              title: 'Delete user permanently',
              body: `Permanently delete ${user.roll_number} (${user.name})? This cannot be undone. Consider disabling the account instead.`,
              label: 'Delete', danger: true, done: 'User deleted.', leave: true,
              run: () => api.delete(`/admin/users/${id}`),
            })}>Delete User</button>
          </p>

          <div className="inline-form">
            <div className="field">
              <label htmlFor="role">Role</label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="user">user</option><option value="admin">admin</option>
              </select>
            </div>
            <button type="button" className="button" disabled={role === user.role} onClick={() => setPending({
              title: 'Change role', body: `Change ${user.roll_number} from ${user.role} to ${role}? Their current sessions will be signed out.`,
              label: 'Change Role', done: 'Role updated.',
              run: () => api.patch(`/admin/users/${id}/role`, { role }),
            })}>Change Role</button>
          </div>

          <div className="inline-form">
            <div className="field">
              <label htmlFor="new-password">New password (leave empty to generate one)</label>
              <input id="new-password" type="password" autoComplete="new-password" maxLength={72}
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <button type="button" className="button" onClick={() => setPending({
              title: 'Reset password', body: `Reset the password for ${user.roll_number}? All their sessions will be signed out.`,
              label: 'Reset Password', done: 'Password reset. All sessions for this user were signed out.',
              run: () => api.post(`/admin/users/${id}/reset-password`, newPassword ? { password: newPassword } : {}),
            })}>Reset Password</button>
          </div>
        </div>
        <p><Link to="/admin/users">Back to users</Link></p>

        <ConfirmDialog open={Boolean(pending)} title={pending?.title} confirmLabel={pending?.label}
          danger={pending?.danger} busy={busy} onConfirm={confirmPending} onCancel={() => setPending(null)}>
          <p>{pending?.body}</p>
        </ConfirmDialog>
      </main>
    </>
  );
}
