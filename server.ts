/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { 
  ServerInstance, 
  FileConversionTask, 
  SettlementStep, 
  BranchSettlement, 
  AuditLog, 
  MaintenanceTicket, 
  ShiftDuty, 
  HolidaySetting, 
  UserPermission 
} from './src/types.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini Client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Global Simulated State
const STATE = {
  calendarMode: 'weekday' as 'weekday' | 'holiday' | 'typhoon',
  servers: [] as ServerInstance[],
  fileConversionTasks: [] as FileConversionTask[],
  settlementSteps: [] as SettlementStep[],
  branchSettlements: [] as BranchSettlement[],
  auditLogs: [] as AuditLog[],
  maintenanceTickets: [] as MaintenanceTicket[],
  shifts: [] as ShiftDuty[],
  holidays: [] as HolidaySetting[],
  userPermissions: [] as UserPermission[],
  branchData: [] as { code: string; name: string; region: string }[],
  functionMenus: [] as any[],
  permissionGroups: [] as any[],
  alertRuleSettings: [
    { type: 'CPU', threshold: 80, enabled: true },
    { type: 'RAM', threshold: 80, enabled: true },
    { type: 'Disk', threshold: 80, enabled: true }
  ],
  dispatchedAlerts: [] as {
    id: string;
    timestamp: string;
    channel: 'SMS' | 'LINE' | 'Email' | 'All';
    staffName: string;
    staffRole: string;
    serverName: string;
    alertText: string;
    verified: boolean;
  }[]
};

