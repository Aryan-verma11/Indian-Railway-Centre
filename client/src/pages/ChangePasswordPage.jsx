import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import api, { setToken } from '../services/api.js';
import { getErrorMessage } from '../services/errors.js';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!currentPassword || !newPassword) {
      setError('Fill in all the fields.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setToken(data.token);
      setSuccess('Your password has been changed. Other devices were signed out.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header />
      <main className="content">
        <h1 className="page-title">Change Password</h1>
        <form className="login-card change-card" onSubmit={handleSubmit} noValidate>
          {error && <p className="error" role="alert"><strong>Error:</strong> {error}</p>}
          {success && <p className="success" role="status"><strong>Success:</strong> {success}</p>}

          <label htmlFor="current_password">Current Password</label>
          <input id="current_password" type="password" autoComplete="current-password"
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} maxLength={72} />

          <label htmlFor="new_password">New Password (8 or more characters)</label>
          <input id="new_password" type="password" autoComplete="new-password"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} maxLength={72} />

          <label htmlFor="confirm_password">Confirm New Password</label>
          <input id="confirm_password" type="password" autoComplete="new-password"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} maxLength={72} />

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Saving...' : 'Change Password'}
          </button>
        </form>
        <p><Link to="/details">Back to User Details</Link></p>
      </main>
    </>
  );
}
