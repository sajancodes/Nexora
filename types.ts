
export interface Stock {
  Symbol: string;
  Sector?: string;
  LTP: number;
  Change: number;
  Open: number;
  High: number;
  Low: number;
  Volume: number;
  Amount: number;
  Trans?: number;
}

export interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

export interface Transaction {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  orderType?: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number;
  timestamp: number;
}

export interface LimitOrder {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  limitPrice: number;
  createdAt: number;
}

export interface Portfolio {
  balance: number;
  holdings: Holding[];
  history: Transaction[];
  limitOrders?: LimitOrder[];
}

export enum AppTab {
  MARKET = 'MARKET',
  PORTFOLIO = 'PORTFOLIO',
  AI_INSIGHTS = 'AI_INSIGHTS'
}
