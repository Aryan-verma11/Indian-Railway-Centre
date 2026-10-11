import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import Notice from '../../components/Notice.jsx';
import UserForm from '../../components/UserForm.jsx';
import api from '../../services/api.js';
import { getErrorMessage, getFieldErrors } from '../../services/errors.js';

export default function AdminUserNew() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function save(values) {
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      const { data } = await api.post('/admin/users', values);
      navigate(`/admin/users/${data.user.id}`, { replace: true });
    } catch (e) {
      setError(getErrorMessage(e));
      setFieldErrors(getFieldErrors(e));
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main className="content wide">
        <h1 className="page-title">Add User</h1>
        <Notice type="error">{error}</Notice>
        <UserForm isNew submitLabel="Create User" busy={busy} fieldErrors={fieldErrors}
          onSubmit={save} onCancel={() => navigate('/admin/users')} />
      </main>
    </>
  );
}
