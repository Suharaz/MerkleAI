import { openLimitOrder, setTPSL, cancelOrders, getOrdersByPair, getPositionByPair } from "../utils/merkle";
import AptosSingleton from "../utils/aptosClient";
import { generateTradingStrategy } from "./tradingStrategy";
import logger from "../utils/logging";

export async function executeTradingStrategy(
  token: string,
  timeframe: string,
  currentPrice: number,
  changePercent: string,
  OptimizedIndicator: any[],
  indicator: any[],
  spread: number,
  aiModel: string,
  privateKey: string,
  address: `0x${string}`
): Promise<string> {
  try {
    const merkle = await AptosSingleton.getMerkleClient();

    const [pendingOrders, openPositions, usdcBalanceRaw] = await Promise.all([
      getOrdersByPair(address, token),
      getPositionByPair(address, token),
      merkle.getUsdcBalance({ accountAddress: address })
    ]);

    const usdcBalance = Number(usdcBalanceRaw) / 10 ** 6;

   
    if (!OptimizedIndicator || OptimizedIndicator.length === 0) {
      logger.error(`⚠️ No indicators found for ${token}`);
      return "null";
    }

    const filteredData = Object.assign({}, ...OptimizedIndicator.map(item =>
      Object.keys(item)
        .filter(key => indicator.includes(key))
        .reduce((acc, key) => ({ ...acc, ...item[key] }), {})
    ));

    let strategies;
    try {
      strategies = await generateTradingStrategy({
        token,
        timeframe,
        changePercent,
        currentPrice,
        indicatorDescriptions: JSON.stringify(filteredData),
        balanceUSDC: usdcBalance,
        openPositions,
        spread,
        aiModel,
        pendingOrders
      });
    } catch (error) {
      logger.error(`❌ Error creating AI strategy for ${token}:`, error);
      return `⚠️ Error creating trading strategy for <b>${token}</b>.`;
    }


    if (!strategies || strategies.length === 0) {

      return `⚠️ AI does not provide any trading strategies for <b>${token}</b> (${timeframe}).`;
    }

    let result = [];
    
    for (const strategy of strategies) {
      try {
        let actionMessage = `<b>Action</b>: `;
        switch (strategy.action) {
          case "buy":
          case "sell":
            if (
              strategy.entryPoint && 
              strategy.stopLoss && 
              strategy.takeProfit && 
              strategy.leverage && 
              strategy.pay
            ) {
              // order opening conditions
              const positionSize = strategy.pay * strategy.leverage;
              if (positionSize <= 300) {
                logger.error(`⚠️ Skip transaction ${strategy.action}  because the order size is too small: ${positionSize} USDC`);
                actionMessage += `Do nothing\n<b>Reason</b>: Order size is too small: ${positionSize} USDC`;
                continue;
              }
              if (strategy.pay >= usdcBalance) {
                logger.error(`⚠️ Skip transaction ${strategy.action}  because the order size is too large: ${strategy.pay} USDC. Available balance: ${usdcBalance} USDC`);
                actionMessage += `Do nothing\n<b>Reason</b>: Order size is too large: ${strategy.pay} USDC. Available balance: ${usdcBalance} USDC`;
                continue;
              }
              if (strategy.leverage > 150) {
                logger.error(`⚠️ Skip transaction ${strategy.action} because leverage is too high: ${strategy.leverage}x`);
                actionMessage += `Do nothing\n<b>Reason</b>: Leverage is too high: ${strategy.leverage}x`;
                continue;
              }
              const tx = await openLimitOrder({
                privateKey,
                pair: token,
                entry: strategy.entryPoint,
                leverage: strategy.leverage,
                isLong: strategy.action === "buy",
                pay: strategy.pay,
                stopLoss: strategy.stopLoss,
                takeProfit: strategy.takeProfit
              });
              if (tx) {
                actionMessage += `${strategy.action.toUpperCase()} order placed for ${token}\n`;
                actionMessage += `<b>Reason</b>: ${strategy.reasoning}\n`;
                actionMessage += `<a href="https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet">View Transaction</a>`;
              }
            }
            break;

          case "hold":
            actionMessage += `Do nothing\n<b>Reason</b>: ${strategy.reasoning}`;
            break;

          case "cancel orders":
            if (strategy.orderIds && strategy.orderIds.length > 0) {
              for (const orderId of strategy.orderIds) {
                const tx = await cancelOrders({ privateKey, pair: token, orderId });
                if (tx) {
                  actionMessage += `Order ${orderId} cancelled for ${token}\n`;
                  actionMessage += `<b>Reason</b>: ${strategy.reasoning}\n`;
                  actionMessage += `<a href="https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet">View Transaction</a>`;
                }
              }
            }
            break;

          case "update TPSL":
            const position = openPositions?.find(p => p.isLong === strategy.isLong);
            if (position) {
              const stopLossTriggerPrice = strategy.newSL ?? position.SL;
              const takeProfitTriggerPrice = strategy.newTP ?? position.TP;

              if (stopLossTriggerPrice !== undefined && takeProfitTriggerPrice !== undefined) {
                const tx = await setTPSL({
                  privateKey,
                  pair: token,
                  stopLossTriggerPrice,
                  takeProfitTriggerPrice,
                  isLong: position.isLong
                });
                if (tx) {
                  actionMessage += `TP/SL updated for ${token}\n`;
                  actionMessage += `<b>Reason</b>: ${strategy.reasoning}\n`;
                  actionMessage += `<a href="https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet">View Transaction</a>`;
                }
              }
            }
            break;

          default:
            actionMessage = `⚠️ Error response from AI Agent, invalid strategy.`;
        }

        if (actionMessage) result.push(actionMessage);
      } catch (error) {
        logger.error(`❌ Error processing trading strategy for ${token}:`, error);
      }
    }

    return result.join("\n\n"); 
  } catch (error) {
    logger.error("❌ Error in executing trading strategy:", error);
    return "⚠️Error in executing trading strategy.";
  }
}
