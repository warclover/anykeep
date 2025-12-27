import React, { useState } from "react";
import {
  Bookmark,
  Clock,
  Search,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import { QuickSaveTab } from "./tabs/QuickSaveTab";
import { RecentTab } from "./tabs/RecentTab";
import { SearchTab } from "./tabs/SearchTab";
import { ChatTab } from "./tabs/ChatTab";
import { SettingsTab } from "./tabs/SettingsTab";

interface MainViewProps {
  onLogout: () => void;
}

type TabId = "save" | "recent" | "search" | "chat";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: "save", label: "保存", icon: <Bookmark className="w-4 h-4" /> },
  { id: "recent", label: "最近", icon: <Clock className="w-4 h-4" /> },
  { id: "search", label: "搜索", icon: <Search className="w-4 h-4" /> },
  { id: "chat", label: "AI", icon: <Sparkles className="w-4 h-4" /> },
];

export function MainView({ onLogout }: MainViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("save");
  const [showSettings, setShowSettings] = useState(false);

  // 显示设置面板
  if (showSettings) {
    return <SettingsTab onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <span className="font-semibold text-gray-900">AnyKeep</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex border-b border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-primary-600 border-b-2 border-primary-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "save" && <QuickSaveTab />}
        {activeTab === "recent" && <RecentTab />}
        {activeTab === "search" && <SearchTab />}
        {activeTab === "chat" && <ChatTab />}
      </main>
    </div>
  );
}
