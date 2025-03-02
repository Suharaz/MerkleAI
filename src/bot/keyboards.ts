import TelegramBot from "node-telegram-bot-api";

const indicators = [
  "Moving Average (MA)", "Relative Strength Index (RSI)", "MACD",
  "Bollinger Bands", "Stochastic Oscillator", "Fibonacci Retracement",
  "Ichimoku Cloud", "Parabolic SAR", "Volume Profile", "ATR"
];

export const generateIndicatorKeyboard = (chatId: string, userIndicatorSelections: Record<string, Record<string, boolean>>) => {
  if (!userIndicatorSelections[chatId]) {
    userIndicatorSelections[chatId] = {};
  }

  const inlineKeyboard = indicators.map((indicator) => [
    {
      text: `${userIndicatorSelections[chatId][indicator] ? "✅ " : ""}${indicator}`,
      callback_data: `toggle_indicator_${indicator}`,
    },
  ]);

  inlineKeyboard.push([{ text: "👉 Confirm", callback_data: "confirm_indicators" }]);

  return { reply_markup: { inline_keyboard: inlineKeyboard } };
};

export const showIndicatorSelection = (bot: TelegramBot, chatId: string, userIndicatorSelections: Record<string, Record<string, boolean>>) => {
  bot.sendMessage(chatId, "📊 Select up to 3 indicators:", generateIndicatorKeyboard(chatId, userIndicatorSelections));
};

export const showAIModelSelection = (bot: TelegramBot, chatId: string) => {
  const aiModels = ["ChatGPT", "Grok AI", "Gemini", "DeepSeek"];
  const inlineKeyboard = aiModels.map((model) => [
    { text: model, callback_data: `select_ai_model_${model}` },
  ]);

  bot.sendMessage(chatId, "🤖 Choose an AI model:", {
    reply_markup: { inline_keyboard: inlineKeyboard },
  });
};

export const showTimeframeSelection = (bot: TelegramBot, chatId: string) => {
  const timeframes = ["5m", "15m", "30m", "1h", "4h", "1d"];
  const inlineKeyboard = timeframes.map((timeframe) => [
    { text: timeframe, callback_data: `select_timeframe_${timeframe}` },
  ]);

  bot.sendMessage(chatId, "⏳Please select trading time frame:", {
    reply_markup: { inline_keyboard: inlineKeyboard },
  });
};