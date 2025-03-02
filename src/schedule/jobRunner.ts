import db from "../database/firebase";
import { getCachedMarketData } from "../trading/marketCache";
import { executeTradingStrategy } from "../trading/executeTradingStrategy";
import TelegramBot from "node-telegram-bot-api";
import { decryptPrivateKey } from "../utils/wallet";

export async function executeTradingForTimeframe(timeframe: string, bot: TelegramBot) {
  try {
    const PQueue = (await import("p-queue")).default; // Dynamic import
    const queue = new PQueue({ concurrency: 5 });

    const usersRef = db.ref("users");
    const snapshot = await usersRef.once("value");
    const users = snapshot.val();

    if (!users) {
      console.log(`⚠️ No users in time frame ${timeframe}`);
      return;
    }

    for (const chatId in users) {
      const user = users[chatId];
      if (
        user.ai_agent &&
        user.status_ai_agent === true &&
        user.ai_agent_config?.timeframe === timeframe
      ) {
        const token = user.ai_agent_config.token;
        if (!token) continue;

        // Get data
        const { optimizedIndicator, currentPrice, changePercent } = getCachedMarketData(timeframe, token);

        // Get other parameters from db
        const indicators = user.ai_agent_config.indicators || [];
        const aiModel = user.ai_agent_config.ai_model || "ChatGPT";
        const encryptedKey = user.key;
        const address = user.wallet;
        const spread = 0.001;

        let privateKey: string;
        try {
          privateKey = decryptPrivateKey(encryptedKey);
        } catch (error) {
          console.error(`❌ Error decrypting private key for user ${chatId}: ${error}`);
          await bot.sendMessage(
            chatId,
            `❌ Unable to decrypt your private key. Please check your wallet configuration.`,
            { parse_mode: "HTML" }
          );
          continue;
        }

        // Add task to queue
        queue.add(async () => {
          try {
            const result = await executeTradingStrategy(
              token,
              timeframe,
              currentPrice,
              changePercent,
              optimizedIndicator,
              indicators,
              spread,
              aiModel,
              privateKey,
              address
            );
            // Đảm bảo result luôn có nội dung
            const message = result && result.trim() ? result : "Campaign executed but no details provided.";
            console.log(`✅ Executed campaign for user ${chatId} in timeframe ${timeframe}: ${message}`);
            await bot.sendMessage(chatId, `✅ ${message}`, { parse_mode: "HTML" });

          } catch (error) {
            // Xử lý lỗi và đảm bảo tin nhắn không rỗng
            const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred";
            await bot.sendMessage(
              chatId,
              `❌ An error occurred while executing the trading campaign for *${token}* in timeframe *${timeframe}*: ${errorMessage}`,
              { parse_mode: "Markdown" }
            );
          }
        });
      }
    }

    await queue.onIdle();
    console.log(`✅ Completed all campaigns within timeframe ${timeframe}`);
  } catch (error) {
    const errorMessage = (error instanceof Error) ? error.message : "Unknown error";
    console.error(`❌ Error processing timeframe ${timeframe}: ${errorMessage}`);
  }
}