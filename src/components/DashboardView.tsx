/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ServerInstance, 
  ShiftDuty, 
  FileConversionTask, 
  SettlementStep 
} from '../types';
import { 
  Server, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XOctagon, 
  ArrowRight, 
  Smartphone, 
  BellRing, 
  Info, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  Zap, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Search, 
  Filter 
} from 'lucide-react';

interface DashboardProps {
  servers: ServerInstance[];
  shifts: ShiftDuty[];
  dispatchedAlerts: any[];
  calendarMode: 'weekday' | 'holiday' | 'typhoon';
  onRebootMicroservice: (serverId: string, msId: string) => Promise<void>;
  onSimulateAlert: (channels: ('SMS' | 'LINE' | 'Email')[], text: string, serverId: string) => Promise<any>;
}

export function DashboardView({
  servers,
  shifts,
  dispatchedAlerts,
  calendarMode,
  onRebootMicroservice,
  onSimulateAlert
}: DashboardProps) {
  // Filters & State
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'AP' | 'DB'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'normal' | 'warning' | 'error'>('ALL');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  
  // Alert Testing Form
  const [msgText, setMsgText] = useState('臨界警告：交易中台代碼 [AP-023] 出現線程集體鎖死！請速查！');
  const [alertChannels, setAlertChannels] = useState<('SMS' | 'LINE' | 'Email')[]>(['LINE', 'SMS']);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertResult, setAlertResult] = useState<{ success: boolean; blocked?: boolean; reason?: string; dispatched?: any[]; staffName?: string } | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifiedTarget, setVerifiedTarget] = useState<any | null>(null);

  // Sound Alarm Indicator
  const [isMuted, setIsMuted] = useState(true);

  // Active On-Duty info (for today)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const activeShift = useMemo(() => {
    return shifts.find(s => s.date === todayStr) || shifts[0];
  }, [shifts, todayStr]);

  // Compute counts
  const stats = useMemo(() => {
    return {
      total: servers.length,
      normal: servers.filter(s => s.status === 'normal').length,
      warning: servers.filter(s => s.status === 'warning').length,
      error: servers.filter(s => s.status === 'error').length,
    };
  }, [servers]);

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase()) || s.ip.includes(search);
      const matchType = filterType === 'ALL' || s.type === filterType;
      const matchStatus = filterStatus === 'ALL' || s.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [servers, search, filterType, filterStatus]);

  // Selected Server Detail Object
  const selectedServer = useMemo(() => {
    return servers.find(s => s.id === selectedServerId) || null;
  }, [servers, selectedServerId]);

  // Handle Send Simulated Alert
  const handleAlertSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (alertChannels.length === 0) {
      alert('請至少勾選一種發送通報管道！');
      return;
    }
    setSendingAlert(true);
    setAlertResult(null);
    try {
      const res = await onSimulateAlert(alertChannels, msgText, selectedServerId || 'AP-012');
      setAlertResult(res);
      
      // If client pushed LINE and needs biometric check
      if (res.success && alertChannels.includes('LINE') && !res.blocked) {
        const lineItem = res.dispatched?.find((d: any) => d.channel === 'LINE');
        if (lineItem && !lineItem.verified) {
          setVerifiedTarget(lineItem);
          setShowVerificationModal(true);
        }
      }
    } catch (err: any) {
      alert('模擬通報發送失敗：' + err.message);
    } finally {
      setSendingAlert(false);
    }
  };

  const handleVerifyLineCode = () => {
    if (verificationCode === '8888') {
      alert('行動裝置身分識別授與成功！已確認值班同仁 [' + activeShift?.primaryDuty.name + '] 工作環境指紋與 OTP 驗證。');
      setShowVerificationModal(false);
      setVerificationCode('');
    } else {
      alert('驗證密碼錯誤！請輸入預設值班安全令牌「8888」進行驗證。');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1.1 Monitoring Dashboard Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Core Stats Overview */}
        <div className="bento-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-slate-500">系統主機總數</span>
              <span className="p-1.5 rounded-lg bg-[#e08b46]/10 text-[#e08b46]">
                <Server className="w-5 h-5" />
              </span>
            </div>
            <div className="text-4xl font-extrabold text-slate-900 tracking-tight">{stats.total} <span className="text-sm font-normal text-slate-500">台</span></div>
            <p className="text-xs text-slate-500 mt-2">銀行中台交易、核心會計與批次分散式架構監控</p>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-bento-border">
            <button 
              onClick={() => { setFilterStatus('normal'); setFilterType('ALL'); }}
              className={`p-2 rounded-xl text-center transition duration-200 cursor-pointer ${filterStatus === 'normal' ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-slate-50 hover:bg-slate-100 text-emerald-600 border border-bento-border'}`}
            >
              <div className="text-lg font-bold">{stats.normal}</div>
              <div className="text-xs">正常</div>
            </button>
            <button 
              onClick={() => { setFilterStatus('warning'); setFilterType('ALL'); }}
              className={`p-2 rounded-xl text-center transition duration-200 cursor-pointer ${filterStatus === 'warning' ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30' : 'bg-slate-50 hover:bg-slate-100 text-amber-600 border border-bento-border'}`}
            >
              <div className="text-lg font-bold">{stats.warning}</div>
              <div className="text-xs">警告</div>
            </button>
            <button 
              onClick={() => { setFilterStatus('error'); setFilterType('ALL'); }}
              className={`p-2 rounded-xl text-center transition duration-200 cursor-pointer ${filterStatus === 'error' ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30' : 'bg-slate-50 hover:bg-slate-100 text-rose-600 border border-bento-border'}`}
            >
              <div className="text-lg font-bold">{stats.error}</div>
              <div className="text-xs">故障</div>
            </button>
          </div>
        </div>

        {/* 1.2 On-duty Smart notification info block */}
        <div className="bento-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-500">今日值班調度與智能通報</span>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                calendarMode === 'weekday' 
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                  : 'bg-[#e08b46]/10 text-[#e08b46] border-[#e08b46]/20'
              }`}>
                {calendarMode === 'weekday' ? '平日工作期' : calendarMode === 'holiday' ? '假日/節慶' : '颱風警戒日'}
              </span>
            </div>
            
            <div className="space-y-2.5 my-3">
              <div className="bento-box-inner p-3">
                <div className="flex items-center space-x-2 text-xs text-sky-600 font-semibold mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
                  <span>第一負責人 (Primary)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-900">{activeShift?.primaryDuty.name}</span>
                  <span className="text-xs text-slate-500">{activeShift?.primaryDuty.phone}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-bento-border p-3 rounded-xl">
                <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>第二負責人 (Backup)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">{activeShift?.secondaryDuty.name}</span>
                  <span className="text-xs text-slate-500">{activeShift?.secondaryDuty.phone}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 leading-relaxed bento-box-inner p-3">
            <div className="flex items-center font-bold text-slate-700 mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 mr-1" />
              <span>自動過濾邏輯已啟用</span>
            </div>
            <span>
              {calendarMode === 'weekday' 
                ? '所有即時監控異常，將直接透過多管道同步推播給值班人員。' 
                : '假日/非交易時段，自動攔截「逾時」警報。防止錯誤干擾假值。'}
            </span>
          </div>
        </div>

        {/* Dynamic Event Feed Stream / Audio Alert */}
        <div className="bento-card p-5 flex flex-col justify-between lg:col-span-2">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-500 flex items-center">
                <Activity className="w-4 h-4 text-[#e08b46] mr-1 animate-pulse" />
                最新主動通報軌跡記錄 ({dispatchedAlerts.slice(0, 5).length})
              </span>
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${isMuted ? 'bg-slate-100 hover:bg-slate-200 text-slate-500' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>喇叭靜音</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-red-600 animate-bounce" />
                    <span>警報已啟</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-36 pr-1">
              {dispatchedAlerts.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  目前無主動告警記錄，系統各節點運行承載良好。
                </div>
              ) : (
                dispatchedAlerts.slice(0, 4).map((alert, i) => (
                  <div key={alert.id || i} className="bg-slate-50 p-2.5 rounded-xl border border-bento-border border-l-2 border-l-amber-500 text-xs flex justify-between items-center">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-1">
                        <span className="px-1 py-0.2 bg-slate-200 rounded font-mono text-[9px] text-slate-600">{alert.channel}</span>
                        <span className="font-bold text-slate-700">{alert.serverName}</span>
                        <span className="text-[10px] text-slate-500">{alert.timestamp}</span>
                      </div>
                      <p className="text-slate-600 line-clamp-1">{alert.alertText}</p>
                    </div>
                    <div>
                      {alert.channel === 'LINE' && (
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${alert.verified ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                          {alert.verified ? '身分已確認' : '待指紋防偽'}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-200 text-xs text-slate-500">
            <span>通報伺服群組運作：99.98% / 延遲: 42ms</span>
            <span className="text-[#e08b46] hover:text-[#d07a35] transition cursor-pointer flex items-center">
              查看全部 <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          </div>
        </div>

      </div>

      {/* 1.1 Main Interactive 100~200 Servers matrix and Details side panel */}
      <div className="bento-card p-5">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 pb-4 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <Server className="w-5 h-5 text-[#e08b46] mr-2" />
              中台中樞 120 台主機運行戰情矩陣 (Server Matrix)
            </h2>
            <p className="text-xs text-slate-500">綠色代表通訊健全正常，黃色為指標警告臨界，紅色為阻斷性異常(需立即處置)</p>
          </div>
          
          {/* Filtering Widgets */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜尋代碼、IP、主機名..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white text-slate-700 pl-9 pr-3 py-1.5 rounded-lg text-xs border border-slate-200 focus:outline-none focus:border-[#e08b46] w-44"
              />
            </div>

            <div className="bg-slate-50 p-0.5 rounded-lg border border-slate-200 flex">
              <button 
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${filterType === 'ALL' ? 'bg-[#e08b46] text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                全部
              </button>
              <button 
                onClick={() => setFilterType('AP')}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${filterType === 'AP' ? 'bg-[#e08b46] text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                AP
              </button>
              <button 
                onClick={() => setFilterType('DB')}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${filterType === 'DB' ? 'bg-[#e08b46] text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                DB
              </button>
            </div>

            <select 
              value={filterStatus}
              onChange={(e: any) => setFilterStatus(e.target.value)}
              className="bg-white text-slate-700 py-1.5 px-2 rounded-lg text-xs border border-slate-200 focus:outline-none"
            >
              <option value="ALL">所有狀態</option>
              <option value="normal">只看：正常</option>
              <option value="warning">只看：警戒</option>
              <option value="error">只看：異常/停擺</option>
            </select>
          </div>
        </div>

        {/* Servers Map Visual Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bento-box-inner p-4">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>矩陣檢視 (共篩選出 {filteredServers.length} 台)</span>
                <span>信義機房 + 內湖備援中心</span>
              </div>

              {/* Server Grid (representing 120 elements) */}
              <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1.5 p-1 max-h-[290px] overflow-y-auto">
                {filteredServers.map((srv) => {
                  let statusBg = 'bg-emerald-500 hover:bg-emerald-400';
                  let glowClass = 'glow-green';
                  if (srv.status === 'warning') {
                    statusBg = 'bg-amber-400 hover:bg-amber-300';
                    glowClass = 'glow-yellow';
                  } else if (srv.status === 'error') {
                    statusBg = 'bg-rose-500 hover:bg-rose-450';
                    glowClass = 'glow-red';
                  }

                  const isSelected = selectedServerId === srv.id;

                  return (
                    <button
                      key={srv.id}
                      onClick={() => setSelectedServerId(srv.id)}
                      className={`h-7 rounded text-[9px] font-mono font-bold flex flex-col items-center justify-center transition border cursor-pointer ${
                        isSelected 
                          ? 'border-[#e08b46] ring-2 ring-[#e08b46]/20 shadow-inner' 
                          : 'border-transparent'
                      } ${statusBg} text-white shadow-md ${glowClass}`}
                      title={`${srv.id} (${srv.name}) [${srv.status}] - CPU: ${srv.metrics.cpu}%`}
                    >
                      {srv.id.replace('AP-', '').replace('DB-', '')}
                    </button>
                  );
                })}
              </div>

              {/* Quick Legend indicators */}
              <div className="flex items-center space-x-4 mt-4 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 glow-green"></span>
                  <span className="text-slate-500">正常運作</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-400 glow-yellow"></span>
                  <span className="text-slate-500">警告 (RAM/CPU &gt; {servers[0]?.thresholds.cpu || 80}%)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500 glow-red"></span>
                  <span className="text-slate-500">阻斷性故障</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick detailed inspector drawer next to grid */}
          <div>
            {selectedServer ? (
              <div className="bg-slate-50 p-4.5 rounded-xl border border-bento-border space-y-4 shadow-inner">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 bg-white text-[#e08b46] border border-slate-200 font-bold text-xs rounded font-mono">{selectedServer.id}</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedServer.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">IP ADDRESS: {selectedServer.ip}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-lg ${
                    selectedServer.status === 'normal' ? 'bg-emerald-500/10 text-emerald-600' :
                    selectedServer.status === 'warning' ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {selectedServer.status === 'normal' ? '正常' : selectedServer.status === 'warning' ? '警告' : '故障'}
                  </span>
                </div>

                {/* Submetrics list */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white border border-bento-border p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block font-sans">CPU</span>
                    <span className={`text-base font-extrabold font-mono ${selectedServer.metrics.cpu >= selectedServer.thresholds.cpu ? 'text-rose-600' : 'text-slate-800'}`}>
                      {selectedServer.metrics.cpu}%
                    </span>
                    <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-[#e08b46] animate-pulse" style={{ width: `${selectedServer.metrics.cpu}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-white border border-bento-border p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block font-sans">RAM MEM</span>
                    <span className={`text-base font-extrabold font-mono ${selectedServer.metrics.ram >= selectedServer.thresholds.ram ? 'text-rose-600' : 'text-slate-800'}`}>
                      {selectedServer.metrics.ram}%
                    </span>
                    <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${selectedServer.metrics.ram}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-white border border-bento-border p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block font-sans">DISK DISK</span>
                    <span className={`text-base font-extrabold font-mono ${selectedServer.metrics.disk >= selectedServer.thresholds.disk ? 'text-rose-600' : 'text-slate-800'}`}>
                      {selectedServer.metrics.disk}%
                    </span>
                    <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${selectedServer.metrics.disk}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* 3.1 Single Local Microservice status listing and fast reboot buttons */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 mb-2 flex items-center justify-between">
                    <span>所屬微服務進程 ({selectedServer.microservices.length})</span>
                    <span className="text-[10px] font-normal text-sky-600">配合微服務架構快速重啟</span>
                  </h3>
                  <div className="space-y-1.5 max-h-[142px] overflow-y-auto">
                    {selectedServer.microservices.map((ms) => (
                      <div key={ms.id} className="bg-white p-2.5 rounded-xl border border-bento-border flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-mono font-bold text-slate-700 block">{ms.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {ms.lastReboot ? `重啟於 ${ms.lastReboot}` : '從容開機常規狀態'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] ${
                            ms.status === 'running' ? 'bg-emerald-500/10 text-emerald-600' :
                            ms.status === 'warning' ? 'bg-amber-400/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'
                          }`}>
                            {ms.status.toUpperCase()}
                          </span>
                          <button
                            onClick={() => onRebootMicroservice(selectedServer.id, ms.id)}
                            className="bg-[#e08b46] hover:bg-[#d07a35] font-bold text-[10px] text-white px-2 py-1 rounded cursor-pointer transition flex items-center space-x-0.5 hover:scale-105 active:scale-95"
                          >
                            <Zap className="w-2.5 h-2.5 fill-current" />
                            <span>重啟</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[9px] text-slate-500 mt-2 bg-white p-2 rounded-xl leading-relaxed border border-slate-100">
                    物理機房：{selectedServer.location}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-6 rounded-xl border border-bento-border text-center py-20 text-slate-400 flex flex-col items-center justify-center space-y-3 shadow-inner">
                <Info className="w-10 h-10 text-slate-300" />
                <p className="text-sm">點選左方矩陣中的主機節點<br />即可展開詳細硬碟/RAM指標、機房位置</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1.2 Proactive Alert Dispatcher Form */}
      <div className="bento-card p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
          <Smartphone className="w-5 h-5 text-emerald-600 mr-2" />
          多管道異常通報/行動端身分識別模擬系統
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          透過此表單，您可以模擬系統自動 or 人工派送告警。系統會自動根據當日排班人員派發，並針對 LINE 綁定特權手機進行防偽裝生物辨識驗證模擬。
        </p>

        <form onSubmit={handleAlertSimulateSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4 lg:col-span-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">告警核心文字 (可自定義輸入)</label>
              <textarea 
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                className="w-full bg-slate-50 text-slate-700 p-2.5 text-xs rounded-xl border border-bento-border focus:outline-none focus:border-[#e08b46] font-mono h-20"
                placeholder="寫下您想通報的錯誤明細內容..."
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-2">同步傳送通報管道 (可多選)</span>
                <div className="flex space-x-4">
                  {['LINE', 'SMS', 'Email'].map((ch) => {
                    const isChecked = alertChannels.includes(ch as any);
                    return (
                      <label key={ch} className="inline-flex items-center space-x-2 text-xs text-slate-600 font-mono cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setAlertChannels(alertChannels.filter(c => c !== ch));
                            } else {
                              setAlertChannels([...alertChannels, ch as any]);
                            }
                          }}
                          className="rounded border-slate-200 bg-white text-[#e08b46] focus:ring-1 focus:ring-[#e08b46] focus:ring-offset-white"
                        />
                        <span>{ch === 'SMS' ? 'SMS簡訊' : ch}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-2">關聯測試主機</span>
                <span className="px-2.5 py-1 bg-slate-50 border border-bento-border text-[#e08b46] font-bold text-xs rounded-lg font-mono block">
                  {selectedServerId || 'AP-012 (未選擇，預設為 AP-012)'}
                </span>
              </div>
            </div>
          </div>

          <div className="bento-box-inner p-4 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-semibold text-slate-600 block mb-1">通知受害對象 (當刻排班同仁)</span>
              <div className="bg-white p-3 rounded-xl border border-bento-border text-xs">
                <span className="text-slate-500 block mb-0.5">預計發送人</span>
                <span className="font-bold text-slate-900 text-sm">{activeShift?.primaryDuty.name}</span>
                <span className="text-slate-500 text-[10px] block mt-1">
                  通話驗證手機：{activeShift?.primaryDuty.phone}<br />
                  LINE 認證綁定：{activeShift?.primaryDuty.lineVerified ? '🟢 已安全授權' : '🔴 尚未認證'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={sendingAlert}
              className="w-full bg-gradient-to-r from-[#e08b46] to-orange-400 hover:from-[#d07a35] hover:to-orange-500 text-xs font-bold text-white py-2 rounded-lg cursor-pointer transition shadow-md flex items-center justify-center space-x-1 hover:scale-[1.01] active:scale-95 disabled:opacity-50"
            >
              <BellRing className="w-4 h-4" />
              <span>{sendingAlert ? '通報廣播傳遞中...' : '發送主動外發警報'}</span>
            </button>
          </div>
        </form>

        {/* 1.2 Alert Result details block */}
        {alertResult && (
          <div className={`mt-4 p-4 rounded-lg flex items-start space-x-3 text-xs border ${
            alertResult.success 
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
          }`}>
            <Info className="w-4 h-4 mt-0.5" />
            <div className="space-y-1">
              {alertResult.blocked ? (
                <>
                  <p className="font-bold">❌ 告警已被系統智慧型靜音攔截：</p>
                  <p className="text-slate-600 leading-relaxed font-mono">{alertResult.reason}</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-emerald-600">🎉 發送成功！智能通報已派發：</p>
                  <p className="text-slate-600">
                    已依據排班時間，將警報文字順利提交至通聯網關，即將同步推發至值班同仁手機 <b>[{alertResult.staffName}]</b>。
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {alertResult.dispatched?.map((d: any) => (
                      <span key={d.id} className="bg-white p-1.5 rounded-lg border border-bento-border font-mono text-[10px] text-[#e08b46]">
                        [{d.channel}] ID: {d.id} - {d.verified ? '行動指紋已通過' : '防弊安全認證確認中'}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 1.2 Mobile Verification Dialog Pop-up (Biometric check simulator) */}
      {showVerificationModal && verifiedTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e08b46]/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-[#e08b46]/10 rounded-full flex items-center justify-center mx-auto border border-[#e08b46]/20">
                <Lock className="w-6 h-6 text-[#e08b46] animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">安全身分二因子校驗</h3>
                <p className="text-xs text-slate-500 mt-1">
                  因應金管會特權連線指令及行動通知安全規範，系統已向當值人員手機 <b>{activeShift?.primaryDuty.name}</b> 發送 LINE 金鑰認證。
                </p>
              </div>

              <div className="bento-box-inner p-4 text-left border border-bento-border space-y-1.5 font-mono text-xs">
                <p className="text-slate-400">【安全通報封包驗證】</p>
                <p className="text-slate-600">警報管道：LINE_ENTERPRISE</p>
                <p className="text-slate-600">防偽憑證：SHA256-{verifiedTarget.id.substring(4, 11)}</p>
                <p className="text-amber-600 font-semibold">驗證狀態：等待指紋 OTP 輸入</p>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-semibold text-slate-500 block">請輸入值班特權登錄安全碼 (請輸入「8888」進行模擬測試)</label>
                <input 
                  type="password"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="輸入 4 位驗證安全碼"
                  className="w-full bg-slate-50 text-center font-bold tracking-widest text-lg text-slate-900 p-2.5 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => setShowVerificationModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 py-2 rounded cursor-pointer transition"
                >
                  稍後自主驗證
                </button>
                <button
                  onClick={handleVerifyLineCode}
                  className="flex-1 bg-[#e08b46] hover:bg-[#d07a35] text-xs font-bold text-white py-2 rounded cursor-pointer transition"
                >
                  確認驗證行動端
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
