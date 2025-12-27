/**
 * 设置 Tab
 *
 * 提供扩展配置选项
 */

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Globe,
  Bell,
  Palette,
  Info,
  ExternalLink,
  Check,
  Loader2,
} from "lucide-react";

interface SettingsTabProps {
  onBack: () => void;
}

interface Settings {
  /** API 端点 */
  apiEndpoint: "production" | "development" | "custom";
  /** 自定义 API URL */
  customApiUrl: string;
  /** 保存成功通知 */
  showSaveNotification: boolean;
  /** 自动检测已保存 URL */
  autoCheckSaved: boolean;
  /** 主题 */
  theme: "light" | "dark" | "system";
}

const DEFAULT_SETTINGS: Settings = {
  apiEndpoint: "production",
  customApiUrl: "",
  showSaveNotification: true,
  autoCheckSaved: true,
  theme: "system",
};

const STORAGE_KEY = "anykeep_settings";

export function SettingsTab({ onBack }: SettingsTabProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 加载设置
  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY]) {
        setSettings({ ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] });
      }
      setLoading(false);
    });
  }, []);

  // 保存设置
  const saveSettings = async (newSettings: Settings) => {
    setSaving(true);
    setSaved(false);

    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: newSettings });
      setSettings(newSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("[Settings] Save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  // 更新单个设置项
  const updateSetting = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button
          onClick={onBack}
          className="p-1 -ml-1 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-gray-900">设置</h2>
        {(saving || saved) && (
          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Check className="w-3 h-3 text-green-500" />
                已保存
              </>
            )}
          </span>
        )}
      </div>

      {/* 设置列表 */}
      <div className="flex-1 overflow-y-auto">
        {/* API 设置 */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Globe className="w-4 h-4" />
            API 设置
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="apiEndpoint"
                checked={settings.apiEndpoint === "production"}
                onChange={() => updateSetting("apiEndpoint", "production")}
                className="w-4 h-4 text-primary-500"
              />
              <div>
                <div className="text-sm text-gray-900">生产环境</div>
                <div className="text-xs text-gray-500">anykeep.com</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="apiEndpoint"
                checked={settings.apiEndpoint === "development"}
                onChange={() => updateSetting("apiEndpoint", "development")}
                className="w-4 h-4 text-primary-500"
              />
              <div>
                <div className="text-sm text-gray-900">开发环境</div>
                <div className="text-xs text-gray-500">localhost:3000</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="apiEndpoint"
                checked={settings.apiEndpoint === "custom"}
                onChange={() => updateSetting("apiEndpoint", "custom")}
                className="w-4 h-4 text-primary-500"
              />
              <div className="flex-1">
                <div className="text-sm text-gray-900">自定义</div>
                {settings.apiEndpoint === "custom" && (
                  <input
                    type="url"
                    value={settings.customApiUrl}
                    onChange={(e) =>
                      updateSetting("customApiUrl", e.target.value)
                    }
                    placeholder="https://your-api.com"
                    className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>
            </label>
          </div>
        </div>

        {/* 通知设置 */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Bell className="w-4 h-4" />
            通知
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <div>
                <div className="text-sm text-gray-900">保存成功通知</div>
                <div className="text-xs text-gray-500">
                  保存书签后显示成功提示
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.showSaveNotification}
                onChange={(e) =>
                  updateSetting("showSaveNotification", e.target.checked)
                }
                className="w-4 h-4 text-primary-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <div>
                <div className="text-sm text-gray-900">自动检测已保存</div>
                <div className="text-xs text-gray-500">
                  打开弹窗时检测当前页面是否已保存
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCheckSaved}
                onChange={(e) =>
                  updateSetting("autoCheckSaved", e.target.checked)
                }
                className="w-4 h-4 text-primary-500 rounded"
              />
            </label>
          </div>
        </div>

        {/* 主题设置 */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Palette className="w-4 h-4" />
            外观
          </div>

          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => updateSetting("theme", theme)}
                className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                  settings.theme === theme
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {theme === "light" && "浅色"}
                {theme === "dark" && "深色"}
                {theme === "system" && "跟随系统"}
              </button>
            ))}
          </div>
        </div>

        {/* 关于 */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Info className="w-4 h-4" />
            关于
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between p-2">
              <span>版本</span>
              <span className="text-gray-400">1.0.0</span>
            </div>

            <a
              href="https://anykeep.com/help"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
            >
              <span>帮助中心</span>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>

            <a
              href="https://anykeep.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
            >
              <span>隐私政策</span>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>

            <a
              href="https://anykeep.com/feedback"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
            >
              <span>反馈建议</span>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
