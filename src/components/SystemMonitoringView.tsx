/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ServerInstance, 
  FileConversionTask, 
  SettlementStep, 
  BranchSettlement, 
  AuditLog 
} from '../types';
import { 
  Database, 
  FileCheck, 
  Building2, 
  ShieldCheck, 
  AlertOctagon, 
  CheckCircle, 
  Clock, 
  Sliders, 
  Save, 
  Search, 
  Filter, 
  X, 
  ArrowRightLeft, 
  FileSpreadsheet, 
  Wrench 
} from 'lucide-react';

interface MonitoringProps {
  servers: ServerInstance[];
  tasks: FileConversionTask[];
  steps: SettlementStep[];
  branches: BranchSettlement[];
  logs: AuditLog[];
  onUpdateThresholds: (cpu: number, ram: number, disk: number) => Promise<void>;
  alertRuleSettings: { type: string; threshold: number; enabled: boolean }[];
  onRebootMicroservice: (serverId: string, msId: string) => Promise<void>;
  onCreateTicket: (payload: any) => Promise<void>;
}

export function SystemMonitoringView({
  servers,
  tasks,
  steps,
  branches,
  logs,
  onUpdateThresholds,
  alertRuleSettings,
  onRebootMicroservice,
  onCreateTicket
}: MonitoringProps) {
  
  // 2.1 Watermark Alarm Configuration
  const initialCpuThresh = useMemo(() => alertRuleSettings.find(r => r.type === 'CPU')?.threshold || 80, [alertRuleSettings]);
  const initialRamThresh = useMemo(() => alertRuleSettings.find(r => r.type === 'RAM')?.threshold || 80, [alertRuleSettings]);
  const initialDiskThresh = useMemo(() => alertRuleSettings.find(r => r.type === 'Disk')?.threshold || 80, [alertRuleSettings]);

  const [cpuVal, setCpuVal] = useState(initialCpuThresh);
  const [ramVal, setRamVal] = useState(initialRamThresh);
  const [diskVal, setDiskVal] = useState(initialDiskThresh);
  const [savingThresholds, setSavingThresholds] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'disk' | 'file-intraday' | 'file-postmarket' | 'checkout' | 'audit'>('disk');

  // 2.2.1 Intraday Transfer Sign-off Filter States
  const [intraDb, setIntraDb] = useState('ALL');
  const [intraStatus, setIntraStatus] = useState('ALL');
  const [intraName, setIntraName] = useState('');
  const [intraQueryResult, setIntraQueryResult] = useState<any[] | null>(null);

  // 2.2.2 Post-market Transfer Monitoring Filter States
  const [postCompany, setPostCompany] = useState('ALL');
  const [postStatus, setPostStatus] = useState('ALL');
  const [postName, setPostName] = useState('');
  const [postQueryResult, setPostQueryResult] = useState<any[] | null>(null);

  // Branch and File Conversion keyword search
  const [branchSearch, setBranchSearch] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Local selected failure details modal
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<FileConversionTask | null>(null);

  // Pre-market IT Ticket Reporting Modal
  const [itReportServer, setItReportServer] = useState<any | null>(null);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketCategory, setTicketCategory] = useState('程式異常');
  const [ticketPriority, setTicketPriority] = useState('L1_HIGH');
  const [ticketDesc, setTicketDesc] = useState('');

  React.useEffect(() => {
    if (itReportServer) {
      setTicketTitle(`[盤前異常監控] 伺服器主機 ${itReportServer.id} 告警處置`);
      const failedMs = itReportServer.microservices.filter((m: any) => m.status !== 'running').map((m: any) => m.name).join(', ');
      let desc = `盤前巡檢回報：\n主機：${itReportServer.id} (${itReportServer.name})\nCPU負載: ${itReportServer.metrics.cpu}% | RAM佔用: ${itReportServer.metrics.ram}% | 磁碟: ${itReportServer.metrics.disk}%\n`;
      if (failedMs) {
        desc += `異常微服務包含：[${failedMs}] 發生中斷停止，請求 IT 盡速排除！`;
      } else {
        desc += `硬體資源接近飽和臨界，請求 IT 微調核心伺服器水位！`;
      }
      setTicketDesc(desc);
      setTicketCategory(failedMs ? '程式異常' : '硬體故障');
    }
  }, [itReportServer]);

  // Handle Save Threshold Configuration
  const handleSaveThresholds = async () => {
    setSavingThresholds(true);
    try {
      await onUpdateThresholds(cpuVal, ramVal, diskVal);
      alert('🔔 水位安全警報閥值更新成功！\n全伺服器已套用核心監控上限：\nCPU: ' + cpuVal + '% | RAM: ' + ramVal + '% | 磁碟磁碟: ' + diskVal + '%。若硬體水壓超標，通報網關將主動啟動 SMS/LINE 廣播。');
    } catch (err: any) {
      alert('更新警報臨界失敗：' + err.message);
    } finally {
      setSavingThresholds(false);
    }
  };

  // Queries for the new tabs
  const handleIntraQuery = () => {
    const filtered = tasks.filter(t => {
      const matchDb = intraDb === 'ALL' || t.dbType === intraDb;
      const matchStatus = intraStatus === 'ALL' || t.status === intraStatus;
      const matchName = !intraName || t.taskName.toLowerCase().includes(intraName.toLowerCase());
      return matchDb && matchStatus && matchName;
    });
    setIntraQueryResult(filtered);
  };

  const handlePostQuery = () => {
    // In this mock, we'll treat all tasks as post-market if they match filters
    const filtered = tasks.filter(t => {
      const matchStatus = postStatus === 'ALL' || t.status === postStatus;
      const matchName = !postName || t.taskName.toLowerCase().includes(postName.toLowerCase());
      // postCompany logic (mapping dbType to company for mock)
      const matchCompany = postCompany === 'ALL' || t.dbType.includes(postCompany);
      return matchStatus && matchName && matchCompany;
    });
    setPostQueryResult(filtered);
  };

  // Pre-market Disk / AP Checklist filter (AP vs DB and disk stats)
  // Ordered by Status Severity: error (3) > warning (2) > normal (1), and secondary by original index!
  const sortedPreMarketChecklist = useMemo(() => {
    const mapped = servers.map((s, idx) => {
      const isDiskAlert = s.metrics.disk >= diskVal;
      const isCpuAlert = s.metrics.cpu >= cpuVal;
      const isRamAlert = s.metrics.ram >= ramVal;
      
      const isCoreEngineActive = s.microservices.every(m => m.status === 'running');
      return {
        ...s,
        isDiskAlert,
        isCpuAlert,
        isRamAlert,
        isCoreEngineActive,
        originalIdx: idx
      };
    });

    return [...mapped].sort((a, b) => {
      const getSev = (status: string) => {
        if (status === 'error') return 3;
        if (status === 'warning') return 2;
        return 1;
      };
      const sevA = getSev(a.status);
      const sevB = getSev(b.status);
      if (sevB !== sevA) {
        return sevB - sevA; // highest severity first
      }
      return a.originalIdx - b.originalIdx;
    });
  }, [servers, cpuVal, ramVal, diskVal]);

  // Filter branch checkouts sorted by FAIL (3) > WAIT (2) > DONE (1)
  const filteredBranches = useMemo(() => {
    const filtered = branches.filter((b, idx) => {
      const q = branchSearch.toLowerCase().trim();
      return (
        b.code.toLowerCase().includes(q) || 
        b.name.toLowerCase().includes(q) ||
        b.manager.toLowerCase().includes(q)
      );
    }).map((b, idx) => ({ ...b, originalIdx: idx }));

    return [...filtered].sort((a, b) => {
      const getSev = (status: string) => {
        if (status === 'FAIL') return 3;
        if (status === 'WAIT') return 2;
        return 1;
      };
      const sevA = getSev(a.status);
      const sevB = getSev(b.status);
      if (sevB !== sevA) {
        return sevB - sevA;
      }
      return a.originalIdx - b.originalIdx;
    });
  }, [branches, branchSearch]);

  // Filter file conversion tasks sorted by FAILED (3) > WAITING (2) > SUCCESS (1)
  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((t, idx) => {
      const q = fileSearch.toLowerCase().trim();
      return (
        t.taskName.toLowerCase().includes(q) || 
        t.fileName.toLowerCase().includes(q) || 
        t.dbType.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) // supports searching by Ticket / conversion task ID!
      );
    }).map((t, idx) => ({ ...t, originalIdx: idx }));

    return [...filtered].sort((a, b) => {
      const getSev = (status: string) => {
        if (status === 'FAILED') return 3;
        if (status === 'WAITING') return 2;
        return 1;
      };
      const sevA = getSev(a.status);
      const sevB = getSev(b.status);
      if (sevB !== sevA) {
        return sevB - sevA;
      }
      return a.originalIdx - b.originalIdx;
    });
  }, [tasks, fileSearch]);

  // Filter audit logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => 
      l.user.includes(auditSearch) || 
      l.action.includes(auditSearch) || 
      l.details.includes(auditSearch)
    );
  }, [logs, auditSearch]);

  return (
    <div className="space-y-6">
      
      {/* Tab Navigation buttons */}
      <div className="flex border border-bento-border bg-slate-50 p-1.5 rounded-xl">
        <button
          onClick={() => setActiveTab('disk')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeTab === 'disk' ? 'bg-[#e08b46] text-white shadow-sm border border-[#e08b46]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
        >
          <Database className="w-4 h-4" />
          <span>2.1 盤前檢核與硬碟水壓</span>
        </button>
        <button
          onClick={() => setActiveTab('file-intraday')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeTab === 'file-intraday' ? 'bg-[#e08b46] text-white shadow-sm border border-[#e08b46]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
        >
          <FileCheck className="w-4 h-4" />
          <span>2.2 盤中轉檔簽核</span>
        </button>
        <button
          onClick={() => setActiveTab('file-postmarket')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeTab === 'file-postmarket' ? 'bg-[#e08b46] text-white shadow-sm border border-[#e08b46]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
        >
          <Clock className="w-4 h-4" />
          <span>2.3 轉檔監控(盤後)</span>
        </button>
        <button
          onClick={() => setActiveTab('checkout')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeTab === 'checkout' ? 'bg-[#e08b46] text-white shadow-sm border border-[#e08b46]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
        >
          <Building2 className="w-4 h-4" />
          <span>2.4 跨行中台與分行結帳</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeTab === 'audit' ? 'bg-[#e08b46] text-white shadow-sm border border-[#e08b46]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>2.5 軌跡稽核與登入登載</span>
        </button>
      </div>
      {activeTab === 'disk' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Checklist table */}
          <div className="bento-card p-5 lg:col-span-3 space-y-4 font-sans">
            <div className="flex justify-between items-center border-b border-bento-border pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">伺服器核心硬體/程式開關盤前狀態檢核</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-sans">顯示目前最需關注的前 12 台高負載 / 服務停擺伺服器主機指標</p>
              </div>
              <span className="px-2.5 py-0.5 bg-slate-50 text-[#e08b46] border border-bento-border rounded-lg font-mono text-xs">Pre-Market Checked</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="border-b border-bento-border text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">主機代碼/名稱</th>
                    <th className="py-2.5 px-3">伺服器類別</th>
                    <th className="py-2.5 px-3">程式狀態 (AP 開啟)</th>
                    <th className="py-2.5 px-3">CPU 負載</th>
                    <th className="py-2.5 px-3">RAM</th>
                    <th className="py-2.5 px-3">硬碟 (水位)</th>
                    <th className="py-2.5 px-3 text-center">處置與通報</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {sortedPreMarketChecklist.filter(s => s.status !== 'normal' || s.metrics.disk >= 60).slice(0, 15).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{s.id}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{s.name}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${s.type === 'AP' ? 'bg-[#e08b46]/10 text-[#e08b46] border-[#e08b46]/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}>
                          {s.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs font-sans">
                        {s.isCoreEngineActive ? (
                          <span className="text-emerald-600 font-medium">● 健全(微服務通)</span>
                        ) : (
                          <span className="text-rose-600 font-bold animate-pulse">▲ 零星微服務停用</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={s.isCpuAlert ? 'text-rose-600 font-extrabold' : 'text-slate-600'}>{s.metrics.cpu}%</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={s.isRamAlert ? 'text-rose-600 font-extrabold' : 'text-slate-600'}>{s.metrics.ram}%</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span className={`${s.isDiskAlert ? 'text-rose-600 font-extrabold' : 'text-slate-700'}`}>{s.metrics.disk}%</span>
                          {s.isDiskAlert && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            id={`reboot-${s.id}`}
                            onClick={async () => {
                              const msToReboot = s.microservices.find((m: any) => m.status !== 'running') || s.microservices[0];
                              if (msToReboot) {
                                try {
                                  await onRebootMicroservice(s.id, msToReboot.id);
                                  alert(`🔄 成功發送 [${s.id}] 的服務 [${msToReboot.name}] 重啟指令！請稍候 3-5 秒確認最新狀態。`);
                                } catch (e: any) {
                                  alert(`重啟失敗: ${e.message}`);
                                }
                              } else {
                                alert(`主機 ${s.id} 無任何微服務可重啟。`);
                              }
                            }}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition"
                          >
                            重啟微服務
                          </button>
                          <button
                            id={`report-${s.id}`}
                            onClick={() => setItReportServer(s)}
                            className="bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition"
                          >
                            報修 IT
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 2.2 Tab: Intraday Transfer Sign-off */}
      {activeTab === 'file-intraday' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bento-card p-5 space-y-5">
            <div className="flex items-center space-x-2 border-b border-bento-border pb-3">
              <FileCheck className="w-5 h-5 text-[#e08b46]" />
              <h3 className="text-sm font-bold text-slate-900">2.2 盤中轉檔簽核監控</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-bento-border">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">資料庫別 (機房區別)</label>
                <select 
                  value={intraDb} onChange={(e) => setIntraDb(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 py-2 px-3 rounded-lg text-xs focus:outline-none focus:border-[#e08b46]"
                >
                  <option value="ALL">全部資料庫</option>
                  <option value="Oracle">Oracle (核心)</option>
                  <option value="SQL Server">SQL Server</option>
                  <option value="PostgreSQL">PostgreSQL</option>
                  <option value="DB2">DB2 (主機)</option>
                  <option value="Teradata">Teradata (倉儲)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">轉檔狀態</label>
                <select 
                  value={intraStatus} onChange={(e) => setIntraStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 py-2 px-3 rounded-lg text-xs focus:outline-none focus:border-[#e08b46]"
                >
                  <option value="ALL">全部狀態</option>
                  <option value="SUCCESS">轉檔成功</option>
                  <option value="FAILED">轉檔失敗</option>
                  <option value="WAITING">等待拋轉</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">轉檔名稱</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" placeholder="輸入關鍵字..." value={intraName} onChange={(e) => setIntraName(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 py-2 pl-9 pr-3 rounded-lg text-xs focus:outline-none focus:border-[#e08b46]"
                  />
                </div>
              </div>

              <button 
                onClick={handleIntraQuery}
                className="bg-[#e08b46] hover:bg-[#d07a35] text-white font-bold py-2 px-6 rounded-lg text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-orange-900/10"
              >
                <Search className="w-3.5 h-3.5" />
                <span>執行查詢</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="border-b border-bento-border bg-slate-50 text-slate-500">
                    <th className="py-2.5 px-3">拋轉代號</th>
                    <th className="py-2.5 px-3">資料庫</th>
                    <th className="py-2.5 px-3">轉檔名稱</th>
                    <th className="py-2.5 px-3">實體檔名</th>
                    <th className="py-2.5 px-3">狀態</th>
                    <th className="py-2.5 px-3 text-right">追蹤時戳</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(intraQueryResult || []).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold">{t.id}</td>
                      <td className="py-3 px-3">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-600 border border-slate-200">{t.dbType}</span>
                      </td>
                      <td className="py-3 px-3 font-sans font-semibold">{t.taskName}</td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">{t.fileName}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' :
                          t.status === 'FAILED' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {t.status === 'SUCCESS' ? '轉檔成功' : t.status === 'FAILED' ? '轉檔異常' : '等待中'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500 text-[10px]">{t.timestamp}</td>
                    </tr>
                  ))}
                  {!intraQueryResult && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 italic font-sans">請輸入篩選條件並按下「執行查詢」以顯示盤中轉檔資料。</td>
                    </tr>
                  )}
                  {intraQueryResult && intraQueryResult.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">查無相符的盤中轉檔紀錄。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2.3 Tab: Post-market Transfer Monitoring */}
      {activeTab === 'file-postmarket' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bento-card p-5 space-y-5">
            <div className="flex items-center space-x-2 border-b border-bento-border pb-3">
              <Clock className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">2.3 轉檔監控 (盤後結帳)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-bento-border">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">公司別</label>
                <select 
                  value={postCompany} onChange={(e) => setPostCompany(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 py-2 px-3 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                >
                  <option value="ALL">全部公司</option>
                  <option value="CTCB">中信中立商銀</option>
                  <option value="LIFE">人壽保險</option>
                  <option value="SEC">證券金融</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">轉檔狀態</label>
                <select 
                  value={postStatus} onChange={(e) => setPostStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 py-2 px-3 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                >
                  <option value="ALL">全部狀態</option>
                  <option value="SUCCESS">轉檔成功</option>
                  <option value="FAILED">轉檔失敗</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">轉檔名稱 (交易明細/沖銷檔...)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" placeholder="關鍵字 (如: 沖銷...)" value={postName} onChange={(e) => setPostName(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 py-2 pl-9 pr-3 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <button 
                onClick={handlePostQuery}
                className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold py-2 px-6 rounded-lg text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-emerald-900/20"
              >
                <Search className="w-3.5 h-3.5" />
                <span>執行監控查詢</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="border-b border-bento-border bg-slate-50 text-slate-500">
                    <th className="py-2.5 px-3">結帳批次</th>
                    <th className="py-2.5 px-3">資料來源庫</th>
                    <th className="py-2.5 px-3">轉檔項目</th>
                    <th className="py-2.5 px-3">寫入狀態</th>
                    <th className="py-2.5 px-3">診斷訊息</th>
                    <th className="py-2.5 px-3 text-right">完成時戳</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(postQueryResult || []).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-emerald-600">{t.id.replace('CONV', 'POST')}</td>
                      <td className="py-3 px-3 font-mono text-[10px]">{t.dbType}</td>
                      <td className="py-3 px-3 font-sans font-semibold">{t.taskName} (結帳檔)</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {t.status === 'SUCCESS' ? '✓ 寫入成功' : '✗ 寫入失敗'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-sans italic">{t.status === 'FAILED' ? t.errorDetail : '無異常'}</td>
                      <td className="py-3 px-3 text-right text-slate-500 text-[10px]">{t.timestamp}</td>
                    </tr>
                  ))}
                  {!postQueryResult && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 italic font-sans">請選擇公司別與項目並按下「執行監控查詢」。</td>
                    </tr>
                  )}
                  {postQueryResult && postQueryResult.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">查無盤後結帳轉檔資料。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2.3 Tab: Settlement Search */}
      {activeTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Middle step steps progress */}
          <div className="bento-card p-5 space-y-4">
            <div className="border-b border-bento-border pb-2">
              <h3 className="text-sm font-bold text-slate-900">2.4 中台結帳步驟進程監控 (Mid-Office Steps)</h3>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">檢視目前清算與大帳核心跑批狀態</p>
            </div>
            
            <div className="space-y-4 font-sans">
              {steps.map((st, i) => (
                <div key={st.step} className="flex space-x-3 items-start relative">
                  {i < steps.length - 1 && (
                    <div className="absolute left-[13px] top-6 bottom-0 w-0.5 bg-slate-200"></div>
                  )}
                  
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs font-mono select-none z-10 ${
                    st.status === 'DONE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 font-extrabold' :
                    st.status === 'FAIL' ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse font-extrabold' : 'bg-slate-50 text-slate-400 border border-bento-border'
                  }`}>
                    {st.step}
                  </span>

                  <div className="space-y-0.5 flex-1 font-sans">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-slate-800">{st.name}</span>
                      <span className={`text-[10px] font-bold ${
                        st.status === 'DONE' ? 'text-emerald-600' :
                        st.status === 'FAIL' ? 'text-rose-600 animate-pulse' : 'text-slate-500'
                      }`}>
                        {st.status === 'DONE' ? 'DONE' : st.status === 'FAIL' ? 'FAIL (中斷異常)' : 'WAIT'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {st.status !== 'WAIT' ? `更新時戳：${st.updatedAt}` : '等待前序步驟推進'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Branches Settlement list */}
          <div className="bento-card p-5 lg:col-span-2 space-y-4 font-sans">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-bento-border pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">全台各分行帳口結帳與清算狀態查詢</h3>
                <p className="text-xs text-slate-500 font-sans">登錄包含實體營業所一比一結算封包狀態</p>
              </div>

              <div className="relative font-sans">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="搜尋分行代碼、名稱、專員..." 
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  className="bg-white text-slate-700 pl-9 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:border-[#e08b46] w-52 focus:ring-1 focus:ring-[#e08b46] font-sans"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[310px] font-sans">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="border-b border-bento-border bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 pb-2 font-sans">分行代碼 / 名稱</th>
                    <th className="py-2 px-3 pb-2 font-sans">清結狀態</th>
                    <th className="py-2 px-3 pb-2 font-sans">今日帳款總額 (TWD)</th>
                    <th className="py-2 px-3 pb-2 font-sans">交易成交筆數</th>
                    <th className="py-2 px-3 pb-2 font-sans text-right">核帳維運掌管者</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredBranches.map((b) => (
                    <tr key={b.code} className={`hover:bg-slate-50 transition pb-2 border-b border-slate-50 ${b.status === 'FAIL' ? 'bg-amber-50 text-amber-700' : ''}`}>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-500">[{b.code}]</span>{' '}
                        <span className="font-sans text-slate-900 font-medium">{b.name}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded font-sans text-[10px] font-bold ${
                          b.status === 'DONE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                          b.status === 'FAIL' ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse' :
                          'bg-slate-100 text-slate-600 border border-bento-border'
                        }`}>
                          {b.status === 'DONE' ? '● 結帳完訖' : b.status === 'FAIL' ? '⚠️ 平衡不符' : '⏳ 等待核算'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">${b.amount.toLocaleString()}</td>
                      <td className="py-3 px-3 text-slate-600">{b.count.toLocaleString()} 筆</td>
                      <td className="py-3 px-3 text-slate-700 font-sans text-right">{b.manager}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bento-card p-5 space-y-4 animate-fadeIn font-sans">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-bento-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">2.5 IT 維運平台使用者登錄軌跡與敏感操作記置日誌</h3>
              <p className="text-xs text-slate-500 font-sans">完整保存本監控平台內部維護軌跡以作機關稽核及安全查溯</p>
            </div>
            
            <div className="relative font-sans">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="過濾操作員、功能事件、IP..." 
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="bg-white text-slate-700 pl-9 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:border-[#e08b46] w-52 font-sans focus:ring-1 focus:ring-[#e08b46]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="border-b border-bento-border bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-3">日誌/日戳代碼</th>
                  <th className="py-2.5 px-3">系統操作使用者</th>
                  <th className="py-2.5 px-3">稽核動作/分類</th>
                  <th className="py-2.5 px-3">明細異動記載</th>
                  <th className="py-2.5 px-3">登錄來源核心 IP</th>
                  <th className="py-2.5 px-3 text-right">寫入時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700 animate-fadeIn">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-500 font-semibold">{log.id}</td>
                    <td className="py-3 px-3 font-sans font-bold text-slate-900">{log.user}</td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-lg text-[10px] font-sans">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-sans">{log.details}</td>
                    <td className="py-3 px-3 text-sky-600 font-mono text-[11px]">{log.ip}</td>
                    <td className="py-3 px-3 text-right text-slate-500 text-[10px]">{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pre-market IT Problem Reporting Modal */}
      {itReportServer && (
        <div id="it-reporting-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bento-card border border-[#e08b46]/30 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-4 bg-white">
            <button 
              id="close-it-modal"
              onClick={() => setItReportServer(null)}
              className="absolute right-4 top-4 hover:bg-slate-100 p-1.5 rounded-xl text-slate-400 transition-colors cursor-pointer animate-none"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="space-y-4 font-sans text-xs">
              <div className="flex items-center space-x-2 text-sky-600 border-b border-slate-100 pb-2.5">
                <AlertOctagon className="w-5 h-5 text-sky-600 animate-pulse animate-duration-1000" />
                <h3 className="text-sm font-bold text-slate-900">盤前異常狀況處置 - 回報異常工單至 IT 系統</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-slate-500 font-bold block mb-1">工單標題 (Title)</label>
                  <input
                    id="ticket-title-input"
                    type="text"
                    required
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 py-1.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">申報類別 (Category)</label>
                    <select
                      id="ticket-category-select"
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                      className="w-full bg-slate-50 text-slate-700 py-1.5 px-2 rounded-lg border border-slate-200"
                    >
                      <option value="程式異常">程式異常</option>
                      <option value="硬體故障">硬體故障</option>
                      <option value="網通異常">網通異常</option>
                      <option value="安全通報">安全通報</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">危及程度/優先級 (Priority)</label>
                    <select
                      id="ticket-priority-select"
                      value={ticketPriority}
                      onChange={(e: any) => setTicketPriority(e.target.value)}
                      className="w-full bg-slate-50 text-slate-700 py-1.5 px-2 rounded-lg border border-slate-200 font-bold"
                    >
                      <option value="L1_HIGH" className="text-rose-600">L1_HIGH - 嚴重危及極高</option>
                      <option value="L2_MEDIUM" className="text-amber-600">L2_MEDIUM - 中高危急</option>
                      <option value="L3_LOW" className="text-sky-600">L3_LOW - 輕微警告</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 font-bold block mb-1">主機代碼</label>
                  <input
                    type="text"
                    readOnly
                    value={`${itReportServer.id} (${itReportServer.name})`}
                    className="w-full bg-slate-100 text-slate-500 py-1.5 px-3 rounded-lg border border-slate-200 cursor-not-allowed font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="text-slate-500 font-bold block mb-1">故障細節描述/診斷日誌截圖</label>
                  <textarea
                    id="ticket-desc-input"
                    rows={4}
                    required
                    value={ticketDesc}
                    onChange={(e) => setTicketDesc(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 py-2 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#e08b46] font-mono text-[11px] leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setItReportServer(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition"
                >
                  取消
                </button>
                <button
                  id="submit-ticket-btn"
                  onClick={async () => {
                    if (!ticketTitle.trim() || !ticketDesc.trim()) {
                      alert('請填寫完整標題與描述細節！');
                      return;
                    }
                    try {
                      await onCreateTicket({
                        title: ticketTitle,
                        serverId: itReportServer.id,
                        microserviceId: itReportServer.microservices.find((m: any) => m.status !== 'running')?.id || '',
                        category: ticketCategory,
                        priority: ticketPriority,
                        description: ticketDesc,
                        sysLog: `Pre-market Checklist Incident logs for ${itReportServer.id}`
                      });
                      alert(`✅ 申報成功！已於 IT 系統註冊最新電子維護工單。\n指派派工單至：陳曉明 (Ming) 進行優先排除。`);
                      setItReportServer(null);
                    } catch (e: any) {
                      alert(`建立工單失敗: ${e.message}`);
                    }
                  }}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-5 py-2 rounded-lg cursor-pointer transition-all"
                >
                  確認建立工單並通知 IT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2.2 Modal detail popup for Failed file transfer task diagnostics */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bento-card border border-rose-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-4 bg-white">
            <button 
              onClick={() => setSelectedTaskDetail(null)}
              className="absolute right-4 top-4 hover:bg-slate-100 p-1.5 rounded-xl text-slate-400 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="space-y-4 font-sans">
              <div className="flex items-center space-x-2 text-rose-600 border-b border-bento-border pb-2.5">
                <AlertOctagon className="w-6 h-6 animate-bounce" />
                <h3 className="text-base font-bold text-slate-900">轉檔重整失敗原因定位說明</h3>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 font-mono text-xs border border-bento-border">
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <span>拋轉工識別碼：<strong className="text-slate-900 font-mono">{selectedTaskDetail.id}</strong></span>
                  <span>庫結構別：<strong className="text-slate-900 font-mono">{selectedTaskDetail.dbType}</strong></span>
                  <span className="col-span-2">轉檔指標名：<strong className="text-slate-800">{selectedTaskDetail.taskName}</strong></span>
                  <span className="col-span-2">伺服器檔案：<strong className="text-slate-600 font-mono">{selectedTaskDetail.fileName}</strong></span>
                </div>
                <div className="border-t border-slate-200 pt-2 text-rose-600">
                  <span className="font-bold underline">失敗嚴重程度分類：[{selectedTaskDetail.errorCategory}]</span>
                  <p className="mt-1.5 text-slate-700 font-sans leading-relaxed text-xs">
                    {selectedTaskDetail.errorDetail}
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-slate-500 text-[11px] leading-relaxed">
                <span className="font-bold text-slate-700 block mb-1">💡 建議維運處事 SOP 步驟：</span>
                <p>1. 確認銀行聯外通道 F5 / MPLS 專線防火牆是否正常放行 SFTP 協定 Port 22。</p>
                <p>2. 下載實體檔案確認 UTF-8 字元中是否包含不符合 Schema 規範之全形空格或溢出亂碼。</p>
                <p>3. 登錄中台中樞，視本機排程重灌手動檔案寫入流程。</p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedTaskDetail(null)}
                  className="bg-[#e08b46] hover:bg-[#d07a35] text-xs font-bold text-white px-5 py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  確認並關閉診斷面板
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
