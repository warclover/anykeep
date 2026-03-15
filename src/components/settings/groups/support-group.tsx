"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import { AIOperationHistoryCard } from "../ai-operation-history-card";
import {
  SettingsGroupSection,
  SettingsItemCard,
} from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
import { useUiText } from "@/lib/i18n";
import { useOnboarding } from "@/components/providers/onboarding-provider";

export function SupportGroup() {
  const router = useRouter();
  const t = useUiText();
  const { triggerOnboarding } = useOnboarding();

  return (
    <SettingsGroupSection group={SETTINGS_GROUPS[7]}>
      <div id="settings-item-support-ai-history">
        <AIOperationHistoryCard />
      </div>

      <SettingsItemCard
        id="settings-item-support-onboarding"
        title={t.settings.support.onboardingTitle ?? "新手引导"}
        description={
          t.settings.support.onboardingDescription ??
          "重新查看新手引导，了解各项功能的使用方式"
        }
      >
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={triggerOnboarding}
        >
          <Rocket className="size-4" />
          {t.settings.support.replayOnboarding ?? "重新查看引导"}
        </Button>
      </SettingsItemCard>

      <SettingsItemCard
        id="settings-item-support-feedback"
        title={t.settings.support.title}
        description={t.settings.support.description}
      >
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => router.push("/settings/feedback")}
        >
          {t.settings.support.myFeedback}
        </Button>
      </SettingsItemCard>
    </SettingsGroupSection>
  );
}
