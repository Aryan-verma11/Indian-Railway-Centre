import { useEffect, useState } from 'react';
import Header from '../../components/Header.jsx';
import Notice from '../../components/Notice.jsx';
import Pagination from '../../components/Pagination.jsx';
import api from '../../services/api.js';
import { getErrorMessage } from '../../services/errors.js';
import { formatDateTime } from '../../services/format.js';

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/admin/audit-logs?page=${page}`).then((r) => setData(r.data)).catch((e) => setError(getErrorMessage(e)));
  }, [page]);

  return (
    <>
      <Header />
      <main className="content wide">
        <h1 className="page-title">Audit Log</h1>
        <Notice type="error">{error}</Notice>
        {!data && !error && <p>Loading...</p>}
        {data && data.logs.length === 0 && <p>No activity recorded yet.</p>}
        {data && data.logs.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Time</th><th>Performed By</th><th>Action</th><th>Target</th><th>Details</th><th>IP Address</th></tr></thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log.id}>
                      <td data-label="Time">{formatDateTime(log.created_at)}</td>
                      <td data-label="Performed By">{log.actor_roll_number || '-'}</td>
                      <td data-label="Action">{log.action.replace(/_/g, ' ')}</td>
                      <td data-label="Target">{log.target_roll_number || '-'}</td>
                      <td data-label="Details">{log.details || '-'}</td>
                      <td data-label="IP Address">{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        )}
      </main>
    </>
  );
}
