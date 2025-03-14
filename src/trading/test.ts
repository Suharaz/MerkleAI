import { fetchMarketData } from "./marketData";
import { calculateIndicators, optimized_calculateIndicators } from "./calcIndicators";
import { generateTradingStrategy } from "./tradingStrategy";
import { getPositionByPair } from '../utils/merkle';
import { UserData, Position, Candle } from "../types";
import { add, fromNumber, MerkleClient, MerkleClientConfig, updateTPSL } from "@merkletrade/ts-sdk";
import util from 'util';
import { fetchAllMarketData } from "../trading/marketCache";
import {
  Account,
  Aptos,
  Ed25519PrivateKey,
  type InputEntryFunctionData,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
 import {openLimitOrder,openMarketOrder,closePosition,setTPSL,cancelOrders,getOrdersByPair} from '../utils/merkle';
 import AptosSingleton from "../utils/aptosClient";
const PRIVATE_KEY = process.env.PRIVATE_KEY;;
import { generateWallet,decryptPrivateKey } from "../utils/wallet";
import TelegramBot from "node-telegram-bot-api";
// import { registerCommands } from "../commands";
// import { registerCallbacks } from "../callbacks";
// import { logMessage } from "../utils/logging";
import { getCachedMarketData } from "../trading/marketCache";
import { initializeTradingSchedules } from "../schedule";

import { executeTradingStrategy } from "../trading/executeTradingStrategy";
import OpenAI from "openai";
import { config } from "dotenv";
// import { Candle, TradingStrategyInput,TradingStrategyOutput, Position, limitOrderOutput } from "../types";
import logger from "../utils/logging";
config();

async function getTradingHistoryByTimeframe(address: `0x${string}`, timeframe: string) {
  const merkle = await AptosSingleton.getMerkleClient();
  const transactions = await merkle.getTradingHistory({ address });

  if (!transactions.length) return { sum: "0.00", win: 0, loss: 0 };

  const tnow = Date.now();
  const timeframes: Record<string, number> = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "1m": 30 * 24 * 60 * 60 * 1000
  };

  let sum = 0, win = 0, loss = 0;
  
  for (const tx of transactions) {
    const pnl = parseFloat(tx.pnlWithoutFee);
    const txTime = new Date(tx.ts).getTime();

    if (pnl !== 0 && (timeframe === "all" || txTime >= tnow - (timeframes[timeframe] || 0))) {
      sum += pnl;
      pnl > 0 ? win++ : loss++;
    }
  }

  return { sum: sum.toFixed(2), win, loss };
}


async function main() {

  const prompt=`You are a professional cryptocurrency trader with many years of experience in derivatives trading. Analyze the pair BTC/USD on the 5m timeframe and come up with the most optimal trading strategy based on the following data:
      
      **Price data:**
      
      - Current price: 82831
      - Spread: 0.001%
      - Trend: price has down 0.1% in 5m
      
      **Technical indicator of the last 50 candles:**
      {"ma10":{"last_value":82795.20799999998,"slope":-23.963999999999942},"ma20":{"last_value":82915.02800000003,"slope":-14.074999999998544},"rsi9":{"last_value":49.86,"slope":1.0130000000000003},"macd_5_13_1":{"macd":{"last_value":-11.566952203473193,"slope":38.09735699744196},"signal":{"last_value":-11.566952203473193,"slope":38.09735699744196},"histogram":{"last_value":0,"slope":0}}}
      
      **Current position:**
      No open positions.
      
      **Limit order:**
      There are no limit orders.
      
      ### Requirements:
      
      1. Choose the most optimal trading action: "buy", "sell", "hold", "cancel orders", or "update TPSL".
      2. Explain your trading decision with detailed technical analysis.
      3. If the decision is to "buy" or "sell":
      - Suggest appropriate leverage (3x-150x).
      - Determine the entry point (always less than 82831), Stop Loss and Take Profit (TP max 890%).
      -Calculate the Risk-Reward Ratio (R:R) and explain why it makes sense as briefly and usefully as possible.
      4. If the decision is to "cancel orders":
      - List the orderId to cancel  and explain why it makes sense as briefly and usefully as possible.
      5. If the decision is to "update TPSL":
      - Provide the new value of Stop Loss and Take Profit along with the reason for the adjustment.
      6. If there is no strategy suitable for the current balance, return the action hold , with the reason

      ⚠️ **Important Note:**
      -Make sure (pay * leverage) >300$ and pay < 1.7$. Use the most reasonable capital level possible
      - The analysis must be logical and use the given data.
      - Can provide 1 or more strategies, as long as it is the most optimal and effective
      - The result must be returned in valid JSON format:
      
      {
      "action": "buy" | "sell" | "hold" | "cancel orders" | "update TPSL",
      "leverage": number | null,
      "pay": number | null,
      "entryPoint": number | null,
      "stopLoss": number | null,
      "takeProfit": number | null,
      "newSL": number | null,
      "newTP": number | null,
      "isLong":
      "riskRewardRatio": number | null,
      "orderIds": number[] | null,
      "reasoning": "string"
      }`
  const openai = new OpenAI({
            apiKey: process.env.GROKAI_API_KEY,
            baseURL: "https://api.x.ai/v1",
        });
  const openaiCompletion = await openai.chat.completions.create({
    model: "grok-2-latest",
    messages: [{ role: "user", content: prompt }],
   response_format: { type: "json_object" },
  });
  // console.log("grock");
  const responseText = openaiCompletion.choices[0]?.message?.content || "[]";
  console.log(responseText);
}

main();
