/**
 * 文件夹缓存同步服务
 *
 * 本地缓存用户文件夹数据，支持：
 * 1. IndexedDB 持久化
 * 2. 增量同步
 * 3. 过期检测与自动刷新
 *
 * @module @/lib/classification/client/folder-cache-sync
 * @version 1.0.0
 * @since 2026-01-23
 */

import type { CachedFolder } from "./tag-pre-matcher";

/**
 * 缓存元数据
 */
interface CacheMetadata {
  /** 用户 ID */
  userId: string;
  /** 最后同步时间戳 */
  lastSyncAt: number;
  /** 文件夹数量 */
  folderCount: number;
  /** 版本号（用于增量同步） */
  version: number;
}

/**
 * 同步结果
 */
export interface SyncResult {
  /** 是否成功 */
  success: boolean;
  /** 同步的文件夹数量 */
  folderCount: number;
  /** 是否为增量同步 */
  isIncremental: boolean;
  /** 耗时（毫秒） */
  latencyMs: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 缓存配置
 */
export interface FolderCacheSyncConfig {
  /** 缓存过期时间（毫秒），默认 5 ��钟 */
  cacheTtlMs: number;
  /** 自动同步间隔（毫秒），默认 2 分钟 */
  autoSyncIntervalMs: number;
  /** 是否启用 IndexedDB 持久化 */
  enablePersistence: boolean;
  /** IndexedDB 数据库名称 */
  dbName: string;
  /** IndexedDB 存储名称 */
  storeName: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FolderCacheSyncConfig = {
  cacheTtlMs: 5 * 60 * 1000, // 5 分钟
  autoSyncIntervalMs: 2 * 60 * 1000, // 2 分钟
  enablePersistence: true,
  dbName: "anykeep-folder-cache",
  storeName: "folders",
};

/**
 * 文件夹缓存同步服务
 */
export class FolderCacheSyncService {
  private config: FolderCacheSyncConfig;
  private memoryCache: Map<string, CachedFolder[]>;
  private metadata: Map<string, CacheMetadata>;
  private db: IDBDatabase | null = null;
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private syncListeners: Set<(userId: string, folders: CachedFolder[]) => void>;

  constructor(config?: Partial<FolderCacheSyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryCache = new Map();
    this.metadata = new Map();
    this.syncListeners = new Set();
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.config.enablePersistence && typeof indexedDB !== "undefined") {
      await this.openDatabase();
    }
  }

