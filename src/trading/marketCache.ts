import fs from "fs";
import path from "path";
import { fetchMarketData } from "./marketData"; 
import { optimized_calculateIndicators } from "./calcIndicators";
import logger from "../utils/logging"; 


const validTokens = [
    "ETH", "BTC", "APT", "SUI", "TRUMP", "ADA", "XRP",
    "NEIRO", "DOGS", "PNUT", "FLOKI", "BOME", "LTC", "DOGE", "EIGEN", "TAO", "ZRO",
    "OP", "SHIB", "TON", "BONK", "HBAR", "ENA", "W", "PEPE", "LINK", "WIF", "WLD",
    "STRK", "INJ", "JUP", "MANTA", "SEI", "AVAX", "BLUR", "PYTH", "MEME", "TIA",
    "BNB", "MATIC", "SOL", "ARB"
];

const CACHE_DIR = path.join(__dirname, "marketCache");
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}


const marketDataCache: Record<string, Record<string, any>> = {};

function getCacheFilePath(timeframe: string): string {
    return path.join(CACHE_DIR, `marketCache_${timeframe}.json`);
}


function loadCacheFromFile(timeframe: string) {
    const cacheFile = getCacheFilePath(timeframe);
    if (fs.existsSync(cacheFile)) {
        const rawData = fs.readFileSync(cacheFile, "utf-8");
        marketDataCache[timeframe] = JSON.parse(rawData);
    } else {
        marketDataCache[timeframe] = {};
    }
}


function saveCacheToFile(timeframe: string) {
    const cacheFile = getCacheFilePath(timeframe);
    fs.writeFileSync(cacheFile, JSON.stringify(marketDataCache[timeframe], null, 2));
}


async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMin: number = 10,
    delayMax: number = 20
): Promise<T> {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await operation(); 
        } catch (error) {
            retries++;
            if (retries >= maxRetries) {
                throw error; 
            }
           
            const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
            await new Promise(resolve => setTimeout(resolve, delay * 1000)); 
        }
    }
    throw new Error("Max retries reached");
}


export async function fetchAllMarketData(timeframe: string, baseCurrency: string = "USD") {
    if (!timeframe || typeof timeframe !== "string") {
        throw new Error("Invalid timeframe provided");
    }

    // console.log(`🔄 Fetching data for ${timeframe}...`);
    loadCacheFromFile(timeframe);

    const batchSize = 10; 
    for (let i = 0; i < validTokens.length; i += batchSize) {
        const batch = validTokens.slice(i, i + batchSize);
        const marketDataPromises = batch.map(async (token) => {
            const marketPair = `${token}_${baseCurrency}`;
            try {
                
                const candles = await retryOperation(
                    () => fetchMarketData(timeframe, marketPair),
                    3,  
                    10, 
                    20  
                );

                if (!Array.isArray(candles) || candles.length < 2 || !candles[candles.length - 1]?.close) {
                    throw new Error("Invalid candles data");
                }

                const optimizedIndicator = await optimized_calculateIndicators(timeframe, candles);
                const currentPrice = candles[candles.length - 1].close;
                const previousPrice = candles[candles.length - 2].close;
                const changePercent = ((currentPrice - previousPrice) / previousPrice * 100).toFixed(2);

                // Lưu vào cache
                marketDataCache[timeframe][marketPair] = { optimizedIndicator, currentPrice, changePercent };
                logger.info(`✅ Successfully fetched and processed ${marketPair}`);
            } catch (error) {
                logger.error(`❌ Failed to fetch ${marketPair} after 3 retries: ${error}`);
                marketDataCache[timeframe][marketPair] = {};
            }
        });

        await Promise.all(marketDataPromises);
    }

    saveCacheToFile(timeframe);
    logger.info(`✅ Saved data for ${timeframe} to cache!`);
}


export function getCachedMarketData(timeframe: string, marketPair: string) {
    if (!marketDataCache[timeframe]) {
        loadCacheFromFile(timeframe);
    }
    return marketDataCache[timeframe][marketPair] || null;
}


// fetchAllMarketData("4h").then(() => console.log("Done"));