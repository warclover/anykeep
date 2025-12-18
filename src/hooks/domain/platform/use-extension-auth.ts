/**
 * 浏览器扩展认证通信 Hook
 *
 * 用于在用户登录后将认证信息同步到浏览器扩展
 */

"use client";

import { useCallback, useEffect, useState } from "react";

// 开发环境调试日志
const DEBUG = process.env.NODE_ENV === "development";
// eslint-disable-next-line no-console, @typescript-eslint/no-empty-function
const debugLog = DEBUG ? console.info.bind(console, "[Extension]") : () => {};

// 扩展 ID（开发时自动生成，发布后固定）
// 开发环境下需要从扩展的 chrome://extensions 页面获取
const EXTENSION_IDS = [
  // 开发环境 ID（每次安装可能不同，需要手动更新）
  // Chrome 开发模式加载的扩展 ID
  process.env.NEXT_PUBLIC_EXTENSION_ID,
  // 生产环境 Chrome Web Store ID（发布后填写）
  // 'your-chrome-web-store-extension-id',
].filter(Boolean) as string[];

interface ExtensionAuthHook {
  /** 扩展是否已安装 */
  isExtensionInstalled: boolean;
  /** 是否正在检测 */
  isChecking: boolean;
  /** 同步认证信息到扩展 */
  syncAuthToExtension: (token: string, userId: string) => Promise<boolean>;
  /** 通知扩展用户已登出 */
  notifyExtensionLogout: () => Promise<boolean>;
}

/**
 * 检查是否在浏览器环境中且支持 Chrome 扩展 API
 */
function isChromeExtensionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof chrome !== "undefined" &&
    !!chrome.runtime
  );
}

/**
 * 尝试向扩展发送消息
 */
async function sendMessageToExtension(
  extensionId: string,
  message: Record<string, unknown>,
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(extensionId, message, (response) => {
        if (chrome.runtime.lastError) {
          debugLog("通信失败:", chrome.runtime.lastError.message);
          resolve(false);
        } else if (response?.success) {
          debugLog("消息发送成功");
          resolve(true);
        } else {
          resolve(false);
        }
      });
    } catch (error) {
      debugLog("发送消息异常:", error);
      resolve(false);
    }
  });
}

/**
 * 浏览器扩展认证通信 Hook
 */
export function useExtensionAuth(): ExtensionAuthHook {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // 检测扩展是否安装
  useEffect(() => {
    async function checkExtension() {
      if (!isChromeExtensionSupported()) {
        setIsChecking(false);
        return;
      }

      // 尝试与每个可能的扩展 ID 通信
      for (const extensionId of EXTENSION_IDS) {
        const success = await sendMessageToExtension(extensionId, {
          type: "PING",
        });
        if (success) {
          setIsExtensionInstalled(true);
          break;
        }
      }

      setIsChecking(false);
    }

    checkExtension();
  }, []);

  // 同步认证信息到扩展
  const syncAuthToExtension = useCallback(
    async (token: string, userId: string): Promise<boolean> => {
      if (!isChromeExtensionSupported()) {
        return false;
      }

      const apiUrl =
        typeof window !== "undefined" ? window.location.origin : "";

      for (const extensionId of EXTENSION_IDS) {
        const success = await sendMessageToExtension(extensionId, {
          type: "ANYKEEP_AUTH",
          token,
          userId,
          apiUrl,
        });

        if (success) {
          debugLog("认证信息已同步到扩展");
          return true;
        }
      }

      debugLog("无法同步认证信息（扩展可能未安装）");
      return false;
    },
    [],
  );

  // 通知扩展用户已登出
  const notifyExtensionLogout = useCallback(async (): Promise<boolean> => {
    if (!isChromeExtensionSupported()) {
      return false;
    }

    for (const extensionId of EXTENSION_IDS) {
      const success = await sendMessageToExtension(extensionId, {
        type: "ANYKEEP_LOGOUT",
      });

      if (success) {
        debugLog("已通知扩展用户登出");
        return true;
      }
    }

    return false;
  }, []);

  return {
    isExtensionInstalled,
    isChecking,
    syncAuthToExtension,
    notifyExtensionLogout,
  };
}

/**
 * 在登录成功后调用此函数同步认证信息
 * 可以在非 React 组件中使用
 */
export async function syncAuthToExtensionDirect(
  token: string,
  userId: string,
  apiUrl?: string,
): Promise<boolean> {
  if (!isChromeExtensionSupported()) {
    return false;
  }

  const url =
    apiUrl || (typeof window !== "undefined" ? window.location.origin : "");

  for (const extensionId of EXTENSION_IDS) {
    const success = await sendMessageToExtension(extensionId, {
      type: "ANYKEEP_AUTH",
      token,
      userId,
      apiUrl: url,
    });

    if (success) {
      return true;
    }
  }

  return false;
}
