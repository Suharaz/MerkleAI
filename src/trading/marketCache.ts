import fs from "fs";
import path from "path";
import { fetchMarketData } from "./marketData";
import { optimized_calculateIndicators } from "./calcIndicators";

const CACHE_DIR = path.join(__dirname, "marketCache");

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

function getCacheFilePath(timeframe: string): string {
    return path.join(CACHE_DIR, `marketCache_${timeframe}.json`);
}

const marketDataCache: Record<string, Record<string, any>> = {};
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


const validTokens = [
    "ETH", "BTC", "APT", "SUI", "TRUMP", "ADA", "XRP",
    "NEIRO", "DOGS", "PNUT", "FLOKI", "BOME", "LTC", "DOGE", "EIGEN", "TAO", "ZRO",
    "OP", "SHIB", "TON", "BONK", "HBAR", "ENA", "W", "PEPE", "LINK", "WIF", "WLD",
    "STRK", "INJ", "JUP", "MANTA", "SEI", "AVAX", "BLUR", "PYTH", "MEME", "TIA",
    "BNB", "MATIC", "SOL", "ARB"
];


export async function fetchAllMarketData(timeframe: string) {
    console.log(`🔄 Get data ${timeframe}...`);

    // Load cache từ file trước khi cập nhật
    loadCacheFromFile(timeframe);

    const marketDataPromises = validTokens.map(async (token) => {
        const marketPair = `${token}_USD`;
        try {
            const candles = await fetchMarketData(timeframe, marketPair);
            if (!candles || candles.length === 0) throw new Error("Data empty");

            // Calc
            const optimizedIndicator = await optimized_calculateIndicators(timeframe, candles);
            const currentPrice = candles[candles.length - 1].close;
            const changePercent = ((currentPrice - candles[0].close) / candles[0].close * 100).toFixed(2);

            // Save RAM cache
            marketDataCache[timeframe][marketPair] = { optimizedIndicator, currentPrice, changePercent };

        } catch (error) {
            console.error(`❌ Lỗi khi fetch ${marketPair}:`);
        }
    });

    await Promise.all(marketDataPromises);
    saveCacheToFile(timeframe);

    console.log(`✅ Save data ${timeframe} !`);
}


export function getCachedMarketData(timeframe: string, marketPair: string) {
    if (!marketDataCache[timeframe]) {
        loadCacheFromFile(timeframe);
    }

    return marketDataCache[timeframe][marketPair] || null;
}

