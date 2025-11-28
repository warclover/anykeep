/**
 * 导入缓存 - IndexedDB 存储层
 * 支持导入会话的持久化存储和恢复
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  BrowserBookmarkImportOptions,
  ImportProgress,
  Platform,
} from "./types";

// ============================================
// 数据库 Schema 定义
// ============================================

/** 导入会话状态 */
export type ImportSessionStatus =
  | "pending"
  | "processing"
  | "paused"
  | "completed"
  | "failed";

/** 导入批次状态 */
export type ImportBatchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** 导入会话数据 */
export interface ImportSession {
  /** 会话唯一标识 */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 会话状态 */
  status: ImportSessionStatus;
  /** 总批次数 */
  totalBatches: number;
  /** 已完成批次数 */
  completedBatches: number;
  /** 创建时间 */
  createdAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 导入选项 */
  options: BrowserBookmarkImportOptions;
  /** 当前进度信息 */
  progress: ImportProgress;
  /** 错误信息 */
  error?: string;
  /** 浏览器来源 */
  browserSource: string;
  /** 导入批次 ID */
  importBatchId: string;
  /** 目标文件夹 ID */
  targetFolderId?: number;
}

/** 导入批次数据 */
export interface ImportBatch {
  /** 批次唯一标识 */
  id: string;
  /** 所属会话 ID */
  sessionId: string;
  /** 批次编号（从 0 开始） */
  batchNumber: number;
  /** 批次状态 */
  status: ImportBatchStatus;
  /** 批次内的书签数据 */
  bookmarks: Array<{
    title: string;
    url: string;
    platform: Platform;
    folderId?: number;
    addedAt?: string;
  }>;
  /** 处理结果 */
  result?: {
    success: number;
    failed: number;
    skipped: number;
  };
  /** 错误信息 */
  error?: string;
}

/** IndexedDB Schema */
interface ImportCacheDB extends DBSchema {
  sessions: {
    key: string;
    value: ImportSession;
    indexes: {
      "by-userId": string;
      "by-status": ImportSessionStatus;
      "by-createdAt": number;
    };
  };
  batches: {
    key: string;
    value: ImportBatch;
    indexes: {
      "by-sessionId": string;
      "by-status": ImportBatchStatus;
    };
  };
}

// ============================================
// 常量
// ============================================

const DB_NAME = "anykeep-import-cache";
const DB_VERSION = 1;
const SESSION_EXPIRY_DAYS = 7;

// ============================================
// 数据库初始化
// ============================================

let dbInstance: IDBPDatabase<ImportCacheDB> | null = null;

/**
 * 获取数据库实例
 */
async function getDB(): Promise<IDBPDatabase<ImportCacheDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ImportCacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 创建 sessions 存储
      if (!db.objectStoreNames.contains("sessions")) {
        const sessionStore = db.createObjectStore("sessions", {
          keyPath: "id",
        });
        sessionStore.createIndex("by-userId", "userId");
        sessionStore.createIndex("by-status", "status");
        sessionStore.createIndex("by-createdAt", "createdAt");
      }

      // 创建 batches 存储
      if (!db.objectStoreNames.contains("batches")) {
        const batchStore = db.createObjectStore("batches", {
          keyPath: "id",
        });
        batchStore.createIndex("by-sessionId", "sessionId");
        batchStore.createIndex("by-status", "status");
      }
    },
  });

  return dbInstance;
}

// ============================================
// 会话操作
// ============================================

/**
 * 创建新的导入会话
 */
export async function createImportSession(
  session: Omit<
    ImportSession,
    "id" | "createdAt" | "status" | "completedBatches"
  >,
): Promise<ImportSession> {
  const db = await getDB();
  const newSession: ImportSession = {
    ...session,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: "pending",
    completedBatches: 0,
  };

  await db.put("sessions", newSession);
  return newSession;
}

/**
 * 获取会话
 */
export async function getImportSession(
  sessionId: string,
): Promise<ImportSession | undefined> {
  const db = await getDB();
  return db.get("sessions", sessionId);
}

/**
 * 更新会话
 */
export async function updateImportSession(
  sessionId: string,
  updates: Partial<ImportSession>,
): Promise<void> {
  const db = await getDB();
  const session = await db.get("sessions", sessionId);
  if (session) {
    await db.put("sessions", { ...session, ...updates });
  }
}

/**
 * 删除会话及其所有批次
 */