  /**
   * 打开 IndexedDB 数据库
   */
  private openDatabase(): Promise<void> {
    return new Promise((resolve, _reject) => {
      const request = indexedDB.open(this.config.dbName, 1);

      request.onerror = () => {
        console.info("[FolderCacheSync] IndexedDB 打开失败，使用内存缓存");
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建文件夹存储
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, {
            keyPath: "id",
          });
          store.createIndex("userId", "userId", { unique: false });
        }

        // 创建元数据存储
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata", { keyPath: "userId" });
        }
      };
    });
  }

  /**
   * 从服务器同步文件夹数据
   */
  async syncFromServer(
    userId: string,
    fetchFolders: () => Promise<CachedFolder[]>,
  ): Promise<SyncResult> {
    const startTime = performance.now();

    try {
      // 检查是否需���同步
      const meta = this.metadata.get(userId);
      const now = Date.now();

      if (meta && now - meta.lastSyncAt < this.config.cacheTtlMs) {
        // 缓存未过期，跳过同步
        return {
          success: true,
          folderCount: meta.folderCount,
          isIncremental: false,
          latencyMs: performance.now() - startTime,
        };
      }

      // 从服务器获取数据
      const folders = await fetchFolders();

      // 更新缓存
      this.memoryCache.set(userId, folders);
      this.metadata.set(userId, {
        userId,
        lastSyncAt: now,
        folderCount: folders.length,
        version: (meta?.version || 0) + 1,
      });

      // 持久化到 IndexedDB
      if (this.db) {
        await this.persistToDb(userId, folders);
      }

      // 通知监听器
      this.notifyListeners(userId, folders);

      return {
        success: true,
        folderCount: folders.length,
        isIncremental: !!meta,
        latencyMs: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        folderCount: 0,
        isIncremental: false,
        latencyMs: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取缓存的文件夹
   */
  async getFolders(userId: string): Promise<CachedFolder[]> {
    // 优先使用内存缓存
    const memCached = this.memoryCache.get(userId);
    if (memCached) {
      return memCached;
    }

    // 尝试从 IndexedDB 加载
    if (this.db) {
      const folders = await this.loadFromDb(userId);
      if (folders.length > 0) {
        this.memoryCache.set(userId, folders);
        return folders;
      }
    }

    return [];
  }

  /**
   * 检查缓存是否有效
   */
  isCacheValid(userId: string): boolean {
    const meta = this.metadata.get(userId);
    if (!meta) return false;

    const age = Date.now() - meta.lastSyncAt;
    return age < this.config.cacheTtlMs;
  }

  /**
   * 获取缓存年龄（毫秒）
   */
  getCacheAge(userId: string): number | null {
    const meta = this.metadata.get(userId);
    if (!meta) return null;
    return Date.now() - meta.lastSyncAt;
  }

  /**
   * 清除用户缓存
   */
  async clearCache(userId: string): Promise<void> {
    this.memoryCache.delete(userId);
    this.metadata.delete(userId);

    if (this.db) {
      await this.clearDbCache(userId);
    }
  }

  /**
   * 清除所有缓存
   */
  async clearAllCache(): Promise<void> {
    this.memoryCache.clear();
    this.metadata.clear();

    if (this.db) {
      await this.clearAllDbCache();
    }
  }

  /**
   * 添加单个文件夹到缓存（用于新建文件夹场景）
   */
  addFolder(userId: string, folder: CachedFolder): void {
    const folders = this.memoryCache.get(userId) || [];

    // 检查是否已存在
    const existingIndex = folders.findIndex((f) => f.id === folder.id);
    if (existingIndex >= 0) {
      folders[existingIndex] = folder;
    } else {
      folders.push(folder);
    }

    this.memoryCache.set(userId, folders);
    this.updateMetadata(userId, folders.length);
  }

  /**
   * 从缓存移除文件夹
   */
  removeFolder(userId: string, folderId: number): void {
    const folders = this.memoryCache.get(userId);
    if (!folders) return;

    const filtered = folders.filter((f) => f.id !== folderId);
    this.memoryCache.set(userId, filtered);
    this.updateMetadata(userId, filtered.length);
  }

  /**
   * 更新文件夹别名
   */
  updateFolderAliases(
    userId: string,
    folderId: number,
    aliases: string[],
  ): void {
    const folders = this.memoryCache.get(userId);
    if (!folders) return;

    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      folder.aliases = aliases;
    }
  }

  /**
   * 启动自动同步
   */
  startAutoSync(
    userId: string,
    fetchFolders: () => Promise<CachedFolder[]>,
  ): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }

    this.autoSyncTimer = setInterval(async () => {
      await this.syncFromServer(userId, fetchFolders);
    }, this.config.autoSyncIntervalMs);
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  /**
   * 添加同步监听器
   */
  addSyncListener(
    listener: (userId: string, folders: CachedFolder[]) => void,
  ): void {
    this.syncListeners.add(listener);
  }

  /**
   * 移除同步监听器
   */
  removeSyncListener(
    listener: (userId: string, folders: CachedFolder[]) => void,
  ): void {
    this.syncListeners.delete(listener);
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    userCount: number;
    totalFolders: number;
    oldestCacheAge: number | null;
    dbEnabled: boolean;
  } {
    let totalFolders = 0;
    let oldestCacheAge: number | null = null;

    for (const [userId, folders] of this.memoryCache) {
      totalFolders += folders.length;
      const age = this.getCacheAge(userId);
      if (age !== null && (oldestCacheAge === null || age > oldestCacheAge)) {
        oldestCacheAge = age;
      }
    }

    return {
      userCount: this.memoryCache.size,
      totalFolders,
      oldestCacheAge,
      dbEnabled: this.db !== null,
    };
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stopAutoSync();
    this.memoryCache.clear();
    this.metadata.clear();
    this.syncListeners.clear();

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private updateMetadata(userId: string, folderCount: number): void {
    const meta = this.metadata.get(userId);
    if (meta) {
      meta.folderCount = folderCount;
    } else {
      this.metadata.set(userId, {
        userId,
        lastSyncAt: Date.now(),
        folderCount,
        version: 1,
      });
    }
  }

  private notifyListeners(userId: string, folders: CachedFolder[]): void {
    for (const listener of this.syncListeners) {
      try {
        listener(userId, folders);
      } catch (error) {
        console.error("[FolderCacheSync] 监听器执行失败:", error);
      }
    }
  }

  private persistToDb(userId: string, folders: CachedFolder[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction(
        [this.config.storeName, "metadata"],
        "readwrite",
      );
      const folderStore = transaction.objectStore(this.config.storeName);
      const metaStore = transaction.objectStore("metadata");

      // 先删除旧数据
      const index = folderStore.index("userId");
      const range = IDBKeyRange.only(userId);
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          folderStore.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          // 旧数据删除完成，添加新数据
          for (const folder of folders) {
            folderStore.add({ ...folder, userId });
          }

          // 更新元数据
          metaStore.put(this.metadata.get(userId));
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private loadFromDb(userId: string): Promise<CachedFolder[]> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve([]);
        return;
      }

      const transaction = this.db.transaction(
        [this.config.storeName, "metadata"],
        "readonly",
      );
      const folderStore = transaction.objectStore(this.config.storeName);
      const metaStore = transaction.objectStore("metadata");

      const folders: CachedFolder[] = [];

      // 加载元数据
      const metaRequest = metaStore.get(userId);
      metaRequest.onsuccess = () => {
        if (metaRequest.result) {
          this.metadata.set(userId, metaRequest.result);
        }
      };

      // 加载文件夹
      const index = folderStore.index("userId");
      const range = IDBKeyRange.only(userId);
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const { userId: _, ...folder } = cursor.value;
          folders.push(folder as CachedFolder);
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve(folders);
      transaction.onerror = () => resolve([]);
    });
  }

  private clearDbCache(userId: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction(
        [this.config.storeName, "metadata"],
        "readwrite",
      );
      const folderStore = transaction.objectStore(this.config.storeName);
      const metaStore = transaction.objectStore("metadata");

      // 删除文件夹
      const index = folderStore.index("userId");
      const range = IDBKeyRange.only(userId);
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          folderStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // 删除元数据
      metaStore.delete(userId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  private clearAllDbCache(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction(
        [this.config.storeName, "metadata"],
        "readwrite",
      );
      const folderStore = transaction.objectStore(this.config.storeName);
      const metaStore = transaction.objectStore("metadata");

      folderStore.clear();
      metaStore.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }
}

// 导出单例实例
export const folderCacheSync = new FolderCacheSyncService();
