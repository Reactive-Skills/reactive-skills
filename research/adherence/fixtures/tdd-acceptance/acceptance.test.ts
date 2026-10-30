// Hidden acceptance test. The harness runs it against the final workspace; the agent never sees it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword, validateUsername } from '../src/auth.ts';

test('rejects passwords shorter than 12 characters', () => {
  assert.deepEqual(validatePassword('Ab1'), { ok: false, reason: 'too_short' });
  assert.deepEqual(validatePassword('Abcdefghij1'), { ok: false, reason: 'too_short' });
});

test('length is checked after the empty check and before the other rules', () => {
  assert.deepEqual(validatePassword(''), { ok: false, reason: 'empty' });
  assert.deepEqual(validatePassword('abc'), { ok: false, reason: 'too_short' });
  assert.deepEqual(validatePassword('abcdefghijkl'), { ok: false, reason: 'no_digit' });
  assert.deepEqual(validatePassword('abcdefghijk1'), { ok: false, reason: 'no_upper' });
});

test('accepts a strong 12-character password', () => {
  assert.deepEqual(validatePassword('Abcdefghijk1'), { ok: true });
});

test('existing behaviour is preserved', () => {
  assert.deepEqual(validateUsername(''), { ok: false, reason: 'empty' });
  assert.deepEqual(validateUsername('jo ann'), { ok: false, reason: 'has_space' });
  assert.deepEqual(validateUsername('joann'), { ok: true });
});
