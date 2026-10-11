import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import Notice from '../../components/Notice.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getErrorMessage } from '../../services/errors.js';

export default function AdminSettings() {
  const { user, logoutAll } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signOutEverywhere() {
    setBusy(true);
    try {
      await logoutAll();
      navigate('/login', { replace: true });
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Header />
      <main className="content">
        <h1 className="page-title">Settings</h1>
        <Notice type="error">{error}</Notice>
        <h2 className="section-title">Your Account</h2>
        <dl className="details">
          <div className="detail-row"><dt>Name</dt><dd>{user.name}</dd></div>
          <div className="detail-row"><dt>Roll Number</dt><dd>{user.roll_number}</dd></div>
          <div className="detail-row"><dt>Role</dt><dd>{user.role}</dd></div>
        </dl>
        <h2 className="section-title">Security</h2>
        <p className="actions">
          <Link className="button" to="/change-password">Change Password</Link>
          <button type="button" className="button" onClick={() => setOpen(true)}>Sign Out of All Devices</button>
        </p>
        <ConfirmDialog open={open} title="Sign out of all devices" confirmLabel="Sign Out Everywhere" busy={busy}
          onConfirm={signOutEverywhere} onCancel={() => setOpen(false)}>
          <p>Every active session for your account, including this one, will be ended.</p>
        </ConfirmDialog>
      </main>
    </>
  );
}
