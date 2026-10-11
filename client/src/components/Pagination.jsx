export default function Pagination({ page, pages, total, onChange }) {
  return (
    <div className="pagination">
      <span>Page {page} of {pages} ({total} total)</span>
      <span>
        <button type="button" className="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <button type="button" className="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </span>
    </div>
  );
}
