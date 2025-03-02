import OpenAI from "openai";
import { config } from "dotenv";
import { Candle, TradingStrategyInput,TradingStrategyOutput, Position, limitOrderOutput } from "../types";

config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type AIModel = "ChatGPT" | "GrokAI";

export async function generateTradingStrategy(input: TradingStrategyInput): Promise<TradingStrategyOutput[]> {
  try {
    const {
      token,
      timeframe,
      changePercent,
      currentPrice,
      indicatorDescriptions,
      balanceUSDC,
      openPositions,
      spread,
      aiModel = "ChatGPT", 
      pendingOrders,
    } = input;
    const trendDescription = parseFloat(changePercent) > 0 ? `up ${changePercent}%` : `down ${Math.abs(parseFloat(changePercent))}%`;

    const positionDescription = openPositions?.length
      ? openPositions.map(pos => `${pos.isLong ? "Long" : "Short"}, collateral: ${pos.collateral} USDT, avgPrice: ${pos.avgPrice}, SL: ${pos.SL}, TP: ${pos.TP}, Leverage: ${pos.leverage}`).join("\n")
      : "No open positions.";

    const limitOrderDescription = pendingOrders?.length
      ? pendingOrders.map(lo => `OrderId: ${lo.orderId}, ${lo.isLong ? "Long" : "Short"}, entry: ${lo.entry} USDT, Leverage: ${lo.leverage}`).join("\n")
      : "There are no limit orders.";

      const prompt = `
      You are a professional cryptocurrency trader with many years of experience in derivatives trading. Analyze the pair ${token.replace("_USD", "/USD")} on the ${timeframe} timeframe and come up with the most optimal trading strategy based on the following data:
      
      **Price data:**
      
      - Current price: ${currentPrice}
      - Spread: ${spread}%
      - Trend: price has ${trendDescription}
      
      **Technical indicators:**
      ${indicatorDescriptions}
      
      **Current position:**
      ${positionDescription}
      
      **Limit order:**
      ${limitOrderDescription}
      
      ### Requirements:
      
      1. Choose the most optimal trading action: "buy", "sell", "hold", "cancel orders", or "update TPSL".
      
      2. Explain your trading decision with detailed technical analysis.
      3. If the decision is to "buy" or "sell":
      - Suggest appropriate leverage (3x-150x) and capital ratio to use (0-100%).
      - Determine the entry point (always less than ${currentPrice}), Stop Loss and Take Profit (TP max 890%).
      - Calculate Risk-Reward Ratio (R:R) and explain why it is reasonable.
      4. If the decision is to "cancel orders":
      - List the orderId to cancel and the specific reason.
      5. If the decision is to "update TPSL":
      - Provide the new value of Stop Loss and Take Profit along with the reason for the adjustment.
      6.I have a balance of ${balanceUSDC}.You must calculate so that the order (pay * leverage) must always >300 and pay < ${balanceUSDC}.
        If there is no strategy suitable for the current balance, return the action hold , with the reason
      ⚠️ **Important Note:**
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
      }
      `;
      
    const openaiCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
     response_format: { type: "json_object" },
    });
    const responseText = openaiCompletion.choices[0]?.message?.content || "[]";
    try {
      const parsedResponse = JSON.parse(responseText);
  
      
      const strategies: TradingStrategyOutput[] = Array.isArray(parsedResponse) ? parsedResponse : [parsedResponse];
      // console.log(responseText);
      // console.log(prompt);
      return strategies.filter(strategy =>
        ["buy", "sell", "hold", "cancel orders", "update TPSL"].includes(strategy.action)
      );
  } catch (error) {
      console.error("JSON Parse Error:", error);
      console.error("Raw Response:", responseText);
      throw new Error("Unable to parse JSON from OpenAI");
  }
  
  } catch (error) {
    console.error("Error creating strategy:", error);
    throw new Error("Unable to create trading strategy");
  }
}
