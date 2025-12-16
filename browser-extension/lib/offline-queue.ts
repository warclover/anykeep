/* eslint-disable no-console */
/**
 * AnyKeep 浏览器扩展 - 离线队列
 * 使用 IndexedDB 存储离线书签，网络恢复后自动同步
 */

import type { OfflineBookmark, SyncResult } from "@/types";
import { api } from "./api";

/** 数据库名称 */
const DB_NAME = "anykeep-offline";

/** 数据库版本 */
const DB_VERSION = 1;

/** 存储名称 */
const STORE_NAME = "bookmarks";

/** 最大重试次数 */
const MAX_RETRY_COUNT = 3;

/** 重试间隔（毫秒）- 预留给未来自动重试功能 */
const _RETRY_INTERVAL = 5000;

/**
 * 离线队列管理类
 */
export class OfflineQueue {
  private db: IDBDatabase | null = null;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("[OfflineQueue] Failed to open database:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("[OfflineQueue] Database initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建书签存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("retryCount", "retryCount", { unique: false });
        }
      };
    });
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 添加书签到离线队列
   */
  async add(
    bookmark: Omit<OfflineBookmark, "id" | "createdAt" | "retryCount">,
  ): Promise<string> {
    await this.init();

    const id = this.generateId();
    const item: OfflineBookmark = {
      ...bookmark,
      id,
      createdAt: Date.now(),
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(item);

      request.onsuccess = () => {
        console.log("[OfflineQueue] Added bookmark:", id);
        resolve(id);
      };

      request.onerror = () => {
        console.error("[OfflineQueue] Failed to add bookmark:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有待同步的书签
   */
  async getAll(): Promise<OfflineBookmark[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error("[OfflineQueue] Failed to get bookmarks:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取待同步书签数量
   */
  async getCount(): Promise<number> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 删除书签
   */
  async remove(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log("[OfflineQueue] Removed bookmark:", id);
        resolve();
      };

      request.onerror = () => {
        console.error(
          "[OfflineQueue] Failed to remove bookmark:",
          request.error,
        );
        reject(request.error);
      };
    });
  }

  /**
   * 更新书签（用于记录重试信息）
   */
  async update(id: string, updates: Partial<OfflineBookmark>): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          reject(new Error(`Bookmark not found: ${id}`));
          return;
        }

        const updated = { ...item, ...updates };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => {
          resolve();
        };

        putRequest.onerror = () => {
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * 增加重试次数
   */
  async incrementRetryCount(id: string, error?: string): Promise<void> {
    await this.init();

    const item = await this.get(id);
    if (item) {
      await this.update(id, {
        retryCount: item.retryCount + 1,
        lastError: error,
      });
    }
  }

  /**
   * 获取单个书签
   */
  async get(id: string): Promise<OfflineBookmark | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 同步单个书签
   */
  private async syncOne(bookmark: OfflineBookmark): Promise<boolean> {
    try {
      await api.saveBookmark({
        url: bookmark.url,
        title: bookmark.title,
        platform: bookmark.platform,
        description: bookmark.metadata?.description,
        coverUrl: bookmark.metadata?.coverUrl,
        author: bookmark.metadata?.author,
        publishTime: bookmark.metadata?.publishTime,
        wordCount: bookmark.metadata?.wordCount,
        imageCount: bookmark.metadata?.imageCount,
      });

      // 同步成功，删除离线记录
      await this.remove(bookmark.id);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[OfflineQueue] Failed to sync bookmark ${bookmark.id}:`,
        errorMessage,
      );

      // 更新重试次数
      await this.incrementRetryCount(bookmark.id, errorMessage);

      // 如果超过最大重试次数，也删除（避免无限重试）
      const updated = await this.get(bookmark.id);
      if (updated && updated.retryCount >= MAX_RETRY_COUNT) {
        console.warn(
          `[OfflineQueue] Bookmark ${bookmark.id} exceeded max retries, removing`,
        );
        // 不删除，保留让用户手动处理
      }

      return false;
    }
  }

  /**
   * 同步所有离线书签
   */
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      failed: 0,
      errors: [],
    };

    // 检查网络状态
    if (!navigator.onLine) {
      console.log("[OfflineQueue] No network, skipping sync");
      return result;
    }

    const bookmarks = await this.getAll();
    console.log(`[OfflineQueue] Syncing ${bookmarks.length} bookmarks`);

    for (const bookmark of bookmarks) {
      // 跳过超过重试次数的项目
      if (bookmark.retryCount >= MAX_RETRY_COUNT) {
        result.failed++;
        result.errors.push({
          id: bookmark.id,
          url: bookmark.url,
          error: `Exceeded max retries (${MAX_RETRY_COUNT})`,
        });
        continue;
      }

      const success = await this.syncOne(bookmark);
      if (success) {
        result.synced++;
      } else {
        result.failed++;
        const updated = await this.get(bookmark.id);
        result.errors.push({
          id: bookmark.id,
          url: bookmark.url,
          error: updated?.lastError || "Unknown error",
        });
      }

      // 添加间隔，避免请求过快
      if (bookmarks.indexOf(bookmark) < bookmarks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `[OfflineQueue] Sync completed: ${result.synced} synced, ${result.failed} failed`,
    );
    return result;
  }

  /**
   * 清空队列
   */
  async clear(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log("[OfflineQueue] Queue cleared");
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/** 全局离线队列实例 */
export const offlineQueue = new OfflineQueue();

export default offlineQueue;
