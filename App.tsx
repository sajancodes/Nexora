import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Stock, Portfolio, AppTab, LimitOrder, Transaction } from './types';
import Sidebar from './components/Sidebar';
import MainTerminal from './components/MainTerminal';
import OrderPanel from './components/OrderPanel';
import PortfolioView from './components/PortfolioView';
import AIInsights from './components/AIInsights';
import Auth from './components/Auth';
import { auth, db, rtdb } from './services/firebase';
import { fetchMarketSnapshot, fetchSymbolHistory, syncAllMarketCache, HistoricalCandle } from './services/api';
import { onAuthStateChanged, signOut, User, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDocFromServer } from 'firebase/firestore';
import { ref, onValue, update as rtdbUpdate } from 'firebase/database';
import { TrendingUp, LayoutDashboard, Briefcase, Cpu, Loader2, LogOut, Clock, RefreshCw, Lock, Unlock, ShieldCheck, CheckCircle2 } from 'lucide-react';

const ADMIN_UID = "wL3xCPtylQc5pxcuaFOWNdW62UW2";

const SYMBOLS: Record<string, string[]> = {
  "Banks": ["NABIL","NMB","NICA","GBIME","EBL","HBL","NIBL","PCBL","SBL","SCB","ADBL","CZBIL","MBL","KBL","LBL","SANIMA","PRVU","BOKL","MEGA","SRBL"],
  "Development & Finance": ["MNBBL","JBBL","GBBL","SHINE","SADBL","CORBL","SAPDBL","MLBL","KSBBL","UDBL","GUFL","PFL","MFIL","CFCL","ICFC","BFCL","SFCL"],
  "Insurance": ["NLIC","LICN","ALICL","PLIC","RLICL","SLICL","SNLI","ILI","ULI","NICL","SICL","NIL","PRIN","IGI","SALICO","SGIC","SPIL","HEI","RBCL"],
  "Hydropower": ["CHCL","BPCL","NHPC","SHPC","RADHI","SAHAS","UPCL","UNHPL","AKPL","API","NGPL","NYADI","DHPL","RHPL","HPPL","AHPC"],
  "Manufacturing & Others": ["CIT","HIDCL","NIFRA","NRN","HATHY","ENL","UNL","HDL","SHIVM","BNT","BNL","SARBTM","GCIL","SONA","NLO","OMPL","STC","BBC","NTC","OHL","TRH","YHL"]
};

const SYMBOL_TO_SECTOR: Record<string, string> = {};
Object.entries(SYMBOLS).forEach(([sector, list]) => {
  list.forEach(sym => {
    SYMBOL_TO_SECTOR[sym] = sector;
  });
});

const ALL_FLAT_SYMBOLS = Array.from(new Set(Object.values(SYMBOLS).flat()));
const INITIAL_BALANCE = 50000;
const LIVE_POLL_INTERVAL = 5000;

