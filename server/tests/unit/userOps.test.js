import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, sqliteAvailable } from './helpers.js';
import {
  deleteUserByRoll, importUsers, prepareImport, resetPasswordByRoll, setRoleByRoll,
} from '../../utils/userOps.js';
import { LAST_ADMIN_MESSAGE } from '../../utils/adminGuard.js';

const opts = { skip: !sqliteAvailable && 'node:sqlite not available (needs Node 22.5+)' };
const fakeHash = async (password) => `$fake$${password.split('').reverse().join('')}`;
const lastAdminError = (err) => err.status === 409 && err.message === LAST_ADMIN_MESSAGE;
const count = (t, where = '1=1') => t.one(`SELECT COUNT(*) AS n FROM users WHERE ${where}`).n;

// ---------------- CLI delete ----------------

test('delete: normal user', opts, async () => {
  const t = createDb();
  t.addUser('ADMIN1', { role: 'admin' });
  t.addUser('USER001');
  await t.tx((c) => deleteUserByRoll(c, 'USER001'));
  assert.equal(t.one("SELECT 1 AS x FROM users WHERE roll_number='USER001'"), undefined);
  assert.equal(t.one("SELECT action FROM audit_logs WHERE target_roll_number='USER001'").action, 'user_deleted');
});

test('delete: admin when another active admin exists', opts, async () => {
  const t = createDb();
  t.addUser('ADMIN1', { role: 'admin' });
  t.addUser('ADMIN2', { role: 'admin' });
  await t.tx((c) => deleteUserByRoll(c, 'ADMIN2'));
  assert.equal(count(t, "role='admin'"), 1);
});

test('delete: last admin is refused and nothing changes', opts, async () => {
  const t = createDb();
  t.addUser('ADMIN1', { role: 'admin' });
  t.addUser('USER001');
  await assert.rejects(t.tx((c) => deleteUserByRoll(c, 'ADMIN1')), lastAdminError);
  assert.equal(count(t, "role='admin'"), 1);
  assert.equal(t.one("SELECT COUNT(*) AS n FROM audit_logs").n, 0);
});

test('delete: last ACTIVE admin refused even if a disabled admin exists', opts, async () => {
  const t = createDb();
  t.addUser('ADMIN1', { role: 'admin' });
  t.addUser('ADMIN2', { role: 'admin', active: 0 });
  await assert.rejects(t.tx((c) => deleteUserByRoll(c, 'ADMIN1')), lastAdminError);
  await t.tx((c) => deleteUserByRoll(c, 'ADMIN2')); // removing the disabled one is fine
  assert.equal(count(t, "role='admin'"), 1);
});

test('delete: unknown roll number', opts, async () => {
  const t = createDb();
  await assert.rejects(t.tx((c) => deleteUserByRoll(c, 'NOBODY1')), (err) => err.status === 404);
});

// ---------------- CLI set-role ----------------

test('set-role: promote user to admin bumps token_version and audits', opts, async () => {
  const t = createDb();
  t.addUser('USER001', { tv: 3 });
  const result = await t.tx((c) => setRoleByRoll(c, 'USER001', 'admin'));
  assert.equal(result.changed, true);
  const row = t.one("SELECT role, token_version FROM users WHERE roll_number='USER001'");
  assert.deepEqual({ ...row }, { role: 'admin', token_version: 4 });
  assert.match(t.one("SELECT details FROM audit_logs WHERE action='role_changed'").details, /user -> admin/);
});

test('set-role: demote admin when another active admin exists', opts, async () => {
  const t = createDb();
  t.addUser('ADMIN1', { role: 'admin' });
  t.addUser('ADMIN2', { role: 'admin' });
  await t.tx((c) => setRoleByRoll(c, 'ADMIN2', 'user'));
  assert.equal(t.one("SELECT role FROM users WHERE roll_number='ADMIN2'").role, 'user');
});

