/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ShiftDuty, 
  HolidaySetting,
  UserPermission 
} from '../types';
import { 
  Calendar, 
  Clock, 
  UserCheck, 
  PhoneCall, 
  Mail, 
  Slash, 
  Smartphone, 
  ToggleLeft, 
  ToggleRight, 
  Zap, 
  CheckCircle, 
  ShieldAlert, 
  Save, 
  CloudRain, 
  Sun,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  RefreshCw
} from 'lucide-react';

interface DutyProps {
  shifts: ShiftDuty[];
  holidays: HolidaySetting[];
  calendarMode: 'weekday' | 'holiday' | 'typhoon';
  onUpdateCalendarMode: (mode: 'weekday' | 'holiday' | 'typhoon') => Promise<void>;
  onUpdateShift: (date: string, field: 'primary' | 'secondary', payload: any) => void;
  users?: UserPermission[];
  onAddHoliday?: (payload: any) => Promise<void>;
  onSyncHolidays?: (year: number) => Promise<any>;
  onReloadState?: () => void;
}

export function DutyManagementView({
  shifts,
  holidays,
  calendarMode,
  onUpdateCalendarMode,
  onUpdateShift,
  users = [],
  onAddHoliday,
  onSyncHolidays,
  onReloadState
}: DutyProps) {
  
  // View Tab State
  const [activeTab, setActiveTab] = useState<'schedule' | 'calendar'>('schedule');

  // Shift Schedule modification state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [primaryName, setPrimaryName] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [secondaryName, setSecondaryName] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');

  const [savingShiftIndex, setSavingShiftIndex] = useState<number | null>(null);

  // Calendar Logic State
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 4)); // Default to May 2026
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStatus, setEditStatus] = useState<'放假日' | '工作日（補班）'>('放假日');
  const [editReason, setEditReason] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Trigger calendar mode updates
  const handleCalendarModeChange = async (mode: 'weekday' | 'holiday' | 'typhoon') => {
    try {
      await onUpdateCalendarMode(mode);
      alert('📅 行事曆模式已切換為：[' + (mode === 'weekday' ? '平日工作期' : mode === 'holiday' ? '假日/節慶' : '颱風警戒日') + ']！\n系統在「非工作交易時段」下，將自動啟用告警消音/靜音黑名單，避免派發不必要的結帳逾時通報。');
    } catch (err: any) {
      alert('行事曆設定變更失敗：' + err.message);
    }
  };

  const handleEditShiftClick = (idx: number, shift: ShiftDuty) => {
    setEditingIndex(idx);
    setPrimaryName(shift.primaryDuty.name);
    setPrimaryPhone(shift.primaryDuty.phone);
    setPrimaryEmail(shift.primaryDuty.email);
    setSecondaryName(shift.secondaryDuty.name);
    setSecondaryPhone(shift.secondaryDuty.phone);
    setSecondaryEmail(shift.secondaryDuty.email);
  };

  const handleSaveShiftChanges = (idx: number, date: string) => {
    setSavingShiftIndex(idx);
    
    // Dispatch local edits updates back
    onUpdateShift(date, 'primary', {
      name: primaryName,
      phone: primaryPhone,
      email: primaryEmail,
      lineVerified: shifts[idx].primaryDuty.lineVerified
    });

    onUpdateShift(date, 'secondary', {
      name: secondaryName,
      phone: secondaryPhone,
      email: secondaryEmail,
      lineVerified: shifts[idx].secondaryDuty.lineVerified
    });

    setSavingShiftIndex(null);
    setEditingIndex(null);
    alert('📅 日期 ' + date + ' 之值班調度與通知信箱存檔成功！已即時套用全台中繼推播名單。');
  };

  // Calendar Helpers
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = [];
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    // Padding for start of month
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Days of month
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, i).getDay(); // 0 = Sun, 6 = Sat
      const holiday = holidays.find(h => h.date === dateStr);
      
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isExplicitWorkday = holiday?.type === '工作日（補班）';
      const isExplicitHoliday = holiday?.type === '放假日';

      const isHolidayFinal = (isWeekend && !isExplicitWorkday) || isExplicitHoliday;

      days.push({
        day: i,
        date: dateStr,
        isHoliday: isHolidayFinal,
        holidayName: holiday?.name || (isWeekend && !isExplicitWorkday ? '例假日' : ''),
        holidayType: holiday?.type || (isWeekend && !isExplicitWorkday ? '放假日' : '')
      });
    }

    return days;
  }, [currentMonth, holidays]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateClick = (date: string, isHoliday: boolean, name: string) => {
    setSelectedDate(date);
    setEditStatus(isHoliday ? '放假日' : '工作日（補班）');
    setEditReason(name);
    setShowEditModal(true);
  };

  const handleSaveHolidayChange = async () => {
    if (editStatus === '放假日' && !editReason.trim()) {
      alert('選擇假期請輸入假期事由！');
      return;
    }

    if (onAddHoliday && selectedDate) {
      try {
        await onAddHoliday({
          date: selectedDate,
          name: editStatus === '放假日' ? editReason : '一般上班',
          type: editStatus,
          note: editStatus === '放假日' ? `使用者手動修正: ${editReason}` : '使用者修正為一般上班'
        });
        alert(`📅 日期 ${selectedDate} 已更新為 ${editStatus === '放假日' ? '假期' : '上班'}！`);
        setShowEditModal(false);
        if (onReloadState) onReloadState();
      } catch (err: any) {
        alert('更新失敗: ' + err.message);
      }
    }
  };

  const handleSyncHolidaysLocal = async () => {
    if (!onSyncHolidays) return;
    setIsSyncing(true);
    try {
      const year = currentMonth.getFullYear();
      const res = await onSyncHolidays(year);
      alert(`🎉 成功同步 ${year} 年台灣政府行事曆！新增/更新了 ${res.count} 筆放假安排。`);
    } catch (err: any) {
      alert('同步 API 失敗：' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 4.0 Tab Navigation (Mimicking Monitoring layout) */}
      <div className="flex border border-bento-border bg-slate-50 p-1.5 rounded-xl">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeTab === 'schedule' ? 'bg-[#e08b46] text-white shadow-sm border border-[#e08b46]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
        >
          <UserCheck className="w-4 h-4" />
          <span>4.1 值班人員排班</span>
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeTab === 'calendar' ? 'bg-[#e08b46] text-white shadow-sm border border-[#e08b46]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
        >
          <Calendar className="w-4 h-4" />
          <span>4.2 行事曆設定</span>
        </button>
      </div>

      {activeTab === 'schedule' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 4.3 Calendar Time Control ( weekday/holiday/typhoon toggle ) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-lg space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center">
                <Calendar className="w-5 h-5 text-[#e08b46] mr-2" />
                4.3 行事曆智慧時段控管 (Calendar Controls)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                本行系統能智慧識別「例假日、平日、颱風警報停班假」。在非傳統交易/結帳時段，<b>系統會主動過濾並停止發送「結帳提醒」等不具備即時危害性之逾時警報</b>，避免錯誤騷擾休假或撤離中的員工。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <button
                onClick={() => handleCalendarModeChange('weekday')}
                className={`p-4 rounded-xl border transition text-center flex flex-col items-center justify-center cursor-pointer ${
                  calendarMode === 'weekday' 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Sun className={`w-8 h-8 mb-2 ${calendarMode === 'weekday' ? 'text-emerald-600 rotate-12' : 'text-slate-400'}`} />
                <span className="text-xs font-bold block">平日交易工作時段</span>
                <span className="text-[10px] mt-1.5 opacity-80 border-t border-slate-100 pt-1.5">
                  啟動全管道即時警戒告警、隨時核算清算
                </span>
              </button>

              <button
                onClick={() => handleCalendarModeChange('holiday')}
                className={`p-4 rounded-xl border transition text-center flex flex-col items-center justify-center cursor-pointer ${
                  calendarMode === 'holiday' 
                    ? 'bg-orange-50 border-[#e08b46] text-[#e08b46] shadow-lg' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Calendar className={`w-8 h-8 mb-2 ${calendarMode === 'holiday' ? 'text-[#e08b46]' : 'text-slate-400'}`} />
                <span className="text-xs font-bold block">週末法假日/民俗休市日</span>
                <span className="text-[10px] mt-1.5 opacity-80 border-t border-slate-100 pt-1.5 col-span-2">
                  拒發非必要結帳逾時提醒，消音過濾
                </span>
              </button>

              <button
                onClick={() => handleCalendarModeChange('typhoon')}
                className={`p-4 rounded-xl border transition text-center flex flex-col items-center justify-center cursor-pointer ${
                  calendarMode === 'typhoon' 
                    ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-lg' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <CloudRain className={`w-8 h-8 mb-2 ${calendarMode === 'typhoon' ? 'text-rose-600 animate-bounce' : 'text-slate-400'}`} />
                <span className="text-xs font-bold block">防颱防汛緊急避災日</span>
                <span className="text-[10px] mt-1.5 opacity-80 border-t border-slate-100 pt-1.5">
                  進入最高救災模式，封鎖全域結帳提示
                </span>
              </button>

            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed font-sans">
              <div className="flex items-center space-x-2 font-bold text-slate-800 mb-1">
                <ShieldAlert className="w-4 h-4 text-[#e08b46]" />
                <span>目前行事曆過濾狀態（情境展示）：</span>
              </div>
              {calendarMode === 'weekday' ? (
                <span className="text-emerald-700">🟢 系統目前處於【平日工作交易時段】，所有中台結算、AP指標大盤等皆處於靈敏偵測態。</span>
              ) : (
                <span className="text-amber-700">🟡 系統目前啟動了【智慧靜音機制】，在放假日，若在 15:30 觸發「本機餘額未拋逾時」警報，系統將靜音丟棄，確保同仁不被打擾。</span>
              )}
            </div>
          </div>

          {/* 4.1 Value shift management interface */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-lg space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center">
                <UserCheck className="w-5 h-5 text-[#e08b46] mr-2" />
                4.1 & 4.2 全科人員值班排班設定與智能通知綁定
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                此處可維護每日、每班的值班第一、第二負責人。<b>智能通知邏輯已鎖定：告警推播簡訊/LINE僅在「當下當值時間」向有值班的人員手機派發，避免打擾休假群</b>。
              </p>
            </div>

            <div className="space-y-3">
              {shifts.map((s, idx) => {
                const isEditing = editingIndex === idx;
                
                // Check if this card represents "Today" (T_day is mock 2026-05-21)
                const isToday = s.date === '2026-05-21' || idx === 0;

                return (
                  <div 
                    key={s.date} 
                    className={`p-4 rounded-xl border transition ${
                      isToday 
                        ? 'bg-slate-50 border-[#e08b46]/50 shadow-md ring-1 ring-[#e08b46]/20' 
                        : 'bg-white border-slate-100'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-sm font-mono">{s.date} ({s.dayOfWeek})</span>
                          {isToday && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-200">
                              值勤中 (ACTIVE)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">全中台中樞業務清算、警報第一接收順位</p>
                      </div>

                      {/* Primary & Secondary View / Edit */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 max-w-2xl text-xs font-mono">
                        
                        {/* Primary */}
                        <div className="bg-white p-3 rounded-lg border border-slate-100 text-slate-700">
                          <div className="text-sky-600 font-bold mb-1.5 flex items-center justify-between text-[11px]">
                            <span>第一負責人 (Primary)</span>
                            {s.primaryDuty.lineVerified ? (
                              <span className="text-[10px] text-emerald-600 font-normal">指紋授權 verified</span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-normal">待認證</span>
                            )}
                          </div>
                          
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <label className="text-[9px] text-sky-600 block">選擇在職人員/自動帶出：</label>
                              <select
                                onChange={(e) => {
                                  const found = users.find(u => u.id === e.target.value);
                                  if (found) {
                                    setPrimaryName(found.name);
                                    setPrimaryPhone(found.phone);
                                    setPrimaryEmail(found.email);
                                  }
                                }}
                                className="w-full bg-slate-50 text-slate-900 py-1 px-1.5 rounded border border-slate-200 text-[10px]"
                                defaultValue=""
                              >
                                <option value="" disabled>-- 點此選擇帶出資訊 --</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.name} (門戶: {u.username})</option>
                                ))}
                              </select>
                              
                              <div className="space-y-1 pt-1 border-t border-slate-100">
                                <input 
                                  type="text" value={primaryName} onChange={(e) => setPrimaryName(e.target.value)}
                                  placeholder="任職名"
                                  className="bg-slate-50 border border-slate-200 p-1 rounded text-xs w-full text-slate-900"
                                />
                                <input 
                                  type="text" value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)}
                                  placeholder="電話"
                                  className="bg-slate-50 border border-slate-200 p-1 rounded text-xs w-full text-slate-700 animate-fadeIn"
                                />
                                <input 
                                  type="text" value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)}
                                  placeholder="聯絡信箱"
                                  className="bg-slate-50 border border-slate-200 p-1 rounded text-xs w-full text-slate-700 animate-fadeIn"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5 font-sans font-normal">
                              <div className="font-bold text-slate-900 text-sm">{s.primaryDuty.name}</div>
                              <div className="text-slate-600 flex items-center mt-1">
                                <PhoneCall className="w-3 h-3 text-slate-400 mr-1.5" />
                                {s.primaryDuty.phone}
                              </div>
                              <div className="text-slate-600 flex items-center mt-0.5">
                                <Mail className="w-3 h-3 text-slate-400 mr-1.5" />
                                {s.primaryDuty.email}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Secondary */}
                        <div className="bg-white p-3 rounded-lg border border-slate-100 text-slate-700">
                          <div className="text-slate-500 font-bold mb-1.5 flex items-center justify-between text-[11px]">
                            <span>第二負責人 (Backup)</span>
                          </div>
                          
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <label className="text-[9px] text-sky-600 block">選擇在職人員/自動帶出：</label>
                              <select
                                onChange={(e) => {
                                  const found = users.find(u => u.id === e.target.value);
                                  if (found) {
                                    setSecondaryName(found.name);
                                    setSecondaryPhone(found.phone);
                                    setSecondaryEmail(found.email);
                                  }
                                }}
                                className="w-full bg-slate-50 text-slate-900 py-1 px-1.5 rounded border border-slate-200 text-[10px]"
                                defaultValue=""
                              >
                                <option value="" disabled>-- 點此選擇帶出資訊 --</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.name} (門戶: {u.username})</option>
                                ))}
                              </select>
                              
                              <div className="space-y-1 pt-1 border-t border-slate-100">
                                <input 
                                  type="text" value={secondaryName} onChange={(e) => setSecondaryName(e.target.value)}
                                  placeholder="任職名"
                                  className="bg-slate-50 border border-slate-200 p-1 rounded text-xs w-full text-slate-900"
                                />
                                <input 
                                  type="text" value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)}
                                  placeholder="電話"
                                  className="bg-slate-50 border border-slate-200 p-1 rounded text-xs w-full text-slate-700 animate-fadeIn"
                                />
                                <input 
                                  type="text" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)}
                                  placeholder="聯絡信箱"
                                  className="bg-slate-50 border border-slate-200 p-1 rounded text-xs w-full text-slate-700 animate-fadeIn"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5 font-sans font-normal">
                              <div className="font-bold text-slate-900 text-sm">{s.secondaryDuty.name}</div>
                              <div className="text-slate-600 flex items-center mt-1">
                                <PhoneCall className="w-3 h-3 text-slate-400 mr-1.5" />
                                {s.secondaryDuty.phone}
                              </div>
                              <div className="text-slate-600 flex items-center mt-0.5">
                                <Mail className="w-3 h-3 text-slate-400 mr-1.5" />
                                {s.secondaryDuty.email}
                              </div>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Actions (Edit / Save) */}
                      <div className="flex items-center">
                        {isEditing ? (
                          <button
                            onClick={() => handleSaveShiftChanges(idx, s.date)}
                            className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold text-xs py-1.5 px-3 rounded-lg cursor-pointer transition flex items-center space-x-1"
                          >
                            <Save className="w-4 h-4" />
                            <span>儲存</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEditShiftClick(idx, s)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-bold text-xs py-1.5 px-3 rounded-lg cursor-pointer transition border border-slate-200"
                          >
                            編輯調整
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="animate-fadeIn space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center">
                  <Calendar className="w-5 h-5 text-[#e08b46] mr-2" />
                  4.2 行事曆與放假安排設定
                </h2>
                <p className="text-xs text-slate-500 mt-1">點選日期即可修正「放假日」或「工作日」，假期一律顯示為紅色。</p>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleSyncHolidaysLocal}
                  disabled={isSyncing}
                  className="bg-orange-50 hover:bg-[#e08b46] border border-[#e08b46]/20 text-[#e08b46] hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? '同步中...' : '同步台灣行事曆 API'}</span>
                </button>

                <div className="flex items-center space-x-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-900 cursor-pointer">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-bold text-slate-800 font-mono w-32 text-center">
                    {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
                  </span>
                  <button onClick={handleNextMonth} className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-900 cursor-pointer">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="bg-slate-50 py-3 text-center text-xs font-bold text-slate-500 uppercase">
                  {d}
                </div>
              ))}
              
              {calendarDays.map((dayObj, idx) => {
                if (!dayObj) return <div key={`pad-${idx}`} className="bg-white/50 min-h-24" />;
                
                return (
                  <div 
                    key={dayObj.date}
                    onClick={() => handleDateClick(dayObj.date, dayObj.isHoliday, dayObj.holidayName)}
                    className={`bg-white min-h-24 p-2 transition-all hover:bg-slate-50 cursor-pointer border-t border-slate-100 relative group`}
                  >
                    <span className={`text-sm font-mono font-bold ${dayObj.isHoliday ? 'text-rose-600' : 'text-slate-500'}`}>
                      {dayObj.day}
                    </span>
                    
                    {dayObj.isHoliday && (
                      <div className="mt-2">
                        <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded block truncate font-bold">
                          {dayObj.holidayName}
                        </span>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-[#e08b46]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center space-x-6 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-rose-500 rounded-sm"></div>
                <span>國定假日/例假日 (紅色)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-slate-400 rounded-sm"></div>
                <span>一般上班日 (灰色)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Date Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-slate-900 font-bold flex items-center">
                <Calendar className="w-5 h-5 text-[#e08b46] mr-2" />
                修改日期狀態：{selectedDate}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-900 transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">日期類別</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <button
                    onClick={() => setEditStatus('工作日（補班）')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${editStatus === '工作日（補班）' ? 'bg-white text-emerald-600 border border-emerald-200' : 'text-slate-400 hover:text-slate-900'}`}
                  >
                    一般上班
                  </button>
                  <button
                    onClick={() => setEditStatus('放假日')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${editStatus === '放假日' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'text-slate-400 hover:text-slate-900'}`}
                  >
                    假期 (紅色)
                  </button>
                </div>
              </div>

              {editStatus === '放假日' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-xs font-bold text-slate-500">假期事由</label>
                  <input
                    type="text"
                    placeholder="請輸入假期事由 (如: 端午節, 員工旅遊...)"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#e08b46] transition-all"
                  />
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleSaveHolidayChange}
                  className="w-full bg-[#e08b46] hover:bg-[#d07a35] text-white font-bold py-3 rounded-xl cursor-pointer transition flex items-center justify-center space-x-2 shadow-lg shadow-orange-900/10"
                >
                  <Save className="w-4 h-4" />
                  <span>確認儲存變更</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
