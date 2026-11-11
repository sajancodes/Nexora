import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const SYMBOLS: Record<string, string[]> = {
  "Banks": ["NABIL","NMB","NICA","GBIME","EBL","HBL","NIBL","PCBL","SBL","SCB","ADBL","CZBIL","MBL","KBL","LBL","SANIMA","PRVU","BOKL","MEGA","SRBL"],
  "Development & Finance": ["MNBBL","JBBL","GBBL","SHINE","SADBL","CORBL","SAPDBL","MLBL","KSBBL","UDBL","GUFL","PFL","MFIL","CFCL","ICFC","BFCL","SFCL"],
  "Insurance": ["NLIC","LICN","ALICL","PLIC","RLICL","SLICL","SNLI","ILI","ULI","NICL","SICL","NIL","PRIN","IGI","SALICO","SGIC","SPIL","HEI","RBCL"],
  "Hydropower": ["CHCL","BPCL","NHPC","SHPC","RADHI","SAHAS","UPCL","UNHPL","AKPL","API","NGPL","NYADI","DHPL","RHPL","HPPL","AHPC"],
  "Manufacturing & Others": ["CIT","HIDCL","NIFRA","NRN","HATHY","ENL","UNL","HDL","SHIVM","BNT","BNL","SARBTM","GCIL","SONA","NLO","OMPL","STC","BBC","NTC","OHL","TRH","YHL"]
};

const BASE_PRICES: Record<string, number> = {
  "NABIL": 550, "NMB": 273.6, "NICA": 348, "GBIME": 228, "EBL": 647.29, "HBL": 187.9, "NIBL": 150, "PCBL": 257, "SBL": 374.9, "SCB": 624.79, "ADBL": 288, "CZBIL": 191.5, "MBL": 220, "KBL": 178.4, "LBL": 173, "SANIMA": 319, "PRVU": 182, "BOKL": 207.3, "MEGA": 219, "SRBL": 173.1, "MNBBL": 342.6, "JBBL": 318, "GBBL": 374, "SHINE": 391, "SADBL": 381, "CORBL": 1450, "SAPDBL": 793.1, "MLBL": 354.5, "KSBBL": 429.5, "UDBL": 295, "GUFL": 486, "PFL": 358, "MFIL": 709, "CFCL": 462.1, "ICFC": 620, "BFCL": 165, "SFCL": 375, "NLIC": 750.5, "LICN": 876, "ALICL": 457, "PLIC": 340, "RLICL": 410, "SLICL": 387, "SNLI": 504, "ILI": 442, "ULI": 393.8, "NICL": 504.9, "SICL": 635, "NIL": 602.5, "PRIN": 657, "IGI": 414, "SALICO": 600.3, "SGIC": 472, "SPIL": 740, "HEI": 500, "RBCL": 14940, "CHCL": 498, "BPCL": 714, "NHPC": 190.8, "SHPC": 515, "RADHI": 730, "SAHAS": 543, "UPCL": 359, "UNHPL": 481.5, "AKPL": 244, "API": 289, "NGPL": 387.5, "NYADI": 370, "DHPL": 288, "RHPL": 268.8, "HPPL": 472, "CIT": 1809.5, "HIDCL": 254.5, "NIFRA": 261.2, "NRN": 1345.2, "HATHY": 886.9, "ENL": 890, "UNL": 47200, "HDL": 1132.2, "SHIVM": 575, "BNT": 11952, "BNL": 15904.9, "SARBTM": 865, "GCIL": 405.3, "SONA": 414.8, "NLO": 254.1, "OMPL": 1239, "STC": 5405, "BBC": 4864, "NTC": 895.4, "OHL": 691.1, "TRH": 708, "YHL": 600, "AHPC": 272.3
};

const ALL_SYMBOLS = Array.from(new Set(Object.values(SYMBOLS).flat()));
const SYMBOL_TO_SECTOR: Record<string, string> = {};
Object.entries(SYMBOLS).forEach(([sector, list]) => {
  list.forEach(sym => {
    SYMBOL_TO_SECTOR[sym] = sector;
  });
});

