import TelegramBot from "node-telegram-bot-api";
import db from "../database/firebase";
import { UserData ,BalanceResult} from "../types";
import { fetchAccountData ,decryptPrivateKey} from "../utils/wallet";
import { getTradingHistoryByTimeframe } from "../utils/merkle";
import { getLeaderboard } from "../utils/leaderBoard";
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

      bot.sendMessage(chatId, "Welcome to  Merkle AI Auto Trading. Use /create_aiagent to get started.");
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
      + `🔒 *Private Key:* \`${decryptPrivateKey(userData.key)}\`\n\n`
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
        bot.sendMessage(chatId, "⚠️You have never created an AI Agent before.");
        return;
    }

    const confirmKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ Yes", callback_data: "confirm_reset_agent" },
                    { text: "❌ Cancel", callback_data: "cancel_reset_agent" }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, "⚠️ *Are you sure you want to delete AI Agent and wallet?* This action cannot be undone!", {
        parse_mode: "Markdown",
        ...confirmKeyboard
    });
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
                        `*/help* - Show this help \n` +
                        `*/start_aiagent* - Start the AI Agent \n` +
                        `*/stop_aiagent* - Stop the AI Agent \n` +
                        `*/roi [timeframe]* - Check PnL and win rate (e.g., /roi 1d for 1-day performance) \n` +
                        `*/leaderboard [timeframe]* - View AI Agent leaderboard (e.g., /leaderboard 7d for 7-day ranking)`;

    try {
      await bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
    } catch (error) {
      await bot.sendMessage(chatId, "⚠️ An error occurred while displaying help. Please try again.!");
    }
  });

// run Ai Agent
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
        message += "💰 Your APT balance is too low. Minimum required: *0.3 APT*\n";
        needsTopUp = true;
      }
      if (usdcBalance === undefined || usdcBalance < 2) {
        message += "💵 Your USDC balance is too low. Minimum required: *2 USDC*\n\nAI Agent works better if you have *more than*10 USDC";
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

// stop Ai Agent
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


// check pnl, win rate
bot.onText(/^\/roi (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const timeframe = match?.[1] as string;

  if (!["7d", "1d", "1m", "all"].includes(timeframe)) {
    bot.sendMessage(chatId, "⚠️ Invalid timeframe! Please use: `/roi 7d`, `/roi 1d`, `/roi 1m`, or `/roi all`.", { parse_mode: "Markdown" });
    return;
  }

  const userRef = db.ref(`users/${chatId}`);
  const snapshot = await userRef.once("value");
  const userData = snapshot.val() as UserData | null;

  if (!userData || !userData.wallet) {
    bot.sendMessage(chatId, "⚠️ You do not have a registered wallet! Use `/wallet` to check.");
    return;
  }

  try {
    const result = await getTradingHistoryByTimeframe(userData.wallet, timeframe);
    
    const roiMessage = `📊 *ROI Report (${timeframe})*\n`
      + `💰 *Total PnL:* \`${result.sum}\` USDC\n`
      + `✅ *Winning Trades:* \`${result.win}\`\n`
      + `❌ *Losing Trades:* \`${result.loss}\`\n`
      + `📈 *Win Rate:* \`${((result.win / (result.win + result.loss)) * 100 || 0).toFixed(2)}%\``;

    bot.sendMessage(chatId, roiMessage, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, "⚠️ An error occurred while fetching ROI data. Please try again.");
  }
});


bot.onText(/^\/leaderboard (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const timeframe = match?.[1] as string;

  if (!["7d", "1d", "1m", "all"].includes(timeframe)) {
      bot.sendMessage(chatId, "⚠️ Invalid timeframe! Please select: `1d`, `7d`, `1m`, `all`.", { parse_mode: "Markdown" });
      return;
  }

  const leaderboard = await getLeaderboard(timeframe);
  if (leaderboard.length === 0) {
      bot.sendMessage(chatId, `⚠️ There is currently no data for the ranking: ${timeframe}.`);
      return;
  }

  let message = `🏆 *AI Agent Ranking by (${timeframe})  Win Rate*\n\n`;
  let userRankMessage = "";

  leaderboard.slice(0, 10).forEach((user, index) => {
      message += `${index + 1}. *${user.username}* - Win Rate: *${user.winRate}%* | PnL: *${user.pnl} USDC*\n`;
  });

  // Find the rank of the user calling the command
  const userRank = leaderboard.findIndex(user => user.chatId === chatId);
  if (userRank >= 10) {
      const user = leaderboard[userRank];
      userRankMessage = `📊 *Your Rank*: #${userRank + 1} | Win Rate: *${user.winRate}%* | PnL: *${user.pnl} USDC*`;
  }

  bot.sendMessage(chatId, `${message}\n${userRankMessage}`, { parse_mode: "Markdown" });
});
};
