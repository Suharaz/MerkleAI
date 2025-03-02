import { openLimitOrder,setTPSL, cancelOrders,getOrdersByPair ,getPositionByPair} from "../utils/merkle";
import AptosSingleton from "../utils/aptosClient";
import { generateTradingStrategy } from "./tradingStrategy";

export async function executeTradingStrategy(
  token: string,
  timeframe: string,
  currentPrice:number,
  changePercent:string,
  OptimizedIndicator:any[],
  indicator: any[],
  spread: number,
  aiModel: string,
  privateKey: string,
  address: `0x${string}`
): Promise<any> {
  try {
    const merkle = await AptosSingleton.getMerkleClient();
    const pendingOrders=await getOrdersByPair(address,token)
    const openPositions=await getPositionByPair(address,token)
    const usdcBalance = await merkle.getUsdcBalance({accountAddress: address});
    const filteredData = OptimizedIndicator.reduce((acc, item) => {
      Object.keys(item).forEach(key => {
        if (indicator.includes(key)) {
          acc = { ...acc, ...item[key] };
        }
      });
      return acc;
    }, {});
    const indicatorDescriptions = JSON.stringify(filteredData);
    const strategies = await generateTradingStrategy({
      token: token,
      timeframe: timeframe,
      changePercent: changePercent,
      currentPrice: currentPrice,
      indicatorDescriptions: indicatorDescriptions,
      balanceUSDC: (Number(usdcBalance)/10**6),
      openPositions: openPositions,
      spread: spread,
      aiModel: aiModel, 
      pendingOrders: pendingOrders
    })
    console.log(strategies);
    let result = "";
    for (const strategy of strategies) {
      // console.log(`Strategy execution: ${strategy.action}`);
      switch (strategy.action) {
        case "buy":
          if (strategy.entryPoint && strategy.stopLoss && strategy.takeProfit && strategy.leverage && strategy.pay) {
            const tx = await openLimitOrder({
              privateKey,
              pair: token,
              entry: strategy.entryPoint,
              leverage: strategy.leverage,
              isLong: true,
              pay: strategy.pay,
              stopLoss: strategy.stopLoss,
              takeProfit: strategy.takeProfit
            });
            
            // console.log(`Buy order placed successfully ${token}, ${strategy.reasoning}`);
            if (tx) {
              result+=`<b>Action</b>: Buy order placed for ${token}\n<b>Reason</b>:  ${strategy.reasoning}\n<a href="https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet">View Transaction</a>`;
            }
          }
          break;

        case "sell":
          if (strategy.entryPoint && strategy.stopLoss && strategy.takeProfit && strategy.leverage && strategy.pay) {
            const tx = await openLimitOrder({
              privateKey,
              pair: token,
              entry: strategy.entryPoint,
              leverage: strategy.leverage,
              isLong: false,
              pay: strategy.pay,
              stopLoss: strategy.stopLoss,
              takeProfit: strategy.takeProfit
            });
            if (tx) {
              result+=`<b>Action</b>: Sell order placed for ${token}\n<b>Reason</b>:  ${strategy.reasoning}\n<a href="https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet">View Transaction</a>`;
            }
          }
          break;

        case "hold":
          result+=`<b>Action</b>: Do nothing\n<b>Reason</b>:  ${strategy.reasoning}`;
          break;

        case "cancel orders":
          if (strategy.orderIds && strategy.orderIds.length > 0) {
            for (const orderId of strategy.orderIds) {
              const tx = await cancelOrders({ privateKey, pair: token, orderId });
              if (tx) {
                result+=`<b>Action</b>: Order ${orderId} cancelled for ${token}\n<b>Reason</b>:  ${strategy.reasoning}\n<a href="https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet">View Transaction</a>`;
              }
            }
          }
          break;

        case "update TPSL":
          if (strategy.newSL !== null || strategy.newTP !== null) {
            const position = openPositions?.find(p => p.isLong === strategy.isLong);
            if (position) {
              const stopLossTriggerPrice = strategy.newSL !== null ? strategy.newSL : position.SL;
              const takeProfitTriggerPrice = strategy.newTP !== null ? strategy.newTP : position.TP;

              if (stopLossTriggerPrice !== undefined && takeProfitTriggerPrice !== undefined) {
                const tx = await setTPSL({
                  privateKey,
                  pair: token,
                  stopLossTriggerPrice,
                  takeProfitTriggerPrice,
                  isLong: position.isLong,
                });
                if (tx) {
                  result+=`<b>Action</b>: TP/SL updated for ${token}\n<b>Reason</b>:  ${strategy.reasoning}\n<a href="https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet">View Transaction</a>`;           
                }
              } else {
                result+=`<b>Action</b>: Failed to update TP/SL for ${token} | No valid SL/TP values\n<b>Reason</b>:  ${strategy.reasoning}`;
              }
            } else {
              result+=`<b>Action</b>: No open position found for ${token} to update TP/SL | No valid SL/TP values\n<b>Reason</b>:  ${strategy.reasoning}`;
            }
          }
          break;
        default:
          result += `There is some problem with the response from the AI ​​Agent. Hopefully it will fix itself soon`;
      }
    }
    return result ;
  } catch (error) {
    console.error("Error in executing trading strategy:", error);
    throw new Error("Transaction cannot be performed.");
  }
}

