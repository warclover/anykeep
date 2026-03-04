"use client";

import { lazy, Suspense } from "react";
import { SilentErrorBoundary } from "@/components/ui/lazy-error-boundary";

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

interface HomeBannersSectionProps {
  deferredAIReady: boolean;
  showBriefing: boolean;
}

export function HomeBannersSection({
  deferredAIReady,
  showBriefing,
}: HomeBannersSectionProps) {
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

      {deferredAIReady && showBriefing && (
        <SilentErrorBoundary>
          <Suspense fallback={null}>
            <ProactiveBriefingCard className="mb-4" />
          </Suspense>
        </SilentErrorBoundary>
      )}
    </>
  );
}