// Seed Mock Data
function seedMockData() {
  // 1. Generate 120 servers (AP-001 to AP-080, DB-001 to DB-040)
  const apNames = ['TradingAPI', 'WebPortal', 'AuthServer', 'ETransfer', 'AccountCore', 'MobileGateway', 'BranchSync', 'SettlementEngine'];
  const dbNames = ['CoreOracle', 'UserSQL', 'LedgerPostgres', 'AnalyticsDB2', 'TeradataWarehouse'];
  
  for (let i = 1; i <= 120; i++) {
    const isAP = i <= 80;
    const type = isAP ? 'AP' : 'DB';
    const id = `${type}-${String(i).padStart(3, '0')}`;
    const nameSeed = isAP ? apNames[(i - 1) % apNames.length] : dbNames[(i - 81) % dbNames.length];
    const name = `${nameSeed}-${String(i).padStart(3, '0')}`;
    const ip = isAP ? `10.100.1.${i}` : `10.100.2.${i - 80}`;
    
    // Default metrics
    let cpu = Math.floor(Math.random() * 40) + 20; // 20-60%
    let ram = Math.floor(Math.random() * 30) + 30; // 30-60%
    let disk = Math.floor(Math.random() * 25) + 40; // 40-65%
    let status: 'normal' | 'warning' | 'error' = 'normal';

    // Seed some specific anomalies to make logs interesting!
    if (i === 12) {
      // High RAM Warning
      ram = 84;
      status = 'warning';
    } else if (i === 42) {
      // High CPU Warning
      cpu = 89;
      status = 'warning';
    } else if (i === 77) {
      // Disk threshold breached (L1 High Alert!)
      disk = 92;
      status = 'error';
    } else if (i === 95) {
      // Database Server CPU spiked
      cpu = 95;
      status = 'error';
    }

    const microservices = isAP ? [
      { id: `${id}-ms1`, name: 'api-gateway', status: (i === 12) ? 'warning' : 'running' as any },
      { id: `${id}-ms2`, name: 'auth-service', status: (i === 42) ? 'warning' : 'running' as any },
      { id: `${id}-ms3`, name: 'payment-processor', status: (i === 23) ? 'stopped' : 'running' as any },
      { id: `${id}-ms4`, name: 'audit-logger', status: 'running' as any }
    ] : [
      { id: `${id}-ms1`, name: 'connection-pool', status: (i === 95) ? 'stopped' : 'running' as any },
      { id: `${id}-ms2`, name: 'transaction-listener', status: 'running' as any },
      { id: `${id}-ms3`, name: 'auto-indexer', status: 'running' as any }
    ];

    // If microservice is stopped, elevate overall server status
    if (microservices.some(m => m.status === 'stopped')) {
      status = 'error';
    } else if (microservices.some(m => m.status === 'warning') && status === 'normal') {
      status = 'warning';
    }

    STATE.servers.push({
      id,
      name,
      type,
      status,
      ip,
      metrics: { cpu, ram, disk },
      thresholds: { cpu: 80, ram: 80, disk: 80 },
      microservices,
      location: isAP ? `信義第一機房 ${Math.floor(i/20) + 1}F` : `內湖備援中心`
    });
  }

  // 2. Clear & Seed File Conversion Tasks
  const dbTypes = ['Oracle', 'SQL Server', 'PostgreSQL', 'DB2', 'Teradata'] as const;
  const files = [
    { task: '信託交易匯入', file: 'T_TRUST_TRADE_20260521.DAT' },
    { task: '信用卡扣點拋轉', file: 'C_CARD_POINTS_20260521.CSV' },
    { task: '薪資撥款明細寫入', file: 'A_PAYROLL_SYNC_20260521.TXT' },
    { task: '基金淨值更新', file: 'T_FUND_NAV_20260521.XML' },
    { task: '外匯定存結息拋檔', file: 'F_FX_INTEREST_20260521.DAT' },
    { task: '聯徵中心黑名單下載', file: 'N_JCIC_BLACKLIST_20260521.TXT' },
    { task: '總帳餘額表日拋', file: 'G_SURPLUS_BAL_20260521.CSV' }
  ];

  files.forEach((f, idx) => {
    let taskStatus: 'SUCCESS' | 'FAILED' | 'WAITING' = 'SUCCESS';
    let errorCategory: any = undefined;
    let errorDetail = '';

    if (idx === 2) {
      taskStatus = 'FAILED';
      errorCategory = '檔案未轉';
      errorDetail = '銀行拋轉伺服器 FTP 連線逾時，遠端主機無回應。';
    } else if (idx === 5) {
      taskStatus = 'FAILED';
      errorCategory = '資料異常';
      errorDetail = '第 12,408 行身份字號格式有誤，匯入中斷。';
    } else if (idx === 6) {
      taskStatus = 'WAITING';
    }

    STATE.fileConversionTasks.push({
      id: `CONV-${1000 + idx}`,
      dbType: dbTypes[idx % dbTypes.length],
      taskName: f.task,
      fileName: f.file,
      status: taskStatus,
      errorCategory,
      errorDetail,
      timestamp: `2026-05-21 ${10 + idx}:15:00`
    });
  });

  // 3. Settlement Steps
  const steps = [
    { step: 1, name: '原始檔案匯入彙整', status: 'DONE' as const, updatedAt: '2026-05-21 13:05:12' },
    { step: 2, name: '中台跨行餘額對帳', status: 'DONE' as const, updatedAt: '2026-05-21 14:12:44' },
    { step: 3, name: '分行明細彙整與加總', status: 'FAIL' as const, updatedAt: '2026-05-21 15:01:03' },
    { step: 4, name: '聯名拆分扣帳結算', status: 'WAIT' as const, updatedAt: '--' },
    { step: 5, name: '總帳餘額結帳及鎖檔', status: 'WAIT' as const, updatedAt: '--' }
  ];
  STATE.settlementSteps = steps;

  // 4. Branch Settlements
  const branchNames = [
    { code: '001', name: '總行營業部' },
    { code: '002', name: '敦南分行' },
    { code: '003', name: '信義分行' },
    { code: '004', name: '南京東路分行' },
    { code: '005', name: '台中分行' },
    { code: '006', name: '高雄分行' },
    { code: '007', name: '板橋分行' },
    { code: '008', name: '新竹科學園區分行' },
    { code: '009', name: '桃園國際機場分行' },
    { code: '010', name: '台南分行' }
  ];

  branchNames.forEach((b, idx) => {
    STATE.branchSettlements.push({
      code: b.code,
      name: b.name,
      status: idx === 4 ? 'FAIL' : (idx > 6 ? 'WAIT' : 'DONE'),
      amount: Math.floor(Math.random() * 150000000) + 30000000,
      count: Math.floor(Math.random() * 4000) + 500,
      manager: `維運專員 ${String.fromCharCode(65 + idx)}`
    });

    STATE.branchData.push({
      code: b.code,
      name: b.name,
      region: idx < 4 ? '北部地區' : (idx < 8 ? '中部地區' : '南部地區')
    });
  });

  // 5. Shift Duty Seed (Daily shifts)
  const onDutyUsers = [
    { name: '王大同 (Tung)', phone: '0912-345678', email: 'tung.wang@bank.com.tw', lineVerified: true },
    { name: '李阿美 (A-May)', phone: '0921-987654', email: 'amay.lee@bank.com.tw', lineVerified: true },
    { name: '陳曉明 (Ming)', phone: '0933-111222', email: 'ming.chen@bank.com.tw', lineVerified: false },
    { name: '張小華 (Hua)', phone: '0955-333444', email: 'hua.zhang@bank.com.tw', lineVerified: true }
  ];

  const days = ['星期四', '星期五', '星期六', '星期日', '星期一', '星期二', '星期三'];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Alternate duty roles
    STATE.shifts.push({
      date: dateStr,
      dayOfWeek: days[i],
      primaryDuty: onDutyUsers[(i) % onDutyUsers.length],
      secondaryDuty: onDutyUsers[(i + 1) % onDutyUsers.length]
    });
  }

  // 6. Holidays Config (Comprehensive 2026 Taiwan Calendar)
  STATE.holidays = [
    { date: '2026-01-01', name: '元旦/開國紀念日', type: '放假日', note: '中華民國開國紀念日' },
    { date: '2026-02-16', name: '春節除夕', type: '放假日', note: '農曆除夕' },
    { date: '2026-02-17', name: '春節初一', type: '放假日', note: '農曆正月初一' },
    { date: '2026-02-18', name: '春節初二', type: '放假日', note: '農曆正月初二' },
    { date: '2026-02-19', name: '春節初三', type: '放假日', note: '農曆正月初三' },
    { date: '2026-02-20', name: '春節初四', type: '放假日', note: '農曆正月初四' },
    { date: '2026-02-21', name: '春節初五', type: '放假日', note: '農曆正月初五' },
    { date: '2026-02-28', name: '二二八和平紀念日', type: '放假日', note: '和平紀念日' },
    { date: '2026-04-03', name: '兒童節', type: '放假日', note: '國定假日' },
    { date: '2026-04-04', name: '民族掃墓節/清明節', type: '放假日', note: '清明節墓祭' },
    { date: '2026-05-01', name: '勞動節', type: '工作日（補班）', note: '銀行業通常仍需對帳，視情況調整' },
    { date: '2026-06-19', name: '端午節', type: '放假日', note: '端午民俗節慶' },
    { date: '2026-09-25', name: '中秋節', type: '放假日', note: '中秋月圓' },
    { date: '2026-10-10', name: '國慶日', type: '放假日', note: '中華民國國慶' },
    
    // Some 2026 Weekends for mock
    { date: '2026-05-23', name: '例假日', type: '放假日', note: '週末固定休息' },
    { date: '2026-05-24', name: '例假日', type: '放假日', note: '週末固定休息' },
    { date: '2026-05-30', name: '例假日', type: '放假日', note: '週末固定休息' },
    { date: '2026-05-31', name: '例假日', type: '放假日', note: '週末固定休息' }
  ];

  // 7. Initial User Permissions
  STATE.userPermissions = [
    { 
      id: 'usr-001', 
      username: 'admin', 
      name: '王大同', 
      role: 'Admin', 
      email: 'tung.wang@bank.com.tw', 
      phone: '0912-345678', 
      permissions: ['dashboard', 'monitoring', 'maintenance', 'duty', 'settings'],
      startDate: '2020-01-01',
      endDate: '9999-12-31',
      status: '啟用',
      branch: '001 總行營業部',
      defaultHost: 'DB-077',
      passwordRetryCount: 0
    },
    { 
      id: 'usr-002', 
      username: 'dean_sys', 
      name: '林主管 (Dean)', 
      role: 'Operator', 
      email: 'dean.lin@bank.com.tw', 
      phone: '0988-123456', 
      permissions: ['dashboard', 'monitoring', 'maintenance', 'duty'],
      startDate: '2018-05-12',
      endDate: '9999-12-31',
      status: '啟用',
      branch: '002 敦南分行',
      defaultHost: 'AP-023',
      passwordRetryCount: 0
    },
    { 
      id: 'usr-003', 
      username: 'guest_audit', 
      name: '審計人員 (Audit)', 
      role: 'Guest', 
      email: 'audit.sec@bank.com.tw', 
      phone: '0966-222444', 
      permissions: ['dashboard', 'monitoring'],
      startDate: '2022-10-01',
      endDate: '2027-12-31',
      status: '啟用',
      branch: '003 信義分行',
      defaultHost: 'AP-001',
      passwordRetryCount: 0
    }
  ];

  // 7.1 Seeding standard Function Menus (3.2.2)
  STATE.functionMenus = [
    { code: 'A00000', name: '系統管理', order: 1, parentCode: '', layer: 1, status: '啟用', description: '核心運維權限總入口目錄', routePath: '/admin', actions: { query: true, add: true, edit: true, delete: true, download: true } },
    { code: 'C00000', name: '客戶資訊', order: 2, parentCode: '', layer: 1, status: '啟用', description: '客戶對帳與信用記錄主目錄', routePath: '/customer', actions: { query: true, add: false, edit: false, delete: false, download: false } },
    { code: 'E00000', name: '匯出查詢', order: 3, parentCode: '', layer: 1, status: '啟用', description: '跨分行結帳與交易明細匯出功能', routePath: '/export', actions: { query: true, add: false, edit: false, delete: false, download: true } },
    { code: 'A01000', name: '系統監控', order: 2, parentCode: 'A00000', layer: 2, status: '啟用', description: '伺服器硬體與程式狀態檢校', routePath: '/admin/monitoring', actions: { query: true, add: true, edit: true, delete: true, download: true } },
    { code: 'A01001', name: '盤前檢核', order: 1, parentCode: 'A01000', layer: 3, status: '啟用', description: '分行網路與核心庫硬碟盤前檢核', routePath: '/monitoring/pre-market', actions: { query: true, add: false, edit: false, delete: false, download: false } },
    { code: 'A01002', name: '使用即時查核', order: 2, parentCode: 'A01000', layer: 3, status: '啟用', description: '主管操作稽核日誌與會話登入軌跡', routePath: '/monitoring/audit', actions: { query: true, add: false, edit: false, delete: false, download: true } },
    { code: 'A01003', name: '型態對帳排程', order: 3, parentCode: 'A01000', layer: 3, status: '啟用', description: '中台跑批分行結帳作業日常排程狀態', routePath: '/monitoring/schedule', actions: { query: true, add: true, edit: true, delete: false, download: true } },
    { code: 'A01004', name: '轉帳監控', order: 4, parentCode: 'A01000', layer: 3, status: '啟用', description: '匯交易拋轉及檔案轉檔監控系統', routePath: '/monitoring/transfer', actions: { query: true, add: false, edit: false, delete: false, download: false } }
  ];

  // 7.2 Seeding standard Group permissions (3.2.3)
  STATE.permissionGroups = [
    {
      code: 'admin',
      name: '系統管理組',
      status: '啟用',
      description: '具備平台最高系統登入、權限重置與ACL配置權限。',
      functions: [
        { functionCode: 'A00000', query: true, add: true, edit: true, delete: true, download: true },
        { functionCode: 'C00000', query: true, add: true, edit: true, delete: true, download: true },
        { functionCode: 'E00000', query: true, add: true, edit: true, delete: true, download: true },
        { functionCode: 'A01000', query: true, add: true, edit: true, delete: true, download: true },
        { functionCode: 'A01001', query: true, add: true, edit: true, delete: true, download: true },
        { functionCode: 'A01002', query: true, add: true, edit: true, delete: true, download: true },
        { functionCode: 'A01003', query: true, add: true, edit: true, delete: true, download: true },
        { functionCode: 'A01004', query: true, add: true, edit: true, delete: true, download: true }
      ],
      userIds: ['usr-001']
    },
    {
      code: 'operator',
      name: '核心運維組',
      status: '啟用',
      description: '執行中台監控、日常轉檔跑批追蹤，禁止修改特權帳號。',
      functions: [
        { functionCode: 'A00000', query: true, add: false, edit: true, delete: false, download: true },
        { functionCode: 'C00000', query: true, add: false, edit: false, delete: false, download: false },
        { functionCode: 'E00000', query: true, add: false, edit: false, delete: false, download: true },
        { functionCode: 'A01000', query: true, add: true, edit: true, delete: false, download: true },
        { functionCode: 'A01001', query: true, add: false, edit: false, delete: false, download: false },
        { functionCode: 'A01003', query: true, add: true, edit: true, delete: false, download: true },
        { functionCode: 'A01004', query: true, add: false, edit: false, delete: false, download: false }
      ],
      userIds: ['usr-002']
    },
    {
      code: 'sales',
      name: '交易查核組',
      status: '啟用',
      description: '專為外部主管機關、稽核會計人員提供唯讀查詢、報表匯出等日常審計。',
      functions: [
        { functionCode: 'A00000', query: true, add: false, edit: false, delete: false, download: false },
        { functionCode: 'C00000', query: true, add: false, edit: false, delete: false, download: false },
        { functionCode: 'E00000', query: true, add: false, edit: false, delete: false, download: true },
        { functionCode: 'A01000', query: true, add: false, edit: false, delete: false, download: false },
        { functionCode: 'A01002', query: true, add: false, edit: false, delete: false, download: true }
      ],
      userIds: ['usr-003']
    }
  ];

  // 8. Maintenance Tickets
  STATE.maintenanceTickets = [
    {
      id: 'TKT-20260521-01',
      title: 'AP-023 交易轉帳核心 microservice stopped',
      serverId: 'AP-023',
      microserviceId: 'AP-023-ms3',
      category: '程式異常',
      priority: 'L1_HIGH',
      status: 'INVESTIGATING',
      reporter: '林主管 (Dean)',
      assignedTo: '王大同 (Tung)',
      description: '自動調度常駐執行緒在處理 23 台主機支付扣款時發生記憶體溢出（OOM），服務 payment-processor 崩潰退出，進程已停止運作。',
      createdTime: '2026-05-21 14:15:30',
      timeline: [
        { status: 'PENDING', note: '系統主動偵測 AP-023 payment-processor 微服務異常停止，自動開單', timestamp: '2026-05-21 14:15:30', operator: 'System' },
        { status: 'INVESTIGATING', note: '值班人員 Tung 簽收並開始查看系統堆疊 Log 紀錄。', timestamp: '2026-05-21 14:30:10', operator: '王大同 (Tung)' }
      ]
    },
    {
      id: 'TKT-20260519-14',
      title: '內湖備援中心硬碟容量告警 (DB-077)',
      serverId: 'DB-077',
      category: '硬體故障',
      priority: 'L2_MEDIUM',
      status: 'RESOLVED',
      reporter: '王大同 (Tung)',
      assignedTo: '李阿美 (A-May)',
      description: 'DB-077 自動歸檔資料夾 temp 佔用 92% 累積臨時轉檔，需予以清空歸檔。',
      createdTime: '2026-05-19 09:20:00',
      resolvedTime: '2026-05-19 11:32:00',
      timeline: [
        { status: 'PENDING', note: '建立系統維護工單並指派人員處理', timestamp: '2026-05-19 09:20:00', operator: '王大同 (Tung)' },
        { status: 'RESOLVED', note: '手動清除 2026 以前暫存封包並調整主儲存池配置，磁碟使用率降至 48%', timestamp: '2026-05-19 11:32:00', operator: '李阿美 (A-May)' }
      ]
    }
  ];

  // 9. Initial Audit Trail Logs
  STATE.auditLogs = [
    { id: 'LOG-3001', user: '系統管理員', action: '登入系統', details: '管理員帳號登入監控戰情室，進行每日例行檢核', timestamp: '2026-05-21 15:02:11', ip: '10.22.42.12' },
    { id: 'LOG-3002', user: '王大同 (Tung)', action: '功能存取', details: '查詢分行結帳步驟「中台跨行餘額對帳」', timestamp: '2026-05-21 15:05:32', ip: '10.22.45.109' },
    { id: 'LOG-3003', user: '系統排程', action: '轉檔偵測', details: '聯徵中心黑名單下載 FAILED，錯誤：資料格式異常', timestamp: '2026-05-21 15:08:45', ip: '127.0.0.1' }
  ];
}

