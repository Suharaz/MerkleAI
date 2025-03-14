import db from "../database/firebase";
import { getCachedMarketData } from "../trading/marketCache";
import { executeTradingStrategy } from "../trading/executeTradingStrategy";
import TelegramBot from "node-telegram-bot-api";
import { decryptPrivateKey } from "../utils/wallet";
import logger from "../utils/logging";

export async function executeTradingForTimeframe(timeframe: string, bot: TelegramBot) {
  try {
    const PQueue = (await import("p-queue")).default; // Dynamic import
    const queue = new PQueue({ concurrency: 5 });

    const usersRef = db.ref("users");
    const snapshot = await usersRef.once("value");
    const users = snapshot.val();

    if (!users) {
      logger.info(`⚠️ No users in timeframe ${timeframe}`);
      return;
    }

    const filteredUsers = Object.entries(users).filter(([_, user]: [string, any]) =>
      user.ai_agent &&
      user.status_ai_agent === true &&
      user.ai_agent_config?.timeframe === timeframe &&
      user.ai_agent_config.token
    );

    if (filteredUsers.length === 0) {
      logger.info(`⚠️ No active AI agents in timeframe ${timeframe}`);
      return;
    }

    const messages: string[] = []; 

    for (const [chatId, user] of filteredUsers) {
      try {
        const token = (user as any).ai_agent_config.token;

        const marketData = getCachedMarketData(timeframe, token);
        if (!marketData || !marketData.optimizedIndicator || !marketData.currentPrice || !marketData.changePercent) {
          messages.push(`⚠️ There is no valid market data for *${token}* (${timeframe}).`);
          continue;
        }

        const { optimizedIndicator, currentPrice, changePercent } = marketData;

        let privateKey: string;
        try {
          privateKey = decryptPrivateKey((user as any).key);
        } catch (error) {
          logger.error(`❌ Error decrypting private key for user${chatId}: ${error}`);
          messages.push(`❌ Error decrypting your private key.`);
          continue;
        }

        queue.add(async () => {
          try {
            const result = await executeTradingStrategy(
              token,
              timeframe,
              currentPrice,
              changePercent,
              optimizedIndicator,
              (user as any).ai_agent_config.indicators || [],
              0.001, // Default spread
              (user as any).ai_agent_config.ai_model || "ChatGPT",
              privateKey,
              (user as any).wallet
            );

            const message = result && result.trim() ? result : "Something went wrong.";
            messages.push(`✅<b>${token}</b> (${timeframe}): ${message}`);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error.";
            messages.push(`❌ Error during transaction <b>${token}</b> (${timeframe})`);
          }
        });
      } catch (error) {
        logger.error(`❌ Error processing user ${chatId} in timeframe${timeframe}:`, error);
      }
    }

    await queue.onIdle();

    if (messages.length > 0) {
      for (const [chatId] of filteredUsers) {
        await bot.sendMessage(chatId, messages.join("\n"), { parse_mode: "HTML" });
      }
    }

    console.log(`✅ Completed all campaigns in timeframe ${timeframe}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(`❌ Error processing timeframe ${timeframe}: ${errorMessage}`);
  }
}
