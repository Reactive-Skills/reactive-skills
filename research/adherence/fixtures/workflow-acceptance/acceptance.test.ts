// Hidden acceptance test. The harness runs it against the final workspace; the agent never sees it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal } from '../src/cart.ts';

test('issue #42: a percentage discount applies to every unit', () => {
  assert.equal(cartTotal([{ sku: 'MUG-01', unitPrice: 12, quantity: 3 }], { code: 'TEN', percent: 10 }), 32.4);
});

test('single-unit and undiscounted carts are unchanged', () => {
  assert.equal(cartTotal([{ sku: 'A', unitPrice: 50, quantity: 1 }], { code: 'TEN', percent: 10 }), 45);
  assert.equal(cartTotal([{ sku: 'A', unitPrice: 10, quantity: 1 }, { sku: 'B', unitPrice: 5, quantity: 2 }]), 20);
});