seedMockData();

// Dynamic metrics updates (simulates active heartbeat so the UI stays animated!)
setInterval(() => {
  STATE.servers.forEach(srv => {
    // fluctuate CPU and RAM slightly
    const dCPU = Math.floor(Math.random() * 5) - 2;
    const dRAM = Math.floor(Math.random() * 3) - 1;
    
    // clamp between 5% and 99%
    srv.metrics.cpu = Math.max(5, Math.min(99, srv.metrics.cpu + dCPU));
    srv.metrics.ram = Math.max(5, Math.min(99, srv.metrics.ram + dRAM));

    // dynamically update server status according to thresholds
    const cpuBreach = srv.metrics.cpu >= srv.thresholds.cpu;
    const ramBreach = srv.metrics.ram >= srv.thresholds.ram;
    const diskBreach = srv.metrics.disk >= srv.thresholds.disk;
    const anyMsStopped = srv.microservices.some(m => m.status === 'stopped');

    if (anyMsStopped || cpuBreach || ramBreach || diskBreach) {
      if (anyMsStopped || srv.metrics.cpu >= 90 || srv.metrics.disk >= 90) {
        srv.status = 'error';
      } else {
        srv.status = 'warning';
      }
    } else {
      srv.status = 'normal';
    }
  });
}, 8000);