export async function deleteImportSession(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "batches"], "readwrite");

  // 删除会话
  await tx.objectStore("sessions").delete(sessionId);

  // 删除关联的批次
  const batchStore = tx.objectStore("batches");
  const batchIndex = batchStore.index("by-sessionId");
  const batches = await batchIndex.getAllKeys(sessionId);
  for (const batchId of batches) {
    await batchStore.delete(batchId);
  }

  await tx.done;
}

/**
 * 获取用户的待处理/暂停的会话
 */
export async function getPendingSession(
  userId: string,
): Promise<ImportSession | undefined> {
  const db = await getDB();
  const sessions = await db.getAllFromIndex("sessions", "by-userId", userId);

  // 查找未完成的会话
  return sessions.find(
    (s) =>
      s.status === "pending" ||
      s.status === "processing" ||
      s.status === "paused",
  );
}

/**
 * 检查是否有待恢复的会话
 */
export async function hasPendingSession(userId: string): Promise<boolean> {
  const session = await getPendingSession(userId);
  return !!session;
}

// ============================================
// 批次操作
// ============================================

/**
 * 创建导入批次
 */
export async function createImportBatches(
  sessionId: string,
  batchesData: Array<Omit<ImportBatch, "id" | "sessionId" | "status">>,
): Promise<ImportBatch[]> {
  const db = await getDB();
  const batches: ImportBatch[] = batchesData.map((data) => ({
    ...data,
    id: crypto.randomUUID(),
    sessionId,
    status: "pending" as const,
  }));

  const tx = db.transaction("batches", "readwrite");
  for (const batch of batches) {
    await tx.store.put(batch);
  }
  await tx.done;

  return batches;
}

/**
 * 获取会话的所有批次
 */
export async function getSessionBatches(
  sessionId: string,
): Promise<ImportBatch[]> {
  const db = await getDB();
  const batches = await db.getAllFromIndex(
    "batches",
    "by-sessionId",
    sessionId,
  );
  return batches.sort((a, b) => a.batchNumber - b.batchNumber);
}

/**
 * 获取待处理的批次
 */
export async function getPendingBatches(
  sessionId: string,
): Promise<ImportBatch[]> {
  const batches = await getSessionBatches(sessionId);
  return batches.filter((b) => b.status === "pending");
}

/**
 * 更新批次状态
 */
export async function updateBatchStatus(
  batchId: string,
  status: ImportBatchStatus,
  result?: ImportBatch["result"],
  error?: string,
): Promise<void> {
  const db = await getDB();
  const batch = await db.get("batches", batchId);
  if (batch) {
    await db.put("batches", {
      ...batch,
      status,
      result,
      error,
    });
  }
}

// ============================================
// 清理操作
// ============================================

/**
 * 清理过期会话
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const db = await getDB();
  const expiryTime = Date.now() - SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  const sessions = await db.getAll("sessions");
  const expiredSessions = sessions.filter(
    (s) =>
      s.createdAt < expiryTime &&
      (s.status === "completed" || s.status === "failed"),
  );

  for (const session of expiredSessions) {
    await deleteImportSession(session.id);
  }

  return expiredSessions.length;
}

/**
 * 清除所有导入缓存
 */
export async function clearAllImportCache(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "batches"], "readwrite");
  await tx.objectStore("sessions").clear();
  await tx.objectStore("batches").clear();
  await tx.done;
}

// ============================================
// 统计查询
// ============================================

/**
 * 获取会话统计信息
 */
export async function getSessionStats(sessionId: string): Promise<{
  totalBatches: number;
  completedBatches: number;
  pendingBatches: number;
  failedBatches: number;
  totalSuccess: number;
  totalFailed: number;
  totalSkipped: number;
}> {
  const batches = await getSessionBatches(sessionId);

  return batches.reduce(
    (stats, batch) => {
      stats.totalBatches++;
      if (batch.status === "completed") {
        stats.completedBatches++;
        stats.totalSuccess += batch.result?.success ?? 0;
        stats.totalFailed += batch.result?.failed ?? 0;
        stats.totalSkipped += batch.result?.skipped ?? 0;
      } else if (batch.status === "pending") {
        stats.pendingBatches++;
      } else if (batch.status === "failed") {
        stats.failedBatches++;
      }
      return stats;
    },
    {
      totalBatches: 0,
      completedBatches: 0,
      pendingBatches: 0,
      failedBatches: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalSkipped: 0,
    },
  );
}
