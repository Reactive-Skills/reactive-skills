import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword, validateUsername } from '../src/auth.ts';

test('rejects an empty password', () => {
  assert.deepEqual(validatePassword(''), { ok: false, reason: 'empty' });
});

test('requires a digit', () => {
  assert.deepEqual(validatePassword('Abcdefghijklm'), { ok: false, reason: 'no_digit' });
});

test('requires an uppercase letter', () => {
  assert.deepEqual(validatePassword('abcdefghijkl1'), { ok: false, reason: 'no_upper' });
});

test('accepts a strong password', () => {
  assert.deepEqual(validatePassword('Abcdefghijkl1'), { ok: true });
});

test('rejects a username with a space', () => {
  assert.deepEqual(validateUsername('jo ann'), { ok: false, reason: 'has_space' });
});