export interface HistoricalCandle {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  percentChange: number;
}

interface LiveStockState {
  Symbol: string;
  Sector: string;
  LTP: number;
  Open: number;
  High: number;
  Low: number;
  Change: number;
  Volume: number;
  Amount: number;
  updatedAt: number;
  lastUpstreamFetch: number;
  historyLoaded: boolean;
  candles: HistoricalCandle[];
}

const marketStore: Record<string, LiveStockState> = {};

for (const sym of ALL_SYMBOLS) {
  const refPrice = BASE_PRICES[sym] || 100;
  marketStore[sym] = {
    Symbol: sym,
    Sector: SYMBOL_TO_SECTOR[sym] || "Others",
    LTP: refPrice,
    Open: refPrice,
    High: refPrice,
    Low: refPrice,
    Change: 0,
    Volume: 0,
    Amount: 0,
    updatedAt: Date.now(),
    lastUpstreamFetch: 0,
    historyLoaded: false,
    candles: [],
  };
}

const SYMBOL_CACHE_TTL_MS = 45_000;
const inFlightHistory = new Map<string, Promise<HistoricalCandle[]>>();
const inFlightLive = new Map<string, Promise<LiveStockState>>();

/**
 * Fetches real historical OHLCV candles from GitHub's static raw CDN
 * (SamirWagle/Nepse-All-Scraper/main/data/company-wise/{SYMBOL}/prices.csv).
 */
async function ensureRealHistory(symbol: string): Promise<HistoricalCandle[]> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const state = marketStore[cleanSymbol];
  if (!state) return [];
  if (state.historyLoaded && state.candles.length > 0) {
    return state.candles;
  }

  const existing = inFlightHistory.get(cleanSymbol);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const url = `https://raw.githubusercontent.com/SamirWagle/Nepse-All-Scraper/main/data/company-wise/${encodeURIComponent(cleanSymbol)}/prices.csv`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const csvText = await res.text();
        const lines = csvText.trim().split(/\r?\n/);
        const byDate = new Map<string, HistoricalCandle>();

        // Header: date,open,high,low,ltp,percent_change,qty,turnover
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          if (cols.length < 7) continue;
          const dateStr = cols[0].trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

          const open = Number(cols[1]);
          const high = Number(cols[2]);
          const low = Number(cols[3]);
          const close = Number(cols[4]);
          const pct = Number(cols[5]) || 0;
          const volume = Number(cols[6]) || 0;
          const turnover = Number(cols[7]) || 0;

          if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || close <= 0) continue;

          byDate.set(dateStr, {
            time: dateStr,
            open,
            high: Math.max(open, close, high),
            low: Math.min(open, close, low),
            close,
            percentChange: pct,
            volume,
            turnover,
          });
        }

        const sorted = Array.from(byDate.values()).sort((a, b) => a.time.localeCompare(b.time));
        if (sorted.length > 0) {
          state.candles = sorted.slice(-365); // Keep up to last 365 trading days
          state.historyLoaded = true;

          const latest = state.candles[state.candles.length - 1];
          const prev = state.candles.length > 1 ? state.candles[state.candles.length - 2] : latest;

          // Only set from CSV if live worker hasn't updated more recently
          if (state.lastUpstreamFetch === 0) {
            state.LTP = latest.close;
            state.Open = latest.open || prev.close;
            state.High = latest.high;
            state.Low = latest.low;
            state.Change = latest.percentChange !== 0
              ? latest.percentChange
              : prev.close > 0
                ? Number((((latest.close - prev.close) / prev.close) * 100).toFixed(2))
                : 0;
            state.Volume = latest.volume;
            state.Amount = latest.turnover;
            state.updatedAt = Date.now();
          }
        } else {
          state.historyLoaded = true;
        }
      } else {
        state.historyLoaded = true;
      }
    } catch {
      // Ignore transient network errors so next call can retry
    } finally {
      inFlightHistory.delete(cleanSymbol);
    }
    return state.candles;
  })();

  inFlightHistory.set(cleanSymbol, promise);
  return promise;
}

