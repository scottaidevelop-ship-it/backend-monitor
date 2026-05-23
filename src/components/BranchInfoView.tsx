/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone Branch Info Query View
 */

import React, { useState, useMemo } from 'react';
import { Building, Search, Filter } from 'lucide-react';

interface BranchInfoProps {
  branchData: { code: string; name: string; region: string }[];
}

export function BranchInfoView({ branchData }: BranchInfoProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<'全部' | '北部地區' | '中部地區' | '南部地區' | '東部及離島'>('全部');

  const filteredBranches = useMemo(() => {
    return branchData.filter(b => {
      const matchesSearch = b.code.includes(searchText) || b.name.includes(searchText);
      const matchesRegion = selectedRegion === '全部' || b.region === selectedRegion;
      return matchesSearch && matchesRegion;
    });
  }, [branchData, searchText, selectedRegion]);

  const regionCounts = useMemo(() => {
    const counts = { '全部': branchData.length, '北部地區': 0, '中部地區': 0, '南部地區': 0, '東部及離島': 0 };
    branchData.forEach(b => {
      if (b.region in counts) {
        counts[b.region as keyof typeof counts]++;
      }
    });
    return counts;
  }, [branchData]);

  return (
    <div id="branch-info-container" className="space-y-6">
      
      {/* View Title */}
      <div id="branch-info-header" className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center tracking-widest font-display">
            <Building className="w-5 h-5 text-[#e08b46] mr-2" />
            分行資訊智慧檢索查詢 (Branch Lookup Tool)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            供 IT 大屏與值班櫃位系統即時檢索全台灣中立商銀實體分部、分行系統主機代號與服務網通管轄地域代碼。
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 bg-[#e08b46]/10 text-[#e08b46] border border-[#e08b46]/20 text-xs font-mono font-bold rounded-full">
            共 {branchData.length} 間運營物理網點
          </span>
        </div>
      </div>

      <div id="branch-info-content" className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
        
        {/* Left Filter Pane */}
        <div id="branch-filters-panel" className="bg-slate-50 p-5 rounded-xl border border-slate-200 h-fit space-y-5 shadow-inner">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2.5">
            <Filter className="w-4 h-4 text-[#e08b46]" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">分行地域過濾</h3>
          </div>

          {/* Region Tabs / Filters */}
          <div className="space-y-2">
            {(['全部', '北部地區', '中部地區', '南部地區', '東部及離島'] as const).map(region => (
              <button
                key={region}
                id={`filter-btn-${region}`}
                onClick={() => setSelectedRegion(region)}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-between cursor-pointer ${
                  selectedRegion === region
                    ? 'bg-[#e08b46] border border-[#e08b46] text-white font-bold shadow-md'
                    : 'text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent shadow-sm'
                }`}
              >
                <span>{region}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                  selectedRegion === region ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {regionCounts[region]}
                </span>
              </button>
            ))}
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 text-[10px] text-slate-500 leading-relaxed font-sans shadow-sm">
            📌 本查詢對照表由系統自動自中央會計庫存同步，此介面為純查詢檢索面板，不提供編輯/更動。
          </div>
        </div>

        {/* Right Lookup Grid */}
        <div id="branch-grid-panel" className="lg:col-span-3 space-y-4">
          
          {/* Search Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                id="branch-search-input"
                type="text"
                placeholder="輸入分行名稱、代號進行模糊检索... (例如: 總行、002)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full bg-white text-slate-900 pl-10 pr-4 py-2.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:border-[#e08b46] focus:ring-1 focus:ring-[#e08b46] font-sans shadow-sm transition-all placeholder-slate-400"
              />
            </div>
            {searchText && (
              <button
                id="clear-search-btn"
                onClick={() => setSearchText('')}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 px-3 py-2 cursor-pointer transition"
              >
                清除條件
              </button>
            )}
          </div>

          {/* Grid display of branches */}
          <div id="branch-results-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBranches.map((b) => (
              <div
                key={b.code}
                id={`branch-card-${b.code}`}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-[#e08b46]/50 transition-all duration-200 shadow-sm flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <span className="text-xs font-mono font-bold text-[#e08b46] tracking-widest">{b.code}</span>
                    <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100 font-sans">
                      {b.region}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#e08b46] transition-colors">
                      {b.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">Host mapped: AP-0{b.code} / DB-0{b.code}</p>
                  </div>
                </div>
                <div className="text-[9px] text-[#2c7da0] bg-sky-50 border border-sky-100 rounded px-2 py-1 mt-3 font-sans font-medium flex items-center justify-between">
                  <span>網通通訊：正常連線</span>
                  <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                </div>
              </div>
            ))}

            {filteredBranches.length === 0 && (
              <div id="no-branch-results" className="col-span-full py-12 text-center text-slate-400 border border-dashed border-slate-300 rounded-2xl bg-slate-50">
                <p className="text-sm">🔍 無任何相符的分行資料。請更換其他搜尋關鍵詞！</p>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