// API Endpoints
app.get('/api/state', (req, res) => {
  res.json(STATE);
});

// Update Calendar Mode
app.post('/api/calendar/update', (req, res) => {
  const { mode } = req.body;
  if (['weekday', 'holiday', 'typhoon'].includes(mode)) {
    STATE.calendarMode = mode;
    
    // Add audit log
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '王大同 (Tung)',
      action: '調整月曆管控狀態',
      details: `更新行事曆時段控管模式至：${mode === 'weekday' ? '平日工作期' : mode === 'holiday' ? '例假日休市' : '颱風放假期'}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });

    res.json({ success: true, mode });
  } else {
    res.status(400).json({ error: '無效的行事曆模式' });
  }
});

// Single Microservice Reboot
app.post('/api/server/reboot-microservice', (req, res) => {
  const { serverId, microserviceId } = req.body;
  const server = STATE.servers.find(s => s.id === serverId);
  if (!server) {
    return res.status(418).json({ error: '找不到指定的伺服器伺服器' });
  }
  
  const ms = server.microservices.find(m => m.id === microserviceId);
  if (!ms) {
    return res.status(400).json({ error: '找不到指定的微服務' });
  }

  // Reboot Action
  ms.status = 'running';
  ms.lastReboot = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Recalculate status
  const anyStopped = server.microservices.some(m => m.status === 'stopped');
  const cpuBreach = server.metrics.cpu >= server.thresholds.cpu;
  if (!anyStopped && !cpuBreach) {
    server.status = 'normal';
  }

  // Add audit log
  STATE.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    user: '王大同 (Tung)',
    action: '微服務快速重啟',
    details: `重啟伺服器 [${server.name}] (IP: ${server.ip}) 機群下之「${ms.name}」微服務。`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ip: req.ip || '127.0.0.1'
  });

  res.json({ success: true, server });
});

// Create/Update Maintenance Ticket
app.post('/api/ticket/create', (req, res) => {
  const { title, serverId, microserviceId, category, priority, description, sysLog } = req.body;
  const ticketId = `TKT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(STATE.maintenanceTickets.length + 1).padStart(2, '0')}`;
  
  const newTicket: MaintenanceTicket = {
    id: ticketId,
    title,
    serverId,
    microserviceId,
    category,
    priority,
    status: 'PENDING',
    reporter: '王大同 (Tung)',
    assignedTo: '陳曉明 (Ming)',
    description,
    logsAnalyzed: sysLog || '',
    createdTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
    timeline: [
      {
        status: 'PENDING',
        note: `電子化報修立案建檔，主機 ${serverId}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        operator: '王大同 (Tung)'
      }
    ]
  };

  STATE.maintenanceTickets.unshift(newTicket);

  // Add audit log
  STATE.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    user: '王大同 (Tung)',
    action: '建立報修工單',
    details: `立案電子化維護工單 [${ticketId}]：${title}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ip: req.ip || '127.0.0.1'
  });

  res.json({ success: true, ticket: newTicket });
});

// Update Ticket Code Status
app.post('/api/ticket/update-status', (req, res) => {
  const { ticketId, status, note } = req.body;
  const ticket = STATE.maintenanceTickets.find(t => t.id === ticketId);
  if (!ticket) {
    return res.status(404).json({ error: '找不到工單' });
  }

  ticket.status = status;
  if (status === 'RESOLVED') {
    ticket.resolvedTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  ticket.timeline.push({
    status,
    note: note || `調整工單狀態至: ${status === 'RESOLVED' ? '已處理完成' : status === 'INVESTIGATING' ? '處理偵辦中' : '等待派發中'}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    operator: '王大同 (Tung)'
  });

  // Add audit log
  STATE.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    user: '王大同 (Tung)',
    action: '更新報修狀態',
    details: `更新報修工單 [${ticketId}] 狀態為 ${status}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ip: req.ip || '127.0.0.1'
  });

  res.json({ success: true, ticket });
});

// Update Alert Thresholds
app.post('/api/alert/thresholds', (req, res) => {
  const { cpu, ram, disk } = req.body;
  
  STATE.servers.forEach(s => {
    if (cpu !== undefined) s.thresholds.cpu = cpu;
    if (ram !== undefined) s.thresholds.ram = ram;
    if (disk !== undefined) s.thresholds.disk = disk;
  });

  if (cpu !== undefined) STATE.alertRuleSettings[0].threshold = cpu;
  if (ram !== undefined) STATE.alertRuleSettings[1].threshold = ram;
  if (disk !== undefined) STATE.alertRuleSettings[2].threshold = disk;

  // Add audit log
  STATE.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    user: '林主管 (Dean)',
    action: '安全閥值調校',
    details: `修定系統關鍵指標通知水位：CPU [${cpu || 80}%], RAM [${ram || 80}%], 磁碟 [${disk || 80}%]`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ip: req.ip || '127.0.0.1'
  });

  res.json({ success: true });
});

// Manage Settings (Holidays, branch codes, users)
app.post('/api/holidays/add', (req, res) => {
  const { date, name, type, note } = req.body;
  const newHoliday: HolidaySetting = { date, name, type, note };
  STATE.holidays.push(newHoliday);
  res.json({ success: true, holidays: STATE.holidays });
});

app.post('/api/branch/query-or-update', (req, res) => {
  const { code, name, region } = req.body;
  const existing = STATE.branchData.find(b => b.code === code);
  if (existing) {
    existing.name = name;
    existing.region = region;
  } else {
    STATE.branchData.push({ code, name, region });
  }

  // Update in settlement branch lists if exists
  const bs = STATE.branchSettlements.find(b => b.code === code);
  if (bs) {
    bs.name = name;
  } else {
    STATE.branchSettlements.push({
      code,
      name,
      status: 'WAIT',
      amount: 0,
      count: 0,
      manager: '未指派'
    });
  }

  res.json({ success: true, branches: STATE.branchData });
});

// Taiwan Government Holidays API fetching and syncing
app.post('/api/holidays/fetch-taiwan', async (req, res) => {
  const { year } = req.body;
  const targetYear = year || 2026;
  try {
    const remoteResponse = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${targetYear}/TW`);
    if (remoteResponse.ok) {
      const data: any = await remoteResponse.json();
      const fetched: HolidaySetting[] = data.map((item: any) => ({
        date: item.date,
        name: item.localName || item.name,
        type: '放假日',
        note: `台灣政府法定假日 [${item.name}]`
      }));
      
      let mergedCount = 0;
      fetched.forEach(item => {
        if (!STATE.holidays.some(h => h.date === item.date)) {
          STATE.holidays.push(item);
          mergedCount++;
        }
      });
      
      STATE.holidays.sort((a,b) => a.date.localeCompare(b.date));

      STATE.auditLogs.unshift({
        id: `LOG-${Date.now()}`,
        user: '系統管理員',
        action: '載入政府行事曆',
        details: `自 API 自動同步台灣法定休假共 ${fetched.length} 筆 (新增 ${mergedCount} 筆)`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        ip: req.ip || '127.0.0.1'
      });

      return res.json({ success: true, count: mergedCount, holidays: STATE.holidays });
    }
  } catch (e: any) {
    console.error("Taiwan holiday API fetch error, executing offline fallback:", e.message);
  }

  // Robust, accurate offline fallback for Taiwanese public holidays
  const fallbackHolidays: HolidaySetting[] = [
    { date: `${targetYear}-01-01`, name: '中華民國開國紀念日', type: '放假日', note: '元旦新年，休市 1 天' },
    { date: `${targetYear}-02-28`, name: '二二八和平紀念日', type: '放假日', note: '和平紀念放假 1 天' },
    { date: `${targetYear}-04-03`, name: '兒童節', type: '放假日', note: '國定兒童照顧節放假' },
    { date: `${targetYear}-04-04`, name: '民族掃墓節', type: '放假日', note: '清明節掃墓祭祖' },
    { date: `${targetYear}-05-01`, name: '勞動節', type: '放假日', note: '勞動保障假期' },
    { date: `${targetYear}-10-10`, name: '雙十國慶日', type: '放假日', note: '中華民國國慶放假' }
  ];

  if (Number(targetYear) === 2026) {
    fallbackHolidays.push(
      { date: '2026-02-17', name: '春節除夕', type: '放假日', note: '除夕闔家春運守歲' },
      { date: '2026-02-18', name: '春節初一', type: '放假日', note: '農曆新年歲首放假' },
      { date: '2026-02-19', name: '春節初二', type: '放假日', note: '回娘家民俗放假' },
      { date: '2026-02-20', name: '春節初三', type: '放假日', note: '農曆初三休耕放假' },
      { date: '2026-06-19', name: '端午節放假', type: '放假日', note: '端午民俗節慶，休市 1 天' },
      { date: '2026-09-25', name: '中秋節放假', type: '放假日', note: '中秋節月圓人團圓，休市 1 天' }
    );
  }

  let addCount = 0;
  fallbackHolidays.forEach(item => {
    if (!STATE.holidays.some(h => h.date === item.date)) {
      STATE.holidays.push(item);
      addCount++;
    }
  });
  
  STATE.holidays.sort((a,b) => a.date.localeCompare(b.date));

  STATE.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    user: '系統管理員',
    action: '載入政府行事曆(離線)',
    details: `離線同步並寫入 ${targetYear} 年度 ${addCount} 筆台灣法定休假`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ip: req.ip || '127.0.0.1'
  });

  res.json({ success: true, count: addCount, holidays: STATE.holidays, fallback: true });
});

