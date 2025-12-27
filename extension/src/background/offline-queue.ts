/**
 * 离线队列管理模块
 *
 * 功能：
 * 1. 离线时将保存请求加入队列
 * 2. 网络恢复时自动重试
 * 3. 持久化队列到 storage
 */

import { quickSaveBookmark, type CreateBookmarkRequest } from "./api";
import {
  updateOfflineQueueBadge,
  showSaveSuccess,
  showSaveError,
} from "./badge";

// 队列项
interface QueueItem {
  id: string;
  request: CreateBookmarkRequest;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

// 存储 Key
const STORAGE_KEY = "anykeep_offline_queue";

// 最大重试次数
const MAX_RETRIES = 3;

// 重试延迟（毫秒）
const RETRY_DELAYS = [1000, 5000, 15000];

// 内存中的队列（同步处理用）
let queue: QueueItem[] = [];
let isProcessing = false;

/**
 * 加载队列
 */
async function loadQueue(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  queue = result[STORAGE_KEY] || [];
}

/**
 * 保存队列
 */
async function saveQueue(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: queue });
  await updateOfflineQueueBadge(queue.length);
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 添加到队列
 */
export async function addToQueue(
  request: CreateBookmarkRequest,
): Promise<string> {
  const item: QueueItem = {
    id: generateId(),
    request,
    createdAt: Date.now(),
    retryCount: 0,
  };

  queue.push(item);
  await saveQueue();

  // 尝试立即处理
  processQueue();

  return item.id;
}

/**
 * 从队列移除
 */
async function removeFromQueue(id: string): Promise<void> {
  queue = queue.filter((item) => item.id !== id);
  await saveQueue();
}

/**
 * 处理队列
 */
async function processQueue(): Promise<void> {
  if (isProcessing || queue.length === 0) {
    return;
  }

  // 检查网络状态
  if (!navigator.onLine) {
    return;
  }

  isProcessing = true;

  try {
    // 复制队列以避免并发修改问题
    const itemsToProcess = [...queue];

    for (const item of itemsToProcess) {
      await processItem(item);
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * 处理单个队列项
 */
async function processItem(item: QueueItem): Promise<void> {
  try {
    const result = await quickSaveBookmark(
      item.request.url,
      item.request.title,
      {
        description: item.request.description,
        tags: item.request.tags,
        folder_id: item.request.folder_id,
      },
    );

    if (result.success) {
      await removeFromQueue(item.id);
      showSaveSuccess();
    } else {
      await handleItemError(item, result.error || "Unknown error");
    }
  } catch (error) {
    await handleItemError(
      item,
      error instanceof Error ? error.message : "Network error",
    );
  }
}

/**
 * 处理队列项错误
 */
async function handleItemError(item: QueueItem, error: string): Promise<void> {
  console.error("[OfflineQueue] Item error:", item.id, error);

  item.retryCount++;
  item.lastError = error;

  if (item.retryCount >= MAX_RETRIES) {
    await removeFromQueue(item.id);
    showSaveError();
    return;
  }

  // 保存更新后的队列
  await saveQueue();

  // 安排重试
  const delay =
    RETRY_DELAYS[item.retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

  setTimeout(() => {
    processItem(item);
  }, delay);
}

/**
 * 获取队列状态
 */
export function getQueueStatus(): { count: number; items: QueueItem[] } {
  return {
    count: queue.length,
    items: [...queue],
  };
}

/**
 * 清空队列
 */
export async function clearQueue(): Promise<void> {
  queue = [];
  await saveQueue();
}

/**
 * 初始化离线队列模块
 */
export async function initializeOfflineQueue(): Promise<void> {
  // 加载持久化的队列
  await loadQueue();

  // 尝试处理现有队列
  if (queue.length > 0) {
    processQueue();
  }

  // 定期检查队列（每5分钟）
  setInterval(
    () => {
      if (queue.length > 0) {
        processQueue();
      }
    },
    5 * 60 * 1000,
  );
}
