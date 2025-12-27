import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle, Tag } from "lucide-react";

interface CurrentTab {
  url: string;
  title: string;
  favIconUrl?: string;
}

type SaveStatus = "idle" | "checking" | "saved" | "saving" | "error";

export function QuickSaveTab() {
  const [currentTab, setCurrentTab] = useState<CurrentTab | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [tags, setTags] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // 获取当前标签页信息
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setCurrentTab({
          url: tabs[0].url || "",
          title: tabs[0].title || "",
          favIconUrl: tabs[0].favIconUrl,
        });

        // 检查是否已保存
        setSaveStatus("checking");
        chrome.runtime.sendMessage(
          { type: "CHECK_URL_SAVED", payload: { url: tabs[0].url } },
          (response) => {
            if (response?.saved) {
              setSaveStatus("saved");
            } else {
              setSaveStatus("idle");
            }
          },
        );
      }
    });
  }, []);

  const handleSave = async () => {
    if (!currentTab) return;

    setSaveStatus("saving");
    setErrorMessage("");

    const tagList = tags
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    chrome.runtime.sendMessage(
      {
        type: "QUICK_SAVE",
        payload: {
          url: currentTab.url,
          title: currentTab.title,
          tags: tagList.length > 0 ? tagList : undefined,
        },
      },
      (response) => {
        if (response?.success) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
          setErrorMessage(response?.error || "保存失败");
        }
      },
    );
  };

  if (!currentTab) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* 当前页面信息 */}
      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
        {currentTab.favIconUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={currentTab.favIconUrl} alt="" className="w-8 h-8 rounded" />
        ) : (
          <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
            <span className="text-xs text-gray-500">🔗</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-gray-900 truncate">
            {currentTab.title}
          </h3>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {currentTab.url}
          </p>
        </div>
      </div>

      {/* 标签输入 */}
      <div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 mb-1.5">
          <Tag className="w-3.5 h-3.5" />
          标签（可选）
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="输入标签，用逗号或空格分隔"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={saveStatus === "saving" || saveStatus === "saved"}
        />
      </div>

      {/* 错误提示 */}
      {saveStatus === "error" && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* 保存按钮 */}
      <button
        onClick={handleSave}
        disabled={
          saveStatus === "saving" ||
          saveStatus === "saved" ||
          saveStatus === "checking"
        }
        className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
          saveStatus === "saved"
            ? "bg-green-500 text-white"
            : saveStatus === "saving" || saveStatus === "checking"
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-primary-500 hover:bg-primary-600 text-white"
        }`}
      >
        {saveStatus === "checking" && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            检查中...
          </>
        )}
        {saveStatus === "idle" && "保存到 AnyKeep"}
        {saveStatus === "saving" && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            保存中...
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="w-4 h-4" />
            已保存
          </>
        )}
        {saveStatus === "error" && "重试"}
      </button>

      {/* 快捷操作提示 */}
      <p className="text-xs text-gray-400 text-center">
        💡 提示：点击扩展图标也可快速保存
      </p>
    </div>
  );
}
