/** Minimum se primenjuje jednom na celu stavku, pre PDV-a, kao na gamaunited.rs. */
export function applyLargeFormatMinimum(baseTotalPrice: number, formatType: unknown) {
  if (formatType !== "sheet" && formatType !== "roll") {
    throw new Error("Vrsta materijala nije definisana kao rolna ili ploča u cenovniku. Obračun nije dostupan.");
  }
  const minimumCharge = formatType === "sheet" ? 20 : 10;
  return {
    formatType,
    minimumCharge,
    minimumApplied: baseTotalPrice < minimumCharge,
    totalPrice: Math.max(baseTotalPrice, minimumCharge),
  };
}