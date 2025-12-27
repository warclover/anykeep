import React from "react";
import { LogIn } from "lucide-react";

interface LoginViewProps {
  onLogin: () => void;
}

export function LoginView({ onLogin }: LoginViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 bg-gradient-to-b from-primary-50 to-white">
      {/* Logo */}
      <div className="mb-6">
        <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-white text-2xl font-bold">A</span>
        </div>
      </div>

      {/* 标题 */}
      <h1 className="text-xl font-semibold text-gray-900 mb-2">AnyKeep</h1>
      <p className="text-sm text-gray-500 text-center mb-8">
        智能收藏助手，一键保存您的网页
      </p>

      {/* 登录按钮 */}
      <button
        onClick={onLogin}
        className="flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
      >
        <LogIn className="w-5 h-5" />
        登录 AnyKeep
      </button>

      {/* 提示文字 */}
      <p className="mt-6 text-xs text-gray-400 text-center">
        首次使用？登录后即可开始收藏
      </p>
    </div>
  );
}
