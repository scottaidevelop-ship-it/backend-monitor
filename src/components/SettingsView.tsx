/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  HolidaySetting, 
  UserPermission,
  FunctionMenu,
  PermissionGroup
} from '../types';
import { 
  Settings, 
  CalendarDays, 
  Users, 
  MapPin, 
  Plus, 
  Search, 
  UserCheck, 
  Save, 
  Building,
  Trash2,
  Edit2,
  RefreshCw,
  Unlock,
  Lock,
  ArrowRightLeft,
  Sliders,
  CheckCircle2,
  XCircle,
  FileText,
  Zap,
  ShieldAlert
} from 'lucide-react';

interface SettingsProps {
  holidays: HolidaySetting[];
  permissions: UserPermission[];
  branchData: { code: string; name: string; region: string }[];
  onAddHoliday: (payload: any) => Promise<void>;
  onSyncHolidays?: (year: number) => Promise<any>;
  onReloadState?: () => void;
  functionMenus?: FunctionMenu[];
  permissionGroups?: PermissionGroup[];
  alertRuleSettings: { type: string; threshold: number; enabled: boolean }[];
  onUpdateThresholds: (cpu: number, ram: number, disk: number) => Promise<void>;
}

export function SettingsView({
  holidays,
  permissions,
  branchData,
  onAddHoliday,
  onSyncHolidays,
  onReloadState,
  functionMenus = [],
  permissionGroups = [],
  alertRuleSettings,
  onUpdateThresholds
}: SettingsProps) {

  // Active settings tab: 'holiday' | 'security' | 'threshold'
  const [innerTab, setInnerTab] = useState<'holiday' | 'security' | 'threshold'>('holiday');

  // Multi-tier subtabs inside security: 'users' | 'menus' | 'groups'
  const [secSubTab, setSecSubTab] = useState<'users' | 'menus' | 'groups'>('users');

  // HOLIDAY TAB STATES
  const [newHoliDate, setNewHoliDate] = useState('');
  const [newHoliName, setNewHoliName] = useState('');
  const [newHoliType, setNewHoliType] = useState<'放假日' | '工作日（補班）'>('放假日');
  const [newHoliNote, setNewHoliNote] = useState('');
  const [syncYear, setSyncYear] = useState('2026');
  const [isSyncing, setIsSyncing] = useState(false);

  // THRESHOLD TAB STATES
  const initialCpuThresh = useMemo(() => alertRuleSettings?.find(r => r.type === 'CPU')?.threshold || 80, [alertRuleSettings]);
  const initialRamThresh = useMemo(() => alertRuleSettings?.find(r => r.type === 'RAM')?.threshold || 80, [alertRuleSettings]);
  const initialDiskThresh = useMemo(() => alertRuleSettings?.find(r => r.type === 'Disk')?.threshold || 80, [alertRuleSettings]);

  const [cpuVal, setCpuVal] = useState(initialCpuThresh);
  const [ramVal, setRamVal] = useState(initialRamThresh);
  const [diskVal, setDiskVal] = useState(initialDiskThresh);
  const [savingThresholds, setSavingThresholds] = useState(false);

  // USER MANAGEMENT FORM STATES (3.2.1)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    name: '',
    role: 'Operator' as 'Admin' | 'Operator' | 'Guest',
    email: '',
    phone: '',
    startDate: '2026-05-21',
    endDate: '9999-12-31',
    status: '啟用' as '啟用' | '鎖定' | '停用',
    branch: '001 總行營業部',
    defaultHost: 'AP-023'
  });

  // FUNCTION MENU FORM STATES (3.2.2)
  const [editingMenuCode, setEditingMenuCode] = useState<string | null>(null);
  const [menuForm, setMenuForm] = useState({
    code: '',
    name: '',
    order: 1,
    parentCode: '',
    layer: 1 as 1 | 2 | 3,
    status: '啟用' as '啟用' | '停用',
    description: '',
    routePath: '',
    actions: {
      query: true,
      add: false,
      edit: false,
      delete: false,
      download: false
    }
  });

  // PERMISSION GROUPS STATES (3.2.3)
  const [activeGroupCode, setActiveGroupCode] = useState<string>('admin');
  const [groupTab, setGroupTab] = useState<'info' | 'functions' | 'users'>('functions');

  // Group Form state (Subtab 1)
  const [editingGroupCode, setEditingGroupCode] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState({
    code: '',
    name: '',
    status: '啟用' as '啟用' | '停用',
    description: ''
  });

  // Temporary function check state for Group functional matrix (Subtab 2)
  const [grpFunctions, setGrpFunctions] = useState<{ [fCode: string]: { query: boolean; add: boolean; edit: boolean; delete: boolean; download: boolean } }>({});

  const activeGroup = useMemo(() => {
    return permissionGroups.find(g => g.code === activeGroupCode);
  }, [permissionGroups, activeGroupCode]);

  // Load functions matrix state whenever activeGroup shifts
  React.useEffect(() => {
    if (activeGroup) {
      const initial: typeof grpFunctions = {};
      functionMenus.forEach(m => {
        const found = activeGroup.functions.find(gf => gf.functionCode === m.code);
        initial[m.code] = {
          query: found ? found.query : false,
          add: found ? found.add : false,
          edit: found ? found.edit : false,
          delete: found ? found.delete : false,
          download: found ? found.download : false
        };
      });
      setGrpFunctions(initial);
    }
  }, [activeGroup, functionMenus]);


  // HANDLERS: HOLIDAYS
  const handleAddHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliDate || !newHoliName) {
      alert('請填寫日期與假期名稱！');
      return;
    }
    try {
      await onAddHoliday({
        date: newHoliDate,
        name: newHoliName,
        type: newHoliType,
        note: newHoliNote
      });
      alert(`🎉 交易與交割放假日「${newHoliName}」登錄成功！此日期將自動套用至清算避災機制中。`);
      setNewHoliDate('');
      setNewHoliName('');
      setNewHoliNote('');
      if (onReloadState) onReloadState();
    } catch (err: any) {
      alert('新增交割放假日失敗: ' + err.message);
    }
  };

  const handleSyncTaiwanHolidays = async () => {
    if (!onSyncHolidays) return;
    setIsSyncing(true);
    try {
      const res = await onSyncHolidays(parseInt(syncYear) || 2026);
      alert(`🎉 成功與台灣政府行事曆同步！本批次共載入/合併公務人員放假安排 ${res.count} 筆。`);
    } catch (e: any) {
      alert('同步異常: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };


  // HANDLERS: 3.2.1 USER PROFILE Maintenance
  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username || !userForm.name) {
      alert('帳號與人員姓名不可留空！');
      return;
    }
    try {
      const body = editingUserId ? { id: editingUserId, ...userForm } : userForm;
      const res = await fetch('/api/permissions/users/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        alert(editingUserId ? '👤 使用者基本安全屬性更新完成！' : '👤 新使用者註冊登載成功，初始密碼設為 [123]。');
        setEditingUserId(null);
        setUserForm({
          username: '',
          name: '',
          role: 'Operator',
          email: '',
          phone: '',
          startDate: '2026-05-21',
          endDate: '9999-12-31',
          status: '啟用',
          branch: '001 總行營業部',
          defaultHost: 'AP-023'
        });
        if (onReloadState) onReloadState();
      }
    } catch (err: any) {
      alert('存檔使用者資料發生錯誤: ' + err.message);
    }
  };

  const handleEditUserClick = (user: UserPermission) => {
    setEditingUserId(user.id);
    setUserForm({
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      startDate: user.startDate || '2026-05-21',
      endDate: user.endDate || '9999-12-31',
      status: user.status || '啟用',
      branch: user.branch || '001 總行營業部',
      defaultHost: user.defaultHost || 'AP-023'
    });
  };

  const handleDeleteUserClick = async (id: string, name: string) => {
    if (!confirm(`確定要完全清除帳號成員 [${name}] 嗎？此操作不可撤銷。`)) return;
    try {
      const res = await fetch('/api/permissions/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        alert('使用者已被徹底剔除！');
        if (onReloadState) onReloadState();
      }
    } catch (err: any) {
      alert('刪除使用者失敗: ' + err.message);
    }
  };

  const handleResetUserLockClick = async (id: string, name: string) => {
    try {
      const res = await fetch('/api/permissions/users/reset-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        alert(`🔓 人員 [${name}] 的登入錯誤計數已歸零，密碼鎖定已解除。`);
        if (onReloadState) onReloadState();
      }
    } catch (err: any) {
      alert('密碼解鎖失敗: ' + err.message);
    }
  };


  // HANDLERS: 3.2.2 SYSTEM FUNCTION MENU Maintenance
  const handleMenuFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuForm.code || !menuForm.name) {
      alert('功能代碼及名稱為必填項！');
      return;
    }
    try {
      const res = await fetch('/api/permissions/menus/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuForm)
      });
      if (res.ok) {
        alert('📂 系統功能選單（Route-ACL）修訂/登錄保存成功！');
        setEditingMenuCode(null);
        setMenuForm({
          code: '',
          name: '',
          order: 1,
          parentCode: '',
          layer: 2,
          status: '啟用',
          description: '',
          routePath: '',
          actions: { query: true, add: false, edit: false, delete: false, download: false }
        });
        if (onReloadState) onReloadState();
      }
    } catch (err: any) {
      alert('選單存檔失敗: ' + err.message);
    }
  };

  const handleEditMenuClick = (menu: FunctionMenu) => {
    setEditingMenuCode(menu.code);
    setMenuForm({
      code: menu.code,
      name: menu.name,
      order: menu.order,
      parentCode: menu.parentCode || '',
      layer: menu.layer,
      status: menu.status,
      description: menu.description || '',
      routePath: menu.routePath,
      actions: {
        query: menu.actions.query,
        add: menu.actions.add,
        edit: menu.actions.edit,
        delete: menu.actions.delete,
        download: menu.actions.download
      }
    });
  };

  const handleDeleteMenuClick = async (code: string) => {
    if (!confirm(`確定要立刻註銷功能節點 [${code}] 嗎？這將導致其下層選單一併失效。`)) return;
    try {
      const res = await fetch('/api/permissions/menus/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (res.ok) {
        alert('選單模組已被拔除！');
        if (onReloadState) onReloadState();
      }
    } catch (err: any) {
      alert('刪除選單失敗: ' + err.message);
    }
  };


  // HANDLERS: 3.2.3 PERMISSION GROUPS Maintenance
  // Tab 1: Group properties Save
  const handleGroupFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.code || !groupForm.name) {
      alert('群組代號與名稱不可為空！');
      return;
    }
    try {
      const res = await fetch('/api/permissions/groups/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupForm)
      });
      if (res.ok) {
        alert('🛡️ 特權管理群組基本元數據保存成功！');
        setEditingGroupCode(null);
        setGroupForm({ code: '', name: '', status: '啟用', description: '' });
        if (onReloadState) onReloadState();
      }
    } catch (err: any) {
      alert('群組存檔失敗: ' + err.message);
    }
  };

  const handleEditGroupClick = (g: PermissionGroup) => {
    setEditingGroupCode(g.code);
    setGroupForm({
      code: g.code,
      name: g.name,
      status: g.status,
      description: g.description || ''
    });
  };

  const handleDeleteGroupClick = async (code: string, name: string) => {
    if (!confirm(`警告：解散 [${name}] 特權組可能會導致其下指派的人員瞬間失去安全權限！確定要刪除嗎？`)) return;
    try {
      const res = await fetch('/api/permissions/groups/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (res.ok) {
        alert('群組已撤編！');
        if (onReloadState) onReloadState();
      }
    } catch (err: any) {
      alert('解編失敗: ' + err.message);
    }
  };

  // Tab 2: Group Matrix checkboxes checkbox save
  const handleSaveGroupFunctionsMatrix = async () => {
    if (!activeGroupCode) return;
    try {
      // compile active grpFunctions into list format for backend saver
      const list = Object.keys(grpFunctions).map(fCode => ({
        functionCode: fCode,
        ...grpFunctions[fCode]
      }));

      const res = await fetch('/api/permissions/groups/save-functions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeGroupCode, functions: list })
      });
      if (res.ok) {
        alert('🛡️ 群組功能權限網格 (Query/Add/Edit/Delete/Download) 寫入完成！');
        if (onReloadState) onReloadState();
      }
    } catch (e: any) {
      alert('保存權限網格失敗: ' + e.message);
    }
  };

  // Tab 3: Group Members assigning transfer lists (Left <==> Right Transfer Layout)
  const availableUsers = useMemo(() => {
    if (!activeGroup) return [];
    return permissions.filter(p => !activeGroup.userIds.includes(p.id));
  }, [permissions, activeGroup]);

  const assignedUsers = useMemo(() => {
    if (!activeGroup) return [];
    return permissions.filter(p => activeGroup.userIds.includes(p.id));
  }, [permissions, activeGroup]);

  const handleTransferUser = async (userId: string, action: 'assign' | 'unassign') => {
    if (!activeGroup) return;
    let newUserIds = [...activeGroup.userIds];
    if (action === 'assign') {
      if (!newUserIds.includes(userId)) newUserIds.push(userId);
    } else {
      newUserIds = newUserIds.filter(id => id !== userId);
    }

    try {
      const res = await fetch('/api/permissions/groups/update-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeGroupCode, userIds: newUserIds })
      });
      if (res.ok) {
        if (onReloadState) onReloadState();
      }
    } catch (e: any) {
      alert('調整群組配置名單發生謬誤：' + e.message);
    }
  };


  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-lg space-y-6 animate-fadeIn">
      
      {/* Settings Navigation Menu */}
      <div className="flex border-b border-slate-100 pb-3 justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center">
            <Settings className="w-5 h-5 text-[#e08b46] mr-2" />
            五、 平台核心系統設定與授權維權機制
          </h2>
          <p className="text-xs text-slate-500">登載包含金鑰清算等之全台分行碼架構、國定假日自動載入與特權 ACL 級別網格核定</p>
        </div>

        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs text-slate-600">
          <button
            onClick={() => setInnerTab('holiday')}
            className={`px-3 py-1.5 rounded font-semibold cursor-pointer transition ${innerTab === 'holiday' ? 'bg-[#e08b46] text-white shadow' : 'hover:text-slate-900'}`}
          >
            5.1 交易與交割放假日
          </button>
          <button
            onClick={() => setInnerTab('security')}
            className={`px-3 py-1.5 rounded font-semibold cursor-pointer transition ${innerTab === 'security' ? 'bg-[#e08b46] text-white shadow' : 'hover:text-slate-900'}`}
          >
            5.2 系統權限與 ACL 架構
          </button>
          <button
            onClick={() => setInnerTab('threshold')}
            className={`px-3 py-1.5 rounded font-semibold cursor-pointer transition ${innerTab === 'threshold' ? 'bg-[#e08b46] text-white shadow' : 'hover:text-slate-900'}`}
          >
            5.3 警報閥值設定
          </button>
        </div>
      </div>

      {/* 5.1 Tab: Holiday Setup form and lists */}
      {innerTab === 'holiday' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Add Holiday & Sync API widget */}
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                <CalendarDays className="w-4 h-4 text-[#e08b46]" />
                <span className="font-bold text-slate-900 text-xs">手動登錄交易/交割放假日</span>
              </div>

              <form onSubmit={handleAddHolidaySubmit} className="space-y-3 font-sans text-xs">
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold block">放假日期</label>
                  <input 
                    type="date" 
                    value={newHoliDate}
                    onChange={(e) => setNewHoliDate(e.target.value)}
                    className="w-full bg-white text-slate-900 py-1.5 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold block">假期/放假事由</label>
                  <input 
                    type="text" 
                    value={newHoliName}
                    onChange={(e) => setNewHoliName(e.target.value)}
                    placeholder="例如: 中秋休假、端午節、颱風假..."
                    className="w-full bg-white text-slate-900 py-1.5 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold block">假勤屬性</label>
                  <select
                    value={newHoliType}
                    onChange={(e: any) => setNewHoliType(e.target.value)}
                    className="w-full bg-white text-slate-700 py-1.5 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                  >
                    <option value="放假日">放假日 (休市息)</option>
                    <option value="工作日（補班）">工作日 (開市跑批)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold block">詳細備註</label>
                  <input 
                    type="text" 
                    value={newHoliNote}
                    onChange={(e) => setNewHoliNote(e.target.value)}
                    placeholder="備註放假避災機制、時區提示..."
                    className="w-full bg-white text-slate-900 py-1.5 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#e08b46] hover:bg-[#d07a35] text-white font-bold py-2 rounded-lg cursor-pointer transition flex justify-center items-center space-x-1 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5 mr-0.5" />
                  <span>儲存放假安排</span>
                </button>
              </form>
            </div>

            {/* Smart Taiwan Calendar Fetching API */}
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 space-y-3 shadow-sm">
              <div className="flex items-center space-x-1.5 border-b border-orange-100 pb-2">
                <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin-slow" />
                <span className="font-bold text-orange-900 text-xs">台灣政府行事曆同步 API</span>
              </div>
              <p className="text-[11px] text-orange-800 leading-relaxed font-sans">
                點選將自動調度台灣行政院人事行政總處之中華民國國定假期、節慶及彈性放假安排，一鍵寫入系統迴避清算。
              </p>
              <div className="flex space-x-2 items-center pt-1">
                <span className="text-[11px] text-orange-900 font-semibold">目標年份:</span>
                <select
                  value={syncYear}
                  onChange={(e) => setSyncYear(e.target.value)}
                  className="bg-white border border-orange-200 text-orange-900 text-[11px] py-1 px-1.5 rounded font-mono focus:outline-none focus:border-[#e08b46]"
                >
                  <option value="2026">2026 年 (當前年度)</option>
                  <option value="2027">2027 年</option>
                  <option value="2028">2028 年</option>
                  <option value="2025">2025 年</option>
                </select>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleSyncTaiwanHolidays}
                  className="flex-1 bg-[#e08b46] hover:bg-[#d07a35] text-white py-1 px-2.5 rounded text-[11px] font-bold shadow transition-all flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isSyncing ? 'API 同步中...' : '同步行事曆 API'}
                </button>
              </div>
            </div>
          </div>

          {/* Holiday lists */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase block font-mono">交割放假日資表格系統列表 ({holidays.length})</span>
            
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 font-mono">
                    <th className="py-2.5 px-3">日期 (YYYY-MM-DD)</th>
                    <th className="py-2.5 px-3">放假名稱</th>
                    <th className="py-2.5 px-3">核心避災屬性</th>
                    <th className="py-2.5 px-3">系統同步備忘</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {holidays.map((h, i) => (
                    <tr key={h.date || i} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-bold text-[#e08b46]">{h.date}</td>
                      <td className="py-2.5 px-3 text-slate-900 font-sans font-semibold">{h.name}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          h.type === '放假日' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          {h.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-sans">{h.note || 'API 自動同步掛載'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 5.2 Tab: Users Security permissions config (Detailed 3.2.1, 3.2.2, 3.2.3 sections) */}
      {innerTab === 'security' && (
        <div className="space-y-5 animate-fadeIn">
          
          {/* Sub Navigation Bar for Pages 10-12 sections */}
          <div className="flex border-b border-slate-100 pb-1 flex-wrap gap-2 text-xs">
            <button
              onClick={() => setSecSubTab('users')}
              className={`pb-2 px-3 font-bold border-b-2 cursor-pointer transition ${secSubTab === 'users' ? 'border-[#e08b46] text-[#e08b46]' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              3.2.1 使用者資料與誤鎖維護
            </button>
            <button
              onClick={() => setSecSubTab('menus')}
              className={`pb-2 px-3 font-bold border-b-2 cursor-pointer transition ${secSubTab === 'menus' ? 'border-[#e08b46] text-[#e08b46]' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              3.2.2 功能選單 (Menu) 登錄
            </button>
            <button
              onClick={() => setSecSubTab('groups')}
              className={`pb-2 px-3 font-bold border-b-2 cursor-pointer transition ${secSubTab === 'groups' ? 'border-[#e08b46] text-[#e08b46]' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              3.2.3 特權管理群組與功能 ACL 對照
            </button>
          </div>

          {/* 3.2.1 SUB TAB: USER MAINTENANCE */}
          {secSubTab === 'users' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* User edit/add form */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-2">
                  <Users className="w-4.5 h-4.5 text-[#e08b46]" />
                  <span className="font-bold text-slate-900 text-xs">
                    {editingUserId ? `修改帳戶成員: ${userForm.name}` : '手動增設系統在線成員'}
                  </span>
                </div>

                <form onSubmit={handleUserFormSubmit} className="space-y-3 font-sans text-[11px] text-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">登入帳號 (Username)</label>
                      <input 
                        type="text" required value={userForm.username}
                        disabled={!!editingUserId}
                        onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                        className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46] disabled:opacity-50"
                        placeholder="例如: tung_ops"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">人員真實姓名 (name)</label>
                      <input 
                        type="text" required value={userForm.name}
                        onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                        className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                        placeholder="例如: 王大同"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">對應分行/部門 (branch)</label>
                      <select 
                        value={userForm.branch}
                        onChange={(e) => setUserForm({...userForm, branch: e.target.value})}
                        className="w-full bg-white text-slate-700 py-1.5 px-1 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      >
                        <option value="001 總行營業部">001 總行營業部</option>
                        <option value="002 敦南分行">002 敦南分行</option>
                        <option value="003 信義分行">003 信義分行</option>
                        <option value="011 中永和分行">011 中永和分行</option>
                        <option value="023 內湖備援科">023 內湖備援科</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">所承角色等級 (role)</label>
                      <select 
                        value={userForm.role}
                        onChange={(e: any) => setUserForm({...userForm, role: e.target.value})}
                        className="w-full bg-white text-slate-700 py-1.5 px-1 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      >
                        <option value="Admin">Admin (特別管理員)</option>
                        <option value="Operator">Operator (運維值班經理)</option>
                        <option value="Guest">Guest (稽核唯讀人員)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">聯絡信箱 (email)</label>
                      <input 
                        type="email" required value={userForm.email}
                        onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                        className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                        placeholder="dean.lin@bank.com.tw"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">安全聯絡電話 (phone)</label>
                      <input 
                        type="text" required value={userForm.phone}
                        onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                        className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                        placeholder="09xx-xxxxxx"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">授權起效時間 (startDate)</label>
                      <input 
                        type="date" required value={userForm.startDate}
                        onChange={(e) => setUserForm({...userForm, startDate: e.target.value})}
                        className="w-full bg-white text-slate-700 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">承終起效時間 (endDate)</label>
                      <input 
                        type="date" required value={userForm.endDate}
                        onChange={(e) => setUserForm({...userForm, endDate: e.target.value})}
                        className="w-full bg-white text-slate-700 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">常用作業主機 (defaultHost)</label>
                      <input 
                        type="text" value={userForm.defaultHost}
                        onChange={(e) => setUserForm({...userForm, defaultHost: e.target.value})}
                        className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                        placeholder="例如: DB-077, AP-023"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">安全狀態 (status)</label>
                      <select 
                        value={userForm.status}
                        onChange={(e: any) => setUserForm({...userForm, status: e.target.value})}
                        className="w-full bg-white text-slate-700 py-1.5 px-1 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      >
                        <option value="啟用">啟用 (ACTIVE)</option>
                        <option value="鎖定">鎖定 (BLOCKED)</option>
                        <option value="停用">停用 (DISABLED)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex space-x-1.5 pt-2">
                    {editingUserId && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingUserId(null);
                          setUserForm({ username: '', name: '', role: 'Operator', email: '', phone: '', startDate: '', endDate: '', status: '啟用', branch: '', defaultHost: '' });
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded"
                      >
                        取消
                      </button>
                    )}
                    <button 
                      type="submit"
                      className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-1.5 rounded flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingUserId ? '儲存帳戶變更' : '登記註冊在線'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Users List with password retry reset */}
              <div className="xl:col-span-2 space-y-3">
                <span className="text-[11px] font-bold text-slate-500 font-mono block">銀行運維名冊 & 鎖定解除器 ({permissions.length})</span>
                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 font-mono">
                        <th className="py-2.5 px-3">帳號 / 真實姓名</th>
                        <th className="py-2.5 px-3 font-sans">分行 / 權限等級</th>
                        <th className="py-2.5 px-3">通訊資訊 Email/電話</th>
                        <th className="py-2.5 px-3">狀態/密碼重數</th>
                        <th className="py-2.5 px-3 text-right">安全處置</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {permissions.map((user) => {
                        const isRetryBlocked = user.passwordRetryCount && user.passwordRetryCount >= 3;
                        return (
                          <tr key={user.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3 font-mono">
                              <div className="font-bold text-slate-900">{user.name}</div>
                              <div className="text-[10px] text-slate-500">@{user.username}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-sky-700 text-[11px]">{user.branch || '未設定'}</div>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                user.role === 'Admin' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                user.role === 'Operator' ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[10px] text-slate-600 space-y-0.5">
                              <div>{user.email}</div>
                              <div>{user.phone}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                user.status === '啟用' && !isRetryBlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}>
                                {user.status || '啟用'} {isRetryBlocked ? '(密碼誤鎖!)' : ''}
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">連錯: {user.passwordRetryCount || 0}/3</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-end space-x-1">
                                {(isRetryBlocked || user.status === '鎖定') && (
                                  <button
                                    onClick={() => handleResetUserLockClick(user.id, user.name)}
                                    title="清空錯誤計數，解鎖帳號"
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 p-1 rounded transition flex items-center space-x-1 border border-emerald-200"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold">解鎖</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleEditUserClick(user)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1 rounded transition border border-slate-200"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUserClick(user.id, user.name)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1 rounded transition border border-rose-200"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* 3.2.2 SUB TAB: FUNCTION MENU CONFIGURATION */}
          {secSubTab === 'menus' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Menu creation form */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-2">
                  <Sliders className="w-4.5 h-4.5 text-[#e08b46]" />
                  <span className="font-bold text-slate-900 text-xs">
                    {editingMenuCode ? `修改選單設定: [${menuForm.code}]` : '新註冊系統功能選單'}
                  </span>
                </div>

                <form onSubmit={handleMenuFormSubmit} className="space-y-3 font-sans text-[11px] text-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">功能唯一代碼 (code)</label>
                      <input 
                        type="text" required value={menuForm.code}
                        disabled={!!editingMenuCode}
                        onChange={(e) => setMenuForm({...menuForm, code: e.target.value})}
                        className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46] disabled:opacity-50"
                        placeholder="例如: A01005"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">選單顯示名稱 (name)</label>
                      <input 
                        type="text" required value={menuForm.name}
                        onChange={(e) => setMenuForm({...menuForm, name: e.target.value})}
                        className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                        placeholder="例如: 檔案安全備份"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">顯示序 (order)</label>
                      <input 
                        type="number" required value={menuForm.order}
                        onChange={(e) => setMenuForm({...menuForm, order: parseInt(e.target.value) || 1})}
                        className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">層級維度 (layer)</label>
                      <select 
                        value={menuForm.layer}
                        onChange={(e: any) => setMenuForm({...menuForm, layer: parseInt(e.target.value) as any})}
                        className="w-full bg-white text-slate-700 py-1 px-1 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      >
                        <option value={1}>1 層 (大索引)</option>
                        <option value={2}>2 層 (子目錄)</option>
                        <option value={3}>3 層 (工作鈕)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">安全狀態</label>
                      <select 
                        value={menuForm.status}
                        onChange={(e: any) => setMenuForm({...menuForm, status: e.target.value})}
                        className="w-full bg-white text-slate-700 py-1.5 px-1 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      >
                        <option value="啟用">啟用</option>
                        <option value="停用">停用</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-500 font-bold block mb-1">父主索引代碼 (parentCode - 選填)</label>
                    <input 
                      type="text" value={menuForm.parentCode}
                      onChange={(e) => setMenuForm({...menuForm, parentCode: e.target.value})}
                      className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      placeholder="例如: A01000"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-bold block mb-1">映射路由路徑 (routePath)</label>
                    <input 
                      type="text" required value={menuForm.routePath}
                      onChange={(e) => setMenuForm({...menuForm, routePath: e.target.value})}
                      className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                      placeholder="/admin/backup"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-bold block mb-1">功能描述</label>
                    <textarea 
                      value={menuForm.description}
                      onChange={(e) => setMenuForm({...menuForm, description: e.target.value})}
                      className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46] h-11"
                      placeholder="簡述此模組功能..."
                    />
                  </div>

                  {/* Actions checkboxes */}
                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1.5 shadow-inner">
                    <span className="font-bold text-slate-500 block text-[10px]">定義其下支持之工作按鈕 (Available Actions):</span>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                        <input 
                          type="checkbox" checked={menuForm.actions.query}
                          onChange={(e) => setMenuForm({...menuForm, actions: {...menuForm.actions, query: e.target.checked}})}
                          className="rounded text-[#e08b46] bg-white border-slate-300"
                        />
                        <span>查詢 (Query)</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                        <input 
                          type="checkbox" checked={menuForm.actions.add}
                          onChange={(e) => setMenuForm({...menuForm, actions: {...menuForm.actions, add: e.target.checked}})}
                          className="rounded text-[#e08b46] bg-white border-slate-300"
                        />
                        <span>新增 (Add)</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                        <input 
                          type="checkbox" checked={menuForm.actions.edit}
                          onChange={(e) => setMenuForm({...menuForm, actions: {...menuForm.actions, edit: e.target.checked}})}
                          className="rounded text-[#e08b46] bg-white border-slate-300"
                        />
                        <span>修改 (Edit)</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                        <input 
                          type="checkbox" checked={menuForm.actions.delete}
                          onChange={(e) => setMenuForm({...menuForm, actions: {...menuForm.actions, delete: e.target.checked}})}
                          className="rounded text-[#e08b46] bg-white border-slate-300"
                        />
                        <span>刪除 (Delete)</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
                        <input 
                          type="checkbox" checked={menuForm.actions.download}
                          onChange={(e) => setMenuForm({...menuForm, actions: {...menuForm.actions, download: e.target.checked}})}
                          className="rounded text-[#e08b46] bg-white border-slate-300"
                        />
                        <span>匯出 (Download)</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex space-x-1.5 pt-1">
                    {editingMenuCode && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingMenuCode(null);
                          setMenuForm({ code: '', name: '', order: 1, parentCode: '', layer: 1, status: '啟用', description: '', routePath: '', actions: { query: true, add: false, edit: false, delete: false, download: false } });
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded"
                      >
                        取消
                      </button>
                    )}
                    <button 
                      type="submit"
                      className="flex-1 bg-[#e08b46] hover:bg-[#d07a35] text-white font-bold py-1.5 rounded flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>儲存系統功能</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Menu Registry Table */}
              <div className="xl:col-span-2 space-y-3">
                <span className="text-[11px] font-bold text-slate-500 font-mono block">功能模組/權限選單樹清單代表 ({functionMenus.length})</span>
                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto font-mono text-[11px]">
                  <table className="w-full text-left border-collapse text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                        <th className="py-2.5 px-3">功能代碼/顯示序</th>
                        <th className="py-2.5 px-3">層級名稱</th>
                        <th className="py-2.5 px-3">路由路徑 routePath</th>
                        <th className="py-2.5 px-3">支持按鈕 Acls</th>
                        <th className="py-2.5 px-3 text-right">作業</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {functionMenus.map((m) => (
                        <tr key={m.code} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-[#e08b46]">{m.code}</span>
                            <div className="text-[10px] text-slate-400">顯示序: {m.order}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-1">
                              <span className="text-slate-300">{' | '.repeat(m.layer - 1)} └─</span>
                              <span className="font-bold text-slate-900 font-sans">{m.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-sans block">{m.description || '無描述'}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[10px]">{m.routePath}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 font-sans text-[9px] font-semibold">
                              {m.actions.query && <span className="bg-slate-50 text-slate-600 px-1 py-0.2 rounded border border-slate-200">查</span>}
                              {m.actions.add && <span className="bg-teal-50 text-teal-700 px-1 py-0.2 rounded border border-teal-200">增</span>}
                              {m.actions.edit && <span className="bg-amber-50 text-amber-700 px-1 py-0.2 rounded border border-amber-200">改</span>}
                              {m.actions.delete && <span className="bg-rose-50 text-rose-700 px-1 py-0.2 rounded border border-rose-200">刪</span>}
                              {m.actions.download && <span className="bg-sky-50 text-sky-700 px-1 py-0.2 rounded border border-sky-200">下載</span>}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleEditMenuClick(m)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1 rounded transition border border-slate-200"
                              >
                                <Edit2 className="w-3" h-3 />
                              </button>
                              <button
                                onClick={() => handleDeleteMenuClick(m.code)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 p-1 rounded transition border border-rose-200"
                              >
                                <Trash2 className="w-3" h-3 />
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

          {/* 3.2.3 SUB TAB: ROLE PERMISSION GROUPS & GRID CHECKBOXES */}
          {secSubTab === 'groups' && (
            <div className="space-y-4">
              
              {/* Group selection and horizontal secondary subtabs */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-3 rounded-xl border border-slate-200 gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-600 font-bold">請選擇作業特權群組：</span>
                  <select
                    value={activeGroupCode}
                    onChange={(e) => setActiveGroupCode(e.target.value)}
                    className="bg-white text-slate-900 font-bold border border-slate-200 py-1 px-3 rounded text-xs focus:outline-none focus:border-[#e08b46] font-sans"
                  >
                    {permissionGroups.map(g => (
                      <option key={g.code} value={g.code}>{g.name} ({g.code.toUpperCase()})</option>
                    ))}
                  </select>
                </div>

                <div className="flex bg-white p-0.5 rounded border border-slate-200 text-[11px] font-sans">
                  <button
                    onClick={() => setGroupTab('info')}
                    className={`py-1 px-3 rounded cursor-pointer transition ${groupTab === 'info' ? 'bg-[#e08b46] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    3.2.3.1 群組基本維護
                  </button>
                  <button
                    onClick={() => setGroupTab('functions')}
                    className={`py-1 px-3 rounded cursor-pointer transition ${groupTab === 'functions' ? 'bg-[#e08b46] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    3.2.3.2 權限對應配(網格)
                  </button>
                  <button
                    onClick={() => setGroupTab('users')}
                    className={`py-1 px-3 rounded cursor-pointer transition ${groupTab === 'users' ? 'bg-[#e08b46] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    3.2.3.3 人員綁定/指派
                  </button>
                </div>
              </div>

              {/* Content depending on secondary groupTab */}
              {groupTab === 'info' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fadeIn">
                  
                  {/* Create group form */}
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-2">
                      <Sliders className="w-4.5 h-4.5 text-[#e08b46]" />
                      <span className="font-bold text-slate-900 text-xs">
                        {editingGroupCode ? `修改群組: ${groupForm.name}` : '建立特權角色群組'}
                      </span>
                    </div>

                    <form onSubmit={handleGroupFormSubmit} className="space-y-3 font-sans text-[11px] text-slate-700">
                      <div>
                        <label className="text-slate-500 font-bold block mb-1">群組編號 (code)</label>
                        <input 
                          type="text" required value={groupForm.code}
                          disabled={!!editingGroupCode}
                          onChange={(e) => setGroupForm({...groupForm, code: e.target.value.toLowerCase()})}
                          className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46] disabled:opacity-50"
                          placeholder="例如: billing_ops"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 font-bold block mb-1">群組中文名稱 (name)</label>
                        <input 
                          type="text" required value={groupForm.name}
                          onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                          className="w-full bg-white text-slate-900 py-1 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                          placeholder="例如: 票據結算組"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 font-bold block mb-1">群組狀態</label>
                        <select 
                          value={groupForm.status}
                          onChange={(e: any) => setGroupForm({...groupForm, status: e.target.value})}
                          className="w-full bg-white text-slate-700 py-1 px-1 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46]"
                        >
                          <option value="啟用">啟用</option>
                          <option value="停用">停用</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 font-bold block mb-1">描述/備忘說明</label>
                        <textarea 
                          value={groupForm.description}
                          onChange={(e) => setGroupForm({...groupForm, description: e.target.value})}
                          className="w-full bg-white text-slate-900 py-1.5 px-2 rounded border border-slate-200 focus:outline-none focus:border-[#e08b46] h-16"
                          placeholder="請詳述此群組在避災中對應之授權工作範疇..."
                        />
                      </div>

                      <div className="flex space-x-1.5 pt-1">
                        {editingGroupCode && (
                          <button 
                            type="button"
                            onClick={() => {
                              setEditingGroupCode(null);
                              setGroupForm({ code: '', name: '', status: '啟用', description: '' });
                            }}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded"
                          >
                            取消
                          </button>
                        )}
                        <button 
                          type="submit"
                          className="flex-1 bg-[#e08b46] hover:bg-[#d07a35] text-white font-bold py-1.5 rounded flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>儲存群組資料</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Groups Registry List */}
                  <div className="xl:col-span-2 space-y-3">
                    <span className="text-[11px] font-bold text-slate-500 font-mono block">主控權限群組類別 Registry ({permissionGroups.length})</span>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto font-sans text-xs text-slate-700">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 font-mono">
                            <th className="py-2.5 px-3">群組代號</th>
                            <th className="py-2.5 px-3">群組名稱</th>
                            <th className="py-2.5 px-3">工作職掌/核定備忘</th>
                            <th className="py-2.5 px-3">狀態</th>
                            <th className="py-2.5 px-3 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {permissionGroups.map(g => (
                            <tr key={g.code} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-3 font-mono font-bold text-[#e08b46]">{g.code.toUpperCase()}</td>
                              <td className="py-3 px-3 font-bold text-slate-900">{g.name}</td>
                              <td className="py-3 px-3 text-slate-600 leading-relaxed max-w-xs">{g.description || '無描述'}</td>
                              <td className="py-3 px-3 font-mono">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  g.status === '啟用' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                  {g.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    onClick={() => handleEditGroupClick(g)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1 rounded transition border border-slate-200"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteGroupClick(g.code, g.name)}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 p-1 rounded transition border border-rose-200"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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

              {/* 3.2.3.2 Functional Matrix Checkboxes tab */}
              {groupTab === 'functions' && activeGroup && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 animate-fadeIn shadow-inner">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
                    <div>
                      <h4 className="text-slate-900 font-bold text-xs flex items-center">
                        <Sliders className="w-4 h-4 text-emerald-600 mr-1.5" />
                        權限功能對應配置：正在為群組【{activeGroup.name}】勾選可用功能按鈕權限 (ACL Matrix)
                      </h4>
                      <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                        按鈕 Acls 可精細調控此特別角色在其對應功能視圖（如戰情監控、工單開立）下，具體允許執行哪些事件（查詢、新增、修改、刪除、或匯出）。
                      </p>
                    </div>
                    <button
                      onClick={handleSaveGroupFunctionsMatrix}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-4 rounded shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>儲存【{activeGroup.name}】功能權限</span>
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 overflow-x-auto rounded-lg text-slate-700 font-mono text-[11px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 bg-white font-sans font-bold">
                          <th className="py-2.5 px-3">模組代碼</th>
                          <th className="py-2.5 px-3">功能選單名稱 (層級結構)</th>
                          <th className="py-2.5 px-3 text-center">可查詢 (Query)</th>
                          <th className="py-2.5 px-3 text-center">可新增 (Add)</th>
                          <th className="py-2.5 px-3 text-center">可修改 (Edit)</th>
                          <th className="py-2.5 px-3 text-center">可刪除 (Delete)</th>
                          <th className="py-2.5 px-3 text-center">可下載/匯出 (Download)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {functionMenus.map((m) => {
                          const grpPerm = grpFunctions[m.code] || { query: false, add: false, edit: false, delete: false, download: false };
                          return (
                            <tr key={m.code} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 text-[#e08b46] font-bold">{m.code}</td>
                              <td className="py-2.5 px-3 text-slate-900 font-sans">
                                <span className="text-slate-400">{' | '.repeat(m.layer - 1)} ├─ </span>
                                {m.name}
                              </td>
                              
                              {/* Checkbox matrices */}
                              <td className="py-2.5 px-3 text-center">
                                {m.actions.query ? (
                                  <input 
                                    type="checkbox" checked={grpPerm.query}
                                    onChange={(e) => setGrpFunctions({
                                      ...grpFunctions,
                                      [m.code]: { ...grpPerm, query: e.target.checked }
                                    })}
                                    className="rounded text-[#e08b46] bg-white border-slate-300 cursor-pointer"
                                  />
                                ) : <span className="text-slate-400 text-[10px] select-none font-sans">無支援</span>}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                {m.actions.add ? (
                                  <input 
                                    type="checkbox" checked={grpPerm.add}
                                    onChange={(e) => setGrpFunctions({
                                      ...grpFunctions,
                                      [m.code]: { ...grpPerm, add: e.target.checked }
                                    })}
                                    className="rounded text-[#e08b46] bg-white border-slate-300 cursor-pointer"
                                  />
                                ) : <span className="text-slate-400 text-[10px] select-none font-sans">無支援</span>}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                {m.actions.edit ? (
                                  <input 
                                    type="checkbox" checked={grpPerm.edit}
                                    onChange={(e) => setGrpFunctions({
                                      ...grpFunctions,
                                      [m.code]: { ...grpPerm, edit: e.target.checked }
                                    })}
                                    className="rounded text-[#e08b46] bg-white border-slate-300 cursor-pointer"
                                  />
                                ) : <span className="text-slate-400 text-[10px] select-none font-sans">無支援</span>}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                {m.actions.delete ? (
                                  <input 
                                    type="checkbox" checked={grpPerm.delete}
                                    onChange={(e) => setGrpFunctions({
                                      ...grpFunctions,
                                      [m.code]: { ...grpPerm, delete: e.target.checked }
                                    })}
                                    className="rounded text-[#e08b46] bg-white border-slate-300 cursor-pointer"
                                  />
                                ) : <span className="text-slate-400 text-[10px] select-none font-sans">無支援</span>}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                {m.actions.download ? (
                                  <input 
                                    type="checkbox" checked={grpPerm.download}
                                    onChange={(e) => setGrpFunctions({
                                      ...grpFunctions,
                                      [m.code]: { ...grpPerm, download: e.target.checked }
                                    })}
                                    className="rounded text-[#e08b46] bg-white border-slate-300 cursor-pointer"
                                  />
                                ) : <span className="text-slate-400 text-[10px] select-none font-sans">無支援</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3.2.3.3 Left <==> Right users transfer panel */}
              {groupTab === 'users' && activeGroup && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 animate-fadeIn shadow-inner">
                  <div>
                    <h4 className="text-slate-900 font-bold text-xs flex items-center">
                      <ArrowRightLeft className="w-4 h-4 text-sky-600 mr-1.5" />
                      群組人員配置分配：正在微調【{activeGroup.name}】的指派成員 (Left - Right Dual Transfer)
                    </h4>
                    <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                      您可以一擊移動，快速新增在線帳號成員進入該特權授權組，或者將其從組中拔除。系統將立即依此映射在握。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    
                    {/* Left: Available list */}
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="font-bold text-slate-600 text-xs">可供分配或指派之人員名冊 ({availableUsers.length})</span>
                        <span className="text-[9px] text-slate-400 font-mono">AVAILABLE</span>
                      </div>
                      <div className="space-y-2 max-h-[290px] overflow-y-auto">
                        {availableUsers.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-[11px]">所有帳號皆已分派入編！</div>
                        ) : (
                          availableUsers.map((u) => (
                            <div key={u.id} className="bg-white p-2.5 rounded border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition shadow-sm">
                              <div className="font-sans text-[11px]">
                                <div className="font-bold text-slate-900">{u.name} ({u.role})</div>
                                <div className="text-[9px] text-slate-500 font-mono">@{u.username} | {u.branch}</div>
                              </div>
                              <button 
                                onClick={() => handleTransferUser(u.id, 'assign')}
                                className="bg-orange-50 hover:bg-[#e08b46] text-[#e08b46] hover:text-white p-1 rounded font-bold text-[10px] border border-orange-200 px-2 transition-all cursor-pointer"
                              >
                                加入 &gt;
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Right: Assigned List */}
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="font-bold text-[#e08b46] text-xs">已加入【{activeGroup.name}】之成員名冊 ({assignedUsers.length})</span>
                        <span className="text-[9px] text-slate-400 font-mono">ASSIGNED</span>
                      </div>
                      <div className="space-y-2 max-h-[290px] overflow-y-auto">
                        {assignedUsers.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-[11px]">此群組目前尚無值班指派成員。</div>
                        ) : (
                          assignedUsers.map((u) => (
                            <div key={u.id} className="bg-white p-2.5 rounded border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition shadow-sm">
                              <div className="font-sans text-[11px]">
                                <div className="font-bold text-slate-900">{u.name} ({u.role})</div>
                                <div className="text-[9px] text-slate-500 font-mono">@{u.username} | {u.branch}</div>
                              </div>
                              <button 
                                onClick={() => handleTransferUser(u.id, 'unassign')}
                                className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white p-1 rounded font-bold text-[10px] border border-rose-100 px-2 transition-all cursor-pointer"
                              >
                                &lt; 剔除
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* 5.3 Tab: Watermark threshold setting widget */}
      {innerTab === 'threshold' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6">
            <div className="flex items-center space-x-3 border-b border-slate-200 pb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Sliders className="w-6 h-6 text-[#e08b46]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">警報閥值設定 (Watermark Setting)</h3>
                <p className="text-xs text-slate-500 mt-1 font-sans">
                  配置全伺服器核心監管指標之過載告警百分比。當 CPU、RAM 或磁碟佔用超過設定值時，系統將主動發送通報。
                </p>
              </div>
            </div>

            <div className="space-y-8 py-4 font-sans">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-700 font-bold flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-[#e08b46]" />
                    AP CPU 使用率警報閥值
                  </span>
                  <span className="text-[#e08b46] font-mono font-bold text-lg">{cpuVal}%</span>
                </div>
                <input 
                  type="range" min="50" max="95" value={cpuVal}
                  onChange={(e) => setCpuVal(Number(e.target.value))}
                  className="w-full h-2 accent-[#e08b46] rounded-full bg-slate-200 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 px-1">
                  <span>50% (低敏感)</span>
                  <span>95% (高敏感)</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-700 font-bold flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-emerald-600" />
                    機房 RAM 吞吐警報閥值
                  </span>
                  <span className="text-emerald-600 font-mono font-bold text-lg">{ramVal}%</span>
                </div>
                <input 
                  type="range" min="50" max="95" value={ramVal}
                  onChange={(e) => setRamVal(Number(e.target.value))}
                  className="w-full h-2 accent-emerald-500 rounded-full bg-slate-200 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 px-1">
                  <span>50%</span>
                  <span>95%</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-700 font-bold flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-amber-600" />
                    AP / DB 磁區硬碟警報閥值
                  </span>
                  <span className="text-amber-600 font-mono font-bold text-lg">{diskVal}%</span>
                </div>
                <input 
                  type="range" min="50" max="95" value={diskVal}
                  onChange={(e) => setDiskVal(Number(e.target.value))}
                  className="w-full h-2 accent-amber-500 rounded-full bg-slate-200 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 px-1">
                  <span>50%</span>
                  <span>95%</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={async () => {
                  setSavingThresholds(true);
                  try {
                    await onUpdateThresholds(cpuVal, ramVal, diskVal);
                    alert('🔔 水位安全警報閥值更新成功！\n全伺服器已套用最新監控上限。');
                  } catch (err: any) {
                    alert('更新警報臨界失敗：' + err.message);
                  } finally {
                    setSavingThresholds(false);
                  }
                }}
                disabled={savingThresholds}
                className="w-full bg-[#e08b46] hover:bg-[#d07a35] text-sm font-bold text-white py-3 rounded-xl cursor-pointer transition flex items-center justify-center space-x-2 disabled:opacity-50 shadow-md shadow-orange-900/10"
              >
                <Save className="w-5 h-5" />
                <span>{savingThresholds ? '正在套用閥值設定...' : '儲存並同步全站閥值'}</span>
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>提示：</strong> 修改閥值後，系統通報網關將立即依此標準過濾所有伺服器之硬體水壓報警。過高的閥值可能導致預警延遲，建議維持在 80%~85% 之間以獲取最佳平衡。
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
