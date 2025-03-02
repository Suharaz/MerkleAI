import TelegramBot from "node-telegram-bot-api";
import db from "../database/firebase";
import { UserData ,BalanceResult} from "../types";
import { fetchAccountData } from "../utils/wallet";

export const registerCommands = (bot: TelegramBot) => {
  bot.onText(/^\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from?.username || "No Username";

    const userRef = db.ref(`users/${chatId}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val() as UserData | null;

    if (!userData || !userData.ai_agent) {
      await userRef.set({
        id: chatId,
        username: userName,
        key: null,
        wallet: null,
        ai_agent: false,
        ai_agent_config: null,
        timestamp: Date.now(),
        state: null,
      });

      bot.sendMessage(chatId, "Welcome to my Merkle AI Trading. Use /create_aiagent to get started.");
    } else {
      bot.sendMessage(chatId, "Welcome back, master!");
    }
  });

  // Command /create_aiagent - Create a new AI Agent
  bot.onText(/\/create_aiagent/, async (msg) => {
    const chatId = msg.chat.id;

    const userRef = db.ref(`users/${chatId}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val() as UserData | null;

    if (!userData) {
      bot.sendMessage(chatId, "⚠️ You have never used a bot before. Type /start please.");
      return;
    }

    if (!userData.ai_agent) {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Use default AI Agent", callback_data: "default_ai" }],
            [{ text: "Custom AI Agent", callback_data: "custom_ai" }],
          ],
        },
      };

      bot.sendMessage(chatId, "Select an option:", options);
    } else {
      bot.sendMessage(chatId, "You already have an AI Agent, you cannot create more.");
    }
  });

  // Command /wallet - View wallet information
  bot.onText(/\/wallet/, async (msg) => {
    const chatId = msg.chat.id;
    const userRef = db.ref(`users/${chatId}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val() as UserData | null;

    if (!userData) {
      bot.sendMessage(chatId, "⚠️ You have not created an account yet. Please use /start.");
      return;
    }

    if (!userData.wallet || !userData.key) {
      bot.sendMessage(chatId, "⚠️ You don't have a wallet yet. Create an AI Agent using /create_aiagent to get a wallet.");
      return;
    }

    const walletInfo = `🔑 *Your wallet information:*\n`
      + `📌 *Wallet address:* \`${userData.wallet}\`\n`
      + `🔒 *Private Key:* \`${userData.key}\`\n\n`
      + `🚨 *Note:* Please keep your private key safe, do not share it with anyone!`;

    bot.sendMessage(chatId, walletInfo, { parse_mode: "Markdown" });
  });

  // Command /info_bot - View AI Agent information
  bot.onText(/\/info_bot/, async (msg) => {
    const chatId = msg.chat.id;
    const userRef = db.ref(`users/${chatId}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val() as UserData | null;

    if (!userData) {
      bot.sendMessage(chatId, "⚠️ You have not created an account yet. Please use /start.");
      return;
    }

    if (!userData.ai_agent || !userData.ai_agent_config) {
      bot.sendMessage(chatId, "⚠️ You have not created an AI Agent yet. Use /create_aiagent to start.");
      return;
    }

    const config = userData.ai_agent_config;
    const tokenDisplay = config.token ? config.token.replace("_USD", " / USD") : "BTC/USD"; 
    const agentStatus = userData.status_ai_agent ? "🟢 *Running*" : "🔴 *Stopped*";
    const info = `🤖 *Your AI Agent Info:*\n`
        + `🔧 *Type:* ${config.type}\n`
        + `📛 *Name:* ${config.name || "Unnamed"}\n`
        + `💰 *Trading Token:* ${tokenDisplay}\n`
        + `📊 *Indicators:* ${config.indicators?.join(", ") || "Secret"}\n`
        + `🧠 *AI Model:* ${config.ai_model || "Secret"}\n`
        + `⏳ *Trading Timeframe:* ${config.timeframe || "Secret"}\n`
        + `🚀 *Status:* ${agentStatus}`;;

    bot.sendMessage(chatId, info, { parse_mode: "Markdown" });
  });

  // Command /reset_agent - Delete current AI Agent and wallet
  bot.onText(/\/reset_agent/, async (msg) => {
    const chatId = msg.chat.id;
    const userRef = db.ref(`users/${chatId}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val() as UserData | null;
  
    if (!userData || !userData.ai_agent) {
      bot.sendMessage(chatId, "⚠️ You do not have an AI Agent to delete!");
      return;
    }
  
    await userRef.update({
      ai_agent: false,
      ai_agent_config: null,
      key: null,
      wallet: null,
      state: null,
    });
  
    bot.sendMessage(chatId, "✅ AI Agent and wallet have been deleted successfully. You can create a new AI Agent using /create_aiagent.");
  });

  // Command /help - Show help
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `📚 *List of commands:* \n` +
                        `*/start* - Initialize account \n` +
                        `*/create_aiagent* - Create new AI Agent \n` +
                        `*/wallet* - View wallet information \n` +
                        `*/info_bot* - View AI Agent information \n` +
                        `*/reset_agent* - Delete current AI Agent \n` +
                        `*/help* - Show this help`;

   

    try {
      await bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
    } catch (error) {
      await bot.sendMessage(chatId, "⚠️ An error occurred while displaying help. Please try again.!");
    }
  });

  bot.onText(/^\/start_aiagent$/, async (msg) => { 
    const chatId = msg.chat.id;
    const userRef = db.ref(`users/${chatId}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val() as UserData | null;
  
    if (!userData || !userData.ai_agent) {
      bot.sendMessage(chatId, "⚠️ You do not have an AI Agent!");
      return;
    }

    // check if AI Agent is already running
    if (userData.status_ai_agent === true) {
      bot.sendMessage(chatId, "🚀 AI Agent is already running!");
      return;
    }
    
    fetchAccountData(userData.wallet).then((result: BalanceResult) => {
      const { aptBalance, usdcBalance } = result;
      let message = "⚠️ *Insufficient Balance*\n";
      let needsTopUp = false;

      if (aptBalance < 0.1) {
        message += "💰 Your APT balance is too low. Minimum required: *0.1 APT*\n";
        needsTopUp = true;
      }
      if (usdcBalance === undefined || usdcBalance < 2) {
        message += "💵 Your USDC balance is too low. Minimum required: *2 USDC*\n";
        needsTopUp = true;
      }

      if (needsTopUp) {
        bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      } else {
        // update status_ai_agent to true
        userRef.update({ status_ai_agent: true });
        bot.sendMessage(chatId, "🚀 AI Agent has been started successfully!");
      }
    }).catch((error) => {
      bot.sendMessage(chatId, "⚠️ An error occurred while fetching account data. Please try again.");
    });
});
bot.onText(/^\/stop_aiagent$/, async (msg) => { 
  const chatId = msg.chat.id;
  const userRef = db.ref(`users/${chatId}`);
  const snapshot = await userRef.once("value");
  const userData = snapshot.val() as UserData | null;

  if (!userData || !userData.ai_agent) {
    bot.sendMessage(chatId, "⚠️ You do not have an AI Agent!");
    return;
  }

  if (userData.status_ai_agent === false) {
    bot.sendMessage(chatId, "🚀 No AI Agent is running!");
    return;
  }
  else{
  userRef.update({ status_ai_agent: false });
  bot.sendMessage(chatId, "🚀 Stop AI Agent successfully!");
  }
});
};
