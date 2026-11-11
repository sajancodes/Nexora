# Nexora Pro — Terminal Architecture & Feature Upgrade Plan

This plan resolves core trading and persistence bugs in the **Nexora Pro** NEPSE paper-trading platform, upgrades the AI market intelligence engine to server-side Gemini (`gemini-3.8-flash`), introduces working Limit Orders with live execution matching, fixes candlestick pattern math while adding bearish patterns, and refines the terminal UI with sector filtering and timeframe controls.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Below is the summary of your confirmed decisions from our initial review, which govern the scope of this implementation:

- **Confirmed Decision 1 — Core Functional Fixes**:
  - Automatically initialize and persist `portfolios/{uid}` in Firestore when a new user registers or signs in for the first time, preventing `"No document to update"` trade failures.
  - Implement full **Limit Order** support in `OrderPanel` (target limit price input, pending limit order queue, cancellation, and automatic execution when live `LTP` crosses the limit threshold).
  - Fix the tautological math bug in `Three White Soldiers` (`patternLogic.ts`) and add **Bearish Reversal Patterns** (Bearish Engulfing, Shooting Star, Evening Star, Three Black Crows, Tweezer Top) with red `aboveBar` downward markers.
- **Confirmed Decision 2 — Server-Side Gemini AI Migration**:
  - Replace the hardcoded client-side NVIDIA DeepSeek key with a secure Express backend route (`/api/ai/analyze`) powered by `@google/genai` (`gemini-3.8-flash`) and `process.env.GEMINI_API_KEY`, streaming market sentiment, sector strength, pattern insights, and risk metrics to the client.
- **Confirmed Decision 3 — Terminal UI & Codebase Cleanup**:
  - Replace the hardcoded `● MARKET OPEN` badge in `MainTerminal` with live `isMarketOpen` state and add interactive **Chart Timeframe Controls** (`15s`, `1m`, `5m`, `15m`) plus a pattern marker visibility toggle.
  - Add interactive **Sector Filter Tabs** (`All`, `Banks`, `Dev & Finance`, `Insurance`, `Hydropower`, `Manufacturing`) in the `Sidebar` watchlist.
  - Remove orphaned/unused components (`MarketList`, `Navbar`, `TradeModal`, `DashboardStats`) and remove the Ornamental Footer Engine ticker in `MainTerminal` to adhere to clean SaaS terminal design standards.

---

### 1. Overview & Core Concept

