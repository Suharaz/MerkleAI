import TelegramBot from "node-telegram-bot-api";
import db from "../database/firebase";
import { UserData } from "../types";
import { generateWallet ,decryptPrivateKey} from "../utils/wallet";
import logger from "../utils/logging";
import { showIndicatorSelection, showAIModelSelection, showTimeframeSelection, generateIndicatorKeyboard } from "./keyboards";

interface UserIndicatorSelections {
  [chatId: string]: { [indicator: string]: boolean };
}

const userIndicatorSelections: UserIndicatorSelections = {};

const validTokens = [
  "ETH", "BTC", "APT", "SUI", "TRUMP", "ADA", "XRP",
  "NEIRO", "DOGS", "PNUT", "FLOKI", "BOME", "LTC", "DOGE", "EIGEN", "TAO", "ZRO",
  "OP", "SHIB", "TON", "BONK", "HBAR", "ENA", "W", "PEPE", "LINK", "WIF", "WLD",
  "STRK", "INJ", "JUP", "MANTA", "SEI", "AVAX", "BLUR", "PYTH", "MEME", "TIA",
  "BNB", "MATIC", "SOL", "ARB"
];

function sanitizeInput(input: string): string {
  const regex = /[^\p{L}\p{N}\s\p{Extended_Pictographic}]/gu; 
  return input.replace(regex, "").trim();
}

