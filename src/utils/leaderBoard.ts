import db from "../database/firebase";
import { getTradingHistoryByTimeframe } from "./merkle";
import logger from "./logging";
export async function updateLeaderboard() {
    try {
        const usersSnapshot = await db.ref("users").once("value");
        const users = usersSnapshot.val();

        if (!users) return;

        const updates: any = {};
        const timeframes = ["7d", "1d", "1m", "all"]; 

        for (const chatId in users) {
            const user = users[chatId];
            if (!user.wallet || !user.ai_agent) continue;

            for (const timeframe of timeframes) {
                const result = await getTradingHistoryByTimeframe(user.wallet, timeframe);
                
                updates[`leaderboard/${timeframe}/${chatId}`] = {
                    username: user.ai_agent_config.name,
                    pnl: result.sum,
                    win_rate: ((result.win / (result.win + result.loss)) * 100 || 0).toFixed(2),
                };
            }
        }

        await db.ref().update(updates);
        logger.info("✅ The ranking has been updated.");
    } catch (error) {
        logger.error("❌ The ranking has been updated:", error);
    }
}

export async function getLeaderboard(timeframe: string) {
    try {
        const snapshot = await db.ref(`leaderboard/${timeframe}`).once("value");
        const leaderboard = snapshot.val();

        if (!leaderboard) return [];

        return Object.entries(leaderboard)
            .map(([chatId, data]: any) => ({
                chatId,
                username: data.username,
                pnl: parseFloat(data.pnl),
                winRate: parseFloat(data.win_rate),
            }))
            .sort((a, b) => b.winRate - a.winRate || b.pnl - a.pnl);
    } catch (error) {
        logger.error("❌ Error while getting ranking:", error);
        return [];
    }
}