- **What It Does**: Nexora Pro is a real-time paper trading terminal for the Nepal Stock Exchange (NEPSE) combining live/simulated tick streams, automated candlestick pattern recognition, market and limit order execution, portfolio P&L tracking, and streaming AI market analysis.
- **Target Audience / Persona**: Retail and quantitative paper traders practicing technical analysis, order book execution, and portfolio allocation on NEPSE equities.
- **Key Value**: Reliable cloud-synced portfolio state across sessions, realistic Market & Limit order lifecycle management, accurate bullish/bearish candlestick pattern detection, and secure server-side Gemini market intelligence.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Onboarding & Portfolio Bootstrapping**: When a user signs up or logs in, the terminal checks their Firestore `portfolios/{uid}` document. If missing, it atomically initializes their starting `NPR 50,000` balance, empty holdings, pending orders, and history so their very first trade succeeds without error.
  2. **Sector Watchlist Filtering**: Traders can filter the 93 NEPSE symbols in the left sidebar by sector (`All`, `Banks`, `Finance`, `Insurance`, `Hydro`, `Others`) alongside instant symbol search.
  3. **Interactive Charting & Pattern Inspection**: Traders can switch candle intervals (`15s`, `1m`, `5m`, `15m`), toggle pattern overlays on/off, and immediately see both green bullish markers below bars and red bearish markers above bars, alongside an accurate live Market Open / Closed status indicator.
  4. **Market & Limit Order Execution**:
     - **Market Mode**: Immediate execution at current `LTP` with margin validation.
     - **Limit Mode**: Traders specify a target **Limit Price (NPR)** and quantity. Placing a limit order reserves the required cash (for `BUY`) or shares (for `SELL`) and adds the order to the **Open Limit Orders** tab where it automatically triggers as soon as the stock's `LTP` reaches or crosses the target price (or can be cancelled anytime).
  5. **Streaming Gemini Market Intelligence**: Navigating to the **Analysis** view streams structured technical commentary and reasoning from the server-side Gemini API based on live top gainers, losers, volume leaders, and sector drift.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-density, utilitarian financial trading terminal with crisp 1px structural hairlines (`#1c2127`) and zero nested card clutter.
  - *Color Palette & Mood*:
    - `--background`: Deep carbon slate (`#080a0c`) for primary chart canvas.
    - `--surface`: Elevated panel slate (`#111418`) for sidebar, header, and order entry.
    - `--primary` / Bullish: Emerald (`#2ebd85`) for positive delta, bids, and bullish pattern markers.
    - `--destructive` / Bearish: Crimson (`#f6465d`) for negative delta, asks, and bearish pattern markers.
  - *Typography & Hierarchy*: Clean sans-serif UI labels paired with strict `tabular-nums` monospace alignment for all prices, quantities, percentages, order book levels, and P&L figures to prevent horizontal layout jitter during 2-second price ticks.
  - *Component Styling & Layout*: Full-viewport 1440px+ 3-pane terminal workspace (`264px` Left Watchlist Sidebar + Flex-1 Central Candlestick & L2 Depth Viewport + `320px` Right Order & History Panel), adhering to single-elevation depth and unboxed metadata separators (`·`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Resilient Firestore Portfolio Initialization & Error Handling**
  - *Chosen Approach*: Use `setDoc(..., { merge: true })` and automatic initial document creation inside the `onSnapshot` listener when `!snap.exists()`, paired with structured `handleFirestoreError` diagnostics.
  - *Why*: Eliminates the crash when a newly registered user executes their first trade before a portfolio document exists, while preserving existing balances for returning users.
- **Decision 2: Client-Watched + Firestore-Persisted Limit Order Engine**
  - *Chosen Approach*: Store pending `LimitOrder` items in the user's `portfolios/{uid}` document (`limitOrders` array) and evaluate trigger conditions (`BUY` when `LTP <= limitPrice`, `SELL` when `LTP >= limitPrice`) on each price tick when the market is open.
  - *Why*: Persists open limit orders across page reloads while providing sub-second execution feedback as simulated or synced prices move.
- **Decision 3: Full-Stack Express + Vite Server Architecture for Gemini API**
  - *Chosen Approach*: Introduce `server.ts` running Express on port 3000 with Vite middleware mounted in development and a `/api/ai/analyze` SSE streaming endpoint using `@google/genai` (`gemini-3.8-flash`).
  - *Why*: Keeps `process.env.GEMINI_API_KEY` strictly on the server, removes the hardcoded third-party key and `openai` browser bundle exposure, and provides fast streaming responses with thinking summaries.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Nexora Pro Terminal (Client)                        │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Top Bar: Brand Wordmark  │  Terminal · Portfolio · Analysis  │ Auth  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│         │                                 │                       │        │
│         ▼                                 ▼                       ▼        │
│  ┌──────────────────────┐   ┌──────────────────────────┐   ┌────────────┐  │
│  │   Terminal Workspace │   │      Portfolio View      │   │ AIInsights │  │
│  │ ┌──────────────────┐ │   │ • Profile & Editable Name│   │ • Streamed │  │
│  │ │ Sidebar Watchlist│ │   │ • Cash, Invested & P&L   │   │   Markdown │  │
│  │ │ • Sector Tabs    │ │   │ • Holdings Table         │   │ • Reasoning│  │
│  │ │ • Symbol Search  │ │   │ • Executed & Limit Orders│   │   Summary  │  │
│  │ └────────┬─────────┘ │   └─────────────┬────────────┘   └──────┬─────┘  │
│  │          ▼           │                 │                       │        │
│  │ ┌──────────────────┐ │                 │                       │        │
│  │ │   MainTerminal   │ │                 │                       │        │
│  │ │ • 15s/1m/5m/15m  │ │                 │                       │        │
│  │ │ • Bull/Bear Marks│ │                 │                       │        │
│  │ │ • L2 Order Depth │ │                 │                       │        │
│  │ └────────┬─────────┘ │                 │                       │        │
│  │          ▼           │                 │                       │        │
│  │ ┌──────────────────┐ │                 │                       │        │
│  │ │    OrderPanel    │ │                 │                       │        │
│  │ │ • Market / Limit │ │                 │                       │        │
│  │ │ • Open Orders Tab│ │                 │                       │        │
│  │ └────────┬─────────┘ │                 │                       │        │
│  └──────────┼───────────┘                 │                       │        │
└─────────────┼─────────────────────────────┼───────────────────────┼────────┘
              │                             │                       │
              ▼                             ▼                       ▼
┌───────────────────────────┐ ┌──────────────────────────┐ ┌─────────────────┐
│   Firebase Realtime DB    │ │    Cloud Firestore       │ │ Express Backend │
│ • settings/market (isOpen)│ │ • portfolios/{userId}    │ │ (server.ts)     │
│ • market/snapshot/stocks  │ │   - balance, holdings    │ │ • POST /api/ai/ │
│                           │ │   - history, limitOrders │ │   analyze       │
│                           │ │                          │ │ • @google/genai │
└───────────────────────────┘ └──────────────────────────┘ └─────────────────┘
```

- **Data Model & State**:
  - `Stock`: `{ Symbol, Sector, LTP, Change, Open, High, Low, Volume, Amount }`
  - `LimitOrder`: `{ id, symbol, type: 'BUY' | 'SELL', quantity, limitPrice, createdAt }`
  - `Portfolio`: `{ balance: number, holdings: Holding[], history: Transaction[], limitOrders?: LimitOrder[] }`

- **Interactive Component & State Mapping**:
  - `Sidebar`: Maintains `activeSector` (`'ALL' | 'Banks' | 'Development & Finance' | 'Insurance' | 'Hydropower' | 'Manufacturing & Others'`) + `search` query; clicking any row updates `selectedSymbol`.
  - `MainTerminal`: Maintains `timeframe` (`15 | 60 | 300 | 900` seconds) and `showPatterns` (`boolean`). Regenerates aggregated historical candles when `timeframe` or `stock.Symbol` changes, and runs `detectPatterns` to annotate both bullish (`#2ebd85`, `belowBar`, `arrowUp`) and bearish (`#f6465d`, `aboveBar`, `arrowDown`) signals.
  - `OrderPanel`:
    - Switches between `MARKET` and `LIMIT` entry modes. In `LIMIT` mode, displays a numeric **Limit Price** input initialized to `stock.LTP`.
    - Validates sufficient cash balance or share holdings before submitting.
    - Bottom section switches between **Open Orders** (with a one-click `Cancel` button for pending limit orders) and **Order History** (executed trades).
  - `AIInsights` & `services/geminiService.ts`: Sends top gainers, top losers, volume leaders, and sector performance to `POST /api/ai/analyze`, streaming SSE chunks from `gemini-3.8-flash` into the reasoning and analysis panels.
