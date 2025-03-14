export interface UserData {
  id: number;
  username: string;
  key: string | null;
  wallet: `0x${string}` | null;
  ai_agent: boolean | null;
  status_ai_agent: boolean | null;
  ai_agent_config: {
    type: "Default" | "Custom"; 
    name: string | null;
    token: string | null;
    indicators: string[] | null;
    ai_model: string | null;
    timeframe: string | null;
  } | null;
  timestamp: number;
  state?: string;
}

export interface WalletData {
  privateKey: string;
  address: string;
}

export interface BalanceResult {
  aptBalance: number;
  usdcBalance?: number;
}

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  size: number;
  avgPrice: number;
  collateral: number;
  isLong: true|false;
  SL: number;
  TP: number;
  leverage: number;
  pair:string;
}
export interface limitOrderOutput {
  orderId: number;
  entry: number;
  isLong: boolean;
  leverage: number;
}
export interface LimitOrderParams {
  privateKey: string;
  pair: string;
  entry: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  pay: number;
  isLong: boolean;
}
export interface OpenOrderParams {
  privateKey: string;
  pair: string;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  pay: number;
  isLong: boolean;
}
export interface closePositionParams {
  privateKey: string;
  pair: string;
  isLong: boolean;
}
export interface TPSLParams {
  privateKey: string;
  pair: string;
  stopLossTriggerPrice: number;
  takeProfitTriggerPrice: number;
  isLong: boolean;
}
export interface TradingStrategyOutput {
  action: "buy" | "sell" | "hold" | "cancel orders"| "update TPSL";
  leverage?: number | null;
  pay?: number | null;
  entryPoint?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  newSL?: number | null;
  newTP?: number | null;
  isLong:boolean ;
  riskRewardRatio?: number | null; 
  orderIds: number[] | null,
  reasoning: string;
}
export interface TradingStrategyInput {
  token: string;
  timeframe: string;
  changePercent: string;
  currentPrice: number;
  indicatorDescriptions: string;
  balanceUSDC: number;
  openPositions: Position[] | null;
  spread: number;
  aiModel?: string; 
  pendingOrders: limitOrderOutput[] | null;
}