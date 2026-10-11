import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import Notice from '../../components/Notice.jsx';
import Pagination from '../../components/Pagination.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import api from '../../services/api.js';
import { getErrorMessage } from '../../services/errors.js';

const FILTERS = ['q', 'role', 'status', 'course', 'branch', 'year'];

export default function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const query = Object.fromEntries(FILTERS.map((key) => [key, params.get(key) || '']));
  const page = Number(params.get('page')) || 1;
  const [draft, setDraft] = useState(query);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const search = params.toString();

  const load = useCallback(() => {
    api.get(`/admin/users?${search}`)
      .then((r) => { setData(r.data); setError(''); })
      .catch((e) => setError(getErrorMessage(e)));
  }, [search]);
  useEffect(load, [load]);

  const apply = (event) => {
    event.preventDefault();
    setParams(Object.fromEntries(Object.entries(draft).filter(([, value]) => value)));
  };
  const changePage = (next) => setParams({ ...Object.fromEntries(params), page: String(next) });
  const field = (key) => ({ value: draft[key], onChange: (e) => setDraft({ ...draft, [key]: e.target.value }) });

  async function confirmPending() {
    setBusy(true);
    try {
      await pending.run();
      setMessage(pending.done);
      setError('');
      load();
    } catch (e) {
      setError(getErrorMessage(e));
      setMessage('');
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const toggle = (u) => setPending({
    title: u.is_active ? 'Disable account' : 'Enable account',
    body: `${u.is_active ? 'Disable' : 'Enable'} ${u.roll_number} (${u.name})?${u.is_active ? ' They will be signed out and unable to log in.' : ''}`,
    label: u.is_active ? 'Disable' : 'Enable',
    danger: u.is_active,
    done: `${u.roll_number} ${u.is_active ? 'disabled' : 'enabled'}.`,
    run: () => api.patch(`/admin/users/${u.id}/status`, { is_active: !u.is_active }),
  });
  const remove = (u) => setPending({
    title: 'Delete user permanently',
    body: `Permanently delete ${u.roll_number} (${u.name})? This cannot be undone. Consider disabling the account instead.`,
    label: 'Delete', danger: true, done: `${u.roll_number} deleted.`,
    run: () => api.delete(`/admin/users/${u.id}`),
  });

  const options = data?.options || { branches: [], courses: [], years: [] };
  const select = (key, label, values) => (
    <div className="field">
      <label htmlFor={`f-${key}`}>{label}</label>
      <select id={`f-${key}`} {...field(key)}>
        <option value="">All</option>
        {values.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <Header />
      <main className="content wide">
        <div className="title-row">
          <h1 className="page-title">Users</h1>
          <Link className="button button-primary" to="/admin/users/new">Add User</Link>
        </div>
        <Notice type="error">{error}</Notice>
        <Notice type="success">{message}</Notice>

        <form className="filters" onSubmit={apply}>
          <div className="field">
            <label htmlFor="f-q">Search roll number or name</label>
            <input id="f-q" type="search" maxLength={100} {...field('q')} />
          </div>
          {select('role', 'Role', ['user', 'admin'])}
          {select('status', 'Status', ['active', 'disabled'])}
          {select('course', 'Course', options.courses)}
          {select('branch', 'Branch', options.branches)}
          {select('year', 'Year', options.years)}
          <div className="field filter-actions">
            <button type="submit" className="button button-primary">Search</button>
            <button type="button" className="button" onClick={() => { setDraft(Object.fromEntries(FILTERS.map((k) => [k, '']))); setParams({}); }}>Clear</button>
          </div>
        </form>

        {!data && !error && <p>Loading...</p>}
        {data && data.users.length === 0 && <p>No users match the selected filters.</p>}
        {data && data.users.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Roll Number</th><th>Name</th><th>Role</th><th>Course</th><th>Branch</th><th>Year</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id}>
                      <td data-label="Roll Number">{u.roll_number}</td>
                      <td data-label="Name">{u.name}</td>
                      <td data-label="Role">{u.role}</td>
                      <td data-label="Course">{u.course || '-'}</td>
                      <td data-label="Branch">{u.branch || '-'}</td>
                      <td data-label="Year">{u.year || '-'}</td>
                      <td data-label="Status">{u.is_active ? 'Active' : 'Disabled'}</td>
                      <td data-label="Actions" className="row-actions">
                        <Link to={`/admin/users/${u.id}`}>View</Link>
                        <Link to={`/admin/users/${u.id}/edit`}>Edit</Link>
                        <button type="button" className="link-button" onClick={() => toggle(u)}>{u.is_active ? 'Disable' : 'Enable'}</button>
                        <button type="button" className="link-button danger" onClick={() => remove(u)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={changePage} />
          </>
        )}

        <ConfirmDialog open={Boolean(pending)} title={pending?.title} confirmLabel={pending?.label}
          danger={pending?.danger} busy={busy} onConfirm={confirmPending} onCancel={() => setPending(null)}>
          <p>{pending?.body}</p>
        </ConfirmDialog>
      </main>
    </>
  );
}
