/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Microservice {
  id: string;
  name: string;
  status: 'running' | 'warning' | 'stopped';
  lastReboot?: string;
}

export interface ServerInstance {
  id: string;
  name: string;
  type: 'AP' | 'DB';
  status: 'normal' | 'warning' | 'error';
  ip: string;
  metrics: {
    cpu: number;
    ram: number;
    disk: number;
  };
  thresholds: {
    cpu: number;
    ram: number;
    disk: number;
  };
  microservices: Microservice[];
  location: string;
}

export interface FileConversionTask {
  id: string;
  dbType: 'Oracle' | 'SQL Server' | 'PostgreSQL' | 'DB2' | 'Teradata';
  taskName: string;
  fileName: string;
  status: 'SUCCESS' | 'FAILED' | 'WAITING';
  errorCategory?: '檔案未轉' | '資料異常' | '網路逾時' | '欄位格式錯誤' | '庫存不足';
  errorDetail?: string;
  timestamp: string;
}

export interface SettlementStep {
  step: number;
  name: string;
  status: 'DONE' | 'FAIL' | 'WAIT';
  updatedAt: string;
}

export interface BranchSettlement {
  code: string;
  name: string;
  status: 'DONE' | 'FAIL' | 'WAIT';
  amount: number;
  count: number;
  manager: string;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  details: string;
  timestamp: string;
  ip: string;
}

export interface MaintenanceTicket {
  id: string;
  title: string;
  serverId: string;
  microserviceId?: string;
  category: '硬體故障' | '程式異常' | '轉檔失敗' | '網路中斷' | '權限問題' | '其他';
  priority: 'L1_HIGH' | 'L2_MEDIUM' | 'L3_LOW';
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED';
  reporter: string;
  assignedTo: string;
  description: string;
  aiSuggestedDiagnosis?: string;
  logsAnalyzed?: string;
  createdTime: string;
  resolvedTime?: string;
  timeline: {
    status: string;
    note: string;
    timestamp: string;
    operator: string;
  }[];
}

export interface ShiftDuty {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  primaryDuty: {
    name: string;
    phone: string;
    email: string;
    lineVerified: boolean;
  };
  secondaryDuty: {
    name: string;
    phone: string;
    email: string;
    lineVerified: boolean;
  };
}

export interface HolidaySetting {
  date: string; // YYYY-MM-DD
  name: string;
  type: '放假日' | '工作日（補班）';
  note?: string;
}

export interface UserPermission {
  id: string;
  username: string;
  name: string;
  role: 'Admin' | 'Operator' | 'Guest';
  email: string;
  phone: string;
  permissions: string[]; // List of page-keys they can access
  startDate?: string;
  endDate?: string;
  status?: '啟用' | '停用';
  branch?: string;
  defaultHost?: string;
  passwordRetryCount?: number;
}

export interface FunctionMenu {
  code: string; // e.g. A01001
  name: string; // e.g. 盤前檢核
  order: number;
  parentCode?: string;
  layer: number;
  status: '啟用' | '停用';
  description: string;
  routePath?: string;
  actions: {
    query: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
    download: boolean;
  };
}

export interface PermissionGroup {
  code: string; // e.g. admin, operator
  name: string; // e.g. 系統管理組, 運營操作組
  status: '啟用' | '停用';
  description: string;
  functions: {
    functionCode: string;
    query: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
    download: boolean;
  }[];
  userIds: string[]; // Array of assigned user id
}

export interface SystemState {
  servers: ServerInstance[];
  fileConversionTasks: FileConversionTask[];
  settlementSteps: SettlementStep[];
  branchSettlements: BranchSettlement[];
  auditLogs: AuditLog[];
  maintenanceTickets: MaintenanceTicket[];
  shifts: ShiftDuty[];
  holidays: HolidaySetting[];
  userPermissions: UserPermission[];
  branchData: { code: string; name: string; region: string }[];
  calendarMode: 'weekday' | 'holiday' | 'typhoon';
  functionMenus?: FunctionMenu[];
  permissionGroups?: PermissionGroup[];
}