const BASE_PRICES: Record<string, number> = {
  "NABIL": 550, "NMB": 273.6, "NICA": 348, "GBIME": 228, "EBL": 647.29, "HBL": 187.9, "NIBL": 150, "PCBL": 257, "SBL": 374.9, "SCB": 624.79, "ADBL": 288, "CZBIL": 191.5, "MBL": 220, "KBL": 178.4, "LBL": 173, "SANIMA": 319, "PRVU": 182, "BOKL": 207.3, "MEGA": 219, "SRBL": 173.1, "MNBBL": 342.6, "JBBL": 318, "GBBL": 374, "SHINE": 391, "SADBL": 381, "CORBL": 1450, "SAPDBL": 793.1, "MLBL": 354.5, "KSBBL": 429.5, "UDBL": 295, "GUFL": 486, "PFL": 358, "MFIL": 709, "CFCL": 462.1, "ICFC": 620, "BFCL": 165, "SFCL": 375, "NLIC": 750.5, "LICN": 876, "ALICL": 457, "PLIC": 340, "RLICL": 410, "SLICL": 387, "SNLI": 504, "ILI": 442, "ULI": 393.8, "NICL": 504.9, "SICL": 635, "NIL": 602.5, "PRIN": 657, "IGI": 414, "SALICO": 600.3, "SGIC": 472, "SPIL": 740, "HEI": 500, "RBCL": 14940, "CHCL": 498, "BPCL": 714, "NHPC": 190.8, "SHPC": 515, "RADHI": 730, "SAHAS": 543, "UPCL": 359, "UNHPL": 481.5, "AKPL": 244, "API": 289, "NGPL": 387.5, "NYADI": 370, "DHPL": 288, "RHPL": 268.8, "HPPL": 472, "CIT": 1809.5, "HIDCL": 254.5, "NIFRA": 261.2, "NRN": 1345.2, "HATHY": 886.9, "ENL": 890, "UNL": 47200, "HDL": 1132.2, "SHIVM": 575, "BNT": 11952, "BNL": 15904.9, "SARBTM": 865, "GCIL": 405.3, "SONA": 414.8, "NLO": 254.1, "OMPL": 1239, "STC": 5405, "BBC": 4864, "NTC": 895.4, "OHL": 691.1, "TRH": 708, "YHL": 600, "AHPC": 272.3
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [isApiSyncing, setIsApiSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [liveSyncedCount, setLiveSyncedCount] = useState<number>(0);
  const [historyBySymbol, setHistoryBySymbol] = useState<Record<string, HistoricalCandle[]>>({});
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  
  const [stocks, setStocks] = useState<Stock[]>(() => {
    return ALL_FLAT_SYMBOLS.map(symbol => {
      const price = BASE_PRICES[symbol] || 100.0;
      return {
        Symbol: symbol,
        Sector: SYMBOL_TO_SECTOR[symbol] || 'Others',
        LTP: price,
        Change: 0,
        Open: price,
        High: price,
        Low: price,
        Volume: 0,
        Amount: 0,
      };
    });
  });

  // Tracks whether we already pushed the completed 93-stock cache to RTDB once
  const hasPushedFullCacheRef = useRef<boolean>(false);
  const lastPushedSignatureRef = useRef<string>('');
  const isExecutingLimitRef = useRef<boolean>(false);
  const isAdmin = useMemo(() => user?.uid === ADMIN_UID, [user]);
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.MARKET);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NABIL');
  const [portfolio, setPortfolio] = useState<Portfolio>({
    balance: INITIAL_BALANCE,
    holdings: [],
    history: [],
    limitOrders: [],
  });

  // Validate connection to Firestore on boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'settings', 'market'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const toggleMarketStatus = useCallback(async () => {
    if (!isAdmin) return;
    const newStatus = !isMarketOpen;
    await rtdbUpdate(ref(rtdb, 'settings/market'), { isOpen: newStatus });
  }, [isAdmin, isMarketOpen]);

  // Caches all 93 stocks on the server first, then pushes the entire snapshot to Firebase RTDB in a SINGLE atomic write
  const syncMarketData = useCallback(async () => {
    if (!user || isApiSyncing) return;
    setIsApiSyncing(true);
    setSyncStatus('Caching 94...');

    const fullResult = await syncAllMarketCache();
    if (fullResult && fullResult.success) {
      setLiveSyncedCount(fullResult.count);
      const serverMap = new Map(fullResult.stocks.map(s => [s.Symbol, s]));
      setStocks(current => current.map(stock => {
        const remote = serverMap.get(stock.Symbol);
        if (!remote) return stock;
        return {
          ...stock,
          LTP: remote.LTP,
          Open: remote.Open,
          High: remote.High,
          Low: remote.Low,
          Change: remote.Change,
          Volume: remote.Volume || 0,
          Amount: remote.Amount || 0,
        };
      }));

      // Single atomic write of all 93 stocks to Firebase RTDB
      if (isAdmin && Object.keys(fullResult.rtdbBatch).length > 0) {
        setSyncStatus('Pushing DB...');
        await rtdbUpdate(ref(rtdb, 'market/snapshot/stocks'), fullResult.rtdbBatch);
        hasPushedFullCacheRef.current = true;
      }
      setSyncStatus(`Pushed ${fullResult.count}`);
    } else {
      setSyncStatus('Sync Error');
    }

    setTimeout(() => setSyncStatus(''), 5000);
    setIsApiSyncing(false);
  }, [user, isApiSyncing, isAdmin]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    return onValue(ref(rtdb, 'settings/market'), (snapshot) => {
      if (snapshot.exists()) setIsMarketOpen(Boolean(snapshot.val().isOpen));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onValue(ref(rtdb, 'market/snapshot/stocks'), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      setStocks(prev => prev.map(s => {
        const remote = data[s.Symbol];
        if (!remote || typeof remote.ltp !== 'number') return s;
        return {
          ...s,
          LTP: remote.ltp,
          Open: typeof remote.open === 'number' ? remote.open : s.Open,
          High: typeof remote.high === 'number' ? remote.high : s.High,
          Low: typeof remote.low === 'number' ? remote.low : s.Low,
          Change: typeof remote.change === 'number' ? remote.change : s.Change,
          Volume: typeof remote.volume === 'number' ? remote.volume : s.Volume,
          Amount: typeof remote.amount === 'number' ? remote.amount : s.Amount,
        };
      }));
    });
  }, [user]);

  // Immediately fetch real historical OHLCV candles when a symbol is selected
  useEffect(() => {
    if (!selectedSymbol) return;
    let active = true;

    if (!historyBySymbol[selectedSymbol] || historyBySymbol[selectedSymbol].length === 0) {
      setHistoryLoading(true);
      fetchSymbolHistory(selectedSymbol)
        .then(candles => {
          if (!active) return;
          if (candles.length > 0) {
            setHistoryBySymbol(prev => ({ ...prev, [selectedSymbol]: candles }));
          }
        })
        .finally(() => {
          if (active) setHistoryLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [selectedSymbol]);

  // Reads from local server memory cache; only pushes to Firebase RTDB ONCE when all 94 symbols finish caching
  useEffect(() => {
    let isMounted = true;

    const pullLiveSnapshot = async () => {
      const snapshot = await fetchMarketSnapshot(selectedSymbol);
      if (!isMounted || !snapshot) return;

      setLiveSyncedCount(snapshot.syncedCount);
      if (snapshot.focus && snapshot.focus.symbol === selectedSymbol && snapshot.focus.candles.length > 0) {
        setHistoryBySymbol(prev => ({
          ...prev,
          [selectedSymbol]: snapshot.focus!.candles,
        }));
      }

      setStocks(prev => {
        const serverMap = new Map(snapshot.stocks.map(s => [s.Symbol, s]));
        return prev.map(stock => {
          const remote = serverMap.get(stock.Symbol);
          if (!remote || !remote.isLiveSynced) return stock;
          return {
            ...stock,
            LTP: remote.LTP,
            Open: remote.Open,
            High: remote.High,
            Low: remote.Low,
            Change: remote.Change,
            Volume: remote.Volume || 0,
            Amount: remote.Amount || 0,
          };
        });
      });

      // Push to Firebase RTDB ONLY once all symbols are cached in memory (and only if prices changed)
      if (user && isAdmin && snapshot.syncedCount === snapshot.totalCount) {
        const signature = snapshot.stocks.map(s => `${s.Symbol}:${s.LTP}`).join('|');
        if (!hasPushedFullCacheRef.current || signature !== lastPushedSignatureRef.current) {
          hasPushedFullCacheRef.current = true;
          lastPushedSignatureRef.current = signature;
          const now = Date.now();
          const fullBatch: Record<string, any> = {};
          snapshot.stocks.forEach(s => {
            fullBatch[s.Symbol] = {
              ltp: s.LTP,
              open: s.Open,
              high: s.High,
              low: s.Low,
              change: s.Change,
              volume: s.Volume || 0,
              amount: s.Amount || 0,
              updatedAt: now,
            };
          });
          rtdbUpdate(ref(rtdb, 'market/snapshot/stocks'), fullBatch);
        }
      }
    };

    pullLiveSnapshot();
    const interval = setInterval(pullLiveSnapshot, LIVE_POLL_INTERVAL);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, selectedSymbol, isAdmin]);

  // Subscribe to user's portfolio document and automatically initialize if new user
  useEffect(() => {
    if (!user) return;
    const path = `portfolios/${user.uid}`;
    const userRef = doc(db, 'portfolios', user.uid);

    return onSnapshot(
      userRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Portfolio;
          setPortfolio({
            balance: typeof data.balance === 'number' ? data.balance : INITIAL_BALANCE,
            holdings: Array.isArray(data.holdings) ? data.holdings : [],
            history: Array.isArray(data.history) ? data.history : [],
            limitOrders: Array.isArray(data.limitOrders) ? data.limitOrders : [],
          });
        } else {
          const initialPortfolio: Portfolio = {
            balance: INITIAL_BALANCE,
            holdings: [],
            history: [],
            limitOrders: [],
          };
          try {
            await setDoc(userRef, initialPortfolio, { merge: true });
            setPortfolio(initialPortfolio);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, path);
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
  }, [user]);

  // Execute immediate Market Trade
  const handleTrade = async (
    type: 'BUY' | 'SELL',
    symbol: string,
    quantity: number,
    price: number,
    orderType: 'MARKET' | 'LIMIT' = 'MARKET'
  ) => {
    if (!user || !isMarketOpen) return;
    const path = `portfolios/${user.uid}`;
    const userRef = doc(db, 'portfolios', user.uid);
    const totalCost = Number((quantity * price).toFixed(2));
    const existingHolding = portfolio.holdings.find(h => h.symbol === symbol);

    if (type === 'BUY' && portfolio.balance < totalCost) return;
    if (type === 'SELL' && (!existingHolding || existingHolding.quantity < quantity)) return;

    let newHoldings = [...portfolio.holdings];
    if (type === 'BUY') {
      if (existingHolding) {
        const newQty = existingHolding.quantity + quantity;
        const newAvg = Number((((existingHolding.avgPrice * existingHolding.quantity) + (price * quantity)) / newQty).toFixed(2));
        newHoldings = newHoldings.map(h => h.symbol === symbol ? { ...h, quantity: newQty, avgPrice: newAvg } : h);
      } else {
        newHoldings.push({ symbol, quantity, avgPrice: price });
      }
    } else {
      const newQty = existingHolding!.quantity - quantity;
      newHoldings = newQty === 0
        ? newHoldings.filter(h => h.symbol !== symbol)
        : newHoldings.map(h => h.symbol === symbol ? { ...h, quantity: newQty } : h);
    }

    const newBalance = Number((portfolio.balance + (type === 'BUY' ? -totalCost : totalCost)).toFixed(2));
    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 11),
      symbol,
      type,
      orderType,
      quantity,
      price,
      timestamp: Date.now(),
    };

    try {
      await setDoc(
        userRef,
        {
          balance: newBalance,
          holdings: newHoldings,
          history: [newTx, ...portfolio.history].slice(0, 50),
          limitOrders: portfolio.limitOrders || [],
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Place a pending Limit Order
  const handlePlaceLimitOrder = async (
    type: 'BUY' | 'SELL',
    symbol: string,
    quantity: number,
    limitPrice: number
  ) => {
    if (!user || !isMarketOpen) return;
    const path = `portfolios/${user.uid}`;
    const userRef = doc(db, 'portfolios', user.uid);
    const reservedCost = Number((quantity * limitPrice).toFixed(2));
    const existingHolding = portfolio.holdings.find(h => h.symbol === symbol);

    if (type === 'BUY' && portfolio.balance < reservedCost) return;
    if (type === 'SELL' && (!existingHolding || existingHolding.quantity < quantity)) return;

    let updatedBalance = portfolio.balance;
    let updatedHoldings = [...portfolio.holdings];

    if (type === 'BUY') {
      updatedBalance = Number((portfolio.balance - reservedCost).toFixed(2));
    } else {
      const remainingQty = existingHolding!.quantity - quantity;
      updatedHoldings = remainingQty === 0
        ? updatedHoldings.filter(h => h.symbol !== symbol)
        : updatedHoldings.map(h => h.symbol === symbol ? { ...h, quantity: remainingQty } : h);
    }

    const newOrder: LimitOrder = {
      id: Math.random().toString(36).substring(2, 11),
      symbol,
      type,
      quantity,
      limitPrice,
      createdAt: Date.now(),
    };

    try {
      await setDoc(
        userRef,
        {
          balance: updatedBalance,
          holdings: updatedHoldings,
          limitOrders: [newOrder, ...(portfolio.limitOrders || [])],
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Cancel a pending Limit Order
  const handleCancelLimitOrder = async (orderId: string) => {
    if (!user) return;
    const openOrders = portfolio.limitOrders || [];
    const target = openOrders.find(o => o.id === orderId);
    if (!target) return;

    const path = `portfolios/${user.uid}`;
    const userRef = doc(db, 'portfolios', user.uid);
    let updatedBalance = portfolio.balance;
    let updatedHoldings = [...portfolio.holdings];

    if (target.type === 'BUY') {
      updatedBalance = Number((portfolio.balance + target.quantity * target.limitPrice).toFixed(2));
    } else {
      const existing = updatedHoldings.find(h => h.symbol === target.symbol);
      if (existing) {
        updatedHoldings = updatedHoldings.map(h =>
          h.symbol === target.symbol ? { ...h, quantity: h.quantity + target.quantity } : h
        );
      } else {
        const refPrice = stocks.find(s => s.Symbol === target.symbol)?.LTP || target.limitPrice;
        updatedHoldings.push({ symbol: target.symbol, quantity: target.quantity, avgPrice: refPrice });
      }
    }

    try {
      await setDoc(
        userRef,
        {
          balance: updatedBalance,
          holdings: updatedHoldings,
          limitOrders: openOrders.filter(o => o.id !== orderId),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Automatically trigger pending Limit Orders when live LTP reaches or crosses target price
  useEffect(() => {
    if (!user || !isMarketOpen || isExecutingLimitRef.current) return;
    const openOrders = portfolio.limitOrders || [];
    if (openOrders.length === 0) return;

    const triggeredOrders: { order: LimitOrder; executionPrice: number }[] = [];
    const remainingOrders: LimitOrder[] = [];

    for (const order of openOrders) {
      const liveStock = stocks.find(s => s.Symbol === order.symbol);
      if (!liveStock) {
        remainingOrders.push(order);
        continue;
      }

      if (order.type === 'BUY' && liveStock.LTP <= order.limitPrice) {
        triggeredOrders.push({ order, executionPrice: liveStock.LTP });
      } else if (order.type === 'SELL' && liveStock.LTP >= order.limitPrice) {
        triggeredOrders.push({ order, executionPrice: liveStock.LTP });
      } else {
        remainingOrders.push(order);
      }
    }

    if (triggeredOrders.length === 0) return;

    isExecutingLimitRef.current = true;
    const path = `portfolios/${user.uid}`;
    const userRef = doc(db, 'portfolios', user.uid);

    let updatedBalance = portfolio.balance;
    let updatedHoldings = [...portfolio.holdings];
    const newTransactions: Transaction[] = [];

    for (const { order, executionPrice } of triggeredOrders) {
      if (order.type === 'BUY') {
        const priceImprovement = (order.limitPrice - executionPrice) * order.quantity;
        if (priceImprovement > 0) {
          updatedBalance = Number((updatedBalance + priceImprovement).toFixed(2));
        }
        const existing = updatedHoldings.find(h => h.symbol === order.symbol);
        if (existing) {
          const newQty = existing.quantity + order.quantity;
          const newAvg = Number(
            (((existing.avgPrice * existing.quantity) + (executionPrice * order.quantity)) / newQty).toFixed(2)
          );
          updatedHoldings = updatedHoldings.map(h =>
            h.symbol === order.symbol ? { ...h, quantity: newQty, avgPrice: newAvg } : h
          );
        } else {
          updatedHoldings.push({
            symbol: order.symbol,
            quantity: order.quantity,
            avgPrice: executionPrice,
          });
        }
      } else {
        const proceeds = Number((order.quantity * executionPrice).toFixed(2));
        updatedBalance = Number((updatedBalance + proceeds).toFixed(2));
      }

      newTransactions.push({
        id: Math.random().toString(36).substring(2, 11),
        symbol: order.symbol,
        type: order.type,
        orderType: 'LIMIT',
        quantity: order.quantity,
        price: executionPrice,
        timestamp: Date.now(),
      });
    }

    setDoc(
      userRef,
      {
        balance: updatedBalance,
        holdings: updatedHoldings,
        history: [...newTransactions, ...portfolio.history].slice(0, 50),
        limitOrders: remainingOrders,
      },
      { merge: true }
    )
      .catch((err) => handleFirestoreError(err, OperationType.WRITE, path))
      .finally(() => {
        isExecutingLimitRef.current = false;
      });
  }, [stocks, portfolio, user, isMarketOpen]);

  const selectedStock = useMemo(() => stocks.find(s => s.Symbol === selectedSymbol), [stocks, selectedSymbol]);
  const selectedCandles = historyBySymbol[selectedSymbol] || [];

  if (authLoading) return <div className="h-screen bg-[#080a0c] flex items-center justify-center"><Loader2 className="animate-spin text-[#2ebd85]" size={32} /></div>;
  if (!user) return <Auth />;

  return (
    <div className="flex flex-col h-screen bg-[#080a0c] text-slate-200 overflow-hidden font-sans">
      <header className="h-14 border-b border-[#1c2127] flex items-center justify-between gap-8 px-6 bg-[#111418] z-50 shrink-0">
        {/* Zone 1: Brand Wordmark */}
        <div
          className="flex items-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0"
          onClick={() => setActiveTab(AppTab.MARKET)}
        >
          <div className="bg-[#2ebd85] p-1.5 rounded-lg">
            <TrendingUp size={16} className="text-[#080a0c]" />
          </div>
          <span className="font-bold text-base tracking-tight text-white">
            Nexora Pro
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="flex items-center gap-2">
          {[
            { id: AppTab.MARKET, icon: LayoutDashboard, label: 'Terminal' },
            { id: AppTab.PORTFOLIO, icon: Briefcase, label: 'Portfolio' },
            { id: AppTab.AI_INSIGHTS, icon: Cpu, label: 'Analysis' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                activeTab === t.id
                  ? 'bg-[#1c2127] text-[#2ebd85]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <t.icon size={14} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Zone 3: Admin & Session Controls */}
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs text-slate-400 font-mono tabular-nums hidden lg:inline whitespace-nowrap">
            NEPSE Feed: {liveSyncedCount}/{ALL_FLAT_SYMBOLS.length}
          </span>

          {isAdmin && (
            <div className="flex items-center gap-1.5 bg-[#080a0c] p-1 rounded-lg border border-[#1c2127]">
              <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1 whitespace-nowrap">
                <ShieldCheck size={12} className="text-[#2ebd85]" /> Admin
              </span>
              <button
                onClick={toggleMarketStatus}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition whitespace-nowrap ${
                  isMarketOpen ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25' : 'bg-[#2ebd85]/15 text-[#2ebd85] hover:bg-[#2ebd85]/25'
                }`}
              >
                {isMarketOpen ? <Unlock size={12} /> : <Lock size={12} />}
                <span>{isMarketOpen ? 'Close Market' : 'Open Market'}</span>
              </button>
              <button
                onClick={syncMarketData}
                disabled={isApiSyncing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
              >
                {isApiSyncing ? <Loader2 size={12} className="animate-spin" /> : syncStatus.includes('Done') ? <CheckCircle2 size={12} /> : <RefreshCw size={12} />}
                <span>{syncStatus || 'Sync All'}</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap">
            <Clock size={13} className={isMarketOpen ? 'text-[#2ebd85]' : 'text-rose-400'} />
            <span className={isMarketOpen ? 'text-[#2ebd85]' : 'text-rose-400'}>
              {isMarketOpen ? 'Market Open' : 'Market Closed'}
            </span>
          </div>

          <button
            onClick={() => signOut(auth)}
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-rose-400 transition rounded-lg hover:bg-white/5"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === AppTab.MARKET && (
          <>
            <Sidebar
              stocks={stocks}
              selectedSymbol={selectedSymbol}
              onSelect={setSelectedSymbol}
              loading={isApiSyncing}
            />
            <MainTerminal
              stock={selectedStock}
              holdings={portfolio.holdings}
              stocks={stocks}
              isMarketOpen={isMarketOpen}
              historicalCandles={selectedCandles}
              historyLoading={historyLoading}
            />
            <OrderPanel
              stock={selectedStock}
              balance={portfolio.balance}
              history={portfolio.history}
              limitOrders={portfolio.limitOrders || []}
              onTrade={handleTrade}
              onPlaceLimitOrder={handlePlaceLimitOrder}
              onCancelLimitOrder={handleCancelLimitOrder}
              holdings={portfolio.holdings}
              isMarketOpen={isMarketOpen}
            />
          </>
        )}
        {activeTab === AppTab.PORTFOLIO && (
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <PortfolioView
              portfolio={portfolio}
              stocks={stocks}
              user={user}
              onTrade={handleTrade}
              onCancelLimitOrder={handleCancelLimitOrder}
              onUpdateName={async (n) => {
                if (user) await updateProfile(user, { displayName: n });
              }}
            />
          </div>
        )}
        {activeTab === AppTab.AI_INSIGHTS && (
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <AIInsights stocks={stocks} />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
