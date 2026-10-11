import { useState } from 'react';

const FIELDS = [
  ['roll_number', 'Roll Number', 'text'],
  ['password', 'Password', 'password', 'newOnly'],
  ['name', 'Name', 'text'],
  ['father_name', "Father's Name", 'text'],
  ['gender', 'Gender', 'select', null, ['Male', 'Female', 'Other']],
  ['date_of_birth', 'Date of Birth', 'date'],
  ['phone', 'Phone', 'tel'],
  ['email', 'Email', 'email'],
  ['course', 'Course', 'text'],
  ['branch', 'Branch', 'text'],
  ['year', 'Year', 'text'],
  ['role', 'Role', 'select', 'newOnly', ['user', 'admin']],
  ['address', 'Address', 'textarea'],
];

export default function UserForm({ initial, isNew, submitLabel, fieldErrors = {}, busy, onSubmit, onCancel }) {
  const [values, setValues] = useState({ role: 'user', ...initial });
  const [localErrors, setLocalErrors] = useState({});
  const errors = { ...fieldErrors, ...localErrors };
  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

  function handleSubmit(event) {
    event.preventDefault();
    const missing = {};
    if (!values.roll_number?.trim()) missing.roll_number = 'This field is required.';
    if (!values.name?.trim()) missing.name = 'This field is required.';
    if (isNew && (values.role ?? 'user') === 'user' && !values.date_of_birth) {
      missing.date_of_birth = 'Date of birth is required for candidate login.';
    }
    if (isNew && !values.password) missing.password = 'This field is required.';
    setLocalErrors(missing);
    if (Object.keys(missing).length) return;
    const payload = { ...values };
    if (!isNew) { delete payload.password; delete payload.role; }
    onSubmit(payload);
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit} noValidate>
      {FIELDS.filter(([, , , scope]) => isNew || scope !== 'newOnly').map(([key, label, type, , options]) => {
        const id = `field-${key}`;
        const common = { id, value: values[key] ?? '', onChange: set(key), 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${id}-error` : undefined };
        return (
          <div className={`field${key === 'address' ? ' field-wide' : ''}`} key={key}>
            <label htmlFor={id}>{label}</label>
            {type === 'select' && (
              <select {...common}>
                <option value="">{key === 'role' ? '' : '-- Select --'}</option>
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            )}
            {type === 'textarea' && <textarea {...common} rows={3} maxLength={500} />}
            {type !== 'select' && type !== 'textarea' && (
              <input {...common} type={type} required={key === 'date_of_birth' && isNew && (values.role ?? 'user') === 'user'} autoComplete={type === 'password' ? 'new-password' : 'off'} />
            )}
            {errors[key] && <span className="field-error" id={`${id}-error`}>Error: {errors[key]}</span>}
          </div>
        );
      })}
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving...' : submitLabel}</button>
        <button type="button" className="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
