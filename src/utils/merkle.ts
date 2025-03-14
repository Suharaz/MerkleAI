import { calcEntryByPaySize, dec } from "@merkletrade/ts-sdk";
import { Position, LimitOrderParams, OpenOrderParams, closePositionParams, TPSLParams } from "../types";
import AptosSingleton from "../utils/aptosClient";
import { Account, Aptos, Ed25519PrivateKey, PrivateKey, PrivateKeyVariants,Ed25519Account } from "@aptos-labs/ts-sdk";
import logger from "./logging";
// generate account from private key
function getAccountFromPrivateKey(privateKey: string) {
    if (!privateKey) throw new Error("Private Key not provided yet!");
    return Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(privateKey, PrivateKeyVariants.Ed25519))
    });
}

// calc size and collateral
function calculateOrderParams(pay: number, pairInfo: any, pairState: any, leverage: number, isLong: boolean) {
    const n=pay * 10 ** 6
    const paySize = dec<6>(BigInt(Math.floor(n)));
    return calcEntryByPaySize(paySize, leverage, isLong, pairInfo, pairState);
}

// get current position by pair
export async function getPositionByPair(address: `0x${string}`, pair: string): Promise<Position[] | null> {
    try {
        const merkle = await AptosSingleton.getMerkleClient();
        const positions = await merkle.getPositions({ address:address });
        const fullPairType = `0x5ae6789dd2fec1a9ec9cccfb3acaf12e93d432f0a3a42c92fe1a9d490b7bbc06::pair_types::${pair}`;
        
        const filteredPositions: Position[] = positions
            .filter(position => position.pairType === fullPairType)
            .map(position => {
                const leverage = Number(position.size) / Number(position.collateral); 
                return {
                    size: Number((Number(position.size) / 1e6).toFixed(2)),
                    avgPrice: Number((Number(position.avgPrice) / 1e10).toFixed(4)),
                    collateral:  Number((Number(position.collateral) / 1e6).toFixed(2)),
                    isLong: position.isLong ? true : false,
                    SL: Number((Number(position.stopLossTriggerPrice) / 1e10).toFixed(4)),
                    TP: Number((Number(position.takeProfitTriggerPrice) / 1e10).toFixed(4)),
                    leverage: Number(leverage.toFixed(1)),
                    pair: pair
                };
            });
        
        // console.log(filteredPositions);
        return filteredPositions;
    } catch (error) {
        logger.error("Error fetching positions:", error);
        return null;
    }
}

// open limit order
export async function openLimitOrder(params: LimitOrderParams) {
    try {
        const { privateKey, pair, entry, stopLoss, takeProfit, leverage, pay, isLong } = params;
        const merkle = await AptosSingleton.getMerkleClient();
        const aptos = await AptosSingleton.getAptosClient();
        const account = getAccountFromPrivateKey(privateKey);

        const [pairInfo, pairState] = await Promise.all([
            merkle.getPairInfo({ pairId: pair }),
            merkle.getPairState({ pairId: pair })
        ]);
        
        const { collateral, size } = calculateOrderParams(pay, pairInfo, pairState, leverage, isLong);

        const orderParams = {
            pair, isLong, price: BigInt(entry * 10 ** 10),
            sizeDelta: size, collateralDelta: collateral,
            userAddress: account.accountAddress.toString(), isIncrease: true,
            stopLossTriggerPrice: stopLoss ? BigInt(stopLoss * 10 ** 10) : undefined,
            takeProfitTriggerPrice: takeProfit ? BigInt(takeProfit * 10 ** 10) : undefined
        };

        const openLimit = merkle.payloads.placeLimitOrder(orderParams);
        return await executeTransaction(aptos, account, openLimit);
    } catch (error) {
        logger.error("openLimitOrder failed:", error);
        return null;
    }
}

// open market order
export async function openMarketOrder(params: OpenOrderParams) {
    try {
        const { privateKey, pair, stopLoss, takeProfit, leverage, pay, isLong } = params;
        const merkle = await AptosSingleton.getMerkleClient();
        const aptos = await AptosSingleton.getAptosClient();
        const account = getAccountFromPrivateKey(privateKey);

        const [pairInfo, pairState] = await Promise.all([
            merkle.getPairInfo({ pairId: pair }),
            merkle.getPairState({ pairId: pair })
        ]);
        
        const { collateral, size } = calculateOrderParams(pay, pairInfo, pairState, leverage, isLong);
        const orderParams = {
            pair, isLong, sizeDelta: size, collateralDelta: collateral,
            userAddress: account.accountAddress.toString(), isIncrease: true,
            stopLossTriggerPrice: stopLoss ? BigInt(stopLoss * 10 ** 10) : undefined,
            takeProfitTriggerPrice: takeProfit ? BigInt(takeProfit * 10 ** 10) : undefined
        };
        
        const openMarket = merkle.payloads.placeMarketOrder(orderParams);
        return await executeTransaction(aptos, account, openMarket);
    } catch (error) {
        logger.error("openMarketOrder failed:", error);
        return null;
    }
}

