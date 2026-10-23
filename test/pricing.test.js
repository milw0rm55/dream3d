const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computePrice, margin } = require('../public/admin/pricing-calc');
const defaults = require('../config/pricing');

test('suggested price covers shipping, card fee and VAT, leaving exactly cost + profit', () => {
  for (const vatPct of [0, 21]) {
    const c = { ...defaults, vatPct, hours: 3, minutes: 0, weightG: 60 };
    const r = computePrice(c, [{ value: 1 }]);
    assert.ok(r.cost > r.shipping && r.shipping === defaults.shipCost, 'shipping is part of the cost');
    const net = r.final / (1 + vatPct / 100) - r.fee;
    assert.ok(Math.abs(net - (r.cost + r.profit)) < 1e-9, `VAT ${vatPct}%: net ${net} vs ${r.cost + r.profit}`);
    assert.ok(Math.abs(r.cost + r.profit + r.fee + r.vat - r.final) < 1e-9, 'breakdown adds up to the price');
    assert.ok(r.rounded >= r.final && r.rounded - r.final < c.roundTo);
    assert.ok(Math.abs(margin(r.final, c, r) - r.profit / r.final * 100) < 1e-9);
  }
});

test('shipping alone never suggests a price', () => {
  assert.equal(computePrice({ shipCost: 3.9, cardFeePct: 1.5, cardFeeFixed: 0.25, profitPct: 30 }, []).final, 0);
});