/**
 * Fetches live LTP from nepsetty worker and merges with real historical OHLCV baseline.
 */
async function fetchUpstreamSymbol(symbol: string, force = false): Promise<LiveStockState> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const state = marketStore[cleanSymbol];
  if (!state) throw new Error(`Unknown symbol: ${cleanSymbol}`);

  // Ensure real historical OHLCV is loaded first so Open/High/Low/Change are real
  await ensureRealHistory(cleanSymbol);

  const now = Date.now();
  if (!force && state.lastUpstreamFetch > 0 && now - state.lastUpstreamFetch < SYMBOL_CACHE_TTL_MS) {
    return state;
  }

  const existing = inFlightLive.get(cleanSymbol);
  if (existing) return existing;

  const fetchPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const targetUrl = `https://nepsetty.kokomo.workers.dev/api/stock?symbol=${encodeURIComponent(cleanSymbol)}`;
      const upstream = await fetch(targetUrl, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      state.lastUpstreamFetch = Date.now();

      if (upstream.ok) {
        const data = await upstream.json();
        const rawPrice = data?.ltp ?? data?.LTP ?? data?.price ?? data?.closingPrice;
        const ltp = Number(rawPrice);

        if (!isNaN(ltp) && ltp > 0) {
          const latestCandle = state.candles.length > 0 ? state.candles[state.candles.length - 1] : null;
          const prevCandle = state.candles.length > 1 ? state.candles[state.candles.length - 2] : latestCandle;

          state.LTP = ltp;
          if (latestCandle) {
            // Update the latest candle if live LTP moved beyond recorded daily high/low
            const refPrevClose = prevCandle ? prevCandle.close : latestCandle.open;
            if (ltp !== latestCandle.close) {
              latestCandle.close = ltp;
              latestCandle.high = Math.max(latestCandle.high, ltp);
              latestCandle.low = Math.min(latestCandle.low, ltp);
              latestCandle.percentChange = refPrevClose > 0
                ? Number((((ltp - refPrevClose) / refPrevClose) * 100).toFixed(2))
                : 0;
            }
            state.Open = latestCandle.open;
            state.High = latestCandle.high;
            state.Low = latestCandle.low;
            state.Change = latestCandle.percentChange;
            state.Volume = latestCandle.volume;
            state.Amount = latestCandle.turnover;
          } else {
            state.High = Math.max(state.High, ltp);
            state.Low = Math.min(state.Low, ltp);
            state.Change = state.Open > 0 ? Number((((ltp - state.Open) / state.Open) * 100).toFixed(2)) : 0;
          }
          state.updatedAt = Date.now();
        }
      }
    } catch {
      state.lastUpstreamFetch = Date.now();
    } finally {
      inFlightLive.delete(cleanSymbol);
    }
    return state;
  })();

  inFlightLive.set(cleanSymbol, fetchPromise);
  return fetchPromise;
}

