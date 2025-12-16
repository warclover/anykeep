import { useState, useEffect } from "react";
import {
  Bookmark,
  Check,
  LogIn,
  Loader2,
  AlertCircle,
  ExternalLink,
  FolderInput,
  WifiOff,
  RefreshCw,
  Clock,
} from "lucide-react";
import { BookmarkImport } from "./BookmarkImport";
import { FolderSelector } from "./components/FolderSelector";
import { TagSelector } from "./components/TagSelector";
import type { PageMetadata, Platform, AuthStatus } from "@/types";

interface SaveState {
  status: "idle" | "saving" | "success" | "error";
  message?: string;
  isOffline?: boolean;
}

// 平台配置（主要平台）
const PLATFORM_CONFIG: Partial<
  Record<Platform, { name: string; color: string }>
> = {
  WECHAT_OFFICIAL_ACCOUNT: { name: "微信公众号", color: "#07C160" },
  BILIBILI: { name: "B站", color: "#FB7299" },
  XIAOHONGSHU: { name: "小红书", color: "#FF2442" },
  ZHIHU: { name: "知乎", color: "#0066FF" },
  DOUYIN: { name: "抖音", color: "#000000" },
  WEIBO: { name: "微博", color: "#E6162D" },
  JUEJIN: { name: "掘金", color: "#1E80FF" },
  JIANSHU: { name: "简书", color: "#EA6F5A" },
  CSDN: { name: "CSDN", color: "#FC5531" },
  GITHUB: { name: "GitHub", color: "#24292E" },
  YOUTUBE: { name: "YouTube", color: "#FF0000" },
  TWITTER: { name: "Twitter/X", color: "#1DA1F2" },
  MEDIUM: { name: "Medium", color: "#000000" },
  NOTION: { name: "Notion", color: "#000000" },
  OTHER: { name: "其他", color: "#6B7280" },
  UNKNOWN: { name: "网页", color: "#6B7280" },
};

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [pageInfo, setPageInfo] = useState<PageMetadata | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [currentView, setCurrentView] = useState<"main" | "import">("main");
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 初始化：检查登录状态和获取页面信息
  useEffect(() => {
    initializePopup();
  }, []);

  async function initializePopup() {
    try {
      // 通过 background 获取认证状态
      const authResponse = await browser.runtime.sendMessage({
        type: "GET_AUTH_STATUS",
      });
      setAuthStatus(authResponse.status as AuthStatus);

      // 获取离线队列数量
      const offlineResponse = await browser.runtime.sendMessage({
        type: "GET_OFFLINE_COUNT",
      });
      setOfflineCount(offlineResponse.count || 0);

      // 获取当前标签页信息（通过 Content Script 获取更丰富的元数据）
      const pageInfoResponse = await browser.runtime.sendMessage({
        type: "GET_PAGE_INFO",
      });

      if (pageInfoResponse) {
        setPageInfo(pageInfoResponse as PageMetadata);
      } else {
        // 降级：从 Tab API 获取基本信息
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab && tab.url && tab.title) {
          setPageInfo({
            title: tab.title,
            url: tab.url,
            platform: "UNKNOWN",
          });
        }
      }
    } catch (error) {
      console.error("[Popup] Initialize error:", error);
      setAuthStatus("notLoggedIn");
    }
  }

  // 保存书签
  async function handleSave() {
    if (!pageInfo || authStatus !== "loggedIn") return;

    setSaveState({ status: "saving" });

    try {
      // 通过 background script 保存（支持离线队列）
      const result = await browser.runtime.sendMessage({
        type: "SAVE_BOOKMARK",
        url: pageInfo.url,
        title: pageInfo.title,
        folderId: selectedFolderId,
        userTags: selectedTags.length > 0 ? selectedTags : undefined,
        metadata: {
          description: pageInfo.description,
          coverUrl: pageInfo.coverUrl,
          author: pageInfo.author,
          publishTime: pageInfo.publishTime,
          wordCount: pageInfo.wordCount,
          imageCount: pageInfo.imageCount,
        },
      });

      if (result.success) {
        setSaveState({
          status: "success",
          message: result.message || "收藏成功！",
          isOffline: result.isOffline,
        });

        // 更新离线数量
        if (result.isOffline) {
          const offlineResponse = await browser.runtime.sendMessage({
            type: "GET_OFFLINE_COUNT",
          });
          setOfflineCount(offlineResponse.count || 0);
        }

        // 3秒后重置状态
        setTimeout(() => {
          setSaveState({ status: "idle" });
          // 重置选择状态
          setSelectedFolderId(null);
          setSelectedTags([]);
        }, 3000);
      } else {
        throw new Error(result.message || "保存失败");
      }
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "保存失败，请重试",
      });
    }
  }

  // 同步离线队列
  async function handleSyncOffline() {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    try {
      await browser.runtime.sendMessage({ type: "SYNC_OFFLINE_QUEUE" });

      // 更新离线数量
      const offlineResponse = await browser.runtime.sendMessage({
        type: "GET_OFFLINE_COUNT",
      });
      setOfflineCount(offlineResponse.count || 0);
    } catch (error) {
      console.error("[Popup] Sync error:", error);
    } finally {
      setIsSyncing(false);
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

  // 计算状态
  const isLoggedIn = authStatus === "loggedIn";
  const isExpired = authStatus === "expired";
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
        {authStatus === null && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        )}

        {/* 未登录状态 */}
        {authStatus === "notLoggedIn" && (
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

        {/* Token 过期状态 */}
        {isExpired && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              登录已过期
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              请重新登录以继续使用收藏功能
            </p>
            <button
              onClick={handleLogin}
              className="px-6 py-2.5 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
            >
              重新登录
            </button>
          </div>
        )}

        {/* 已登录状态 */}
        {isLoggedIn && pageInfo && (
          <div className="space-y-4">
            {/* 离线队列提示 */}
            {offlineCount > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-amber-700">
                    {offlineCount} 条待同步
                  </span>
                </div>
                {navigator.onLine && (
                  <button
                    onClick={handleSyncOffline}
                    disabled={isSyncing}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:bg-amber-100 rounded transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`}
                    />
                    同步
                  </button>
                )}
              </div>
            )}

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
              {/* 封面图预览 */}
              {pageInfo.coverUrl && (
                <div className="mb-3 rounded-md overflow-hidden">
                  <img
                    src={pageInfo.coverUrl}
                    alt=""
                    className="w-full h-24 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <h3 className="font-medium text-gray-900 line-clamp-2 mb-2">
                {pageInfo.title}
              </h3>
              {pageInfo.description && (
                <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                  {pageInfo.description}
                </p>
              )}
              <p className="text-xs text-gray-500 truncate">{pageInfo.url}</p>
              {/* 元数据标签 */}
              {(pageInfo.author || pageInfo.wordCount) && (
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  {pageInfo.author && <span>作者: {pageInfo.author}</span>}
                  {pageInfo.wordCount && (
                    <span>约 {pageInfo.wordCount} 字</span>
                  )}
                </div>
              )}
            </div>

            {/* 文件夹选择 */}
            <FolderSelector
              value={selectedFolderId}
              onChange={setSelectedFolderId}
              disabled={saveState.status === "saving"}
            />

            {/* 标签选择 */}
            <TagSelector
              value={selectedTags}
              onChange={setSelectedTags}
              disabled={saveState.status === "saving"}
            />

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
                  {/* 纸屑效果（仅在线成功时显示） */}
                  {!saveState.isOffline && (
                    <div className="confetti-container">
                      <div className="confetti" />
                      <div className="confetti" />
                      <div className="confetti" />
                      <div className="confetti" />
                      <div className="confetti" />
                      <div className="confetti" />
                    </div>
                  )}
                  {/* 成功卡片 */}
                  <div
                    className={`w-full py-4 ${saveState.isOffline ? "bg-amber-500" : "success-card"} text-white rounded-lg font-medium flex flex-col items-center justify-center gap-2 animate-success-bounce`}
                  >
                    <div
                      className={`w-10 h-10 bg-white rounded-full flex items-center justify-center animate-success-icon shadow-lg`}
                    >
                      {saveState.isOffline ? (
                        <WifiOff className="w-6 h-6 text-amber-500" />
                      ) : (
                        <Check
                          className="w-6 h-6 text-green-500"
                          strokeWidth={3}
                        />
                      )}
                    </div>
                    <span className="text-lg animate-success-fade">
                      {saveState.message}
                    </span>
                    <span
                      className={`text-xs ${saveState.isOffline ? "text-amber-100" : "text-green-100"} animate-success-fade`}
                    >
                      {saveState.isOffline
                        ? "联网后自动同步"
                        : "AI 正在分析内容..."}
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
