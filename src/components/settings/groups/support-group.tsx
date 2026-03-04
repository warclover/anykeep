"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AIOperationHistoryCard } from "../ai-operation-history-card";
import {
  SettingsGroupSection,
  SettingsItemCard,
} from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
import { useUiText } from "@/lib/i18n";

export function SupportGroup() {
  const router = useRouter();
  const t = useUiText();

  return (
    <SettingsGroupSection group={SETTINGS_GROUPS[7]}>
      <div id="settings-item-support-ai-history">
        <AIOperationHistoryCard />
      </div>

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
