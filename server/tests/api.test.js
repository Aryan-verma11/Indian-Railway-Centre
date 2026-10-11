// Integration tests. Requires a running server (API_URL) and the demo users from `npm run seed`.
// Candidate login uses registration number + date_of_birth. Admin login uses roll_number + password.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API_URL || 'http://localhost:5000/api';
const ADMIN = { roll_number: 'IRCADMIN', password: 'Admin@12345' };
const USER = { roll_number: 'IRC230001', date_of_birth: '2005-04-15' };
const NEW_USER = {
  roll_number: 'TESTQA01',
  password: 'Initial#123',
  name: 'QA Tester',
  email: 'qa@example.com',
  phone: '9000011111',
  gender: 'Male',
  date_of_birth: '2000-02-29',
  course: 'B.Tech',
  branch: 'QA Branch',
  year: 'First Year',
  address: 'QA Street',
};
const NEW_USER_LOGIN = { roll_number: 'TESTQA01', date_of_birth: '2000-02-29' };

async function call(method, path, { token, body, raw } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(raw || body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: response.status, json, text };
}

const candidateLogin = async (credentials) =>
  (await call('POST', '/auth/login', { body: credentials })).json?.token;

const adminLogin = async (credentials = ADMIN) =>
  (await call('POST', '/auth/admin-login', { body: credentials })).json?.token;

let admin;
let userToken;
let created;

test('health and unauthenticated access', async () => {
  assert.equal((await call('GET', '/health')).status, 200);
  assert.equal((await call('GET', '/auth/me')).status, 401);
  assert.equal((await call('GET', '/admin/users')).status, 401);
  assert.equal((await call('GET', '/admin/users', { token: 'garbage.token.value' })).status, 401);
});

test('candidate login validation and generic failure', async () => {
  const wrongDob = await call('POST', '/auth/login', {
    body: { roll_number: USER.roll_number, date_of_birth: '1999-01-01' },
  });
  const unknownRoll = await call('POST', '/auth/login', {
    body: { roll_number: 'NOSUCH99', date_of_birth: '2000-01-01' },
  });
  assert.equal(wrongDob.status, 401);
  assert.equal(unknownRoll.status, 401);
  assert.equal(wrongDob.json.message, unknownRoll.json.message);
  assert.equal(wrongDob.json.message, 'Invalid registration number or date of birth.');

  assert.equal((await call('POST', '/auth/login', { body: {} })).status, 400);
  assert.equal((await call('POST', '/auth/login', { body: { roll_number: USER.roll_number } })).status, 400);
  assert.equal((await call('POST', '/auth/login', { body: { date_of_birth: '2005-04-15' } })).status, 400);
  assert.equal((await call('POST', '/auth/login', { body: { roll_number: "' OR 1=1 --", date_of_birth: '2000-01-01' } })).status, 400);
  assert.equal((await call('POST', '/auth/login', { body: { roll_number: USER.roll_number, date_of_birth: '31-02-2000' } })).status, 400);
  assert.equal((await call('POST', '/auth/login', { body: { roll_number: USER.roll_number, date_of_birth: '2000-02-31' } })).status, 400);
  assert.equal((await call('POST', '/auth/login', { body: { roll_number: USER.roll_number, date_of_birth: '2099-01-01' } })).status, 400);
  assert.equal((await call('POST', '/auth/login', { raw: '{bad json' })).status, 400);

  const passwordAttempt = await call('POST', '/auth/login', {
    body: { roll_number: USER.roll_number, password: 'Test@12345' },
  });
  assert.equal(passwordAttempt.status, 400);
});

test('candidate login success and admin login separation', async () => {
  const ok = await call('POST', '/auth/login', { body: USER });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.token);
  assert.equal(ok.json.user.roll_number, USER.roll_number);
  assert.equal(ok.json.user.role, 'user');
  for (const secret of ['password_hash', 'token_version', 'is_active', 'last_login_at']) {
    assert.ok(!(secret in ok.json.user), `${secret} leaked`);
  }

  const adminAsCandidate = await call('POST', '/auth/login', {
    body: { roll_number: ADMIN.roll_number, date_of_birth: '1990-01-01' },
  });
  assert.equal(adminAsCandidate.status, 401);

  const adminOk = await call('POST', '/auth/admin-login', { body: ADMIN });
  assert.equal(adminOk.status, 200);
  assert.ok(adminOk.json.token);
  assert.equal(adminOk.json.user.role, 'admin');

  const studentAsAdmin = await call('POST', '/auth/admin-login', {
    body: { roll_number: USER.roll_number, password: 'Test@12345' },
  });
  assert.equal(studentAsAdmin.status, 401);
});

