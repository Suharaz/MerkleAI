import cron from "node-cron";
import { executeTradingForTimeframe } from "./jobRunner";
import { fetchAllMarketData } from "../trading/marketCache";
import TelegramBot from "node-telegram-bot-api";

export function startScheduler(bot: TelegramBot) {
    const scheduleMap = [
        { timeframe: "5m", cron: "*/5 * * * *" },
        { timeframe: "1h", cron: "0 */1 * * *" },
        { timeframe: "4h", cron: "0 */4 * * *" },
        { timeframe: "1d", cron: "0 0 * * *" },
    ];

    scheduleMap.forEach(({ timeframe, cron: cronTime }) => {
        cron.schedule(cronTime, async () => {
            console.log(`🔄 Updating market data (${timeframe})...`);
            await fetchAllMarketData(timeframe); // Lấy dữ liệu trước

            console.log(`🚀 Execute trading campaign for timeframe${timeframe}`);
            await executeTradingForTimeframe(timeframe, bot); // Thực thi chiến lược sau
        });
    });

    console.log("✅Campaign execution schedule has been set!");
}

