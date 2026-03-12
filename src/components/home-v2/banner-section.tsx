/**
 * Home V2 AI 功能横幅区
 *
 * 设计原则：
 * - 全部 lazy 加载 + SilentErrorBoundary（不影响主内容）
 * - 接收 boolean 而非对象（解决 A22）
 * - 延迟加载 AI 组件（requestIdleCallback / setTimeout 降级）
 *
 * @since home-v2
 */

"use client";

import { lazy, Suspense, useState, useEffect, memo } from "react";
import { SilentErrorBoundary } from "@/components/ui/lazy-error-boundary";

// 懒加载 AI 组件（首屏非关键）
const ReclassifyBanner = lazy(() =>
  import("@/components/bookmark/reclassify-banner").then((mod) => ({
    default: mod.ReclassifyBanner,
  })),
);

const InboxOrganizationBanner = lazy(() =>
  import("@/components/inbox/inbox-organization-banner").then((mod) => ({
    default: mod.InboxOrganizationBanner,
  })),
);

const PendingConfirmationsSection = lazy(() =>
  import("@/components/classification/pending-confirmations-section").then(
    (mod) => ({
      default: mod.PendingConfirmationsSection,
    }),
  ),
);

const ProactiveBriefingCard = lazy(() =>
  import("@/components/ai/briefing/proactive-briefing-card").then((mod) => ({
    default: mod.ProactiveBriefingCard,
  })),
);

// ============================================================================
// 组件实现
// ============================================================================

interface BannerSectionProps {
  /** A22 修复：传 boolean 而非对象 */
  showWelcomeMessage: boolean;
}

export const HomeV2BannerSection = memo(function HomeV2BannerSection({
  showWelcomeMessage,
}: BannerSectionProps) {
  // 延迟 AI 加载
  const [aiReady, setAiReady] = useState(false);

  useEffect(() => {
    let idleCallbackId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        idleCallbackId = (
          window as Window & {
            requestIdleCallback: (
              cb: () => void,
              opts?: { timeout: number },
            ) => number;
          }
        ).requestIdleCallback(() => setAiReady(true), { timeout: 3000 });
      } else {
        timeoutId = setTimeout(() => setAiReady(true), 1500);
      }
    }

    return () => {
      if (idleCallbackId !== undefined && "cancelIdleCallback" in window) {
        (
          window as Window & { cancelIdleCallback: (id: number) => void }
        ).cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  if (!aiReady) return null;

  return (
    <>
      <SilentErrorBoundary>
        <Suspense fallback={null}>
          <ReclassifyBanner className="mb-4" />
        </Suspense>
      </SilentErrorBoundary>

      <SilentErrorBoundary>
        <Suspense fallback={null}>
          <InboxOrganizationBanner className="mb-4" />
        </Suspense>
      </SilentErrorBoundary>

      <SilentErrorBoundary>
        <Suspense fallback={null}>
          <PendingConfirmationsSection className="mb-4" />
        </Suspense>
      </SilentErrorBoundary>

      {showWelcomeMessage && (
        <SilentErrorBoundary>
          <Suspense fallback={null}>
            <ProactiveBriefingCard className="mb-4" />
          </Suspense>
        </SilentErrorBoundary>
      )}
    </>
  );
});
