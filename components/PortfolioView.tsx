import React, { useState } from 'react';
import { Portfolio, Stock } from '../types';
import { Wallet, History, ArrowUpRight, ArrowDownRight, User, Edit2, Check, X } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface PortfolioViewProps {
  portfolio: Portfolio;
  stocks: Stock[];
  onTrade: (type: 'BUY' | 'SELL', symbol: string, quantity: number, price: number) => void;
  onCancelLimitOrder: (orderId: string) => void;
  user: FirebaseUser | null;
  onUpdateName: (newName: string) => Promise<void>;
}

const PortfolioView: React.FC<PortfolioViewProps> = ({ portfolio, stocks, user, onUpdateName, onCancelLimitOrder }) => {
  const [activeSubTab, setActiveSubTab] = useState<'HOLDINGS' | 'OPEN_ORDERS' | 'HISTORY'>('HOLDINGS');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);

  const getStockPrice = (symbol: string) => {
    return stocks.find(s => s.Symbol === symbol)?.LTP || 0;
  };

  const calculateHoldingsValue = () => {
    return portfolio.holdings.reduce((acc, h) => acc + (h.quantity * getStockPrice(h.symbol)), 0);
  };

  const calculateReservedCash = () => {
    return (portfolio.limitOrders || [])
      .filter(o => o.type === 'BUY')
      .reduce((acc, o) => acc + o.quantity * o.limitPrice, 0);
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateName(tempName.trim());
      setIsEditingName(false);
    } finally {
      setIsSaving(false);
    }
  };

  const holdingsValue = calculateHoldingsValue();
  const reservedCash = calculateReservedCash();
  const totalValue = portfolio.balance + reservedCash + holdingsValue;
  const initialValue = 50000; 
  const totalPL = totalValue - initialValue;
  const plPercentage = (totalPL / initialValue) * 100;
  const openOrders = portfolio.limitOrders || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Trader Profile Header */}
      <div className="bg-[#111418] p-6 rounded-2xl border border-[#1c2127] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#2ebd85]/15 border border-[#2ebd85]/30 flex items-center justify-center text-[#2ebd85]">
            <User size={24} />
          </div>
          <div>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={50}
                  className="bg-[#080a0c] border border-[#2ebd85] rounded-lg px-3 py-1 text-sm font-bold text-white outline-none"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                />
                <button onClick={handleSaveName} disabled={isSaving} className="p-1.5 text-[#2ebd85] hover:bg-[#2ebd85]/10 rounded">
                  <Check size={16} />
                </button>
                <button onClick={() => { setIsEditingName(false); setTempName(user?.displayName || ''); }} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {user?.displayName || 'Trader Account'}
                </h2>
                <button onClick={() => setIsEditingName(true)} className="p-1 text-slate-400 hover:text-white transition" title="Edit Display Name">
                  <Edit2 size={13} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Account ID: {user?.uid.substring(0, 8).toUpperCase()}</span>
              <span aria-hidden="true">·</span>
              <span>Paper Trading Equity</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-xs text-slate-400">Net Account Equity</p>
            <p className="text-xl font-mono font-bold text-white tabular-nums">
              NPR {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111418] p-5 rounded-2xl border border-[#1c2127] flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-medium">Available Cash Balance</span>
            <Wallet size={16} />
          </div>
          <div className="text-2xl font-mono font-bold text-white tabular-nums">
            NPR {portfolio.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {reservedCash > 0 && (
            <div className="text-[11px] font-mono text-slate-400 tabular-nums">
              Reserved in Limit Buys: NPR {reservedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>

        <div className="bg-[#111418] p-5 rounded-2xl border border-[#1c2127] flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-medium">Holdings Market Value</span>
            <ArrowUpRight size={16} />
          </div>
          <div className="text-2xl font-mono font-bold text-white tabular-nums">
            NPR {holdingsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400">
            {portfolio.holdings.length} active {portfolio.holdings.length === 1 ? 'position' : 'positions'}
          </div>
        </div>

        <div className="bg-[#111418] p-5 rounded-2xl border border-[#1c2127] flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-medium">Total Return (vs NPR 50,000)</span>
            {totalPL >= 0 ? <ArrowUpRight className="text-[#2ebd85]" size={16} /> : <ArrowDownRight className="text-[#f6465d]" size={16} />}
          </div>
          <div className={`text-2xl font-mono font-bold tabular-nums ${totalPL >= 0 ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
            {totalPL >= 0 ? '+' : ''}NPR {totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs font-mono font-semibold tabular-nums ${totalPL >= 0 ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
            {totalPL >= 0 ? '+' : ''}{plPercentage.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-6 border-b border-[#1c2127]">
        <button 
          onClick={() => setActiveSubTab('HOLDINGS')}
          className={`pb-3 px-1 text-sm font-semibold transition relative whitespace-nowrap ${
            activeSubTab === 'HOLDINGS' ? 'text-[#2ebd85] border-b-2 border-[#2ebd85]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Holdings ({portfolio.holdings.length})
        </button>
        <button 
          onClick={() => setActiveSubTab('OPEN_ORDERS')}
          className={`pb-3 px-1 text-sm font-semibold transition relative whitespace-nowrap ${
            activeSubTab === 'OPEN_ORDERS' ? 'text-[#2ebd85] border-b-2 border-[#2ebd85]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Open Limit Orders ({openOrders.length})
        </button>
        <button 
          onClick={() => setActiveSubTab('HISTORY')}
          className={`pb-3 px-1 text-sm font-semibold transition relative whitespace-nowrap ${
            activeSubTab === 'HISTORY' ? 'text-[#2ebd85] border-b-2 border-[#2ebd85]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Order History ({portfolio.history.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeSubTab === 'HOLDINGS' && (
        <div className="bg-[#111418] rounded-2xl overflow-hidden border border-[#1c2127]">
          {portfolio.holdings.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <User size={36} className="text-slate-600" />
              <p className="text-sm">Your portfolio has no active equity holdings yet. Place a Market or Limit order in the Terminal tab.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#080a0c] border-b border-[#1c2127] text-slate-400 text-xs">
                  <tr>
                    <th className="px-6 py-3.5 font-semibold">Instrument</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Quantity</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Avg Cost (NPR)</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Live LTP (NPR)</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Market Value</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Unrealized P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2127]">
                  {portfolio.holdings.map((h) => {
                    const ltp = getStockPrice(h.symbol);
                    const marketVal = h.quantity * ltp;
                    const invested = h.quantity * h.avgPrice;
                    const pl = marketVal - invested;
                    const plPct = invested > 0 ? (pl / invested) * 100 : 0;

                    return (
                      <tr key={h.symbol} className="hover:bg-white/[0.02] transition">
                        <td className="px-6 py-3.5 font-bold text-white">{h.symbol}</td>
                        <td className="px-6 py-3.5 text-right font-mono tabular-nums">{h.quantity}</td>
                        <td className="px-6 py-3.5 text-right font-mono tabular-nums">{h.avgPrice.toFixed(2)}</td>
                        <td className="px-6 py-3.5 text-right font-mono tabular-nums">{ltp.toFixed(2)}</td>
                        <td className="px-6 py-3.5 text-right font-mono font-semibold tabular-nums">
                          NPR {marketVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-6 py-3.5 text-right font-mono font-semibold tabular-nums ${pl >= 0 ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
                          {pl >= 0 ? '+' : ''}{pl.toFixed(2)} ({pl >= 0 ? '+' : ''}{plPct.toFixed(2)}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'OPEN_ORDERS' && (
        <div className="bg-[#111418] rounded-2xl overflow-hidden border border-[#1c2127]">
          {openOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <History size={36} className="text-slate-600" />
              <p className="text-sm">No open limit orders. Pending limit orders automatically execute when live LTP crosses your target price.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#080a0c] border-b border-[#1c2127] text-slate-400 text-xs">
                  <tr>
                    <th className="px-6 py-3.5 font-semibold">Created</th>
                    <th className="px-6 py-3.5 font-semibold">Side</th>
                    <th className="px-6 py-3.5 font-semibold">Instrument</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Quantity</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Limit Price</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Current LTP</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2127]">
                  {openOrders.map((o) => {
                    const currentLtp = getStockPrice(o.symbol);
                    return (
                      <tr key={o.id} className="hover:bg-white/[0.02] transition">
                        <td className="px-6 py-3.5 text-xs font-mono text-slate-400 tabular-nums">
                          {new Date(o.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`font-bold text-xs ${o.type === 'BUY' ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
                            {o.type} LIMIT
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-bold text-white">{o.symbol}</td>
                        <td className="px-6 py-3.5 text-right font-mono tabular-nums">{o.quantity}</td>
                        <td className="px-6 py-3.5 text-right font-mono font-semibold text-white tabular-nums">
                          NPR {o.limitPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-slate-400 tabular-nums">
                          NPR {currentLtp.toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => onCancelLimitOrder(o.id)}
                            className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'HISTORY' && (
        <div className="bg-[#111418] rounded-2xl overflow-hidden border border-[#1c2127]">
          {portfolio.history.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <History size={36} className="text-slate-600" />
              <p className="text-sm">No trading activity recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#080a0c] border-b border-[#1c2127] text-slate-400 text-xs">
                  <tr>
                    <th className="px-6 py-3.5 font-semibold">Timestamp</th>
                    <th className="px-6 py-3.5 font-semibold">Type</th>
                    <th className="px-6 py-3.5 font-semibold">Instrument</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Quantity</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Execution Price</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2127] text-slate-300">
                  {portfolio.history.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-3.5 text-xs font-mono text-slate-400 tabular-nums">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`text-xs font-bold ${tx.type === 'BUY' ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
                          {tx.type} {tx.orderType ? `(${tx.orderType})` : ''}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-bold text-white">{tx.symbol}</td>
                      <td className="px-6 py-3.5 text-right font-mono tabular-nums">{tx.quantity}</td>
                      <td className="px-6 py-3.5 text-right font-mono tabular-nums">NPR {tx.price.toFixed(2)}</td>
                      <td className="px-6 py-3.5 text-right font-mono font-semibold text-white tabular-nums">
                        NPR {(tx.quantity * tx.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PortfolioView;
