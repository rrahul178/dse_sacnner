"use strict";

// Pure indicator helpers. Input rows must be oldest -> newest and contain
// open, high, low, close and volume numeric fields.
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function atr(rows, period = 14) {
  if (rows.length < period + 1) return null;
  const ranges = [];
  for (let i = 1; i < rows.length; i += 1) {
    const prevClose = rows[i - 1].close;
    ranges.push(Math.max(rows[i].high - rows[i].low, Math.abs(rows[i].high - prevClose), Math.abs(rows[i].low - prevClose)));
  }
  let value = mean(ranges.slice(0, period));
  for (let i = period; i < ranges.length; i += 1) value = ((value * (period - 1)) + ranges[i]) / period;
  return value;
}

function adx(rows, period = 14) {
  if (rows.length < (period * 2) + 1) return null;
  const tr = [], plusDM = [], minusDM = [];
  for (let i = 1; i < rows.length; i += 1) {
    const up = rows[i].high - rows[i - 1].high;
    const down = rows[i - 1].low - rows[i].low;
    tr.push(Math.max(rows[i].high - rows[i].low, Math.abs(rows[i].high - rows[i - 1].close), Math.abs(rows[i].low - rows[i - 1].close)));
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  let smoothTR = mean(tr.slice(0, period)), smoothPlus = mean(plusDM.slice(0, period)), smoothMinus = mean(minusDM.slice(0, period));
  const dx = [];
  for (let i = period; i < tr.length; i += 1) {
    if (i > period) { smoothTR = ((smoothTR * (period - 1)) + tr[i]) / period; smoothPlus = ((smoothPlus * (period - 1)) + plusDM[i]) / period; smoothMinus = ((smoothMinus * (period - 1)) + minusDM[i]) / period; }
    const plusDI = smoothTR ? 100 * smoothPlus / smoothTR : 0;
    const minusDI = smoothTR ? 100 * smoothMinus / smoothTR : 0;
    dx.push((plusDI + minusDI) ? 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI) : 0);
  }
  return mean(dx.slice(-period));
}

function mfi(rows, period = 14) {
  if (rows.length < period + 1) return null;
  const positive = [], negative = [];
  for (let i = 1; i < rows.length; i += 1) {
    const typical = (rows[i].high + rows[i].low + rows[i].close) / 3;
    const prior = (rows[i - 1].high + rows[i - 1].low + rows[i - 1].close) / 3;
    const flow = typical * (rows[i].volume || 0);
    positive.push(typical > prior ? flow : 0);
    negative.push(typical < prior ? flow : 0);
  }
  const pos = positive.slice(-period).reduce((a, b) => a + b, 0);
  const neg = negative.slice(-period).reduce((a, b) => a + b, 0);
  if (!neg) return 100;
  return 100 - (100 / (1 + pos / neg));
}

function obv(rows) {
  let value = 0;
  for (let i = 1; i < rows.length; i += 1) value += rows[i].close > rows[i - 1].close ? rows[i].volume : rows[i].close < rows[i - 1].close ? -rows[i].volume : 0;
  const lookback = rows.slice(-21);
  let prior = 0;
  for (let i = 1; i < lookback.length - 1; i += 1) prior += lookback[i].close > lookback[i - 1].close ? lookback[i].volume : lookback[i].close < lookback[i - 1].close ? -lookback[i].volume : 0;
  return { value, trend: value > prior ? "rising" : value < prior ? "falling" : "flat" };
}

function volumePercentile(rows, lookback = 60) {
  if (!rows.length) return null;
  const values = rows.slice(-lookback);
  const today = values[values.length - 1].volume || 0;
  return 100 * values.filter((row) => (row.volume || 0) <= today).length / values.length;
}

function breakoutFreshness(rows, lookback = 20) {
  if (rows.length < lookback + 1) return null;
  const recent = rows.slice(-lookback);
  const high = Math.max(...recent.map((row) => row.high));
  const close = rows[rows.length - 1].close;
  if (close < high * 0.995) return 0;
  for (let age = 0; age < Math.min(5, recent.length); age += 1) if (recent[recent.length - 1 - age].high >= high * 0.995) return 100 - age * 20;
  return 0;
}

function riskReward(rows, support, resistance) {
  const close = rows[rows.length - 1].close;
  const fallbackAtr = atr(rows) || close * 0.03;
  const stop = support && support < close ? support : close - (fallbackAtr * 1.5);
  const target = resistance && resistance > close ? resistance : close + (fallbackAtr * 3);
  const risk = close - stop, reward = target - close;
  return { stopLoss: +stop.toFixed(2), target: +target.toFixed(2), ratio: risk > 0 ? +(reward / risk).toFixed(2) : null };
}

function relativeStrength(closes, benchmarkReturn) {
  if (closes.length < 21 || !Number.isFinite(benchmarkReturn)) return null;
  const stockReturn = ((closes[closes.length - 1] / closes[closes.length - 21]) - 1) * 100;
  return +(stockReturn - benchmarkReturn).toFixed(2);
}

module.exports = { atr, adx, mfi, obv, volumePercentile, breakoutFreshness, riskReward, relativeStrength, clamp };