test('normal user: own data only, no admin access, no sensitive fields', async () => {
  userToken = await candidateLogin(USER);
  assert.ok(userToken);
  const me = await call('GET', '/auth/me', { token: userToken });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.roll_number, USER.roll_number);
  assert.equal(me.json.user.name, 'Test User One');
  assert.equal(me.json.user.date_of_birth, USER.date_of_birth);
  for (const secret of ['password_hash', 'token_version', 'is_active', 'last_login_at']) {
    assert.ok(!(secret in me.json.user), `${secret} leaked`);
  }
  for (const path of ['/admin/users', '/admin/stats', '/admin/users/1', '/admin/audit-logs']) {
    assert.equal((await call('GET', path, { token: userToken })).status, 403, path);
  }
  assert.equal((await call('DELETE', '/admin/users/1', { token: userToken })).status, 403);
  assert.equal((await call('GET', '/users', { token: userToken })).status, 404);
});

test('admin: list, filters, no password hashes', async () => {
  admin = await adminLogin();
  assert.ok(admin);
  const list = await call('GET', '/admin/users', { token: admin });
  assert.equal(list.status, 200);
  assert.ok(!list.text.includes('password_hash') && !list.text.includes('$2b$'));
  assert.ok(list.json.total >= 4);
  const search = await call('GET', '/admin/users?q=IRC2300&role=user&limit=2', { token: admin });
  assert.ok(search.json.users.length <= 2 && search.json.users.every((u) => u.role === 'user'));
  const injection = await call('GET', "/admin/users?q=' OR 1=1 --&branch=x' OR '1'='1", { token: admin });
  assert.equal(injection.status, 200);
  assert.equal(injection.json.total, 0);
  const stats = await call('GET', '/admin/stats', { token: admin });
  assert.ok(stats.json.total >= 4 && stats.json.admins >= 1);
});

test('admin CRUD, validation, duplicates, mass assignment', async () => {
  const bad = await call('POST', '/admin/users', {
    token: admin,
    body: { roll_number: 'a', password: 'short', name: '', email: 'nope', phone: 'abc', role: 'root' },
  });
  assert.equal(bad.status, 400);
  for (const field of ['roll_number', 'password', 'name', 'email', 'phone', 'role']) {
    assert.ok(bad.json.errors[field], field);
  }

  const missingDob = await call('POST', '/admin/users', {
    token: admin,
    body: { ...NEW_USER, roll_number: 'NODOB001', date_of_birth: undefined },
  });
  assert.equal(missingDob.status, 400);
  assert.ok(missingDob.json.errors.date_of_birth);

  const add = await call('POST', '/admin/users', { token: admin, body: NEW_USER });
  assert.equal(add.status, 201);
  created = add.json.user;
  assert.equal(created.role, 'user');
  assert.ok(!add.text.includes('password_hash'));

  const duplicate = await call('POST', '/admin/users', { token: admin, body: NEW_USER });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.message, 'Roll number already exists.');

  assert.equal((await call('GET', '/admin/users/abc', { token: admin })).status, 400);
  assert.equal((await call('GET', '/admin/users/99999999', { token: admin })).status, 404);

  const update = await call('PUT', `/admin/users/${created.id}`, {
    token: admin,
    body: { name: 'QA Renamed', role: 'admin', password_hash: 'x', is_active: false, token_version: 99 },
  });
  assert.equal(update.status, 200);
  assert.equal(update.json.user.name, 'QA Renamed');
  assert.equal(update.json.user.role, 'user');
  assert.equal(update.json.user.is_active, true);
  assert.equal((await call('PUT', `/admin/users/${created.id}`, { token: admin, body: { email: 'bad' } })).status, 400);
  assert.equal((await call('PUT', `/admin/users/${created.id}`, { token: admin, body: {} })).status, 400);
});

