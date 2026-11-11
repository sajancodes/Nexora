import React, { useState, useEffect } from 'react';
import { Stock } from '../types';
import { streamGeminiAnalysis, AIChunk } from '../services/geminiService';
import { BrainCircuit, RefreshCcw, ShieldAlert, Cpu } from 'lucide-react';

interface AIInsightsProps {
  stocks: Stock[];
}

const AIInsights: React.FC<AIInsightsProps> = ({ stocks }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [reasoning, setReasoning] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateAnalysis = async () => {
    if (stocks.length === 0 || loading) return;
    setLoading(true);
    setAnalysis('');
    setReasoning('');

    await streamGeminiAnalysis(stocks, (chunk: AIChunk) => {
      if (chunk.reasoning) setReasoning(prev => prev + chunk.reasoning);
      if (chunk.content) setAnalysis(prev => prev + chunk.content);
    });
    
    setLoading(false);
  };

  useEffect(() => {
    if (stocks.length > 0 && !analysis && !loading) {
      generateAnalysis();
    }
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111418] p-6 rounded-2xl border border-[#1c2127]">
        <div className="flex items-center gap-4">
          <div className="bg-[#2ebd85]/15 p-3 rounded-xl border border-[#2ebd85]/30">
            <BrainCircuit className="text-[#2ebd85] w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Nexora Market Intelligence</h2>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Cpu size={13} className="text-[#2ebd85]" />
              <span>Real-time NEPSE Quantitative Synthesis · Powered by Gemini</span>
            </p>
          </div>
        </div>
        <button 
          onClick={generateAnalysis}
          disabled={loading}
          className="flex items-center gap-2 bg-[#2ebd85] hover:bg-[#27b07a] disabled:opacity-50 px-5 py-2.5 rounded-xl transition text-[#080a0c] font-bold text-xs whitespace-nowrap shrink-0"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Synthesizing Market...' : 'Refresh Analysis'}</span>
        </button>
      </div>

      {reasoning && (
        <div className="bg-[#111418] border border-[#1c2127] p-5 rounded-2xl">
          <div className="text-xs font-semibold text-[#2ebd85] mb-2">
            Market Telemetry & Breadth Input
          </div>
          <div className="text-xs font-mono text-slate-400 leading-relaxed tabular-nums">
            {reasoning}
          </div>
        </div>
      )}

      <div className="bg-[#111418] rounded-2xl p-8 border border-[#1c2127]">
        {loading && !analysis ? (
          <div className="space-y-4">
            <div className="h-5 bg-slate-800/50 animate-pulse rounded w-1/3"></div>
            <div className="h-4 bg-slate-800/30 animate-pulse rounded w-5/6"></div>
            <div className="h-4 bg-slate-800/30 animate-pulse rounded w-3/4"></div>
            <div className="h-28 bg-slate-800/20 animate-pulse rounded-xl w-full mt-4"></div>
          </div>
        ) : (
          <div className="max-w-none space-y-3 text-sm text-slate-300 leading-relaxed">
            {analysis ? analysis.split('\n').map((line, i) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('#')) {
                return (
                  <h3 key={i} className="text-base font-bold text-[#2ebd85] mt-6 first:mt-0 mb-2 border-b border-[#1c2127] pb-2">
                    {trimmed.replace(/^#+\s*/, '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                return (
                  <li key={i} className="ml-5 list-disc text-slate-300">
                    {trimmed.substring(1).trim()}
                  </li>
                );
              }
              if (trimmed === '') return <div key={i} className="h-2" />;
              return <p key={i} className="text-slate-300">{line}</p>;
            }) : (
              <div className="text-center py-16 text-slate-500 text-sm">
                Click Refresh Analysis to generate a live NEPSE market report.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex gap-3 items-start">
        <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={18} />
        <p className="text-xs text-amber-200/80 leading-relaxed">
          <strong className="text-amber-400 font-semibold block mb-0.5">Simulation & Risk Disclosure</strong>
          Market insights are generated from live and simulated NEPSE paper-trading feeds for educational analysis only and do not constitute financial advice.
        </p>
      </div>
    </div>
  );
};

export default AIInsights;
