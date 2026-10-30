import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal, lineTotal } from '../src/cart.ts';

test('line total multiplies price by quantity', () => {
  assert.equal(lineTotal({ sku: 'A', unitPrice: 2.5, quantity: 4 }), 10);
});

test('cart total without a discount', () => {
  assert.equal(cartTotal([{ sku: 'A', unitPrice: 10, quantity: 1 }, { sku: 'B', unitPrice: 5, quantity: 2 }]), 20);
});

test('discount on a single unit', () => {
  assert.equal(cartTotal([{ sku: 'A', unitPrice: 50, quantity: 1 }], { code: 'TEN', percent: 10 }), 45);
});