test('disabled accounts: login blocked, old token revoked, re-enable works', async () => {
  const token = await candidateLogin(NEW_USER_LOGIN);
  assert.ok(token);
  assert.equal((await call('GET', '/auth/me', { token })).status, 200);
  assert.equal((await call('PATCH', `/admin/users/${created.id}/status`, { token: admin, body: { is_active: 'no' } })).status, 400);
  assert.equal((await call('PATCH', `/admin/users/${created.id}/status`, { token: admin, body: { is_active: false } })).status, 200);
  assert.equal((await call('POST', '/auth/login', { body: NEW_USER_LOGIN })).status, 401);
  assert.equal((await call('GET', '/auth/me', { token })).status, 401);
  assert.equal((await call('PATCH', `/admin/users/${created.id}/status`, { token: admin, body: { is_active: true } })).status, 200);
  assert.equal((await call('POST', '/auth/login', { body: NEW_USER_LOGIN })).status, 200);
});

test('candidate password-change endpoint is disabled; admin password change remains available', async () => {
  const studentToken = await candidateLogin(NEW_USER_LOGIN);
  const studentAttempt = await call('POST', '/auth/change-password', {
    token: studentToken,
    body: { current_password: NEW_USER.password, new_password: 'Changed#456' },
  });
  assert.equal(studentAttempt.status, 403);

  const adminToken = await adminLogin();
  const wrong = await call('POST', '/auth/change-password', {
    token: adminToken,
    body: { current_password: 'not-the-admin-password', new_password: 'Changed#456' },
  });
  assert.equal(wrong.status, 400);
});

test('admin password reset refuses candidate accounts', async () => {
  const reset = await call('POST', `/admin/users/${created.id}/reset-password`, { token: admin, body: {} });
  assert.equal(reset.status, 409);
  assert.equal(reset.json.message, 'Candidate accounts use registration number and date of birth; password reset is not applicable.');
  assert.equal((await call('POST', '/auth/login', { body: NEW_USER_LOGIN })).status, 200);
  assert.equal((await call('POST', `/admin/users/${created.id}/reset-password`, { token: admin, body: { password: 'x' } })).status, 400);
});

test('role changes: promotion, demotion invalidates old admin token', async () => {
  const userSession = await candidateLogin(NEW_USER_LOGIN);
  assert.equal((await call('PATCH', `/admin/users/${created.id}/role`, { token: admin, body: { role: 'superuser' } })).status, 400);
  assert.equal((await call('PATCH', `/admin/users/${created.id}/role`, { token: admin, body: { role: 'admin' } })).status, 200);
  assert.equal((await call('GET', '/auth/me', { token: userSession })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: NEW_USER_LOGIN })).status, 401);
  
  const reset = await call('POST', `/admin/users/${created.id}/reset-password`, {
    token: admin,
    body: { password: NEW_USER.password },
  });
  assert.equal(reset.status, 200);


  const promoted = await adminLogin({ roll_number: NEW_USER.roll_number, password: NEW_USER.password });
  assert.ok(promoted);
  assert.equal((await call('GET', '/admin/users', { token: promoted })).status, 200);

  assert.equal((await call('PATCH', `/admin/users/${created.id}/role`, { token: admin, body: { role: 'user' } })).status, 200);
  assert.equal((await call('GET', '/admin/users', { token: promoted })).status, 401);

  const demoted = await candidateLogin(NEW_USER_LOGIN);
  assert.ok(demoted);
  assert.equal((await call('GET', '/admin/users', { token: demoted })).status, 403);
});

test('admin safety rules', async () => {
  const me = (await call('GET', '/admin/users?q=IRCADMIN', { token: admin })).json.users[0];
  assert.equal((await call('DELETE', `/admin/users/${me.id}`, { token: admin })).status, 409);
  assert.equal((await call('PATCH', `/admin/users/${me.id}/status`, { token: admin, body: { is_active: false } })).status, 409);
  const demote = await call('PATCH', `/admin/users/${me.id}/role`, { token: admin, body: { role: 'user' } });
  assert.equal(demote.status, 409);
  assert.match(demote.json.message, /only active administrator/);
});

test('delete user and audit trail', async () => {
  assert.equal((await call('DELETE', `/admin/users/${created.id}`, { token: admin })).status, 200);
  assert.equal((await call('GET', `/admin/users/${created.id}`, { token: admin })).status, 404);
  const logs = await call('GET', '/admin/audit-logs', { token: admin });
  const actions = new Set(logs.json.logs.map((log) => log.action));
  for (const action of ['user_created', 'user_updated', 'user_disabled', 'user_enabled', 'password_reset', 'role_changed', 'user_deleted', 'admin_login']) {
    assert.ok(actions.has(action), `missing audit action ${action}`);
  }
  assert.ok(!logs.text.includes('Changed#456') && !logs.text.includes('Initial#123'));
});
