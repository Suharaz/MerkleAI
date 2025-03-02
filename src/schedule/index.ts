import { startScheduler } from "./scheduler";
import TelegramBot from "node-telegram-bot-api";
export function initializeTradingSchedules(bot: TelegramBot) {
    console.log("🚀 Starting trading schedule...");
   
    startScheduler(bot); 
    
}