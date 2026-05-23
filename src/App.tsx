/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  SystemState, 
  ServerInstance, 
  MaintenanceTicket, 
  ShiftDuty, 
  HolidaySetting, 
  UserPermission 
} from './types';
import { DashboardView } from './components/DashboardView';
import { SystemMonitoringView } from './components/SystemMonitoringView';
import { OperationsView } from './components/OperationsView';
import { DutyManagementView } from './components/DutyManagementView';
import { SettingsView } from './components/SettingsView';
import { BranchInfoView } from './components/BranchInfoView';
import { 
  LayoutDashboard, 
  Activity, 
  Wrench, 
  Calendar, 
  Settings, 
  RefreshCw, 
  ShieldAlert, 
  Terminal, 
  Building2, 
  Clock,
  Lock,
  User,
  LogIn
} from 'lucide-react';

export default function App() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monitoring' | 'operations' | 'branch-info' | 'duty' | 'settings'>('dashboard');

  // User Authentication States (admin/123/王大同)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; name: string; role: string } | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim() === 'admin' && passwordInput === '123') {
      setCurrentUser({
        id: 'usr-admin',
        username: 'admin',
        name: '王大同',
        role: 'Admin'
      });
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('⚠️ 帳號或密碼不正確，請重新輸入！');
    }
  };

  // Unified global system state
  const [state, setState] = useState<SystemState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Time ticker state
  const [currentTime, setCurrentTime] = useState('');

  // Update timezone ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleString('zh-TW', { timeZone: 'UTC', hour12: false }) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch full state from full-stack system backend
  const fetchState = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setState(data);
      } else {
        console.error('Failed to fetch operational state.');
      }
    } catch (err) {
      console.error('Error fetching backend state:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchState();
    // Auto-sync Taiwan holidays for 2026 on initial load
    handleSyncHolidays(2026).catch(err => console.error("Initial holiday sync failed:", err));

    // Poll the backend every 6 seconds to capture simulated live CPU/RAM metrics and alert updates!
    const poll = setInterval(() => {
      fetchState();
    }, 6000);
    return () => clearInterval(poll);
  }, []);

  // API Call: Create standard ticket or AI report
  const handleCreateTicket = async (payload: any) => {
    try {
      const res = await fetch('/api/ticket/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchState();
      } else {
        throw new Error('Server returned error status');
      }
    } catch (err) {
      console.error('Create ticket failed:', err);
      throw err;
    }
  };

  // API Call: Reboot microservice quickly
  const handleRebootMicroservice = async (serverId: string, msId: string) => {
    try {
      const res = await fetch('/api/server/reboot-microservice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, microserviceId: msId })
      });
      if (res.ok) {
        // Optimistic state updates
        await fetchState();
      } else {
        throw new Error('Reboot API call failed');
      }
    } catch (err) {
      console.error('Microservice reboot failed:', err);
      throw err;
    }
  };

  // API Call: Mark Ticket Investigating or Resolved
  const handleUpdateTicketStatus = async (ticketId: string, status: string, note?: string) => {
    try {
      const res = await fetch('/api/ticket/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, status, note })
      });
      if (res.ok) {
        await fetchState();
      } else {
        throw new Error('Ticket state transition failed');
      }
    } catch (err) {
      console.error('Error updating ticket:', err);
      throw err;
    }
  };

  // API Call: Save water pressure rules thresholds
  const handleUpdateThresholds = async (cpu: number, ram: number, disk: number) => {
    try {
      const res = await fetch('/api/alert/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpu, ram, disk })
      });
      if (res.ok) {
        await fetchState();
      } else {
        throw new Error('Failed to update alert water level');
      }
    } catch (err) {
      console.error('Save thresholds failed:', err);
      throw err;
    }
  };

  // API Call: Simulate LINE/SMS Alert Push to Active On-duty staff
  const handleSimulateAlert = async (channels: ('SMS' | 'LINE' | 'Email')[], text: string, serverId: string) => {
    try {
      const res = await fetch('/api/alert/simulate-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels, text, targetServerId: serverId })
      });
      if (res.ok) {
        const bodyNext = await res.json();
        // Refresh alert stream lists
        await fetchState();
        return bodyNext;
      } else {
        throw new Error('Gateway rejected alert simulator packet');
      }
    } catch (err) {
      console.error('Simulating alert failed:', err);
      throw err;
    }
  };

  // API Call: Gemini AI Diagnosis of Logs Stack Trace
  const handleDiagnoseLogs = async (logsText: string, serverId: string) => {
    try {
      const res = await fetch('/api/gemini/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logsText, serverId })
      });
      if (res.ok) {
        return await res.json();
      } else {
        throw new Error('LLM diagnostics server timeout');
      }
    } catch (err) {
      console.error('Gemini diagnostics crashed:', err);
      throw err;
    }
  };

  // API Call: Calendar Mode weekday/holiday state transitions
  const handleUpdateCalendarMode = async (mode: 'weekday' | 'holiday' | 'typhoon') => {
    try {
      const res = await fetch('/api/calendar/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        await fetchState();
      } else {
        throw new Error('Calendar update rejected');
      }
    } catch (err) {
      console.error('Update calendar failed:', err);
      throw err;
    }
  };

  // Local helper: Edit Duty list directly from UI
  const handleUpdateShiftLocal = (date: string, field: 'primary' | 'secondary', payload: any) => {
    if (!state) return;
    
    // Create copy and update
    const updatedShifts = state.shifts.map(s => {
      if (s.date === date) {
        return {
          ...s,
          primaryDuty: field === 'primary' ? payload : s.primaryDuty,
          secondaryDuty: field === 'secondary' ? payload : s.secondaryDuty
        };
      }
      return s;
    });

    setState({
      ...state,
      shifts: updatedShifts
    });
  };

  // Local Add Holiday Setting helper
  const handleAddHolidayLocal = async (payload: any) => {
    try {
      const res = await fetch('/api/holidays/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Sync Taiwan Holidays from API
  const handleSyncHolidays = async (year: number) => {
    try {
      const res = await fetch('/api/holidays/fetch-taiwan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year })
      });
      if (res.ok) {
        await fetchState();
        return await res.json();
      } else {
        throw new Error('Sync failed on server');
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Local Branch code setting update helper
  const handleQueryOrUpdateBranchLocal = async (payload: any) => {
    try {
      const res = await fetch('/api/branch/query-or-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#e08b46] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-sans font-semibold text-slate-500">正在裝載銀行可視化戰情室大屏數據...</p>
      </div>
    );
  }

  // If not logged in, render the Administrator login backend screen block
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
        
        {/* Ambient aesthetic background grids & glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-50 via-white to-white z-0 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-100/30 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#e08b46]/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md bg-white border border-[#e08b46]/20 rounded-3xl p-10 shadow-[0_20px_50px_rgba(224,139,70,0.1)] relative z-10 backdrop-blur-sm animate-fadeIn">
          
          <div className="text-center space-y-4 mb-10">
            <div className="inline-flex p-4 bg-[#e08b46]/10 border border-[#e08b46]/20 rounded-2xl text-[#e08b46] shadow-inner">
              <ShieldAlert className="w-10 h-10 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-[0.2em] font-sans uppercase">
                系統管理員後台
              </h2>
              <div className="h-1 w-12 bg-[#e08b46] mx-auto mt-2 rounded-full"></div>
              <p className="text-[11px] text-slate-400 mt-3 font-medium tracking-widest">
                中信中立商銀聯名會計交易運維中樞
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-6">
            {loginError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-3.5 text-xs flex items-center space-x-2 font-bold animate-shake">
                <AlertOctagon className="w-4 h-4" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 block tracking-[0.15em] uppercase px-1">
                管理員帳號
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-[#e08b46] transition-colors" />
                <input
                  type="text"
                  required
                  placeholder="admin"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setLoginError('');
                  }}
                  className="w-full bg-white text-slate-900 font-mono pl-12 pr-4 py-4 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:border-[#e08b46] focus:ring-4 focus:ring-[#e08b46]/10 transition-all placeholder-slate-300 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 block tracking-[0.15em] uppercase px-1">
                安全密碼
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-[#e08b46] transition-colors" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setLoginError('');
                  }}
                  className="w-full bg-white text-slate-900 font-mono pl-12 pr-4 py-4 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:border-[#e08b46] focus:ring-4 focus:ring-[#e08b46]/10 transition-all placeholder-slate-300 shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#e08b46] hover:bg-[#d07a35] active:scale-[0.98] text-sm font-black text-white py-4 rounded-2xl cursor-pointer transition-all duration-300 flex items-center justify-center space-x-2 shadow-xl shadow-orange-200 uppercase tracking-widest"
            >
              <LogIn className="w-5 h-5" />
              <span>進入系統</span>
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-slate-50 text-center">
            <span className="text-[10px] text-slate-300 font-medium leading-relaxed">
              限經授權之 IT 運營系統管理同仁使用。<br />系統將自動記錄使用者登入與帳戶稽核軌跡。
            </span>
          </div>
          
        </div>
      </div>
    );
  }

  // Active user details representation (override with logged-in user if available)
  const activeUser = currentUser || state.userPermissions[1];

  return (
    <div className="min-h-screen bg-bento-bg font-sans text-slate-700 flex flex-col selection:bg-[#e08b46]/30">
      
      {/* Prime Control Room Header */}
      <header className="bg-bento-panel border-b border-bento-border px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-3">
          <span className="p-2.5 bg-[#e08b46]/10 border border-[#e08b46]/20 rounded-xl text-[#e08b46] block">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </span>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-widest font-display flex items-center">
              可視化監控戰情室與告警管理系統 
              <span className="text-[10px] bg-[#e08b46]/10 text-[#e08b46] font-mono font-bold px-2 py-0.5 rounded-md ml-2 border border-[#e08b46]/25">
                v2.1 PRO
              </span>
            </h1>
            <p className="text-xs text-slate-500">全台中信中立商銀聯名會計交易運維中樞大屏</p>
          </div>
        </div>

        {/* Time and Quick utilities status */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex flex-col text-right font-mono text-[11px] leading-tight text-slate-400">
            <span className="text-slate-400 font-semibold uppercase font-sans">清算中心實體營運時間</span>
            <span className="text-slate-600">{currentTime || '2026-05-21 23:10:48 UTC'}</span>
          </div>

          <div className="bg-slate-50 p-2 rounded-xl border border-bento-border flex items-center space-x-2 text-xs">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500">當前維運官:</span>
            <span className="text-[#e08b46] font-extrabold">{activeUser.name}</span>
          </div>

          <button
            onClick={() => {
              setIsLoggedIn(false);
              setUsernameInput('');
              setPasswordInput('');
            }}
            className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 px-3.5 py-2 rounded-xl transition cursor-pointer"
            title="登出系統"
          >
            登出系統
          </button>

          <button 
            onClick={() => fetchState(true)}
            disabled={refreshing}
            className={`p-2 rounded-xl bg-slate-50 text-slate-500 hover:text-slate-900 border border-bento-border transition-all duration-200 hover:border-slate-300 flex items-center justify-center cursor-pointer ${refreshing ? 'animate-spin text-[#e08b46]' : ''}`}
            title="手動同步全機房狀態"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Operations Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left tactile Sidebar Navigation */}
        <aside className="w-52 bg-bento-panel border-r border-bento-border p-4 flex flex-col justify-between shrink-0">
          
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 block px-2.5 pb-2 uppercase tracking-wider">戰情調度選單</span>
            
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full text-left px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-250 flex items-center space-x-2.5 cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-[#e08b46]/10 text-[#e08b46] border-l-2 border-[#e08b46] font-extrabold shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5" />
              <span>1.0 戰情室大屏</span>
            </button>

            <button
              onClick={() => setActiveTab('monitoring')}
              className={`w-full text-left px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-250 flex items-center space-x-2.5 cursor-pointer ${
                activeTab === 'monitoring' 
                  ? 'bg-[#e08b46]/10 text-[#e08b46] border-l-2 border-[#e08b46] font-extrabold shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Activity className="w-4.5 h-4.5" />
              <span>2.0 系統監控大板</span>
            </button>

            <button
              onClick={() => setActiveTab('operations')}
              className={`w-full text-left px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-250 flex items-center space-x-2.5 cursor-pointer ${
                activeTab === 'operations' 
                  ? 'bg-[#e08b46]/10 text-[#e08b46] border-l-2 border-[#e08b46] font-extrabold shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-4.5 h-4.5" />
              <span>3.0 重啟與報修分析</span>
            </button>

            <button
              onClick={() => setActiveTab('branch-info')}
              className={`w-full text-left px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-250 flex items-center space-x-2.5 cursor-pointer ${
                activeTab === 'branch-info' 
                  ? 'bg-[#e08b46]/10 text-[#e08b46] border-l-2 border-[#e08b46] font-extrabold shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4.5 h-4.5" />
              <span>3.5 分行資訊</span>
            </button>

            <button
              onClick={() => setActiveTab('duty')}
              className={`w-full text-left px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-250 flex items-center space-x-2.5 cursor-pointer ${
                activeTab === 'duty' 
                  ? 'bg-[#e08b46]/10 text-[#e08b46] border-l-2 border-[#e08b46] font-extrabold shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4.5 h-4.5" />
              <span>4.0 智能值班調配</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full text-left px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-250 flex items-center space-x-2.5 cursor-pointer ${
                activeTab === 'settings' 
                  ? 'bg-[#e08b46]/10 text-[#e08b46] border-l-2 border-[#e08b46] font-extrabold shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
              <span>5.0 系統設定</span>
            </button>
          </div>

          <div className="bento-box-inner p-3.5 text-[10px] space-y-1.5">
            <div className="flex items-center space-x-1.5 text-slate-500 font-bold mb-1">
              <Building2 className="w-3.5 h-3.5 text-[#e08b46]" />
              <span>系統網路通聯</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>AP 群：</span>
              <span className="text-emerald-600 font-medium">80/80 Online</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>DB 群：</span>
              <span className="text-emerald-600 font-medium">40/40 Ready</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>節點安全：</span>
              <span className="text-sky-600 font-bold">100% Secure</span>
            </div>
          </div>

        </aside>

        {/* Central visual panel viewport */}
        <main className="flex-1 p-6 overflow-y-auto bg-bento-bg">
          
          {activeTab === 'dashboard' && (
            <DashboardView
              servers={state.servers}
              shifts={state.shifts}
              dispatchedAlerts={state.dispatchedAlerts}
              calendarMode={state.calendarMode}
              onRebootMicroservice={handleRebootMicroservice}
              onSimulateAlert={handleSimulateAlert}
            />
          )}

          {activeTab === 'monitoring' && (
            <SystemMonitoringView
              servers={state.servers}
              tasks={state.fileConversionTasks}
              steps={state.settlementSteps}
              branches={state.branchSettlements}
              logs={state.auditLogs}
              onUpdateThresholds={handleUpdateThresholds}
              alertRuleSettings={state.alertRuleSettings}
              onRebootMicroservice={handleRebootMicroservice}
              onCreateTicket={handleCreateTicket}
            />
          )}

          {activeTab === 'operations' && (
            <OperationsView
              servers={state.servers}
              tickets={state.maintenanceTickets}
              onRebootMicroservice={handleRebootMicroservice}
              onCreateTicket={handleCreateTicket}
              onUpdateTicketStatus={handleUpdateTicketStatus}
              onDiagnoseLog={handleDiagnoseLogs}
            />
          )}

          {activeTab === 'duty' && (
            <DutyManagementView
              shifts={state.shifts}
              holidays={state.holidays}
              calendarMode={state.calendarMode}
              onUpdateCalendarMode={handleUpdateCalendarMode}
              onUpdateShift={handleUpdateShiftLocal}
              users={state.userPermissions}
              onAddHoliday={handleAddHolidayLocal}
              onSyncHolidays={handleSyncHolidays}
              onReloadState={() => fetchState()}
            />
          )}

          {activeTab === 'branch-info' && (
            <BranchInfoView
              branchData={state.branchData}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              holidays={state.holidays}
              permissions={state.userPermissions}
              branchData={state.branchData}
              functionMenus={state.functionMenus}
              permissionGroups={state.permissionGroups}
              onAddHoliday={handleAddHolidayLocal}
              onSyncHolidays={handleSyncHolidays}
              onReloadState={() => fetchState()}
              alertRuleSettings={state.alertRuleSettings}
              onUpdateThresholds={handleUpdateThresholds}
            />
          )}

        </main>

      </div>
    </div>
  );
}
