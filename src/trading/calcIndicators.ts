import { fetchMarketData } from './marketData';
import { Candle } from "../types";
import { maSettings, rsiSettings, macdSettings, bollingerSettings, stochasticSettings, atrSettings } from './settings';
import {
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateATR,
  calculateParabolicSAR,
  calculateIchimokuCloud,
  calculateFibonacciRetracement,
  calculateVolumeProfile,
} from './indicatorUtils';

async function calculateIndicators(timeframe: string, candles: Candle[]): Promise<{ [key: string]: any }[]> {
  // const candles = await fetchMarketData(timeframe, token);
  const indicators: { [key: string]: any }[] = [];

  // Moving Average (MA)
  const maData: { [key: string]: number[] } = {};
  maSettings[timeframe].forEach(period => {
    maData[`ma${period}`] = calculateSMA(candles, period).slice(-50);
  });
  indicators.push({ "Moving Average (MA)": maData });

  // Relative Strength Index (RSI)
  const rsiPeriod = rsiSettings[timeframe];
  indicators.push({ 
    "Relative Strength Index (RSI)": { 
      [`rsi${rsiPeriod}`]: calculateRSI(candles, rsiPeriod).slice(-50) 
    }
  });

  // MACD
  const [fastPeriod, slowPeriod, signalPeriod] = macdSettings[timeframe];
  const macdResult = calculateMACD(candles, fastPeriod, slowPeriod, signalPeriod);
  indicators.push({
    "MACD": {
      [`macd_${fastPeriod}_${slowPeriod}_${signalPeriod}`]: {
        macd: macdResult.macd.slice(-50),
        signal: macdResult.signal.slice(-50),
        histogram: macdResult.histogram.slice(-50),
      }
    }
  });

  // Bollinger Bands
  const [bollingerPeriod, stdDevFactor] = bollingerSettings[timeframe];
  const bbResult = calculateBollingerBands(candles, bollingerPeriod, stdDevFactor);
  indicators.push({
    "Bollinger Bands": {
      [`bollinger_${bollingerPeriod}_${stdDevFactor}`]: {
        middle: bbResult.middle.slice(-50),
        upper: bbResult.upper.slice(-50),
        lower: bbResult.lower.slice(-50),
      }
    }
  });

  // Stochastic Oscillator
  const [kPeriod, dPeriod] = stochasticSettings[timeframe];
  const stochasticResult = calculateStochastic(candles, kPeriod, dPeriod);
  indicators.push({
    "Stochastic Oscillator": {
      [`stochastic_${kPeriod}_${dPeriod}`]: {
        k: stochasticResult.k.slice(-50),
        d: stochasticResult.d.slice(-50),
      }
    }
  });

  // ATR
  const atrPeriod = atrSettings[timeframe];
  indicators.push({
    "ATR": { 
      [`atr${atrPeriod}`]: calculateATR(candles, atrPeriod).slice(-50) 
    }
  });

  // Parabolic SAR
  indicators.push({
    "Parabolic SAR": { 
      sar: calculateParabolicSAR(candles).slice(-50) 
    }
  });

  // Ichimoku Cloud
  const ichimokuResult = calculateIchimokuCloud(candles, 9, 26, 52);
  indicators.push({
    "Ichimoku Cloud": {
      [`ichimoku_${9}_${26}_${52}`]: {
        tenkanSen: ichimokuResult.tenkanSen.slice(-50),
        kijunSen: ichimokuResult.kijunSen.slice(-50),
        senkouSpanA: ichimokuResult.senkouSpanA.slice(-50),
        senkouSpanB: ichimokuResult.senkouSpanB.slice(-50),
        chikouSpan: ichimokuResult.chikouSpan.slice(-50),
      }
    }
  });

  // Volume Profile
  const vpResult = calculateVolumeProfile(candles);
  indicators.push({
    "Volume Profile": {
      volumeProfile: {
        priceLevels: vpResult.priceLevels.slice(-50),
        volumes: vpResult.volumes.slice(-50),
      }
    }
  });

  // Fibonacci Retracement 
  indicators.push({
    "Fibonacci Retracement": { 
      Fibonacci_Retracement: calculateFibonacciRetracement(candles)
    }
  });

  return indicators;
}

export { calculateIndicators };

interface VolumeProfileData {
  priceLevels: number[];
  volumes: number[];
}

interface OptimizedTimeSeries {
  last_value: number;
  slope: number;
}

interface OptimizedVolumeProfile {
  peak_price_level: number;
  mean_price: number;
  total_volume: number;
}

type OptimizedIndicator = {
  [key: string]: {
    [subKey: string]: OptimizedTimeSeries | OptimizedVolumeProfile | { [innerKey: string]: OptimizedTimeSeries } | { [key: string]: number };
  } | any;
};

async function optimized_calculateIndicators(timeframe: string, candles: Candle[]): Promise<OptimizedIndicator[]> {
  const indicators: { [key: string]: any }[] = await calculateIndicators(timeframe, candles); 

  function calculateSlope(values: number[], m: number = 10): number {
    if (values.length < m + 1) return 0;
    const lastValue: number = values[values.length - 1];
    const valueMAgo: number = values[values.length - 1 - m];
    return (lastValue - valueMAgo) / m;
  }

  function optimizeTimeSeries(values: number[]): OptimizedTimeSeries {
    return {
      last_value: values[values.length - 1],
      slope: calculateSlope(values),
    };
  }

  function summarizeVolumeProfile(vp: VolumeProfileData): OptimizedVolumeProfile {
    const maxVolumeIndex: number = vp.volumes.indexOf(Math.max(...vp.volumes));
    const totalVolume: number = vp.volumes.reduce((a: number, b: number) => a + b, 0);
    const meanPrice: number = vp.priceLevels.reduce((sum: number, price: number, i: number) => sum + price * vp.volumes[i], 0) / totalVolume;
    return {
      peak_price_level: vp.priceLevels[maxVolumeIndex],
      mean_price: meanPrice,
      total_volume: totalVolume,
    };
  }

  const optimizedIndicators: OptimizedIndicator[] = indicators.map((indicator: { [key: string]: any }) => {
    const key: string = Object.keys(indicator)[0];
    const data: any = indicator[key];

    if (key === "Volume Profile") {
      return { [key]: { volumeProfile: summarizeVolumeProfile(data.volumeProfile as VolumeProfileData) } };
    } else if (key === "Fibonacci Retracement") {
      return { [key]: data }; 
    } else {
      const optimizedData: { [subKey: string]: any } = {};
      for (const subKey in data) {
        const subData: any = data[subKey];
        if (Array.isArray(subData)) {
          optimizedData[subKey] = optimizeTimeSeries(subData as number[]);
        } else {
          optimizedData[subKey] = {};
          for (const innerKey in subData) {
            optimizedData[subKey][innerKey] = optimizeTimeSeries(subData[innerKey] as number[]);
          }
        }
      }
      return { [key]: optimizedData };
    }
  });

  return optimizedIndicators;
}

export { optimized_calculateIndicators };