import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import Notice from '../../components/Notice.jsx';
import UserForm from '../../components/UserForm.jsx';
import api from '../../services/api.js';
import { getErrorMessage, getFieldErrors } from '../../services/errors.js';

export default function AdminUserEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/admin/users/${id}`).then((r) => setUser(r.data.user)).catch((e) => setError(getErrorMessage(e)));
  }, [id]);

  async function save(values) {
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await api.put(`/admin/users/${id}`, values);
      navigate(`/admin/users/${id}`, { replace: true });
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
        <h1 className="page-title">Edit User</h1>
        <Notice type="error">{error}</Notice>
        {!user && !error && <p>Loading...</p>}
        {user && (
          <UserForm initial={user} submitLabel="Save Changes" busy={busy} fieldErrors={fieldErrors}
            onSubmit={save} onCancel={() => navigate(`/admin/users/${id}`)} />
        )}
      </main>
    </>
  );
}
