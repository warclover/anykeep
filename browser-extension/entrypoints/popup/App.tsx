import { useState, useEffect } from "react";
import {
  Bookmark,
  Check,
  LogIn,
  Loader2,
  AlertCircle,
  ExternalLink,
  FolderInput,
} from "lucide-react";
import { BookmarkImport } from "./BookmarkImport";

// 平台检测
type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "UNKNOWN";

interface PageInfo {
  title: string;
  url: string;
  platform: Platform;
  description?: string;
  coverUrl?: string;
}

interface SaveState {
  status: "idle" | "saving" | "success" | "error";
  message?: string;
}

// 平台配置
const PLATFORM_CONFIG: Record<
  Platform,
  { name: string; color: string; bgClass: string }
> = {
  WECHAT_OFFICIAL_ACCOUNT: {
    name: "微信公众号",
    color: "#07C160",
    bgClass: "bg-wechat",
  },
  BILIBILI: { name: "B站", color: "#FB7299", bgClass: "bg-bilibili" },
  XIAOHONGSHU: { name: "小红书", color: "#FF2442", bgClass: "bg-xiaohongshu" },
  UNKNOWN: { name: "其他", color: "#6B7280", bgClass: "bg-gray-500" },
};

// 检测平台
function detectPlatform(url: string): Platform {
  if (url.includes("mp.weixin.qq.com")) return "WECHAT_OFFICIAL_ACCOUNT";
  if (url.includes("bilibili.com")) return "BILIBILI";
  if (url.includes("xiaohongshu.com") || url.includes("xhslink.com"))
    return "XIAOHONGSHU";
  return "UNKNOWN";
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [_apiUrl, setApiUrl] = useState<string>(""); // 保留用于未来功能
  const [currentView, setCurrentView] = useState<"main" | "import">("main");

  // 初始化：检查登录状态和获取页面信息
  useEffect(() => {
    initializePopup();
  }, []);

  async function initializePopup() {
    // 获取存储的 API URL 和认证信息
    const storage = await browser.storage.local.get([
      "apiUrl",
      "authToken",
      "userId",
    ]);

    if (storage.apiUrl) {
      setApiUrl(storage.apiUrl);
    } else {
      // 默认 API URL（生产环境）
      const defaultUrl = "https://anykeep.vercel.app";
      setApiUrl(defaultUrl);
      await browser.storage.local.set({ apiUrl: defaultUrl });
    }

    // 检查登录状态
    if (storage.authToken && storage.userId) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }

    // 获取当前标签页信息
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.url && tab.title) {
      setPageInfo({
        title: tab.title,
        url: tab.url,
        platform: detectPlatform(tab.url),
      });
    }
  }

  // 保存书签
  async function handleSave() {
    if (!pageInfo || !isLoggedIn) return;

    setSaveState({ status: "saving" });

    try {
      const storage = await browser.storage.local.get([
        "authToken",
        "userId",
        "apiUrl",
      ]);

      const response = await fetch(`${storage.apiUrl}/api/bookmarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storage.authToken}`,
        },
        body: JSON.stringify({
          title: pageInfo.title,
          url: pageInfo.url,
          platform: pageInfo.platform,
          user_id: storage.userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "保存失败");
      }

      setSaveState({ status: "success", message: "收藏成功！" });

      // 3秒后重置状态
      setTimeout(() => {
        setSaveState({ status: "idle" });
      }, 3000);
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "保存失败，请重试",
      });
    }
  }

  // 打开设置页面进行登录
  async function handleLogin() {
    const storage = await browser.storage.local.get(["apiUrl"]);
    const url = storage.apiUrl || "https://anykeep.vercel.app";
    await browser.tabs.create({ url: `${url}/login?from=extension` });
  }

  // 打开 AnyKeep 主页
  async function openAnyKeep() {
    const storage = await browser.storage.local.get(["apiUrl"]);
    const url = storage.apiUrl || "https://anykeep.vercel.app";
    await browser.tabs.create({ url: `${url}/home` });
  }

  const platformConfig = pageInfo ? PLATFORM_CONFIG[pageInfo.platform] : null;

  // 书签导入视图
  if (currentView === "import") {
    return <BookmarkImport onBack={() => setCurrentView("main")} />;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Bookmark className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900">AnyKeep</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 导入书签按钮 */}
          {isLoggedIn && (
            <button
              onClick={() => setCurrentView("import")}
              className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
              title="导入浏览器书签"
            >
              <FolderInput className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={openAnyKeep}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="打开 AnyKeep"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* 加载中 */}
        {isLoggedIn === null && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        )}

        {/* 未登录状态 */}
        {isLoggedIn === false && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <LogIn className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">请先登录</h2>
            <p className="text-sm text-gray-500 mb-6">
              登录后即可一键收藏网页内容
            </p>
            <button
              onClick={handleLogin}
              className="px-6 py-2.5 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
            >
              前往登录
            </button>
          </div>
        )}

        {/* 已登录状态 */}
        {isLoggedIn === true && pageInfo && (
          <div className="space-y-4">
            {/* 平台标识 */}
            {platformConfig && (
              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-1 rounded-md text-white text-sm font-medium"
                  style={{ backgroundColor: platformConfig.color }}
                >
                  {platformConfig.name}
                </span>
              </div>
            )}

            {/* 页面信息 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 line-clamp-2 mb-2">
                {pageInfo.title}
              </h3>
              <p className="text-xs text-gray-500 truncate">{pageInfo.url}</p>
            </div>

            {/* 保存按钮 */}
            <div className="pt-2">
              {saveState.status === "idle" && (
                <button
                  onClick={handleSave}
                  className="w-full py-3 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Bookmark className="w-5 h-5" />
                  收藏到 AnyKeep
                </button>
              )}

              {saveState.status === "saving" && (
                <button
                  disabled
                  className="w-full py-3 bg-indigo-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  保存中...
                </button>
              )}

              {saveState.status === "success" && (
                <div className="relative">
                  {/* 纸屑效果 */}
                  <div className="confetti-container">
                    <div className="confetti" />
                    <div className="confetti" />
                    <div className="confetti" />
                    <div className="confetti" />
                    <div className="confetti" />
                    <div className="confetti" />
                  </div>
                  {/* 成功卡片 */}
                  <div className="w-full py-4 success-card text-white rounded-lg font-medium flex flex-col items-center justify-center gap-2 animate-success-bounce">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center animate-success-icon shadow-lg">
                      <Check
                        className="w-6 h-6 text-green-500"
                        strokeWidth={3}
                      />
                    </div>
                    <span className="text-lg animate-success-fade">
                      {saveState.message}
                    </span>
                    <span className="text-xs text-green-100 animate-success-fade">
                      AI 正在分析内容...
                    </span>
                  </div>
                </div>
              )}

              {saveState.status === "error" && (
                <div className="space-y-2">
                  <div className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-medium flex items-center justify-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {saveState.message}
                  </div>
                  <button
                    onClick={() => setSaveState({ status: "idle" })}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    重试
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-3 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">AnyKeep - 智能内容收藏助手</p>
      </footer>
    </div>
  );
}
