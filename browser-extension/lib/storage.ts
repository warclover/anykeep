/**
 * AnyKeep 浏览器扩展 - 存储管理
 * 统一管理 chrome.storage.local 的读写操作
 */

import type { StorageData, StorageKey } from "@/types";
import { DEFAULT_STORAGE } from "@/types";

/**
 * 获取单个存储值
 */
async function get<K extends StorageKey>(key: K): Promise<StorageData[K]> {
  const result = await browser.storage.local.get(key);
  return result[key] ?? DEFAULT_STORAGE[key];
}

/**
 * 获取多个存储值
 */
async function getMultiple<K extends StorageKey>(
  keys: K[],
): Promise<Pick<StorageData, K>> {
  const result = await browser.storage.local.get(keys);
  const data = {} as Pick<StorageData, K>;

  for (const key of keys) {
    data[key] = result[key] ?? DEFAULT_STORAGE[key];
  }

  return data;
}

/**
 * 获取所有存储值
 */
async function getAll(): Promise<StorageData> {
  const keys = Object.keys(DEFAULT_STORAGE) as StorageKey[];
  return getMultiple(keys) as Promise<StorageData>;
}

/**
 * 设置单个存储值
 */
async function set<K extends StorageKey>(
  key: K,
  value: StorageData[K],
): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

/**
 * 设置多个存储值
 */
async function setMultiple(data: Partial<StorageData>): Promise<void> {
  await browser.storage.local.set(data);
}

/**
 * 删除存储值
 */
async function remove(keys: StorageKey | StorageKey[]): Promise<void> {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  await browser.storage.local.remove(keyArray);
}

/**
 * 清除所有存储
 */
async function clear(): Promise<void> {
  await browser.storage.local.clear();
}

/**
 * 重置为默认值
 */
async function reset(): Promise<void> {
  await browser.storage.local.set(DEFAULT_STORAGE);
}

/**
 * 监听存储变化
 */
function onChange(
  callback: (changes: {
    [key in StorageKey]?: {
      oldValue?: StorageData[key];
      newValue?: StorageData[key];
    };
  }) => void,
): () => void {
  const listener = (
    changes: { [key: string]: browser.Storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName === "local") {
      callback(changes as Parameters<typeof callback>[0]);
    }
  };

  browser.storage.onChanged.addListener(listener);

  // 返回取消监听函数
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

/**
 * 存储管理对象
 */
export const storage = {
  get,
  getMultiple,
  getAll,
  set,
  setMultiple,
  remove,
  clear,
  reset,
  onChange,
};

export default storage;