export const registerCallbacks = (bot: TelegramBot) => {
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id.toString() || "";
    const messageId = query.message?.message_id;
    const userRef = db.ref(`users/${chatId}`);

    if (!chatId || !messageId) return;

    try {
      if (query.data === "default_ai") {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
        await bot.sendMessage(chatId, "🔧 Please enter a name for your AI Agent:");
        await userRef.update({ state: "waiting_for_name_default" });
      } else if (query.data === "custom_ai") {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
        await bot.sendMessage(chatId, "🔧 Please enter a name for your AI Agent:");
        await userRef.update({ state: "waiting_for_name_custom" });
      } else if (query.data?.startsWith("toggle_indicator_")) {
        const indicator = query.data.replace("toggle_indicator_", "");

        if (!userIndicatorSelections[chatId]) {
          userIndicatorSelections[chatId] = {};
        }

        const selectedCount = Object.values(userIndicatorSelections[chatId]).filter(Boolean).length;

        if (userIndicatorSelections[chatId][indicator]) {
          userIndicatorSelections[chatId][indicator] = false;
        } else {
          if (selectedCount >= 4) {
            bot.answerCallbackQuery(query.id, { text: "❌ You can only select up to 4 indicators!", show_alert: true });
            return;
          }
          userIndicatorSelections[chatId][indicator] = true;
        }

        bot.editMessageReplyMarkup(generateIndicatorKeyboard(chatId, userIndicatorSelections).reply_markup, {
          chat_id: chatId,
          message_id: messageId,
        });
      } else if (query.data === "confirm_indicators") {
        const selectedIndicators = Object.keys(userIndicatorSelections[chatId]).filter(
          (indicator) => userIndicatorSelections[chatId][indicator]
        );

        if (selectedIndicators.length === 0) {
          bot.answerCallbackQuery(query.id, { text: "❌ You need to select at least 1 indicator!", show_alert: true });
          return;
        }

        const snapshot = await userRef.once("value");
        const userData = snapshot.val() as UserData;
        const updatedConfig = {
          ...userData.ai_agent_config,
          indicators: selectedIndicators,
        };

        await userRef.update({ ai_agent_config: updatedConfig, state: "waiting_for_ai_model" });

        await bot.deleteMessage(chatId, messageId);
        await bot.sendMessage(chatId, `✅ List of indicators you choose: ${selectedIndicators.join(", ")}`);
        delete userIndicatorSelections[chatId];
        showAIModelSelection(bot, chatId);
      } else if (query.data?.startsWith("select_ai_model_")) {
        const selectedModel = query.data.replace("select_ai_model_", "");

        const snapshot = await userRef.once("value");
        const userData = snapshot.val() as UserData;
        const updatedConfig = {
          ...userData.ai_agent_config,
          ai_model: selectedModel,
        };

        await userRef.update({ ai_agent_config: updatedConfig, state: "waiting_for_timeframe" });

        await bot.deleteMessage(chatId, messageId);
        await bot.sendMessage(chatId, `✅ You have selected the AI ​​model: ${selectedModel}`);
        showTimeframeSelection(bot, chatId);
      } else if (query.data?.startsWith("select_timeframe_")) {
        const selectedTimeframe = query.data.replace("select_timeframe_", "");

        const snapshot = await userRef.once("value");
        const userData = snapshot.val() as UserData;
        const updatedConfig = {
          ...userData.ai_agent_config,
          timeframe: selectedTimeframe,
        };

        const wallet = generateWallet();

        await userRef.update({
          ai_agent_config: updatedConfig,
          key: wallet.privateKey,
          wallet: wallet.address,
          state: null,
        });

        await bot.deleteMessage(chatId, messageId);
        await bot.sendMessage(chatId, `✅ You have selected the trading time frame as ${selectedTimeframe}`);

        const walletInfo = `🎉 <b>AI Agent has been created successfully!</b>\n\n`
          + `🔑 <b>Your wallet has been created!</b>\n`
          + `📌 <b>Address:</b> <code>${wallet.address}</code>\n`
          + `🔒 <b>Private Key:</b> <code>${decryptPrivateKey(wallet.privateKey)}</code>\n\n`
          + `🎮 Use the <b>/start_aiagent</b> command to run your AI Agent\n`
          + `🚨 <b>Note:</b> Please backup your private key, do not share with anyone`;


          await bot.sendMessage(chatId, walletInfo, { parse_mode: "HTML" });
      } else if (query.data === "confirm_reset_agent"){
        await userRef.update({
          ai_agent: false,
          ai_agent_config: null,
          key: null,
          wallet: null,
          state: null,
      });

      await bot.editMessageText("✅ AI Agent and wallet have been deleted successfully! You can create a new AI Agent using the /create_aiagent command.", {
          chat_id: chatId,
          message_id: messageId
      });

      } else if (query.data === "cancel_reset_agent"){
        await bot.editMessageText("🚫 Cancels deletion of AI Agent. No changes are made.", {
          chat_id: chatId,
          message_id: messageId
      });
      }

      bot.answerCallbackQuery(query.id);
    } catch (error) {
      logger.error("Error in callback:", error);
      bot.sendMessage(chatId, "⚠️ An error occurred. Please contact Admin");
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id.toString();
    const userRef = db.ref(`users/${chatId}`);
    try {
      const snapshot = await userRef.once("value");
      const userData = snapshot.val() as UserData | null;

      if (!userData) return;

      if (userData.state === "waiting_for_name_default" || userData.state === "waiting_for_name_custom") {
        const sanitizedName = sanitizeInput(msg.text!);
        if (userData.state === "waiting_for_name_default") {
          const wallet = generateWallet();
          await userRef.update({
            ai_agent: true,
            ai_agent_config: {
              name: sanitizedName,
              type: "Default",
              token: "BTC_USD",
              indicators: ["Moving Average (MA)", "Relative Strength Index (RSI)", "MACD","ATR"],
              ai_model: "ChatGPT",
              timeframe: "1h",
            },
            key: wallet.privateKey,
            wallet: wallet.address,
            state: null,
          });

          const walletInfo = `🎉 <b>AI Agent has been created successfully!</b>\n\n`
          + `🔑 <b>Your wallet has been created!</b>\n`
          + `📌 <b>Address:</b> <code>${wallet.address}</code>\n`
          + `🔒 <b>Private Key:</b> <code>${decryptPrivateKey(wallet.privateKey)}</code>\n\n`
          + `🎮 Use the <b>/start_aiagent</b> command to run your AI Agent\n`
          + `🚨 <b>Note:</b> Please backup your private key, do not share with anyone`;


          await bot.sendMessage(chatId, walletInfo, { parse_mode: "HTML" });
        } else if (userData.state === "waiting_for_name_custom") {
          await userRef.update({
            ai_agent: true,
            ai_agent_config: {
              name: sanitizedName,
              type: "Custom",
              token: null,
              indicators: [],
              ai_model: null,
              timeframe: null,
            },
            state: "waiting_for_token",
          });

          await bot.sendMessage(chatId, `⌨ Please enter token (eg: BTC, ETH, APT):`, { parse_mode: "Markdown" });
        }
      } else if (userData.state === "waiting_for_token") {
        const inputToken = msg.text!.toUpperCase();

        if (!validTokens.includes(inputToken)) {
          await bot.sendMessage(chatId, `⚠️ Token *${inputToken}* is invalid! Please re-enter (eg: BTC, ETH, APT):`, { parse_mode: "Markdown" });
          return;
        }
        const fullToken = `${inputToken}_USD`;

        const updatedConfig = {
          ...userData.ai_agent_config,
          token: fullToken,
        };

        await userRef.update({
          ai_agent_config: updatedConfig,
          state: "waiting_for_indicators",
        });

        await bot.sendMessage(chatId, `✅ You have selected token: *${inputToken} / USD*. Now select indicator.`, { parse_mode: "Markdown" });
        showIndicatorSelection(bot, chatId, userIndicatorSelections);
      }
    } catch (error) {
      logger.error("Error processing message:", error);
      await bot.sendMessage(chatId, "⚠️ An error occurred. Please try again later!");
    }
  });
};