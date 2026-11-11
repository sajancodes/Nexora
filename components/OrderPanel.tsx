import React, { useState, useEffect } from 'react';
import { Stock, Transaction, Holding, LimitOrder } from '../types';
import { Clock, AlertCircle, X, CheckCircle2 } from 'lucide-react';

interface OrderPanelProps {
  stock?: Stock;
  balance: number;
  history: Transaction[];
  limitOrders: LimitOrder[];
  onTrade: (type: 'BUY' | 'SELL', symbol: string, quantity: number, price: number) => Promise<void> | void;
  onPlaceLimitOrder: (type: 'BUY' | 'SELL', symbol: string, quantity: number, limitPrice: number) => Promise<void> | void;
  onCancelLimitOrder: (orderId: string) => Promise<void> | void;
  holdings: Holding[];
  isMarketOpen: boolean;
}

const OrderPanel: React.FC<OrderPanelProps> = ({
  stock,
  balance,
  history,
  limitOrders,
  onTrade,
  onPlaceLimitOrder,
  onCancelLimitOrder,
  holdings,
  isMarketOpen,
}) => {
  const [orderMode, setOrderMode] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [bottomTab, setBottomTab] = useState<'OPEN' | 'HISTORY'>('OPEN');
  const [qty, setQty] = useState<number>(10);
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (stock) {
      setLimitPrice(stock.LTP.toFixed(2));
    }
  }, [stock?.Symbol]);

  if (!stock) return <aside className="w-80 bg-[#111418] border-l border-[#1c2127] shrink-0"></aside>;

  const parsedLimitPrice = parseFloat(limitPrice);
  const effectivePrice = orderMode === 'LIMIT' ? (isNaN(parsedLimitPrice) ? 0 : parsedLimitPrice) : stock.LTP;
  const totalAmount = qty * effectivePrice;
  const currentHolding = holdings.find(h => h.symbol === stock.Symbol);
  const availableShares = currentHolding?.quantity || 0;

  const showNotice = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleOrderSubmit = async (side: 'BUY' | 'SELL') => {
    if (!isMarketOpen) {
      showNotice('error', 'Market is currently closed.');
      return;
    }
    if (qty <= 0) {
      showNotice('error', 'Quantity must be at least 1.');
      return;
    }
    if (orderMode === 'LIMIT' && (isNaN(parsedLimitPrice) || parsedLimitPrice <= 0)) {
      showNotice('error', 'Enter a valid limit price.');
      return;
    }
    if (side === 'BUY' && balance < totalAmount) {
      showNotice('error', `Insufficient cash balance (Need NPR ${totalAmount.toLocaleString()}).`);
      return;
    }
    if (side === 'SELL' && availableShares < qty) {
      showNotice('error', `Insufficient holdings (${availableShares} shares available).`);
      return;
    }

    if (orderMode === 'MARKET') {
      await onTrade(side, stock.Symbol, qty, stock.LTP);
      showNotice('success', `Executed ${side} ${qty} ${stock.Symbol} @ NPR ${stock.LTP.toFixed(2)}`);
    } else {
      // If limit price is already marketable, execute immediately at LTP
      if ((side === 'BUY' && stock.LTP <= parsedLimitPrice) || (side === 'SELL' && stock.LTP >= parsedLimitPrice)) {
        await onTrade(side, stock.Symbol, qty, stock.LTP);
        showNotice('success', `Limit ${side} filled immediately @ NPR ${stock.LTP.toFixed(2)}`);
      } else {
        await onPlaceLimitOrder(side, stock.Symbol, qty, parsedLimitPrice);
        setBottomTab('OPEN');
        showNotice('success', `Placed ${side} Limit ${qty} ${stock.Symbol} @ NPR ${parsedLimitPrice.toFixed(2)}`);
      }
    }
  };

  return (
    <aside className="w-80 border-l border-[#1c2127] bg-[#111418] flex flex-col overflow-hidden shrink-0">
      {/* Order Entry Form */}
      <div className="p-4 flex flex-col gap-3.5 border-b border-[#1c2127]">
        {!isMarketOpen && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex items-start gap-2">
            <AlertCircle size={14} className="text-rose-400 mt-0.5 shrink-0" />
            <div className="text-xs text-rose-200 leading-snug">
              <span className="font-bold block">Market Closed</span>
              Ask an administrator to open the market session to execute orders.
            </div>
          </div>
        )}

        {/* Market / Limit Mode Switcher */}
        <div className="flex bg-[#080a0c] p-1 rounded-lg border border-[#1c2127]">
          <button 
            onClick={() => setOrderMode('MARKET')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap ${
              orderMode === 'MARKET' ? 'bg-[#2ebd85] text-[#080a0c] font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Market Order
          </button>
          <button 
            onClick={() => {
              setOrderMode('LIMIT');
              if (!limitPrice) setLimitPrice(stock.LTP.toFixed(2));
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap ${
              orderMode === 'LIMIT' ? 'bg-[#2ebd85] text-[#080a0c] font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Limit Order
          </button>
        </div>

        <div className={`space-y-3 transition-opacity duration-200 ${!isMarketOpen ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Target Limit Price Input (shown when LIMIT is active) */}
          {orderMode === 'LIMIT' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-400">Limit Price (NPR)</label>
                <button
                  type="button"
                  onClick={() => setLimitPrice(stock.LTP.toFixed(2))}
                  className="text-[11px] text-[#2ebd85] hover:underline font-mono tabular-nums"
                >
                  LTP: {stock.LTP.toFixed(2)}
                </button>
              </div>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                disabled={!isMarketOpen}
                className="w-full bg-[#080a0c] border border-[#1c2127] rounded-lg px-3 py-2 text-sm font-mono font-semibold text-white tabular-nums focus:outline-none focus:border-[#2ebd85]"
              />
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-400">Quantity (Shares)</label>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                Held: {availableShares}
              </span>
            </div>
            <input 
              type="number"
              min="1"
              className="w-full bg-[#080a0c] border border-[#1c2127] rounded-lg px-3 py-2 text-sm font-mono font-semibold text-white tabular-nums focus:outline-none focus:border-[#2ebd85]"
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
              disabled={!isMarketOpen}
            />
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[10, 25, 50, 100].map(val => (
                <button 
                  key={val}
                  type="button"
                  onClick={() => setQty(prev => prev + val)}
                  disabled={!isMarketOpen}
                  className="bg-[#080a0c] border border-[#1c2127] py-1 text-xs font-mono font-medium text-slate-300 rounded hover:bg-[#1c2127] transition disabled:opacity-50"
                >
                  +{val}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Row */}
          <div className="bg-[#080a0c] p-3 rounded-lg border border-[#1c2127] space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Estimated Total</span>
              <span className="font-mono font-bold text-[#2ebd85] tabular-nums">
                NPR {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Available Cash</span>
              <span className="font-mono text-slate-300 tabular-nums">
                NPR {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {feedback && (
            <div
              className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-[#2ebd85]/15 border border-[#2ebd85]/30 text-[#2ebd85]'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
              <span className="leading-tight">{feedback.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button 
              type="button"
              onClick={() => handleOrderSubmit('BUY')}
              disabled={!isMarketOpen}
              className="w-full bg-[#2ebd85] hover:bg-[#27b07a] text-[#080a0c] font-bold py-2.5 px-4 rounded-lg transition active:scale-[0.98] text-xs disabled:bg-slate-800 disabled:text-slate-500 whitespace-nowrap"
            >
              Buy {stock.Symbol}
            </button>
            <button 
              type="button"
              onClick={() => handleOrderSubmit('SELL')}
              disabled={!isMarketOpen}
              className="w-full bg-[#f6465d] hover:bg-[#e03e53] text-white font-bold py-2.5 px-4 rounded-lg transition active:scale-[0.98] text-xs disabled:bg-slate-800 disabled:text-slate-500 whitespace-nowrap"
            >
              Sell {stock.Symbol}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Open Orders & Order History Section */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#080a0c]/40">
        <div className="px-3 py-2 border-b border-[#1c2127] flex items-center gap-2 bg-[#0b0e11]">
          <button
            onClick={() => setBottomTab('OPEN')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition whitespace-nowrap ${
              bottomTab === 'OPEN' ? 'bg-[#1c2127] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Open Orders ({limitOrders.length})
          </button>
          <button
            onClick={() => setBottomTab('HISTORY')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              bottomTab === 'HISTORY' ? 'bg-[#1c2127] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock size={12} />
            <span>History ({history.length})</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {bottomTab === 'OPEN' ? (
            limitOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No pending limit orders. Switch to Limit Order above to set a target price.
              </div>
            ) : (
              limitOrders.map(order => (
                <div key={order.id} className="p-3 border-b border-[#1c2127]/60 hover:bg-white/[0.02] transition flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${order.type === 'BUY' ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
                        {order.type} LIMIT
                      </span>
                      <span className="text-xs font-bold text-white">{order.symbol}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                      {order.quantity} shares @ NPR {order.limitPrice.toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => onCancelLimitOrder(order.id)}
                    title="Cancel Limit Order"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No executed trades recorded yet.
            </div>
          ) : (
            history.map(tx => (
              <div key={tx.id} className="p-3 border-b border-[#1c2127]/60 hover:bg-white/[0.02] transition">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${tx.type === 'BUY' ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
                      {tx.type}
                    </span>
                    <span className="text-xs font-bold text-slate-200">{tx.symbol}</span>
                    {tx.orderType === 'LIMIT' && (
                      <span className="text-[10px] text-slate-400">· Limit</span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                    {new Date(tx.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 tabular-nums">
                  <span>{tx.quantity} shares @ {tx.price.toFixed(2)}</span>
                  <span className="text-slate-300 font-semibold">NPR {(tx.quantity * tx.price).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};

export default OrderPanel;
