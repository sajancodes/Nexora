import React, { useState, useMemo } from 'react';
import { Stock } from '../types';
import { Search, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SidebarProps {
  stocks: Stock[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  loading: boolean;
}

const SECTOR_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'Banks', label: 'Banks' },
  { id: 'Development & Finance', label: 'Finance' },
  { id: 'Insurance', label: 'Insur.' },
  { id: 'Hydropower', label: 'Hydro' },
  { id: 'Manufacturing & Others', label: 'Others' },
];

const Sidebar: React.FC<SidebarProps> = ({ stocks, selectedSymbol, onSelect, loading }) => {
  const [search, setSearch] = useState('');
  const [activeSector, setActiveSector] = useState<string>('ALL');

  const filtered = useMemo(() => {
    return stocks.filter(s => {
      const matchesSearch = s.Symbol.toLowerCase().includes(search.toLowerCase());
      const matchesSector = activeSector === 'ALL' || s.Sector === activeSector;
      return matchesSearch && matchesSector;
    });
  }, [stocks, search, activeSector]);

  return (
    <aside className="w-64 border-r border-[#1c2127] bg-[#111418] flex flex-col shrink-0">
      <div className="p-3 border-b border-[#1c2127] bg-[#080a0c] space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
          <input 
            type="text"
            placeholder="Search symbol..."
            className="w-full bg-[#111418] border border-[#1c2127] rounded-lg py-2 pl-8 pr-3 text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2ebd85] transition placeholder:text-slate-600 uppercase"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Interactive Sector Filter Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-[#111418] p-1 rounded-lg border border-[#1c2127]">
          {SECTOR_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSector(tab.id)}
              className={`py-1 px-1.5 rounded text-[10px] font-semibold transition whitespace-nowrap truncate ${
                activeSector === tab.id
                  ? 'bg-[#2ebd85] text-[#080a0c] font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="px-4 py-2 flex justify-between items-center text-[11px] font-semibold text-slate-400 bg-[#111418]/60 border-b border-[#1c2127]">
        <span>Watchlist · {filtered.length}</span>
        {loading && <Loader2 size={12} className="animate-spin text-[#2ebd85]" />}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#080a0c]">
        {filtered.length > 0 ? (
          filtered.map(stock => {
            const isSelected = selectedSymbol === stock.Symbol;
            return (
              <button
                key={stock.Symbol}
                onClick={() => onSelect(stock.Symbol)}
                className={`w-full px-4 py-2.5 flex justify-between items-center transition border-b border-[#1c2127]/40 ${
                  isSelected ? 'bg-[#2ebd85]/10' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="text-left min-w-0">
                  <div className={`text-xs font-bold tracking-tight ${isSelected ? 'text-[#2ebd85]' : 'text-slate-200'}`}>
                    {stock.Symbol}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {stock.Sector || 'NEPSE'}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end shrink-0">
                  <div className="text-xs font-mono font-semibold text-slate-200 tabular-nums">
                    {stock.LTP.toFixed(2)}
                  </div>
                  <div className={`text-[10px] font-mono font-medium flex items-center gap-0.5 tabular-nums ${stock.Change >= 0 ? 'text-[#2ebd85]' : 'text-[#f6465d]'}`}>
                    {stock.Change >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {Math.abs(stock.Change).toFixed(2)}%
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            No matching instruments in this sector.
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
