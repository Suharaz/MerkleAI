import axios from 'axios';
import { Candle } from '../types';
import logger from '../utils/logging';
function isValidBinanceInterval(timeframe: string): boolean {
  const validIntervals = ['5m', '15m', '30m', '1h', '4h', '1d'];
  return validIntervals.includes(timeframe);
}

const convertTokenToBinanceSymbol = (token: string): string => {
    return token.replace("_USD", "USDT").toUpperCase();
  };

export const fetchMarketData = async (timeframe: string, token: string): Promise<Candle[]> => {
  if (!isValidBinanceInterval(timeframe)) {
    throw new Error(`Invalid time frame: ${timeframe}. Must be one of: 5m, 15m, 30m, 1h, 4h, 1d`);
  }

  const symbol = convertTokenToBinanceSymbol(token);

  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol, interval: timeframe, limit: 400 },
    });
    // console.log("Raw data from API:", response.data);

    const candles: Candle[] = response.data.map((kline: any[]) => ({
      openTime: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
    }));

    return candles;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Error while retrieving market data for ${symbol}:`, error.message);
    } else {
      logger.error(`Error while retrieving market data for ${symbol}:`, error);
    }
    throw error;
  }
};