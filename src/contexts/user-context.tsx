/**
 * 用户上下文 Provider
 * 客户端缓存用户数据，避免每次页面切换重复请求
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/supabase";

interface UserContextValue {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

interface UserProviderProps {
  children: ReactNode;
}

/**
 * 用户数据 Provider
 * 在应用启动时获取用户数据，缓存到 Context 中
 */
export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();

      // 获取用户
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!currentUser) {
        setUser(null);
        setProfile(null);
        return;
      }

      setUser(currentUser);

      // 获取 profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("Failed to fetch profile:", profileError);
      }

      setProfile(profileData);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
      setError(err instanceof Error ? err.message : "获取用户数据失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化获取用户数据
  useEffect(() => {
    fetchUserData();

    // 监听认证状态变化
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, _session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchUserData();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        isLoading,
        error,
        refetch: fetchUserData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

/**
 * 获取用户数据的 Hook
 */
export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }

  return context;
}

/**
 * 获取用户数据的 Hook（非必须，不抛错误）
 * 用于可选显示用户信息的组件
 */
export function useOptionalUser() {
  return useContext(UserContext);
}
