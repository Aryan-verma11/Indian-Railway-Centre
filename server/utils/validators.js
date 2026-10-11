export const ROLES = ['user', 'admin'];
const GENDERS = ['Male', 'Female', 'Other'];
const NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRollNumber(input) {
  const value = typeof input === 'string' ? input.trim().toUpperCase() : '';
  return /^[A-Z0-9_-]{3,30}$/.test(value)
    ? { value }
    : { error: 'Roll number must be 3 to 30 letters, digits, hyphens or underscores.' };
}

export function validatePassword(input) {
  if (typeof input !== 'string' || input.length < 8 || Buffer.byteLength(input) > 72) {
    return 'Password must be 8 to 72 characters.';
  }
  return null;
}

export function validateRole(input) {
  return ROLES.includes(input) ? { value: input } : { error: 'Role must be user or admin.' };
}

const text = (label, max, pattern) => (value) => {
  if (value.length > max) return `${label} must be at most ${max} characters.`;
  if (CONTROL_CHARS.test(value)) return `${label} contains invalid characters.`;
  if (pattern && !pattern.test(value)) return `${label} contains invalid characters.`;
  return null;
};

const FIELD_RULES = {
  name: { required: true, check: text('Name', 100, NAME_PATTERN) },
  father_name: { check: text("Father's name", 100, NAME_PATTERN) },
  gender: { check: (v) => (GENDERS.includes(v) ? null : 'Gender must be Male, Female or Other.') },
  date_of_birth: {
    check: (v) => {
      const date = new Date(`${v}T00:00:00Z`);
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(date.getTime())
        && date.toISOString().startsWith(v) && v >= '1900-01-01' && date <= new Date();
      return valid ? null : 'Enter a valid date of birth.';
    },
  },
  phone: {
    normalize: (v) => v.replace(/[\s-]/g, ''),
    check: (v) => (/^\+?[0-9]{7,15}$/.test(v) ? null : 'Enter a valid phone number.'),
  },
  email: { check: (v) => (v.length <= 150 && EMAIL_PATTERN.test(v) ? null : 'Enter a valid email address.') },
  course: { check: text('Course', 100) },
  branch: { check: text('Branch', 150) },
  year: { check: text('Year', 30) },
  address: { check: text('Address', 500) },
};

export const DETAIL_FIELDS = Object.keys(FIELD_RULES);

export function validateDetails(body, { partial = false } = {}) {
  const values = {};
  const errors = {};
  for (const [field, rule] of Object.entries(FIELD_RULES)) {
    if (partial && !(field in body)) continue;
    const raw = body[field];
    if (raw === undefined || raw === null || raw === '') {
      if (rule.required) errors[field] = 'This field is required.';
      else values[field] = null;
      continue;
    }
    if (typeof raw !== 'string') {
      errors[field] = 'Invalid value.';
      continue;
    }
    const value = rule.normalize ? rule.normalize(raw.trim()) : raw.trim();
    const error = rule.check(value);
    if (error) errors[field] = error;
    else values[field] = value;
  }
  return { values, errors };
}
