import { Candle } from '../types';
import { SMA, RSI, MACD, BollingerBands, Stochastic, ATR, PSAR, IchimokuCloud } from 'technicalindicators';

// Define output interfaces
export interface MAOutput { ma: number[]; }
export interface RSIOutput { rsi: number[]; }
export interface MACDOutput { macd: number[]; signal: number[]; histogram: number[]; }
export interface BollingerBandsOutput { middle: number[]; upper: number[]; lower: number[]; }
export interface StochasticOutput { k: number[]; d: number[]; }
export interface ATROutput { atr: number[]; }
export interface ParabolicSAROutput { sar: number[]; }
export interface IchimokuOutput {
  tenkanSen: number[];
  kijunSen: number[];
  senkouSpanA: number[];
  senkouSpanB: number[];
  chikouSpan: number[];
}
export interface FibonacciLevels {
  level0: number;
  level23_6: number;
  level38_2: number;
  level50: number;
  level61_8: number;
  level100: number;
}
export interface VolumeProfileOutput { priceLevels: number[]; volumes: number[]; }

// Helper interface and function
interface CandleData {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
}

function extractCandleData(candles: Candle[]): CandleData {
  return {
    closes: candles.map(c => c.close),
    highs: candles.map(c => c.high),
    lows: candles.map(c => c.low),
    volumes: candles.map(c => c.volume),
  };
}

// Validate candles
function validateCandles(candles: Candle[]): void {
  if (!candles || !Array.isArray(candles)) {
    throw new Error('Invalid candles data.');
  }
  candles.forEach((c, i) => {
    if (c.close === undefined || c.high === undefined || c.low === undefined || c.volume === undefined) {
      throw new Error(`Candle at index ${i} is missing required properties.`);
    }
    if (c.high < c.low) {
      throw new Error(`Invalid candle at index ${i}: high < low.`);
    }
  });
}

// SMA
export function calculateSMA(candles: Candle[], period: number): number[] {
  validateCandles(candles);
  const { closes } = extractCandleData(candles);
  if (closes.length < period) {
    throw new Error(`Not enough data to calculate SMA. Need at least ${period} candles.`);
  }
  return SMA.calculate({ period, values: closes });
}

// RSI
export function calculateRSI(candles: Candle[], period: number): number[] {
  validateCandles(candles);
  const { closes } = extractCandleData(candles);
  if (closes.length < period + 1) {
    throw new Error(`Not enough data to calculate RSI. Need at least ${period + 1} candles.`);
  }
  return RSI.calculate({ period, values: closes });
}

// MACD
export function calculateMACD(candles: Candle[], fastPeriod: number, slowPeriod: number, signalPeriod: number): MACDOutput {
  validateCandles(candles);
  const { closes } = extractCandleData(candles);
  if (closes.length < slowPeriod) {
    throw new Error(`Not enough data to calculate MACD. Need at least ${slowPeriod} candles.`);
  }
  const macd = MACD.calculate({
    fastPeriod,
    slowPeriod,
    signalPeriod,
    values: closes,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  return {
    macd: macd.map(m => m.MACD ?? NaN),
    signal: macd.map(m => m.signal ?? NaN),
    histogram: macd.map(m => m.histogram ?? NaN),
  };
}

// Bollinger Bands
export function calculateBollingerBands(candles: Candle[], period: number, stdDev: number): BollingerBandsOutput {
  validateCandles(candles);
  const { closes } = extractCandleData(candles);
  if (closes.length < period) {
    throw new Error(`Not enough data to calculate Bollinger Bands. Need at least ${period} candles.`);
  }
  const bb = BollingerBands.calculate({ period, stdDev, values: closes });
  return {
    middle: bb.map(b => b.middle ?? NaN),
    upper: bb.map(b => b.upper ?? NaN),
    lower: bb.map(b => b.lower ?? NaN),
  };
}

// Stochastic Oscillator
export function calculateStochastic(candles: Candle[], kPeriod: number, dSmoothing: number): StochasticOutput {
  validateCandles(candles);
  const { highs, lows, closes } = extractCandleData(candles);
  if (closes.length < Math.max(kPeriod, dSmoothing)) {
    throw new Error(`Not enough data to calculate Stochastic Oscillator. Need at least ${Math.max(kPeriod, dSmoothing)} candles.`);
  }
  const stoch = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: kPeriod,
    signalPeriod: dSmoothing,
  });
  return {
    k: stoch.map(s => s.k ?? NaN),
    d: stoch.map(s => s.d ?? NaN),
  };
}