// Users Profile Save API (3.2.1)
app.post('/api/permissions/users/save', (req, res) => {
  const user = req.body;
  if (!user.id) {
    // Generate unique user ID
    user.id = `usr-${String(Date.now()).substring(5)}`;
    user.passwordRetryCount = 0;
    STATE.userPermissions.push(user);
    
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '新增使用者資料',
      details: `成功建立全新使用者 ${user.name} (@${user.username})，角色為 [${user.role}]`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  } else {
    // Modify existing
    const idx = STATE.userPermissions.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      STATE.userPermissions[idx] = { ...STATE.userPermissions[idx], ...user };
      STATE.auditLogs.unshift({
        id: `LOG-${Date.now()}`,
        user: '系統管理員',
        action: '修改使用者資料',
        details: `成功修改使用者 ${user.name} (@${user.username}) 的安全基本配置與分派屬性`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        ip: req.ip || '127.0.0.1'
      });
    }
  }
  res.json({ success: true, users: STATE.userPermissions });
});

// Users Delete API (3.2.1)
app.post('/api/permissions/users/delete', (req, res) => {
  const { id } = req.body;
  const user = STATE.userPermissions.find(u => u.id === id);
  if (user) {
    STATE.userPermissions = STATE.userPermissions.filter(u => u.id !== id);
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '刪除使用者帳號',
      details: `自密鑰運作名單完全剪除使用者 ${user.name} (@${user.username})`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  }
  res.json({ success: true, users: STATE.userPermissions });
});