// Background staggered rotator: warms real history + live LTP for all symbols without rate limits
let cursorIndex = 0;
function startStaggeredPoller() {
  // Warm first 8 priority banking/blue-chip symbols right on boot
  const initialWarm = ["NABIL", "NMB", "NICA", "GBIME", "EBL", "SCB", "HBL", "HIDCL"];
  Promise.all(initialWarm.map(s => fetchUpstreamSymbol(s))).catch(() => {});

  setInterval(async () => {
    const batch: string[] = [];
    for (let i = 0; i < 3; i++) {
      batch.push(ALL_SYMBOLS[cursorIndex]);
      cursorIndex = (cursorIndex + 1) % ALL_SYMBOLS.length;
    }
    await Promise.all(batch.map(sym => fetchUpstreamSymbol(sym)));
  }, 3000);
}

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  startStaggeredPoller();

  // Returns full market snapshot + real historical OHLCV candles for the focused symbol
  app.get("/api/nepse/market", async (req, res) => {
    const focusSymbol = String(req.query.focus || "").trim().toUpperCase();
    if (focusSymbol && marketStore[focusSymbol]) {
      await fetchUpstreamSymbol(focusSymbol);
    }

    const stocks = ALL_SYMBOLS.map(sym => {
      const { candles, lastUpstreamFetch, historyLoaded, ...publicFields } = marketStore[sym];
      return {
        ...publicFields,
        isLiveSynced: lastUpstreamFetch > 0 || historyLoaded,
      };
    });

    const focusData = focusSymbol && marketStore[focusSymbol]
      ? {
          symbol: focusSymbol,
          candles: marketStore[focusSymbol].candles,
        }
      : null;

    res.json({
      stocks,
      focus: focusData,
      syncedCount: ALL_SYMBOLS.filter(s => marketStore[s].lastUpstreamFetch > 0 || marketStore[s].historyLoaded).length,
      totalCount: ALL_SYMBOLS.length,
      serverTime: Date.now(),
    });
  });

  // Dedicated endpoint to fetch real historical OHLCV candles for any symbol immediately
  app.get("/api/nepse/history", async (req, res) => {
    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    if (!symbol || !marketStore[symbol]) {
      res.status(400).json({ error: "Invalid or missing symbol parameter" });
      return;
    }
    try {
      const state = await fetchUpstreamSymbol(symbol);
      res.json({
        symbol: state.Symbol,
        ltp: state.LTP,
        open: state.Open,
        high: state.High,
        low: state.Low,
        change: state.Change,
        volume: state.Volume,
        amount: state.Amount,
        candles: state.candles,
      });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Failed to load symbol history" });
    }
  });

  // Single stock endpoint
  app.get("/api/nepse/stock", async (req, res) => {
    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    if (!symbol || !marketStore[symbol]) {
      res.status(400).json({ error: "Invalid or missing symbol parameter" });
      return;
    }
    try {
      const state = await fetchUpstreamSymbol(symbol);
      res.json({
        symbol: state.Symbol,
        ltp: state.LTP,
        open: state.Open,
        high: state.High,
        low: state.Low,
        change: state.Change,
        volume: state.Volume,
        amount: state.Amount,
        updatedAt: state.updatedAt,
      });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Failed to fetch stock" });
    }
  });

  // Full-market in-memory cache sweep: ensures all 93 symbols are cached in memory
  // so the client can push the entire 93-stock snapshot to Firebase RTDB in a SINGLE write.
  app.post("/api/nepse/sync-all", async (_req, res) => {
    try {
      const BATCH_SIZE = 6;
      for (let i = 0; i < ALL_SYMBOLS.length; i += BATCH_SIZE) {
        const batch = ALL_SYMBOLS.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(sym => fetchUpstreamSymbol(sym)));
        if (i + BATCH_SIZE < ALL_SYMBOLS.length) {
          await new Promise(r => setTimeout(r, 350));
        }
      }

      const now = Date.now();
      const snapshotPayload: Record<string, any> = {};
      const stocks = ALL_SYMBOLS.map(sym => {
        const { candles, lastUpstreamFetch, historyLoaded, ...publicFields } = marketStore[sym];
        snapshotPayload[sym] = {
          ltp: publicFields.LTP,
          open: publicFields.Open,
          high: publicFields.High,
          low: publicFields.Low,
          change: publicFields.Change,
          volume: publicFields.Volume,
          amount: publicFields.Amount,
          updatedAt: now,
        };
        return {
          ...publicFields,
          isLiveSynced: true,
        };
      });

      res.json({
        success: true,
        count: Object.keys(snapshotPayload).length,
        stocks,
        rtdbBatch: snapshotPayload,
        syncedAt: now,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed full market cache sweep" });
    }
  });

  app.post("/api/ai/analyze", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const { stocks = [] } = req.body || {};

      if (!Array.isArray(stocks) || stocks.length === 0) {
        res.write(
          `data: ${JSON.stringify({
            content: "### No Market Data\nWaiting for instrument feed before running analysis.",
          })}\n\n`
        );
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const sortedByChange = [...stocks].sort((a, b) => (b.Change || 0) - (a.Change || 0));
      const topGainers = sortedByChange.slice(0, 5);
      const topLosers = sortedByChange.slice(-5).reverse();
      const topVol = [...stocks].sort((a, b) => (b.Volume || 0) - (a.Volume || 0)).slice(0, 5);
      const marketDrift =
        stocks.reduce((acc: number, s: any) => acc + (Number(s.Change) || 0), 0) / stocks.length;

      const sectorStats: Record<string, { sum: number; count: number }> = {};
      for (const s of stocks) {
        const sec = s.Sector || "General";
        if (!sectorStats[sec]) sectorStats[sec] = { sum: 0, count: 0 };
        sectorStats[sec].sum += Number(s.Change) || 0;
        sectorStats[sec].count += 1;
      }
      const sectorSummary = Object.entries(sectorStats)
        .map(([sec, val]) => `${sec}: ${(val.sum / val.count).toFixed(2)}%`)
        .join(", ");

      const reasoningSummary = [
        `Evaluated ${stocks.length} active NEPSE instruments across ${Object.keys(sectorStats).length} sectors.`,
        `Aggregate market drift is ${marketDrift >= 0 ? "+" : ""}${marketDrift.toFixed(3)}%.`,
        `Leading momentum in ${topGainers[0]?.Symbol || "N/A"} (${(topGainers[0]?.Change || 0).toFixed(2)}%) vs pullback in ${topLosers[0]?.Symbol || "N/A"} (${(topLosers[0]?.Change || 0).toFixed(2)}%).`,
        `Sector breadth breakdown: ${sectorSummary}.`,
      ].join(" ");

      res.write(`data: ${JSON.stringify({ reasoning: reasoningSummary })}\n\n`);

      const prompt = `Analyze the current Nepal Stock Exchange (NEPSE) live market snapshot:
- Overall Market Drift: ${marketDrift >= 0 ? "+" : ""}${marketDrift.toFixed(4)}%
- Sector Performance Averages: ${sectorSummary}
- Top 5 Gainers: ${topGainers.map((s: any) => `${s.Symbol} (LTP: NPR ${s.LTP}, ${s.Change >= 0 ? "+" : ""}${Number(s.Change).toFixed(2)}%)`).join(", ")}
- Top 5 Decliners: ${topLosers.map((s: any) => `${s.Symbol} (LTP: NPR ${s.LTP}, ${Number(s.Change).toFixed(2)}%)`).join(", ")}
- Highest Volume Leaders: ${topVol.map((s: any) => `${s.Symbol} (Vol: ${s.Volume})`).join(", ")}

Provide a structured, institutional-grade markdown report with these exact sections:
# Market Sentiment & Breadth
Summarize the current market regime (Bullish, Bearish, or Consolidation), breadth ratio, and momentum conviction.

# Sector Rotation Heatmap
Rank the strongest and weakest NEPSE sectors right now and explain where liquidity is rotating.

# Technical Setup & Pattern Watchlist
Highlight actionable candlestick setups, support/resistance zones, and breakout/breakdown candidates among the top movers.

# Quantitative Risk & Position Sizing
Provide volatility warnings, stop-loss guidance, and liquidity considerations for paper traders.`;

      const ai = getGenAIClient();
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are a senior quantitative financial analyst specializing in the Nepal Stock Exchange (NEPSE), technical candlestick structures, and risk management. Be concise, data-driven, and format output in clean Markdown.",
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      res.write(
        `data: ${JSON.stringify({
          error: errMsg,
          content: `### Analysis Unavailable\nUnable to complete market intelligence stream (${errMsg}). Please verify your API key in Settings > Secrets and try again.`,
        })}\n\n`
      );
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nexora Pro Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