// ATR
export function calculateATR(candles: Candle[], period: number): number[] {
  validateCandles(candles);
  const { highs, lows, closes } = extractCandleData(candles);
  if (closes.length < period + 1) {
    throw new Error(`Not enough data to calculate ATR. Need at least ${period + 1} candles.`);
  }
  return ATR.calculate({ high: highs, low: lows, close: closes, period });
}

// Parabolic SAR
export function calculateParabolicSAR(candles: Candle[], options: { step?: number; max?: number } = { step: 0.02, max: 0.2 }): number[] {
  validateCandles(candles);
  const { highs, lows } = extractCandleData(candles);
  if (highs.length < 2) {
    throw new Error(`Not enough data to calculate Parabolic SAR. Need at least 2 candles.`);
  }
  return PSAR.calculate({ high: highs, low: lows, step: options.step ?? 0.02, max: options.max ?? 0.2 });
}

// Ichimoku Cloud
export function calculateIchimokuCloud(
  candles: Candle[],
  tenkanPeriod = 9,
  kijunPeriod = 26,
  senkouPeriod = 52,
  displacement = 26 
): IchimokuOutput {
  validateCandles(candles);
  const { highs, lows, closes } = extractCandleData(candles);
  if (closes.length < senkouPeriod) {
    throw new Error(`Not enough data to calculate Ichimoku Cloud. Need at least ${senkouPeriod} candles.`);
  }
  const ichimoku = IchimokuCloud.calculate({
    high: highs,
    low: lows,
    conversionPeriod: tenkanPeriod,
    basePeriod: kijunPeriod,
    spanPeriod: senkouPeriod,
    displacement: displacement, 
  });
  const chikouSpan = new Array(closes.length).fill(NaN);
  for (let i = 0; i < closes.length - kijunPeriod; i++) {
    chikouSpan[i] = closes[i + kijunPeriod];
  }
  return {
    tenkanSen: ichimoku.map(i => i.conversion ?? NaN),
    kijunSen: ichimoku.map(i => i.base ?? NaN),
    senkouSpanA: ichimoku.map(i => i.spanA ?? NaN),
    senkouSpanB: ichimoku.map(i => i.spanB ?? NaN),
    chikouSpan: chikouSpan,
  };
}

// Fibonacci Retracement
export function calculateFibonacciRetracement(candles?: Candle[], high?: number, low?: number): FibonacciLevels {
  if (candles && candles.length > 0) {
    validateCandles(candles);
    const { highs, lows } = extractCandleData(candles);
    high = high ?? Math.max(...highs);
    low = low ?? Math.min(...lows);
  }
  if (high === undefined || low === undefined || high <= low) {
    throw new Error('Invalid high and low values for Fibonacci Retracement.');
  }
  const diff = high - low;
  return {
    level0: high,
    level23_6: high - diff * 0.236,
    level38_2: high - diff * 0.382,
    level50: high - diff * 0.5,
    level61_8: high - diff * 0.618,
    level100: low,
  };
}

// Volume Profile
export function calculateVolumeProfile(candles: Candle[], bins = 10): VolumeProfileOutput {
  validateCandles(candles);
  const { highs, lows, closes, volumes } = extractCandleData(candles);
  if (candles.length < 1) {
    throw new Error('Not enough data to calculate Volume Profile. Need at least one candle.');
  }
  const minPrice = Math.min(...lows);
  const maxPrice = Math.max(...highs);
  const range = maxPrice - minPrice || 0.0001;
  const binSize = range / bins;
  const priceLevels: number[] = Array(bins).fill(0).map((_, i) => minPrice + i * binSize + binSize / 2);
  const volumeBins: number[] = Array(bins).fill(0);
  closes.forEach((price, i) => {
    const binIndex = Math.min(Math.floor((price - minPrice) / binSize), bins - 1);
    volumeBins[binIndex] += volumes[i];
  });
  return { priceLevels, volumes: volumeBins };
}