// User password retry lock resets (3.2.1)
app.post('/api/permissions/users/reset-lock', (req, res) => {
  const { id } = req.body;
  const user = STATE.userPermissions.find(u => u.id === id);
  if (user) {
    user.passwordRetryCount = 0;
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '密碼誤次數解鎖',
      details: `手動重製解鎖人員 ${user.name} (@${user.username}) 之密碼連錯鎖定狀態`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  }
  res.json({ success: true, users: STATE.userPermissions });
});

// Menu Lists Save API (3.2.2)
app.post('/api/permissions/menus/save', (req, res) => {
  const menu = req.body;
  const idx = STATE.functionMenus.findIndex(m => m.code === menu.code);
  if (idx !== -1) {
    STATE.functionMenus[idx] = { ...STATE.functionMenus[idx], ...menu };
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '編修功能單項目',
      details: `成功更新系統代碼 [${menu.code}] 之名稱與操作按鈕授權架構`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  } else {
    STATE.functionMenus.push(menu);
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '新增功能單項目',
      details: `手動註冊新系統模組 [${menu.code}] ${menu.name} 至系統資料表`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  }
  res.json({ success: true, menus: STATE.functionMenus });
});

// Menu Lists Delete API (3.2.2)
app.post('/api/permissions/menus/delete', (req, res) => {
  const { code } = req.body;
  const menu = STATE.functionMenus.find(m => m.code === code);
  if (menu) {
    STATE.functionMenus = STATE.functionMenus.filter(m => m.code !== code);
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '移除功能單項目',
      details: `自全局選單剪除模組代碼 [${code}] ${menu.name}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  }
  res.json({ success: true, menus: STATE.functionMenus });
});

// Permission Groups Save API (3.2.3 Basic Info)
app.post('/api/permissions/groups/save', (req, res) => {
  const group = req.body;
  const idx = STATE.permissionGroups.findIndex(g => g.code === group.code);
  if (idx !== -1) {
    STATE.permissionGroups[idx] = { ...STATE.permissionGroups[idx], ...group };
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '編修權限群組資料',
      details: `成功變更群組 [${group.code}] ${group.name} 之狀態及備忘備註`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  } else {
    group.functions = group.functions || [];
    group.userIds = group.userIds || [];
    STATE.permissionGroups.push(group);
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '增設特權群組類別',
      details: `增設新 ACL 映射群組關係 [${group.code}] ${group.name}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  }
  res.json({ success: true, groups: STATE.permissionGroups });
});

