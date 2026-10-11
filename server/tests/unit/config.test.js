import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrustProxy } from '../../utils/config.js';

test('parseTrustProxy: safe defaults', () => {
  for (const value of [undefined, null, '', '  ', '0', 'false', 'off', 'no']) assert.equal(parseTrustProxy(value), false, String(value));
});

test('parseTrustProxy: hop counts and subnet lists', () => {
  assert.equal(parseTrustProxy('1'), 1);
  assert.equal(parseTrustProxy(' 2 '), 2);
  assert.equal(parseTrustProxy('loopback'), 'loopback');
  assert.equal(parseTrustProxy('10.0.0.0/8, loopback'), '10.0.0.0/8, loopback');
});

test('parseTrustProxy: rejects "true" and junk', () => {
  for (const value of ['true', 'TRUE', 'yes', '99', '1; drop', '$(x)']) assert.throws(() => parseTrustProxy(value), Error, value);
});
