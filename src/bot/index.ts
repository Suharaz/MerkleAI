import TelegramBot from "node-telegram-bot-api";
import { registerCommands } from "./commands";
import { registerCallbacks } from "./callbacks";
// import { logMessage } from "../utils/logging";
import { initializeTradingSchedules } from "../schedule";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
if (!TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN in .env file");

const bot = new TelegramBot(TOKEN, { polling: true });

registerCommands(bot);
registerCallbacks(bot);
initializeTradingSchedules(bot);
console.log("🚀 Bot is running...");