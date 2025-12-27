import React, { useEffect, useState } from "react";
import { LoginView } from "./views/LoginView";
import { MainView } from "./views/MainView";
import { LoadingSpinner } from "./components/LoadingSpinner";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    // 检查认证状态
    chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" }, (response) => {
      if (response?.authenticated) {
        setAuthStatus("authenticated");
      } else {
        setAuthStatus("unauthenticated");
      }
    });
  }, []);

  const handleLogin = async () => {
    chrome.runtime.sendMessage({ type: "START_AUTH" }, (response) => {
      if (response?.success) {
        setAuthStatus("authenticated");
      }
    });
  };

  const handleLogout = async () => {
    chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
      setAuthStatus("unauthenticated");
    });
  };

  return (
    <div className="w-popup-w h-popup-h bg-white text-gray-900 overflow-hidden">
      {authStatus === "loading" && (
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner />
        </div>
      )}

      {authStatus === "unauthenticated" && <LoginView onLogin={handleLogin} />}

      {authStatus === "authenticated" && <MainView onLogout={handleLogout} />}
    </div>
  );
}
