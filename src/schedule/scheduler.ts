import cron from "node-cron";
import { executeTradingForTimeframe } from "./jobRunner";
import { fetchAllMarketData } from "../trading/marketCache";
import {updateLeaderboard} from "../utils/leaderBoard";
import TelegramBot from "node-telegram-bot-api";
import logger from "../utils/logging";
export async function executeInOrder(bot: TelegramBot, timeframe: string) {
    logger.info(`🔄 Updating market data (${timeframe})...`);
    await fetchAllMarketData(timeframe);

    logger.info(`🔄 Execute trading campaign for timeframe ${timeframe}`);
    await executeTradingForTimeframe(timeframe, bot);
}

export function startScheduler(bot: TelegramBot) {
    cron.schedule("0 0 * * *", async () => { 
        await executeInOrder(bot, "1d");
        await executeInOrder(bot, "4h");
        await executeInOrder(bot, "1h");
        await executeInOrder(bot, "5m");
        logger.info("🔄 Updating rankings...");
        await updateLeaderboard();
        logger.info("✅ The leaderboard update schedule is set!");
    });

    cron.schedule("0 */4 * * *", async () => { 
        await executeInOrder(bot, "4h");
        await executeInOrder(bot, "1h");
        await executeInOrder(bot, "5m");
    });

    cron.schedule("0 */1 * * *", async () => { 
        await executeInOrder(bot, "1h");
        await executeInOrder(bot, "5m");
    });

    cron.schedule("*/5 * * * *", async () => { 
        await executeInOrder(bot, "5m");
    });

    console.log("✅ Campaign execution schedule with priority order has been set!");
}