// Permission Groups Delete API (3.2.3)
app.post('/api/permissions/groups/delete', (req, res) => {
  const { code } = req.body;
  const grp = STATE.permissionGroups.find(g => g.code === code);
  if (grp) {
    STATE.permissionGroups = STATE.permissionGroups.filter(g => g.code !== code);
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '銷毀權限群組類別',
      details: `自 ACL 表解散權限管制群 [${code}] ${grp.name}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  }
  res.json({ success: true, groups: STATE.permissionGroups });
});

// Permission Groups Menu Checkbox Mapping API (3.2.3 Tab 2)
app.post('/api/permissions/groups/save-functions', (req, res) => {
  const { code, functions } = req.body;
  const group = STATE.permissionGroups.find(g => g.code === code);
  if (group) {
    group.functions = functions;
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '調整群組功能核定',
      details: `重定群組 [${code}] 的各子功能 (查詢/新增/修改/刪除/下載) 核准表`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  }
  res.json({ success: true, groups: STATE.permissionGroups });
});

// Permission Groups Left <==> Right Users Transfer Mapping API (3.2.3 Tab 3)
app.post('/api/permissions/groups/update-users', (req, res) => {
  const { code, userIds } = req.body;
  const group = STATE.permissionGroups.find(g => g.code === code);
  if (group) {
    group.userIds = userIds;
    STATE.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      user: '系統管理員',
      action: '異配群組指派人員',
      details: `重整群組 [${code}] 成員：共計綁定指派 ${userIds.length} 位在線帳密`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: req.ip || '127.0.0.1'
    });
  }
  res.json({ success: true, groups: STATE.permissionGroups });
});

// Simulate Alert Push to On-Duty Staff with Security Verification Mock
app.post('/api/alert/simulate-send', (req, res) => {
  const { channels, text, targetServerId } = req.body;
  
  // Find current active on-duty staff
  const todayStr = new Date().toISOString().split('T')[0];
  let shift = STATE.shifts.find(s => s.date === todayStr);
  if (!shift) {
    shift = STATE.shifts[0]; // Fallback to current first shift if date range shifts
  }

  const calendarMode = STATE.calendarMode;
  const isWeekendOrHoliday = calendarMode === 'holiday' || calendarMode === 'typhoon';
  
  // Rule checks: if Weekend/Holiday, and the alerts is overtime reminder/non-critical checkout alert, skip to block false warnings!
  const isHypotheticalTimeoutAlert = text.toLowerCase().includes('overtime') || text.includes('逾時') || text.includes('結帳提醒');
  
  if (isWeekendOrHoliday && isHypotheticalTimeoutAlert) {
    return res.status(200).json({
      success: false,
      blocked: true,
      reason: `行事曆控管：目前為 [${calendarMode === 'holiday' ? '假日' : '颱風假'}]，系統已自動攔截並停止發送非交易時段之「${text}」逾時告警通知。`
    });
  }

  // Dispatch! Only to active shift on-duty staff
  const primaryOnDuty = shift.primaryDuty;
  const secondaryOnDuty = shift.secondaryDuty;

  const logs: any[] = [];
  channels.forEach((c: 'SMS' | 'LINE' | 'Email') => {
    // Generate unique alert token
    const alertId = `ALT-${Date.now()}-${Math.floor(Math.random() * 900) + 100}`;
    const serverName = targetServerId ? (STATE.servers.find(s => s.id === targetServerId)?.name || targetServerId) : '整機匯聚';
    
    // Simulate mobile biometric check requirement mockup, e.g. Line push to verified device only
    let verified = false;
    if (c === 'LINE') {
      verified = primaryOnDuty.lineVerified; // If true, verified. If false, needs authentication
    } else {
      verified = true; // SMS & Email bypass mobile auth rules as they are pull-standard
    }

    const payload = {
      id: alertId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      channel: c,
      staffName: primaryOnDuty.name,
      staffRole: '第一負責人 (Primary)',
      serverName,
      alertText: text,
      verified
    };

    STATE.dispatchedAlerts.unshift(payload);
    logs.push(payload);
  });

  // Add audit log
  STATE.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    user: '值班通報派發系統',
    action: '自動推播告警',
    details: `向當日值班 [${primaryOnDuty.name}] 透過 [${channels.join(', ')}] 發送告警：${text}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ip: '127.0.0.1'
  });

  res.json({
    success: true,
    blocked: false,
    dispatched: logs,
    notifiedStaff: primaryOnDuty
  });
});

