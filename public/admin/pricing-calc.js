/**
 * Suggested-price math for the admin calculator.
 * One file for the browser (window.PricingCalc) and Node (test/pricing.test.js).
 */
(function (root) {
  function computePrice(c, others) {
    const n = k => Number(c[k]) || 0;
    const hours = n('hours') + n('minutes') / 60;
    const filament = n('spoolWeight') > 0 ? n('weightG') / n('spoolWeight') * n('spoolPrice') * (1 + n('wastePct') / 100) : 0;
    const electricity = n('powerW') / 1000 * hours * n('kwhPrice');
    const labor = (n('prepMin') + n('postMin')) / 60 * n('laborRate');
    const lifeHours = n('paybackYears') * 365 * n('dailyHours');
    const machine = lifeHours > 0
      ? hours * n('printerCost') * (1 + n('repairPct') / 100 * n('paybackYears')) / lifeHours
      : 0;
    const other = others.reduce((s, o) => s + (Number(o.value) || 0), 0);
    const shipping = n('shipCost');
    const cost = filament + electricity + labor + machine + other + shipping;
    const profit = cost * n('profitPct') / 100;
    // card fee is charged on the whole price (VAT included): solve price so that net - fee = cost + profit
    const keep = 1 / (1 + n('vatPct') / 100) - n('cardFeePct') / 100;
    const final = cost > shipping && keep > 0 ? (cost + profit + n('cardFeeFixed')) / keep : 0;
    const step = n('roundTo');
    const rounded = step > 0 ? Math.ceil(final / step) * step : Math.round(final);
    const fee = final ? final * n('cardFeePct') / 100 + n('cardFeeFixed') : 0;
    const vat = final - final / (1 + n('vatPct') / 100);
    return { hours, filament, electricity, labor, machine, other, shipping, cost, profit, fee, vat, final, rounded };
  }

  // what is really left from a sale at this price, after VAT, card fee and costs
  function margin(price, c, r) {
    const n = k => Number(c[k]) || 0;
    return (price / (1 + n('vatPct') / 100) - price * n('cardFeePct') / 100 - n('cardFeeFixed') - r.cost) / price * 100;
  }

  // a product is several printed pieces: time and filament are summed over all of them
  function sumPieces(pieces) {
    const seconds = pieces.reduce((s, p) => s + (Number(p.seconds) || 0), 0);
    const grams = pieces.reduce((s, p) => s + (Number(p.grams) || 0), 0);
    return {
      hours: Math.floor(seconds / 3600),
      minutes: Math.round((seconds % 3600) / 60),
      weightG: Math.round(grams * 10) / 10,
    };
  }

  const PricingCalc = { computePrice, margin, sumPieces };
  if (typeof module !== 'undefined' && module.exports) module.exports = PricingCalc;
  else root.PricingCalc = PricingCalc;
})(this);
