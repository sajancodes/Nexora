import { Stock } from '../types';

export interface HistoricalCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  percentChange: number;
}

export interface MarketSnapshotResponse {
  stocks: (Stock & { isLiveSynced?: boolean; updatedAt?: number })[];
  focus: {
    symbol: string;
    candles: HistoricalCandle[];
  } | null;
  syncedCount: number;
  totalCount: number;
  serverTime: number;
}

export interface FullSyncResponse {
  success: boolean;
  count: number;
  stocks: (Stock & { isLiveSynced?: boolean })[];
  rtdbBatch: Record<string, {
    ltp: number;
    open: number;
    high: number;
    low: number;
    change: number;
    volume: number;
    amount: number;
    updatedAt: number;
  }>;
  syncedAt: number;
}

/**
 * Fetches the rate-limit-safe server-cached NEPSE market snapshot,
 * including real historical OHLCV candles for the focused symbol.
 */
export async function fetchMarketSnapshot(focusSymbol?: string): Promise<MarketSnapshotResponse | null> {
  try {
    const query = focusSymbol ? `?focus=${encodeURIComponent(focusSymbol.trim().toUpperCase())}` : '';
    const res = await fetch(`/api/nepse/market${query}`, { method: 'GET' });
    if (!res.ok) return null;
    return (await res.json()) as MarketSnapshotResponse;
  } catch (err) {
    console.error('[API ERROR] fetchMarketSnapshot:', err);
    return null;
  }
}

/**
 * Warms all 93 symbols in the server cache and returns a single consolidated batch object
 * so the client can push all 93 stocks to Firebase RTDB in a single atomic write.
 */
export async function syncAllMarketCache(): Promise<FullSyncResponse | null> {
  try {
    const res = await fetch('/api/nepse/sync-all', { method: 'POST' });
    if (!res.ok) return null;
    return (await res.json()) as FullSyncResponse;
  } catch (err) {
    console.error('[API ERROR] syncAllMarketCache:', err);
    return null;
  }
}

/**
 * Fetches real historical OHLCV candles for a single NEPSE symbol.
 */
export async function fetchSymbolHistory(symbol: string): Promise<HistoricalCandle[]> {
  try {
    const cleanSymbol = symbol.trim().toUpperCase();
    const res = await fetch(`/api/nepse/history?symbol=${encodeURIComponent(cleanSymbol)}`, { method: 'GET' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.candles) ? data.candles : [];
  } catch (err) {
    console.error('[API ERROR] fetchSymbolHistory:', err);
    return [];
  }
}

/**
 * Single stock fetch routed via the local server cache (/api/nepse/stock).
 */
export async function fetchLiveLtp(symbol: string): Promise<number | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const url = `/api/nepse/stock?symbol=${encodeURIComponent(cleanSymbol)}`;
  
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const data = await res.json();
    const rawPrice = data?.ltp ?? data?.LTP ?? data?.price ?? data?.closingPrice;
    const price = Number(rawPrice);
    if (isNaN(price) || price <= 0) return null;
    return price;
  } catch (err) {
    console.error(`[API ERROR] ${cleanSymbol}:`, err);
    return null;
  }
}