// Simulate AI diagnostics of errors with Gemini
app.post('/api/gemini/diagnose', async (req, res) => {
  const { logsText, serverId, microserviceId } = req.body;
  const server = STATE.servers.find(s => s.id === serverId);
  const serverName = server ? server.name : serverId;

  // Let's create a rich, structured diagnostic prompt
  const prompt = `你是一位專業的銀行業中台與微服務運維工程師。
目前我們的可視化監控戰情室發現伺服器 [${serverName}] 的微服務發生故障。以下是捕獲到的異常日誌 (Logs)：

\`\`\`
${logsText}
\`\`\`

請針對以上異常日誌，進行深入診斷，並以 **JSON** 格式回覆以下欄位（不要有任何前後引言說明，直接回覆合格的 JSON）：
1. "category": 異常之主分類（請從這幾個選項中挑選一個："硬體故障"、"程式異常"、"轉檔失敗"、"網路中斷"、"權限問題"）。
2. "cause": 故障具體原因分析（簡潔，50字以內）。
3. "suggestion": 維運人員第一時間處置建議步驟（100字以內）。
4. "priority": 建議報修優先級（"L1_HIGH"、"L2_MEDIUM"、"L3_LOW"）。
5. "title": 報修工單標題。
`;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      // Fallback response if no Gemini API Key is configured in dev secrets
      const mockResult = {
        category: "程式異常",
        cause: "執行緒在並發處理扣點資料庫寫入時超出了 JVM 記憶體限制 (Out Of Memory)，垃圾回收器 (GC) 反覆頻繁執行仍無法回收 Heap 資源導致線程崩潰。",
        suggestion: "1. 請至維運專頁點選該微服務對應的『快速重啟』按鈕重啟 AP 主線程服務。\n2. 若重啟後仍反覆停擺，請提升該服務 JVM Heap Max 記憶體分配參數至 -Xmx4g。\n3. 指派 IT 資料庫交易優化組，重構批次轉檔之緩存提交策略 (Batch Offset Commit)。",
        priority: "L1_HIGH",
        title: `AI 自動診斷: 【主機 ${serverName}】 payment-processor 記憶體堆疊 OOM 溢出崩潰`
      };
      return res.json({ 
        success: true, 
        mocked: true, 
        result: mockResult,
        note: "（此為模擬診斷，您可以設定 GEMINI_API_KEY 以啟用真實 Gemini AI 即時日誌智慧分析！）"
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsedResult = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      result: parsedResult,
      mocked: false
    });

  } catch (err: any) {
    console.error("Gemini diagnose failed:", err);
    res.status(500).json({ error: 'AI 診斷執行失敗，請重試或查看後端日誌。', details: err.message });
  }
});

// Serve compiled build assets or connect in dev mode
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind to 0.0.0.0:3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Operations Server running on http://localhost:${PORT}`);
  });
}

startServer();
