export function calculateNPV(cashFlows: number[], rate: number, initialInvestment: number): number {
  const pv = cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t + 1), 0);
  return pv - initialInvestment;
}

export function calculateIRR(cashFlows: number[], initialInvestment: number): number | null {
  const allFlows = [-initialInvestment, ...cashFlows];
  let rate = 0.1;
  for (let i = 0; i < 2000; i++) {
    const npv = allFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
    const dnpv = allFlows.reduce((sum, cf, t) => sum - t * cf / Math.pow(1 + rate, t + 1), 0);
    if (Math.abs(dnpv) < 1e-12) break;
    const newRate = rate - npv / dnpv;
    if (!isFinite(newRate) || Math.abs(newRate - rate) < 1e-10) { rate = newRate; break; }
    rate = newRate;
    if (rate < -0.9999) rate = -0.9999;
  }
  return isFinite(rate) && rate > -1 ? rate : null;
}

export function calculateMIRR(cashFlows: number[], financeRate: number, reinvestRate: number, initialInvestment: number): number | null {
  const n = cashFlows.length;
  const fvPositive = cashFlows.reduce((sum, cf, t) =>
    sum + (cf > 0 ? cf * Math.pow(1 + reinvestRate, n - 1 - t) : 0), 0);
  const pvNegative = Math.abs(cashFlows.reduce((sum, cf, t) =>
    sum + (cf < 0 ? cf / Math.pow(1 + financeRate, t + 1) : 0), 0) - initialInvestment);
  if (pvNegative === 0) return null;
  return Math.pow(fvPositive / pvNegative, 1 / n) - 1;
}

export function calculateCAFRow(revenue: number, chargesDecaissees: number, dap: number, taxRate = 0.25) {
  const resultatAvantImpot = revenue - chargesDecaissees - dap;
  const impot = Math.max(0, resultatAvantImpot * taxRate);
  const resultatNet = resultatAvantImpot - impot;
  const caf = resultatNet + dap;
  return { resultatAvantImpot, impot, resultatNet, caf };
}

export function calculatePayback(cashFlows: number[], initialInvestment: number): number | null {
  let cumul = -initialInvestment;
  for (let t = 0; t < cashFlows.length; t++) {
    const prev = cumul;
    cumul += cashFlows[t];
    if (cumul >= 0 && cashFlows[t] > 0) {
      return t + Math.abs(prev) / cashFlows[t];
    }
  }
  return null;
}

export function calculateProfitabilityIndex(npv: number, initialInvestment: number): number {
  return initialInvestment > 0 ? (npv + initialInvestment) / initialInvestment : 0;
}

export function calculateEquivalentAnnuity(npv: number, rate: number, years: number): number {
  if (years <= 0) return 0;
  if (rate === 0) return npv / years;
  return (npv * rate) / (1 - Math.pow(1 + rate, -years));
}

export function calculateROA(netIncome: number, totalAssets: number): number {
  return totalAssets > 0 ? netIncome / totalAssets : 0;
}

export function calculateROE(netIncome: number, equity: number): number {
  return equity > 0 ? netIncome / equity : 0;
}

export function calculateLeverageEffect(roe: number, roa: number): number {
  return roe - roa;
}

export function calculateExpectedNPV(scenarios: { probability: number; npv: number }[]): number {
  return scenarios.reduce((sum, s) => sum + s.probability * s.npv, 0);
}

export function calculateNPVVariance(scenarios: { probability: number; npv: number }[], eNpv: number): number {
  return scenarios.reduce((sum, s) => sum + s.probability * Math.pow(s.npv - eNpv, 2), 0);
}

export function coefficientOfVariation(stdDev: number, mean: number): number {
  return mean !== 0 ? Math.abs(stdDev / mean) : Infinity;
}

export function formatPct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatMillions(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)} Md`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)} M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)} k`;
  return v.toFixed(0);
}
