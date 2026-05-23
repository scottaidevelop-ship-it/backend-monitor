/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ServerInstance, 
  MaintenanceTicket 
} from '../types';
import { 
  Wrench, 
  BrainCircuit, 
  ClipboardList, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  X, 
  Zap, 
  Send, 
  Plus, 
  FileText, 
  User, 
  Cpu, 
  ChevronRight, 
  Activity 
} from 'lucide-react';

interface OperationsProps {
  servers: ServerInstance[];
  tickets: MaintenanceTicket[];
  onRebootMicroservice: (serverId: string, msId: string) => Promise<void>;
  onCreateTicket: (payload: any) => Promise<void>;
  onUpdateTicketStatus: (ticketId: string, status: string, note?: string) => Promise<void>;
  onDiagnoseLog: (logsText: string, serverId: string) => Promise<any>;
}

export function OperationsView({
  servers,
  tickets,
  onRebootMicroservice,
  onCreateTicket,
  onUpdateTicketStatus,
  onDiagnoseLog
}: OperationsProps) {

  // Current sub-view: 'reboot' | 'ai' | 'tickets'
  const [subView, setSubView] = useState<'reboot' | 'ai' | 'tickets'>('reboot');

  // AI Diagnostic States
  const [diagnoseServerId, setDiagnoseServerId] = useState('AP-023');
  
  // Custom templates of logs based on server selection to make the demo incredibly realistic
  const logTemplates: Record<string, string> = {
    'AP-023': `[2026-05-21 14:15:30.124] [ERROR] payment-processor-service: Thread pool saturated.
java.lang.OutOfMemoryError: Java heap space
  at java.util.concurrent.ThreadPoolExecutor.addWorker(ThreadPoolExecutor.java:950)
  at java.util.concurrent.ThreadPoolExecutor.execute(ThreadPoolExecutor.java:1367)
  at com.bank.payment.worker.TransactionTask.scheduleBatch(TransactionTask.java:420)
  at com.bank.payment.controller.DispatchController.postRoute(DispatchController.java:82)
[WARN] Connection pool leaked: Active/Max = 100/100 db connections. Transaction aborted.`,
    'DB-077': `[2026-05-21 15:01:03] [SEVERE] Oracle RDBMS Core: ORA-00257: archiver error. Connect internal only, until freed.
Failed to write archiver logs. Temp flash recovery area (FRA) exceeded 92.4% capacity.
System tablespace lock initiated to prevent disk corruption.
All non-authorized queries are suspended.`,
    'AP-042': `[2026-05-21 15:04:12] [CRITICAL] gateway-api-gateway: CPU core affinity deadlock.
[sys-stats] CPU Core 1: 100%, Core 2: 98%, Core 3: 100%, Core 4: 99%.
Locked on lock address <0x00021A52> between thread 'Gateway-Selector-1' and 'Gateway-Selector-2'.
Incoming reverse proxy connections are queued (Queue depth: 8192, overflow: dropped).`,
    'DB-095': `[2026-05-21 15:08:11] [ERROR] Connection Pool: Unable to establish handshake with Oracle DB-095 on port 1521.
[net-diag] ping 10.100.2.15 -> lost 100% packets.
[net-diag] route tracing failed at core spine switch #3 (switch-hsinchu-03).
Possible physical fiber disconnection or core chassis power loss.`
  };

  const [logsText, setLogsText] = useState(logTemplates['AP-023']);
  const [customDispatchNote, setCustomDispatchNote] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState('');
  const [rebootResultMsg, setRebootResultMsg] = useState('');

  // Synchronous rule-based check to determine if Reboot is suggested based on logsText
  const rebootAssessment = useMemo(() => {
    const text = logsText.toLowerCase();
    if (text.includes('outofmemoryerror') || text.includes('thread pool saturated') || text.includes('heap space') || text.includes('deadlock') || text.includes('affinity deadlock')) {
      return {
        shouldReboot: true,
        reason: '核心進程執行緒已飽和或死鎖。在硬體及底層資料庫健全之情況下，執行微服務進程快速重啟（Reboot）可於數十秒內重新初始化記憶體、釋放執行緒鎖，是推薦的最快修補途徑。',
        suggestedAction: '建議執行微服務快速重啟. 可點擊下方按鈕直接指派重啟指令，或前往 3.1 故障微服務快速重啟模組操作。'
      };
    } else if (text.includes('archiver error') || text.includes('fra') || text.includes('ora-00257') || text.includes('exceeded 92.4% capacity')) {
      return {
        shouldReboot: false,
        reason: '底層資料庫 FRA 歸檔空間已滿。當前為 Oracle DB tablespace 的防寫保護鎖定，重啟微服務 AP 亦無法成功寫入任何資料，甚至可能導致未完全拋轉的會計封包佚失，因此不建議盲目重啟微服務 AP。',
        suggestedAction: '資料庫層級之硬體與儲存容量瓶頸，重啟服務無效，建議第一時間傳報 IT 運維組及 DBA，由專人手動釋放 FRA 封包空間或重灌 Oracle 關聯硬碟。'
      };
    } else if (text.includes('lost 100% packets') || text.includes('network handshaking failed') || text.includes('physical fiber') || text.includes('spine switch')) {
      return {
        shouldReboot: false,
        reason: '網路連線握手失敗，偵測到中繼交換機 (spine switch) 實體光纖斷訊或機架斷電（封包遺失率 100%）。微服務或 AP 本體軟體運行無誤，重啟進程無濟於事。',
        suggestedAction: '此為底層實體網路硬體中斷，重啟微服務無效，請利用下方 IT 快速通報管道派發派工單予 IT 網管科，第一時間進行線路備援切換與機組搶修。'
      };
    } else {
      return {
        shouldReboot: true,
        reason: '常規或一般性日誌偶發警告。RAM 或 Disk 使用率雖高但未完全鎖死，通常可透過微服務重啟釋放快取（Cache）以緩解，但建議先進行一線快速傳報。',
        suggestedAction: '建議重啟或進行預防性通報，密切監控下屬各交易通道的平衡狀態。'
      };
    }
  }, [logsText]);

  // Manual ticket creator states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    title: '',
    serverId: 'AP-012',
    category: '程式異常' as any,
    priority: 'L2_MEDIUM' as any,
    description: ''
  });

  // Ticket Filter States
  const [ticketFilterStatus, setTicketFilterStatus] = useState<'ALL' | 'PENDING' | 'INVESTIGATING' | 'RESOLVED'>('ALL');
  const [selectedTicketIdForTimeline, setSelectedTicketIdForTimeline] = useState<string | null>(null);
  const [quickUpdateNote, setQuickUpdateNote] = useState('');

  // Handle Log template refresh when selection changes
  const handleServerLogsChange = (srvId: string) => {
    setDiagnoseServerId(srvId);
    if (logTemplates[srvId]) {
      setLogsText(logTemplates[srvId]);
    } else {
      setLogsText(`[2026-05-21 15:10:00] [WARN] Host ${srvId} - Core metrics warning log. \nDisk/RAM breached threshold. Thread queue depth high.`);
    }
    setDispatchSuccessMsg('');
    setRebootResultMsg('');
  };

  // Submit IT Alert Dispatch Ticket (第一時間通報 IT 讓 IT 了解狀況)
  const handleITDispatchSubmit = async () => {
    setIsDispatching(true);
    setDispatchSuccessMsg('');
    try {
      const activeServerObj = servers.find(s => s.id === diagnoseServerId);
      const hostName = activeServerObj?.name || '未知主機';
      const detailNote = customDispatchNote.trim() || '主機發生緊急事故，原始日誌隨附，請 IT 維運小組第一時間確認。';
      
      const payload = {
        title: `【IT 事故通報】${diagnoseServerId} (${hostName}) 異常日誌速報`,
        serverId: diagnoseServerId,
        category: (diagnoseServerId.startsWith('DB') ? '硬體故障' : '程式異常') as any,
        priority: 'L1_HIGH' as any, // First priority! High urgency
        description: `【IT 第一時間事故通報】\n- 異動主機：${diagnoseServerId} (${hostName})\n- 運維判定：${rebootAssessment.shouldReboot ? '建議 AP 重新啟動' : '不建議 AP 重啟，需硬體/DBA/網管即刻介入'}\n- 專員備註：${detailNote}\n\n- 事故 Logs 原始日誌：\n${logsText}`
      };
      
      await onCreateTicket(payload);
      setDispatchSuccessMsg(`已將異常事故日誌及排查備註一鍵電傳至 IT 維運全組以利立即掌握狀況！並已於「電子事件系統（3.3）」自動建案列管處理。`);
      setCustomDispatchNote('');
    } catch (err: any) {
      alert('IT 事故通報失敗：' + err.message);
    } finally {
      setIsDispatching(false);
    }
  };

  // Directly trigger reboot for the selected host
  const handleDirectReboot = async () => {
    setRebootResultMsg('');
    try {
      const activeServerObj = servers.find(s => s.id === diagnoseServerId);
      if (!activeServerObj) {
        alert('找不到該主機資訊！');
        return;
      }
      
      const stoppedOrWarningMs = activeServerObj.microservices.find(ms => ms.status !== 'running') 
        || activeServerObj.microservices[0];
        
      if (!stoppedOrWarningMs) {
        alert('該主機下無任何微服務執行個體！');
        return;
      }
      
      await onRebootMicroservice(diagnoseServerId, stoppedOrWarningMs.id);
      setRebootResultMsg(`重啟指令發送成功！已向底層發射微服務「${stoppedOrWarningMs.name}」重構訊號，您可以於上方（3.1）或首頁大屏監控最新進度。`);
    } catch (err: any) {
      alert('直接重啟失敗: ' + err.message);
    }
  };

  // Manual ticket creator submission
  const handleManualTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.title || !newTicketForm.description) {
      alert('請填寫工單標題與問題描述！');
      return;
    }
    try {
      await onCreateTicket(newTicketForm);
      alert('🎉 電子化報修工單立案成功！已向全科值班小組指派任務。');
      setShowCreateModal(false);
      setNewTicketForm({
        title: '',
        serverId: 'AP-012',
        category: '程式異常',
        priority: 'L2_MEDIUM',
        description: ''
      });
      setSubView('tickets');
    } catch (err: any) {
      alert('手動報修建案失敗：' + err.message);
    }
  };

  // Tickets List computed filtering
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => ticketFilterStatus === 'ALL' || t.status === ticketFilterStatus);
  }, [tickets, ticketFilterStatus]);

  // Selected Ticket detail for visual timeline review
  const activeTimelineTicket = useMemo(() => {
    return tickets.find(t => t.id === selectedTicketIdForTimeline) || null;
  }, [tickets, selectedTicketIdForTimeline]);

  // Handle ticket status cycle update (e.g., mark investigating or solved)
  const handleStatusProgress = async (tktId: string, nextStatus: 'INVESTIGATING' | 'RESOLVED') => {
    try {
      await onUpdateTicketStatus(tktId, nextStatus, quickUpdateNote || undefined);
      setQuickUpdateNote('');
      alert(`工單 ${tktId} 已成功變更為 [${nextStatus === 'RESOLVED' ? '已處理完成' : '處理偵辦中'}]！`);
    } catch (err: any) {
      alert('變更工單狀態失敗：' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Operating Inner tabs */}
      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="flex space-x-1.5">
          <button
            onClick={() => setSubView('reboot')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition flex items-center space-x-1 cursor-pointer ${subView === 'reboot' ? 'bg-[#e08b46] text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
          >
            <Zap className="w-4 h-4" />
            <span>3.1 故障微服務快速重啟</span>
          </button>
          <button
            onClick={() => setSubView('ai')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition flex items-center space-x-1 cursor-pointer ${subView === 'ai' ? 'bg-[#e08b46] text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
          >
            <FileText className="w-4 h-4" />
            <span>3.2 事故日誌與 IT 快速通報</span>
          </button>
          
          <button
            onClick={() => setSubView('tickets')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition flex items-center space-x-1 cursor-pointer ${subView === 'tickets' ? 'bg-[#e08b46] text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>3.3 電子化事件報修系統</span>
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-emerald-600 hover:bg-emerald-550 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition flex items-center space-x-1"
        >
          <Plus className="w-4 h-4" />
          <span>電子維護工單派發</span>
        </button>
      </div>

      {/* SUB-VIEW 3.2: Incident Logs & IT Rapid Dispatch Terminal */}
      {subView === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Logs input / server target select block */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-lg space-y-4 lg:col-span-1">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <Cpu className="w-4 h-4 text-[#e08b46] mr-2" />
                第一手事故日誌查閱與鎖定
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 font-sans">發生異常時，選擇特定 AP/DB 讀取事故現場 Logs</p>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold block">事故目標主機選擇</label>
                <select 
                  value={diagnoseServerId}
                  onChange={(e) => handleServerLogsChange(e.target.value)}
                  className="w-full bg-slate-50 text-slate-700 py-2 px-2.5 rounded-lg text-xs border border-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-[#e08b46] cursor-pointer"
                >
                  <option value="AP-023">AP-023 (payment-processor - 執行緒溢出停止)</option>
                  <option value="DB-077">DB-077 (CoreOracle - FRA 空間歸檔阻塞鎖定)</option>
                  <option value="AP-042">AP-042 (WebPortal - CPU 連鎖死鎖 Deadlock)</option>
                  <option value="DB-095">DB-095 (LedgerPostgres - 路由骨幹崩潰 lost 100%)</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-slate-600 font-semibold block">事故現場日誌 (Logs 主體)</label>
                  <span className="text-[9px] text-slate-400 font-mono">可任意編輯模擬日誌</span>
                </div>
                <textarea 
                  value={logsText}
                  onChange={(e) => {
                    setLogsText(e.target.value);
                    setDispatchSuccessMsg('');
                    setRebootResultMsg('');
                  }}
                  className="w-full bg-slate-50 text-slate-700 p-2.5 text-[11px] rounded-lg border border-slate-200 font-mono h-[250px] focus:outline-none focus:border-[#e08b46] focus:ring-1 focus:ring-[#e08b46] leading-snug"
                />
              </div>
            </div>
          </div>

          {/* Diagnostics decision-making and IT notification block */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-lg lg:col-span-2 flex flex-col justify-between font-sans">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center">
                    <Activity className="w-4.5 h-4.5 text-[#e08b46] mr-2 animate-pulse" />
                    事故快速重啟判定與 IT 通報決策中心
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">免除 AI 延遲與分析。依據原始日誌即時決定處理策略（重啟 or IT 通報）</p>
                </div>
                <span className="text-[10px] bg-slate-50 text-slate-500 px-2.5 py-1 rounded-md border border-slate-100 font-mono">
                  系統判定規則已啟用
                </span>
              </div>

              {/* Status and Action alerts */}
              {rebootResultMsg && (
                <div className="bg-emerald-50 text-emerald-600 text-xs px-4 py-2.5 rounded-xl border border-emerald-100 font-sans animate-fadeIn">
                  {rebootResultMsg}
                </div>
              )}

              {dispatchSuccessMsg && (
                <div className="bg-orange-50 text-orange-700 text-xs px-4 py-2.5 rounded-xl border border-orange-100 font-sans animate-fadeIn">
                  {dispatchSuccessMsg}
                </div>
              )}

              {/* Reboot decision panel */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-sans uppercase font-semibold">🔍 事故日誌重啟判定結論</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    rebootAssessment.shouldReboot 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                      : 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
                  }`}>
                    {rebootAssessment.shouldReboot ? '✓ 建議重啟微服務' : '⚠️ 不建議重啟微服務'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-100 leading-relaxed font-sans">
                    <span className="font-bold text-slate-800 block mb-1 text-[11px]">判定因由：</span>
                    {rebootAssessment.reason}
                  </div>

                  <div className="text-xs text-slate-600 bg-white/50 p-3 rounded-lg border border-slate-100/50 leading-relaxed font-sans">
                    <span className="font-bold text-slate-800 block mb-1 text-[11px]">後續維運 Action 指引：</span>
                    {rebootAssessment.suggestedAction}
                  </div>
                </div>

                {/* Direct quick reboot action trigger if recommended */}
                <div className="flex items-center space-x-3 pt-1 font-sans">
                  <button
                    onClick={handleDirectReboot}
                    className="flex-1 bg-[#e08b46] hover:bg-[#d07a35] active:bg-[#c06a25] font-bold text-xs text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border border-[#e08b46]/10 flex items-center justify-center space-x-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>即刻執行微服務快速重啟</span>
                  </button>

                  <button
                    onClick={() => setSubView('reboot')}
                    className="bg-white hover:bg-slate-50 font-bold text-xs text-slate-700 px-4 py-2.5 rounded-xl cursor-pointer border border-slate-200 transition flex items-center justify-center space-x-1"
                    title="前往 3.1 手動模組"
                  >
                    <span>及至 3.1 重啟庫</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Direct Dispatch to IT form */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <span className="text-[10px] text-slate-500 block font-sans uppercase font-semibold">🚨 第一時間事故通知 / Logs 通報 IT 全組</span>
                
                <div className="space-y-3 font-sans">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    若判定為硬體層故障、資料庫歸檔滿或對外線路中斷，請填寫運維備註，並一鍵抄送事故現場日誌（含 Logs 追蹤附檔）至 IT 全體群組通報：
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="填寫事故速報速記備註（可留空，預設由系統推送基本主機快照描述）"
                      value={customDispatchNote}
                      onChange={(e) => setCustomDispatchNote(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#e08b46] focus:ring-1 focus:ring-[#e08b46] font-sans placeholder-slate-400"
                    />

                    <button
                      onClick={handleITDispatchSubmit}
                      disabled={isDispatching}
                      className="bg-emerald-600 hover:bg-emerald-550 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 font-sans shrink-0"
                    >
                      {isDispatching ? (
                        <span>發送中...</span>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>一鍵通報 IT 即刻處理</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* SUB-VIEW 3.1: Microservice Rapid reboot actions */}
      {subView === 'reboot' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-lg space-y-4 animate-fadeIn">
          <div>
            <h3 className="text-sm font-bold text-slate-900">配合微服務網關結構 —— 單一微服務進程快速重啟 (Quick Reboot Office)</h3>
            <p className="text-xs text-slate-500">當特定模組中斷時，支持只重啟「單一故障微服務」，避免不必要的全實體機 VM 整機重開，最大化維護盤中交易不中斷。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.filter(s => s.status !== 'normal').map((srv) => (
              <div key={srv.id} className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-3 shadow-inner">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-1.5 py-0.5 bg-white text-[#e08b46] border border-slate-200 font-bold text-[10px] rounded font-mono">{srv.id}</span>
                    <h4 className="font-bold text-slate-900 text-xs mt-1">{srv.name}</h4>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${srv.status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                    {srv.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {srv.microservices.map(ms => (
                    <div key={ms.id} className="bg-white p-2 rounded border border-slate-100 flex justify-between items-center font-mono">
                      <div className="space-y-0.5">
                        <span className="text-xs text-slate-700">{ms.name}</span>
                        {ms.lastReboot && (
                          <span className="text-[8px] text-slate-400 block">Reboot: {ms.lastReboot}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`text-[9px] font-bold ${ms.status === 'running' ? 'text-emerald-600' : 'text-rose-600 animate-pulse'}`}>
                          {ms.status.toUpperCase()}
                        </span>
                        
                        <button
                          onClick={() => onRebootMicroservice(srv.id, ms.id)}
                          className="bg-[#e08b46] hover:bg-[#d07a35] px-2 py-1 rounded text-[10px] font-semibold text-white transition flex items-center space-x-0.5 cursor-pointer"
                        >
                          <Zap className="w-2.5 h-2.5 fill-current" />
                          <span>重啟</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-VIEW 3.3: Electronic incident tickets database */}
      {subView === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Tickets lists table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-lg lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">電子化安全報修與異常處置紀錄倉庫 ({filteredTickets.length})</h3>
                <p className="text-xs text-slate-500">取代傳統電話或口頭通報。全程數位留痕、追蹤解決時效進度</p>
              </div>

              <select
                value={ticketFilterStatus}
                onChange={(e: any) => setTicketFilterStatus(e.target.value)}
                className="bg-slate-50 text-slate-700 py-1.5 px-2 rounded-lg text-xs border border-slate-200 focus:outline-none focus:border-[#e08b46]"
              >
                <option value="ALL">所有處理狀態</option>
                <option value="PENDING">等待指派 (PENDING)</option>
                <option value="INVESTIGATING">調查處理中 (INVESTIGATING)</option>
                <option value="RESOLVED">故障排除解決 (RESOLVED)</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                    <th className="py-2.5 px-3">立案編號</th>
                    <th className="py-2.5 px-3">關聯主機</th>
                    <th className="py-2.5 px-3">分類 / 優先度</th>
                    <th className="py-2.5 px-3">故障事件主體摘要</th>
                    <th className="py-2.5 px-3">目前狀態</th>
                    <th className="py-2.5 px-3">處理同仁</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[11px] font-semibold">
                  {filteredTickets.map((t) => (
                    <tr 
                      key={t.id} 
                      onClick={() => setSelectedTicketIdForTimeline(t.id)}
                      className={`hover:bg-slate-50 transition cursor-pointer ${
                        selectedTicketIdForTimeline === t.id ? 'bg-orange-50 border-l-2 border-[#e08b46]' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono text-slate-500">{t.id}</td>
                      <td className="py-3 px-3 font-mono text-slate-700">{t.serverId}</td>
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded block w-fit">{t.category}</span>
                          <span className={`text-[9px] font-bold ${
                            t.priority === 'L1_HIGH' ? 'text-rose-600' : 'text-amber-600'
                          }`}>{t.priority}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-sans max-w-xs truncate text-slate-900">{t.title}</td>
                      <td className="py-3 px-3">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                          t.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600' :
                          t.status === 'INVESTIGATING' ? 'bg-sky-50 text-sky-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {t.status === 'RESOLVED' ? '排除完成' : t.status === 'INVESTIGATING' ? '正由IT處理' : '待指派簽收'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans font-normal text-slate-500">{t.assignedTo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chronological Ticket Timeline audit Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-lg">
            <div className="border-b border-slate-100 pb-2 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <FileText className="w-4 h-4 text-[#e08b46] mr-2" />
                事件歷程縱深軌跡與回報 (Timeline)
              </h3>
              <p className="text-[11px] text-slate-500">選擇並稽查單一修復工單的落實過程</p>
            </div>

            {activeTimelineTicket ? (
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#e08b46] font-mono font-bold">{activeTimelineTicket.id}</span>
                    <span className="text-[10px] text-slate-400">{activeTimelineTicket.createdTime}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">{activeTimelineTicket.title}</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed max-h-24 overflow-y-auto">
                    {activeTimelineTicket.description}
                  </p>
                </div>

                {/* Timeline display loop */}
                <div className="space-y-3 pl-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">流轉痕跡 (Chronological trace)</span>
                  <div className="space-y-3 max-h-[170px] overflow-y-auto font-sans">
                    {activeTimelineTicket.timeline.map((item, idx) => (
                      <div key={idx} className="flex space-x-2 items-start text-xs relative">
                        {idx < activeTimelineTicket.timeline.length - 1 && (
                          <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-slate-200"></div>
                        )}
                        <span className="w-4 h-4 rounded-full bg-white border border-[#e08b46] flex-shrink-0 flex items-center justify-center text-[9px] text-[#e08b46] font-bold">
                          {idx + 1}
                        </span>
                        <div className="flex-1 space-y-0.5 bg-slate-50 p-1.5 rounded border border-slate-100">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-600">處理態: {item.status}</span>
                            <span className="text-slate-400">{item.timestamp}</span>
                          </div>
                          <p className="text-slate-700 text-[11px]">{item.note}</p>
                          <span className="text-[9px] text-sky-600 font-mono block">Operator: {item.operator}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status transitions options */}
                {activeTimelineTicket.status !== 'RESOLVED' && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2 pt-2 text-xs">
                    <span className="font-bold text-slate-700 block">流轉控管更新速記</span>
                    
                    <input 
                      type="text" 
                      placeholder="寫下運維診斷備註..." 
                      value={quickUpdateNote}
                      onChange={(e) => setQuickUpdateNote(e.target.value)}
                      className="w-full bg-white text-slate-700 p-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                    />

                    <div className="flex space-x-2 pt-1 font-semibold">
                      {activeTimelineTicket.status === 'PENDING' && (
                        <button
                          onClick={() => handleStatusProgress(activeTimelineTicket.id, 'INVESTIGATING')}
                          className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-[10px] py-1 rounded cursor-pointer transition text-center"
                        >
                          簽收調查 (Investigate)
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleStatusProgress(activeTimelineTicket.id, 'RESOLVED')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-550 text-white text-[10px] py-1 rounded cursor-pointer transition text-center"
                      >
                        已解完畢 (Mark Resolved)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-lg p-16 text-center text-slate-400 italic text-xs">
                點擊左列任何一筆工單項目，即可調閱與派發該事件之解決時效進度軌跡。
              </div>
            )}
          </div>

        </div>
      )}

      {/* Manual ticketing create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 hover:bg-slate-100 p-1.5 rounded text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
            
            <form onSubmit={handleManualTicketSubmit} className="space-y-4">
              <div className="flex items-center space-x-2 font-bold text-slate-900 text-base border-b border-slate-100 pb-2">
                <Wrench className="w-5 h-5 text-[#e08b46]" />
                <span>電子化維護工單立新立案</span>
              </div>

              <div className="space-y-3 font-sans text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-semibold block">關聯主機編號</label>
                    <select
                      value={newTicketForm.serverId}
                      onChange={(e) => setNewTicketForm({ ...newTicketForm, serverId: e.target.value })}
                      className="w-full bg-slate-50 text-slate-700 py-1.5 px-2 rounded border border-slate-200 font-mono focus:outline-none focus:border-[#e08b46]"
                    >
                      {servers.map((s) => (
                        <option key={s.id} value={s.id}>{s.id} - ({s.name})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 font-semibold block">異常歸類分類</label>
                    <select
                      value={newTicketForm.category}
                      onChange={(e: any) => setNewTicketForm({ ...newTicketForm, category: e.target.value })}
                      className="w-full bg-slate-50 text-slate-700 py-1.5 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                    >
                      <option value="硬體故障">硬體故障</option>
                      <option value="程式異常">程式異常</option>
                      <option value="轉檔失敗">轉檔失敗</option>
                      <option value="網路中斷">網路中斷</option>
                      <option value="權限問題">權限問題</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-semibold block">安全漏洞優先度</label>
                    <select
                      value={newTicketForm.priority}
                      onChange={(e: any) => setNewTicketForm({ ...newTicketForm, priority: e.target.value })}
                      className="w-full bg-slate-50 text-slate-700 py-1.5 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                    >
                      <option value="L1_HIGH">L1 頂級緊急 (HIGH)</option>
                      <option value="L2_MEDIUM">L2 常規處置 (MEDIUM)</option>
                      <option value="L3_LOW">L3 低度觀察 (LOW)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-slate-500 font-semibold block">開單報告人</label>
                    <input 
                      type="text" 
                      disabled 
                      value="王大同 (Tung)" 
                      className="w-full bg-slate-100 text-slate-400 py-1.5 px-2 rounded border border-slate-200 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold block">告警事件主摘要 (一目了然)</label>
                  <input
                    type="text"
                    required
                    placeholder="例如: AP-12 的 auth-service 微服務崩潰停用"
                    value={newTicketForm.title}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, title: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 p-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold block">故障細節描述與系統 Log</label>
                  <textarea
                    required
                    placeholder="請交代發生狀況，受害模組，以便派發追蹤..."
                    value={newTicketForm.description}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
                    className="w-full bg-slate-50 text-slate-700 p-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46] h-24"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded font-semibold transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-550 text-white px-5 py-2 rounded font-bold transition cursor-pointer"
                >
                  立案並指派 IT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
