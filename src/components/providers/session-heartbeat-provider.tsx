/**
 * 会话心跳检测提供者
 * 在应用根级别启用会话心跳检测，防止长时间操作时会话过期
 *
 * V4.2.30: 解决 AUTH-001 会话过期问题
 */

"use client";

import { useRouter } from "next/navigation";
import { useSessionHeartbeat } from "@/hooks/core/use-session-heartbeat";
import { toast } from "sonner";

interface SessionHeartbeatProviderProps {
  children: React.ReactNode;
}

export function SessionHeartbeatProvider({
  children,
}: SessionHeartbeatProviderProps) {
  const router = useRouter();

  useSessionHeartbeat({
    onSessionExpired: () => {
      // 会话过期时，显示提示并跳转到登录页
      toast.error("会话已过期，请重新登录", {
        duration: 3000,
      });
      router.push("/login?reason=session_expired");
    },
    // 会话刷新成功时静默处理，避免频繁打扰用户
  });

  return <>{children}</>;
}