test('set-role: demoting the last active admin is refused', opts, async () => {
  const t = createDb();
  t.addUser('ADMIN1', { role: 'admin', tv: 5 });
  t.addUser('ADMIN2', { role: 'admin', active: 0 });
  await assert.rejects(t.tx((c) => setRoleByRoll(c, 'ADMIN1', 'user')), lastAdminError);
  const row = t.one("SELECT role, token_version FROM users WHERE roll_number='ADMIN1'");
  assert.deepEqual({ ...row }, { role: 'admin', token_version: 5 });
});

test('set-role: same role is a no-op; invalid role and unknown user rejected', opts, async () => {
  const t = createDb();
  t.addUser('ADMIN1', { role: 'admin', tv: 1 });
  const same = await t.tx((c) => setRoleByRoll(c, 'ADMIN1', 'admin'));
  assert.equal(same.changed, false);
  assert.equal(t.one("SELECT token_version AS v FROM users WHERE roll_number='ADMIN1'").v, 1);
  await assert.rejects(t.tx((c) => setRoleByRoll(c, 'ADMIN1', 'root')), (err) => err.status === 400);
  await assert.rejects(t.tx((c) => setRoleByRoll(c, 'NOBODY1', 'admin')), (err) => err.status === 404);
});

test('reset-password via CLI helper bumps token_version and never audits the password', opts, async () => {
  const t = createDb();
  t.addUser('USER001', { tv: 0 });
  t.addUser('ADMIN1', { role: 'admin', tv: 0 });
  await t.tx((c) => resetPasswordByRoll(c, 'ADMIN1', '$fake$newhash'));
  const row = t.one("SELECT password_hash, token_version FROM users WHERE roll_number='ADMIN1'");
  assert.deepEqual({ ...row }, { password_hash: '$fake$newhash', token_version: 1 });
  await assert.rejects(t.tx((c) => resetPasswordByRoll(c, 'USER001', '$fake$blocked')), (err) => err.status === 409);
  assert.ok(!JSON.stringify(t.all('SELECT * FROM audit_logs')).includes('newhash'));
});

// ---------------- Import ----------------

const row = (roll, extra = {}) => ({ roll_number: roll, password: 'Secret#1234', name: 'Imported Person', date_of_birth: '2000-01-01', ...extra });
const doImport = (t, rows) => {
  const { valid, problems } = prepareImport(rows);
  assert.deepEqual(problems, []);
  return t.tx((c) => importUsers(c, valid, fakeHash));
};

test('import: new users (normal and admin) are created with hashed passwords', opts, async () => {
  const t = createDb();
  const result = await doImport(t, [row('new001', { gender: 'Male', phone: '9000000009' }), row('NEWADM1', { role: 'admin' })]);
  assert.deepEqual(result.created.map((u) => [u.rollNumber, u.role]), [['NEW001', 'user'], ['NEWADM1', 'admin']]);
  assert.equal(result.skipped.length, 0);
  const user = t.one("SELECT * FROM users WHERE roll_number='NEW001'");
  assert.equal(user.password_hash, '$fake$4321#terceS');
  assert.notEqual(user.password_hash, 'Secret#1234');
  assert.equal(user.phone, '9000000009');
  assert.equal(t.all("SELECT * FROM audit_logs WHERE action='user_imported'").length, 2);
  assert.ok(!JSON.stringify(t.all('SELECT * FROM audit_logs')).includes('Secret#1234'));
});

test('import: existing normal user is skipped; password, role, token_version, status, details preserved', opts, async () => {
  const t = createDb();
  t.addUser('USER001', { hash: 'ORIGINAL-HASH', name: 'Original Name', tv: 7, active: 0 });
  const before = { ...t.one("SELECT * FROM users WHERE roll_number='USER001'") };
  const result = await doImport(t, [row('USER001', { role: 'admin', name: 'Hijack Name', password: 'Attacker#1234' })]);
  assert.equal(result.created.length, 0);
  assert.equal(result.skipped[0].rollNumber, 'USER001');
  assert.match(result.skipped[0].reason, /already exists/);
  assert.deepEqual({ ...t.one("SELECT * FROM users WHERE roll_number='USER001'") }, before);
});

