/** Rates belong to a particular order; missing FX is not silently invented. */
export function procurementTotals(goodsUsd: number, costsEur: number, usdToEur: number | null) {
  const rate = Number(usdToEur);
  const validRate = Number.isFinite(rate) && rate > 0;
  return {
    totalUsd: costsEur === 0 ? goodsUsd : validRate ? goodsUsd + costsEur / rate : null,
    totalEur: validRate ? goodsUsd * rate + costsEur : null,
  };
}