// close position
export async function closePosition(params: closePositionParams) {
    try {
        const { privateKey, pair, isLong } = params;
        const merkle = await AptosSingleton.getMerkleClient();
        const aptos = await AptosSingleton.getAptosClient();
        const account = getAccountFromPrivateKey(privateKey);

        const positions = await merkle.getPositions({ address: account.accountAddress.toString() });
        const position = positions.find(p => p.pairType.endsWith(pair) && p.isLong === isLong);
        if (!position) {
            logger.warn(`⚠️No valid position found! Pair: ${pair}, isLong: ${isLong}`);
            return null;
        }
        const orderParams = {
            pair, isLong, sizeDelta: position.size, collateralDelta: position.collateral,
            userAddress: account.accountAddress.toString(), isIncrease: false
        };
        
        const closeOrder = merkle.payloads.placeMarketOrder(orderParams);
        return await executeTransaction(aptos, account, closeOrder);
    } catch (error) {
        logger.error("Close position failed:", error);
        return null;
    }
}

//cancel order
export async function cancelOrders(params: { privateKey: string, pair: string, orderId: number }) {
    try {
        const { privateKey, pair, orderId } = params;
        const merkle = await AptosSingleton.getMerkleClient();
        const aptos = await AptosSingleton.getAptosClient();
        const account = getAccountFromPrivateKey(privateKey);

        const payload = merkle.payloads.cancelOrder({
            pair, userAddress: account.accountAddress.toString(), orderId: BigInt(orderId)
        });
        
        return await executeTransaction(aptos, account, payload);

    } catch (error) {
            logger.error("Close position failed:", error);
            return null;
        }
}

// get order by pair
export async function getOrdersByPair(address: `0x${string}`, pair: string) {
    try {
        const merkle = await AptosSingleton.getMerkleClient();
        const orders = await merkle.getOrders({ address: address });
        const filteredOrders = orders.filter(order => order.pairType.endsWith(pair)).map(order => ({
           orderId: Number(order.orderId),
           entry: Number(order.price) / 1e10,
           isLong: order.isLong,
           leverage: Number(order.sizeDelta) / Number(order.collateralDelta) 
        }));
        return filteredOrders;
    } catch (error) {
        logger.error("Error fetching orders:", error);
        return null;
    }
}

// set TP/SL
export async function setTPSL(params: TPSLParams) {
    try {
        const { privateKey, pair, stopLossTriggerPrice, takeProfitTriggerPrice, isLong } = params;
        const merkle = await AptosSingleton.getMerkleClient();
        const aptos = await AptosSingleton.getAptosClient();
        const account = getAccountFromPrivateKey(privateKey);

        const payload = merkle.payloads.updateTPSL({
            pair,
            userAddress: account.accountAddress.toString(),
            stopLossTriggerPrice: BigInt(stopLossTriggerPrice * 10 ** 10),
            takeProfitTriggerPrice: BigInt(takeProfitTriggerPrice * 10 ** 10),
            isLong
        });
        
        return await executeTransaction(aptos, account, payload);
    } catch (error) {
        logger.error("Set TP/SL failed:", error);
        return null;
    }
}

// send transaction
async function executeTransaction(aptos:Aptos, account:Ed25519Account, payload:any) {
    const transaction = await aptos.transaction.build.simple({ sender: account.accountAddress, data: payload });
    const signedTx = await aptos.signAndSubmitTransaction({ signer: account, transaction });
    return aptos.waitForTransaction({ transactionHash: signedTx.hash });
}

// get History Trading by time
export async function getTradingHistoryByTimeframe(address: `0x${string}`, timeframe: string) {
    try {
        const merkle = await AptosSingleton.getMerkleClient();
        const transactions = await merkle.getTradingHistory({ address });

        
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return { sum: "0.00", win: 0, loss: 0 };
        }
        
        const timeframes: Record<string, number> = {
            "7d": 7 * 24 * 60 * 60 * 1000,
            "1d": 24 * 60 * 60 * 1000,
            "1m": 30 * 24 * 60 * 60 * 1000
        };

        const tnow = Date.now();
        const filterTime = timeframes[timeframe] || 0;
        const validTransactions = transactions.filter(tx => {
            const pnl = parseFloat(tx.pnlWithoutFee);
            const txTime = new Date(tx.ts).getTime();
            return pnl !== 0 && (timeframe === "all" || txTime >= tnow - filterTime);
        });

        const { sum, win, loss } = validTransactions.reduce(
            (acc, tx) => {
                const pnl = parseFloat(tx.pnlWithoutFee);
                acc.sum += pnl;
                pnl > 0 ? acc.win++ : acc.loss++;
                return acc;
            },
            { sum: 0, win: 0, loss: 0 }
        );

        return { sum: sum.toFixed(2), win, loss };
    } catch (error) {
        logger.error("❌ Error while retrieving transaction history:", error);
        return { sum: "0.00", win: 0, loss: 0 };
    }
}

