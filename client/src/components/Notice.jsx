export default function Notice({ type, children }) {
  if (!children) return null;
  const isError = type === 'error';
  return (
    <p className={isError ? 'error' : 'success'} role={isError ? 'alert' : 'status'}>
      <strong>{isError ? 'Error:' : 'Success:'}</strong> {children}
    </p>
  );
}