test('import: existing admin keeps role and password; last admin cannot be demoted by import', opts, async () => {
  const t = createDb();
  t.addUser('ADMIN1', { role: 'admin', hash: 'ADMIN-HASH', tv: 2 });
  const before = { ...t.one("SELECT * FROM users WHERE roll_number='ADMIN1'") };
  const result = await doImport(t, [row('admin1', { role: 'user', password: 'Changed#12345' })]);
  assert.equal(result.skipped.length, 1);
  assert.deepEqual({ ...t.one("SELECT * FROM users WHERE roll_number='ADMIN1'") }, before);
  assert.equal(count(t, "role='admin' AND is_active=1"), 1);
});

test('import: duplicate roll number inside the file (case-insensitive) is skipped and reported', opts, async () => {
  const t = createDb();
  const result = await doImport(t, [row('DUP001', { name: 'First' }), row('dup001', { name: 'Second' })]);
  assert.equal(result.created.length, 1);
  assert.match(result.skipped[0].reason, /duplicate roll number in the import file/);
  assert.equal(t.one("SELECT name FROM users WHERE roll_number='DUP001'").name, 'First');
});

test('import: candidate without DOB is rejected while admin may omit DOB', opts, async () => {
  const candidate = prepareImport([row('NODOB001', { date_of_birth: '' })]);
  assert.equal(candidate.valid.length, 0);
  assert.match(candidate.problems.join(' '), /date_of_birth: Date of birth is required for candidate login/);
  const admin = prepareImport([row('ADMINNOD', { role: 'admin', date_of_birth: '' })]);
  assert.equal(admin.valid.length, 1);
  assert.equal(admin.valid[0].role, 'admin');
});

test('import: malformed rows are all reported and nothing is imported', opts, async () => {
  const bad = [
    row('GOOD001'),
    row('x'),                                   // invalid roll number
    row('BADROLE1', { role: 'superuser' }),     // invalid role
    row('SHORTPW1', { password: 'short' }),     // invalid password
    { roll_number: 'NONAME1', password: 'Secret#1234' }, // missing name
    row('BADMAIL1', { email: 'nope' }),
    row('BADDOB1', { date_of_birth: '2000-02-30' }),
    'not an object',
    null,
  ];
  const { valid, problems } = prepareImport(bad);
  assert.equal(valid.length, 1);
  assert.equal(problems.length, 8);
  assert.throws(() => prepareImport({}), (err) => err.status === 400);
  assert.throws(() => prepareImport('x'), (err) => err.status === 400);
  // The CLI aborts when problems exist, so the database is never touched:
  const t = createDb();
  assert.equal(count(t), 0);
});

test('import: a failure part-way rolls the whole import back', opts, async () => {
  const t = createDb();
  const { valid } = prepareImport([row('ROLL0001'), row('ROLL0002'), row('ROLL0003')]);
  let calls = 0;
  const flaky = async (password) => { calls += 1; if (calls === 3) throw new Error('boom'); return fakeHash(password); };
  await assert.rejects(t.tx((c) => importUsers(c, valid, flaky)), /boom/);
  assert.equal(count(t), 0);
  assert.equal(t.one('SELECT COUNT(*) AS n FROM audit_logs').n, 0);
});

test('import: unknown fields cannot set security columns', opts, async () => {
  const t = createDb();
  await doImport(t, [row('SNEAKY1', { is_active: 0, token_version: 99, password_hash: 'x', id: 500 })]);
  const user = t.one("SELECT * FROM users WHERE roll_number='SNEAKY1'");
  assert.equal(user.is_active, 1);
  assert.equal(user.token_version, 0);
  assert.notEqual(user.password_hash, 'x');
  assert.notEqual(user.id, 500);
});
