# Multi-Persona Phase 4 实施方案

> **阶段**: Phase 4 - 集成验收 + 可选配置入口
> **版本**: v1.0
> **日期**: 2025-12-28
> **前置依赖**: Phase 1-3 完成
> **预估工时**: 3-4 天

---

## 一、Phase 4 目标概述

### 1.1 核心目标

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Phase 4: 集成验收 + 可选配置入口                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1️⃣ 集成验收                                                          │   │
│  │    • 端到端功能验证（推断→识别→响应）                                   │   │
│  │    • 性能基准测试（延迟、准确率）                                       │   │
│  │    • 边界条件与错误恢复                                                │   │
│  │    • 回归测试（确保不破坏现有功能）                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 2️⃣ 可选配置入口                                                       │   │
│  │    • 设置页面画像配置 UI                                               │   │
│  │    • 推断结果预览与确认                                                │   │
│  │    • 手动覆盖推断结果                                                  │   │
│  │    • 偏好微调选项                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3️⃣ 灰度发布准备                                                       │   │
│  │    • Feature Flag 配置                                                │   │
│  │    • 监控指标埋点                                                      │   │
│  │    • 回滚方案                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 验收标准

| 维度           | 指标                 | 目标值  |
| -------------- | -------------------- | ------- |
| **功能完整性** | 端到端测试通过率     | ≥ 95%   |
| **推断准确率** | 画像推断 vs 用户确认 | ≥ 70%   |
| **性能**       | 推断延迟 P95         | < 200ms |
| **用户体验**   | 配置流程完成率       | ≥ 80%   |
| **稳定性**     | 错误率               | < 1%    |

---

## 二、集成验收方案

### 2.1 端到端测试矩阵

```typescript
// src/lib/ai-agent/personas/__tests__/e2e/persona-integration.test.ts

describe("Multi-Persona E2E Integration", () => {
  // ==================== 推断链路测试 ====================

  describe("Inference Chain", () => {
    it("should infer persona from bookmark behavior", async () => {
      // Given: 用户收藏了大量技术文章
      const mockBookmarks = generateTechBookmarks(50);

      // When: 触发推断
      const result = await personaInferenceEngine.infer(userId, mockBookmarks);

      // Then: 应识别为技术实践型
      expect(result.group).toBe("tech");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it("should infer consultant from industry reports", async () => {
      const mockBookmarks = generateConsultingBookmarks(30);
      const result = await personaInferenceEngine.infer(userId, mockBookmarks);

      expect(result.primaryType).toBe("consultant");
      expect(result.group).toBe("professional");
    });

    it("should handle mixed behavior with multi-persona", async () => {
      // 混合行为：技术 + 学术
      const mockBookmarks = [
        ...generateTechBookmarks(25),
        ...generateAcademicBookmarks(25),
      ];

      const result = await personaInferenceEngine.infer(userId, mockBookmarks);

      // 应返回主画像 + 次画像
      expect(result.primaryType).toBeDefined();
      expect(result.secondaryTypes?.length).toBeGreaterThan(0);
    });
  });

  // ==================== 意图路由测试 ====================

  describe("Intent Routing with Persona", () => {
    const testCases = [
      {
        persona: "pm",
        input: "帮我分析下竞品",
        expectedIntent: "competitive_analysis",
        expectedSkill: "competitive_analysis",
      },
      {
        persona: "consultant",
        input: "帮我了解下新能源行业",
        expectedIntent: "industry_research",
        expectedSkill: "industry_research",
      },
      {
        persona: "cert_seeker",
        input: "帮我整理CPA重点",
        expectedIntent: "exam_organize",
        expectedSkill: "exam_organizer",
      },
      {
        persona: "lawyer",
        input: "最近有什么新规定",
        expectedIntent: "regulation_tracking",
      },
    ];

    testCases.forEach(({ persona, input, expectedIntent, expectedSkill }) => {
      it(`should route "${input}" to ${expectedIntent} for ${persona}`, async () => {
        // 设置用户画像
        await setUserPersona(userId, persona);

        // 发送消息
        const routingResult = await intentRouter.route(input, { userId });

        // 验证意图
        expect(routingResult.intent).toBe(expectedIntent);
        if (expectedSkill) {
          expect(routingResult.skillId).toBe(expectedSkill);
        }
      });
    });
  });

  // ==================== Prompt 注入测试 ====================

  describe("Persona-aware Prompt Injection", () => {
    it("should inject consultant prompt for consultant persona", async () => {
      await setUserPersona(userId, "consultant");

      const prompt = await promptInjector.build(userId, "help me organize");

      expect(prompt).toContain("咨询助手");
      expect(prompt).toContain("案例库");
      expect(prompt).toContain("金字塔原理");
    });

    it("should inject cert_seeker prompt for exam preparation", async () => {
      await setUserPersona(userId, "cert_seeker");

      const prompt = await promptInjector.build(userId, "help me review");

      expect(prompt).toContain("备考助手");
      expect(prompt).toContain("艾宾浩斯");
    });
  });

  // ==================== 响应风格测试 ====================

  describe("Response Style Adaptation", () => {
    it("should use professional tone for analyst", async () => {
      await setUserPersona(userId, "analyst");

      const response = await aiAgent.chat(userId, "帮我分析数据");

      // 分析师：不使用 emoji，数据严谨
      expect(response).not.toMatch(/[😀-🙏]/);
      expect(response).toMatch(/数据|分析|趋势/);
    });

    it("should use encouraging tone for cert_seeker", async () => {
      await setUserPersona(userId, "cert_seeker");

      const response = await aiAgent.chat(userId, "我的复习进度");

      // 备考者：鼓励语气，使用 emoji
      expect(response).toMatch(/加油|继续|💪|📝/);
    });
  });
});
```

### 2.2 性能基准测试

```typescript
// src/lib/ai-agent/personas/__tests__/perf/persona-performance.test.ts

describe("Persona Performance Benchmarks", () => {
  const BENCHMARK_ITERATIONS = 100;
  const P95_THRESHOLD_MS = 200;
  const P99_THRESHOLD_MS = 500;

  describe("Inference Performance", () => {
    it("should infer persona within P95 threshold", async () => {
      const latencies: number[] = [];

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const mockBookmarks = generateRandomBookmarks(100);

        const start = performance.now();
        await personaInferenceEngine.infer(`user_${i}`, mockBookmarks);
        const end = performance.now();

        latencies.push(end - start);
      }

      const p95 = percentile(latencies, 95);
      const p99 = percentile(latencies, 99);

      console.log(
        `Inference P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`,
      );

      expect(p95).toBeLessThan(P95_THRESHOLD_MS);
      expect(p99).toBeLessThan(P99_THRESHOLD_MS);
    });

    it("should handle large bookmark sets efficiently", async () => {
      const largeSets = [100, 500, 1000, 5000];

      for (const size of largeSets) {
        const mockBookmarks = generateRandomBookmarks(size);

        const start = performance.now();
        await personaInferenceEngine.infer("large_user", mockBookmarks);
        const latency = performance.now() - start;

        console.log(`Inference for ${size} bookmarks: ${latency.toFixed(2)}ms`);

        // 即使 5000 条书签也应在 500ms 内完成
        expect(latency).toBeLessThan(500);
      }
    });
  });

  describe("Intent Routing Performance", () => {
    it("should route with persona boost within threshold", async () => {
      const latencies: number[] = [];
      const testInputs = generateIntentTestInputs(BENCHMARK_ITERATIONS);

      for (const input of testInputs) {
        const start = performance.now();
        await intentRouter.route(input, { userId: "perf_user" });
        latencies.push(performance.now() - start);
      }

      const p95 = percentile(latencies, 95);
      console.log(`Intent Routing P95: ${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(50); // 路由应非常快
    });
  });
});
```

### 2.3 回归测试清单

```typescript
// src/lib/ai-agent/__tests__/regression/persona-regression.test.ts

describe("Persona Feature Regression Tests", () => {
  // 确保不破坏现有功能

  describe("Existing AI Capabilities", () => {
    it("should maintain search functionality", async () => {
      const result = await aiAgent.chat(userId, "搜索关于 React 的文章");
      expect(result).toContain("搜索");
    });

    it("should maintain tag management", async () => {
      const result = await aiAgent.chat(userId, "给这个加上学习标签");
      expect(result).toBeDefined();
    });

    it("should maintain export functionality", async () => {
      const result = await aiAgent.chat(userId, "导出我的收藏");
      expect(result).toBeDefined();
    });
  });

  describe("Backward Compatibility", () => {
    it("should work without persona (general fallback)", async () => {
      // 清除画像
      await clearUserPersona(userId);

      const result = await aiAgent.chat(userId, "帮我整理");
      expect(result).toBeDefined();
      // 应使用 general persona
    });

    it("should handle legacy user data", async () => {
      // 模拟旧版本用户数据（无 persona 字段）
      const legacyUser = await createLegacyUser();

      const result = await aiAgent.chat(legacyUser.id, "你好");
      expect(result).toBeDefined();
    });
  });

  describe("Feature Flag Control", () => {
    it("should disable persona when flag is off", async () => {
      await setFeatureFlag("ENABLE_MULTI_PERSONA", false);

      const prompt = await promptInjector.build(userId, "test");

      // 不应包含画像特定内容
      expect(prompt).not.toContain("咨询助手");
      expect(prompt).not.toContain("备考助手");

      await setFeatureFlag("ENABLE_MULTI_PERSONA", true);
    });
  });
});
```

---

## 三、可选配置入口设计

### 3.1 设置页面 UI 设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI 个性化设置                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ 📊 AI 识别的你                                           [查看详情 >] │ │
│  │                                                                       │ │
│  │  基于你的 1,234 条收藏，AI 认为你是：                                  │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  🚀 产品经理 (78% 置信度)                              [主画像] │ │ │
│  │  │  常见行为：竞品分析、用户反馈整理、PRD素材收集                   │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  次要特征：                                                           │ │
│  │  • 💻 技术实践 (45%) - AI/技术追踪                                   │ │
│  │  • 📈 自我提升 (32%) - 学习资源收集                                  │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ ⚙️ 手动设置                                                           │ │
│  │                                                                       │ │
│  │  ○ 使用 AI 推断 (推荐)                                               │ │
│  │  ◉ 手动选择身份                                                      │ │
│  │                                                                       │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │ 选择你的主要身份：                                             │   │ │
│  │  │                                                               │   │ │
│  │  │  🎓 学术研究  ✍️ 内容创作  💻 技术实践                         │   │ │
│  │  │  💼 专业服务  🎨 产品设计  📈 自我提升                         │   │ │
│  │  │                                                               │   │ │
│  │  │  已选：🎨 产品设计                                            │   │ │
│  │  │                                                               │   │ │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │   │ │
│  │  │  │产品经理 ✓│ │UX研究员 │ │游戏策划 │ │企业培训 │            │   │ │
│  │  │  │竞品/需求 │ │用研/设计│ │机制/玩法│ │案例/课程│            │   │ │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │   │ │
│  │  └───────────────────────────────────────────────────────────────┘   │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ 🎨 响应偏好                                                           │ │
│  │                                                                       │ │
│  │  响应风格：  ○ 简洁  ◉ 详细  ○ 自动                                  │ │
│  │  使用 Emoji：◉ 适度  ○ 丰富  ○ 不使用                               │ │
│  │  主动提醒：  ◉ 开启  ○ 关闭                                          │ │
│  │  学术引用：  ○ 开启  ◉ 关闭                                          │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                    [ 保存设置 ]                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 组件实现

```typescript
// src/components/settings/persona-settings.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePersonaInference } from '@/hooks/ai/use-persona-inference';
import { usePersonaSettings } from '@/hooks/ai/use-persona-settings';
import { PERSONA_GROUPS, PERSONA_TYPES } from '@/lib/ai-agent/personas/constants';
import type { PersonaType, PersonaGroup, UserPersonaV3_1 } from '@/lib/ai-agent/personas/types';

// UI 文本常量
const UI_TEXT = {
  title: 'AI 个性化设置',
  inferredSection: 'AI 识别的你',
  viewDetails: '查看详情',
  basedOn: '基于你的 {count} 条收藏，AI 认为你是：',
  primaryPersona: '主画像',
  secondaryTraits: '次要特征',
  manualSection: '手动设置',
  useInference: '使用 AI 推断 (推荐)',
  manualSelect: '手动选择身份',
  selectIdentity: '选择你的主要身份：',
  selected: '已选：',
  preferencesSection: '响应偏好',
  responseStyle: '响应风格：',
  emojiStyle: '使用 Emoji：',
  proactiveReminder: '主动提醒：',
  academicCitation: '学术引用：',
  saveButton: '保存设置',
  saving: '保存中...',
  saved: '已保存',
  confidence: '置信度',
} as const;

interface PersonaSettingsProps {
  userId: string;
}

export function PersonaSettings({ userId }: PersonaSettingsProps) {
  // 推断结果
  const {
    inferredPersona,
    confidence,
    secondaryTypes,
    bookmarkCount,
    isLoading: isInferring,
    refresh: refreshInference,
  } = usePersonaInference(userId);

  // 用户设置
  const {
    settings,
    updateSettings,
    isSaving,
    lastSaved,
  } = usePersonaSettings(userId);

  // 本地状态
  const [mode, setMode] = useState<'inferred' | 'manual'>('inferred');
  const [selectedGroup, setSelectedGroup] = useState<PersonaGroup | null>(null);
  const [selectedType, setSelectedType] = useState<PersonaType | null>(null);
  const [preferences, setPreferences] = useState({
    responseStyle: 'detailed' as 'concise' | 'detailed' | 'auto',
    emojiStyle: 'minimal' as 'none' | 'minimal' | 'rich',
    proactiveReminders: true,
    academicCitations: false,
  });

  // 初始化
  useEffect(() => {
    if (settings) {
      setMode(settings.source === 'inferred' ? 'inferred' : 'manual');
      setSelectedGroup(settings.group);
      setSelectedType(settings.primaryType);
      setPreferences(settings.preferences);
    }
  }, [settings]);

  // 保存处理
  const handleSave = async () => {
    const newSettings: Partial<UserPersonaV3_1> = {
      primaryType: mode === 'inferred' ? inferredPersona : selectedType!,
      group: mode === 'inferred' ? getGroupFromType(inferredPersona) : selectedGroup!,
      preferences,
      source: mode === 'inferred' ? 'inferred' : 'settings',
      updatedAt: new Date().toISOString(),
    };

    await updateSettings(newSettings);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{UI_TEXT.title}</h2>

      {/* AI 推断结果 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>📊 {UI_TEXT.inferredSection}</span>
            <Button variant="ghost" size="sm" onClick={refreshInference}>
              {UI_TEXT.viewDetails}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isInferring ? (
            <PersonaInferenceSkeleton />
          ) : inferredPersona ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                {UI_TEXT.basedOn.replace('{count}', bookmarkCount.toLocaleString())}
              </p>

              {/* 主画像 */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {PERSONA_TYPES[inferredPersona].icon}
                    </span>
                    <span className="font-medium">
                      {PERSONA_TYPES[inferredPersona].name}
                    </span>
                    <Badge variant="secondary">
                      {confidence}% {UI_TEXT.confidence}
                    </Badge>
                  </div>
                  <Badge>{UI_TEXT.primaryPersona}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  常见行为：{PERSONA_TYPES[inferredPersona].behaviors.join('、')}
                </p>
              </div>

              {/* 次要特征 */}
              {secondaryTypes.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">{UI_TEXT.secondaryTraits}</p>
                  <div className="space-y-1">
                    {secondaryTypes.map(({ type, confidence }) => (
                      <div key={type} className="flex items-center gap-2 text-sm">
                        <span>{PERSONA_TYPES[type].icon}</span>
                        <span>{PERSONA_TYPES[type].name}</span>
                        <span className="text-muted-foreground">({confidence}%)</span>
                        <span className="text-muted-foreground">
                          - {PERSONA_TYPES[type].shortDesc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              收藏数据不足，无法推断画像。请先收藏一些内容。
            </p>
          )}
        </CardContent>
      </Card>

      {/* 手动设置 */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ {UI_TEXT.manualSection}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="inferred" id="inferred" />
              <label htmlFor="inferred">{UI_TEXT.useInference}</label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="manual" id="manual" />
              <label htmlFor="manual">{UI_TEXT.manualSelect}</label>
            </div>
          </RadioGroup>

          {mode === 'manual' && (
            <div className="mt-4 rounded-lg border p-4">
              <p className="mb-4 font-medium">{UI_TEXT.selectIdentity}</p>

              {/* 分组选择 */}
              <div className="mb-4 flex flex-wrap gap-2">
                {PERSONA_GROUPS.map((group) => (
                  <Button
                    key={group.id}
                    variant={selectedGroup === group.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedGroup(group.id);
                      setSelectedType(null);
                    }}
                  >
                    {group.icon} {group.name}
                  </Button>
                ))}
              </div>

              {/* 类型选择 */}
              {selectedGroup && (
                <>
                  <p className="mb-2 text-sm">
                    {UI_TEXT.selected}
                    {PERSONA_GROUPS.find((g) => g.id === selectedGroup)?.icon}{' '}
                    {PERSONA_GROUPS.find((g) => g.id === selectedGroup)?.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PERSONA_GROUPS.find((g) => g.id === selectedGroup)?.subTypes.map(
                      (type) => (
                        <Button
                          key={type}
                          variant={selectedType === type ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedType(type)}
                          className="flex-col h-auto py-2"
                        >
                          <span>{PERSONA_TYPES[type].name}</span>
                          <span className="text-xs text-muted-foreground">
                            {PERSONA_TYPES[type].shortDesc}
                          </span>
                        </Button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 响应偏好 */}
      <Card>
        <CardHeader>
          <CardTitle>🎨 {UI_TEXT.preferencesSection}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <PreferenceRow
              label={UI_TEXT.responseStyle}
              options={[
                { value: 'concise', label: '简洁' },
                { value: 'detailed', label: '详细' },
                { value: 'auto', label: '自动' },
              ]}
              value={preferences.responseStyle}
              onChange={(v) =>
                setPreferences({ ...preferences, responseStyle: v as any })
              }
            />
            <PreferenceRow
              label={UI_TEXT.emojiStyle}
              options={[
                { value: 'minimal', label: '适度' },
                { value: 'rich', label: '丰富' },
                { value: 'none', label: '不使用' },
              ]}
              value={preferences.emojiStyle}
              onChange={(v) =>
                setPreferences({ ...preferences, emojiStyle: v as any })
              }
            />
            <PreferenceRow
              label={UI_TEXT.proactiveReminder}
              options={[
                { value: 'true', label: '开启' },
                { value: 'false', label: '关闭' },
              ]}
              value={preferences.proactiveReminders.toString()}
              onChange={(v) =>
                setPreferences({ ...preferences, proactiveReminders: v === 'true' })
              }
            />
            <PreferenceRow
              label={UI_TEXT.academicCitation}
              options={[
                { value: 'true', label: '开启' },
                { value: 'false', label: '关闭' },
              ]}
              value={preferences.academicCitations.toString()}
              onChange={(v) =>
                setPreferences({ ...preferences, academicCitations: v === 'true' })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving
            ? UI_TEXT.saving
            : lastSaved
            ? `${UI_TEXT.saved} (${formatTime(lastSaved)})`
            : UI_TEXT.saveButton}
        </Button>
      </div>
    </div>
  );
}

// 偏好行组件
function PreferenceRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-24 text-sm">{label}</span>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="flex gap-4"
      >
        {options.map((opt) => (
          <div key={opt.value} className="flex items-center space-x-1">
            <RadioGroupItem value={opt.value} id={`${label}-${opt.value}`} />
            <label htmlFor={`${label}-${opt.value}`} className="text-sm">
              {opt.label}
            </label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

// 骨架屏
function PersonaInferenceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
```

### 3.3 API 端点

```typescript
// src/app/api/user/persona/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { personaInferenceEngine } from "@/lib/ai-agent/personas/inference-engine";
import { z } from "zod";

// 验证 Schema
const UpdatePersonaSchema = z.object({
  primaryType: z.string(),
  group: z.string(),
  preferences: z.object({
    responseStyle: z.enum(["concise", "detailed", "auto"]),
    emojiStyle: z.enum(["none", "minimal", "rich"]),
    proactiveReminders: z.boolean(),
    academicCitations: z.boolean(),
  }),
  source: z.enum(["registration", "settings", "inferred"]),
});

// GET - 获取用户画像（包含推断）
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 获取存储的设置
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_preferences, persona_settings")
    .eq("id", user.id)
    .single();

  // 获取推断结果
  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("id, title, url, platform, tags, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const inference = await personaInferenceEngine.infer(
    user.id,
    bookmarks || [],
  );

  return NextResponse.json({
    stored: profile?.persona_settings || null,
    inferred: {
      primaryType: inference.primaryType,
      group: inference.group,
      confidence: inference.confidence,
      secondaryTypes: inference.secondaryTypes,
    },
    bookmarkCount: bookmarks?.length || 0,
  });
}

// PUT - 更新用户画像设置
export async function PUT(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validation = UpdatePersonaSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request", details: validation.error.errors },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      persona_settings: {
        ...validation.data,
        updatedAt: new Date().toISOString(),
      },
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data.persona_settings });
}
```

### 3.4 Hooks

```typescript
// src/hooks/ai/use-persona-inference.ts

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface InferredPersona {
  primaryType: string;
  group: string;
  confidence: number;
  secondaryTypes: Array<{ type: string; confidence: number }>;
}

export function usePersonaInference(userId: string) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["persona-inference", userId],
    queryFn: async () => {
      const res = await fetch("/api/user/persona");
      if (!res.ok) throw new Error("Failed to fetch persona");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["persona-inference", userId] });
    refetch();
  }, [queryClient, userId, refetch]);

  return {
    inferredPersona: data?.inferred?.primaryType || null,
    confidence: data?.inferred?.confidence || 0,
    secondaryTypes: data?.inferred?.secondaryTypes || [],
    bookmarkCount: data?.bookmarkCount || 0,
    storedSettings: data?.stored || null,
    isLoading,
    error,
    refresh,
  };
}

// src/hooks/ai/use-persona-settings.ts

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserPersonaV3_1 } from "@/lib/ai-agent/personas/types";

export function usePersonaSettings(userId: string) {
  const queryClient = useQueryClient();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["persona-settings", userId],
    queryFn: async () => {
      const res = await fetch("/api/user/persona");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      return data.stored as UserPersonaV3_1 | null;
    },
  });

  const mutation = useMutation({
    mutationFn: async (newSettings: Partial<UserPersonaV3_1>) => {
      const res = await fetch("/api/user/persona", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["persona-settings", userId] });
      queryClient.invalidateQueries({
        queryKey: ["persona-inference", userId],
      });
    },
  });

  const updateSettings = useCallback(
    (newSettings: Partial<UserPersonaV3_1>) =>
      mutation.mutateAsync(newSettings),
    [mutation],
  );

  return {
    settings,
    isLoading,
    updateSettings,
    isSaving: mutation.isPending,
    lastSaved,
    error: mutation.error,
  };
}
```

---

## 四、灰度发布方案

### 4.1 Feature Flags 配置

```typescript
// src/lib/ai-agent/config/feature-flags.ts - 新增

export const MULTI_PERSONA_FLAGS = {
  // 主开关
  ENABLE_MULTI_PERSONA: getEnvBoolean("ENABLE_MULTI_PERSONA", false),

  // 子功能开关
  ENABLE_PERSONA_INFERENCE: getEnvBoolean("ENABLE_PERSONA_INFERENCE", false),
  ENABLE_PERSONA_PROMPTS: getEnvBoolean("ENABLE_PERSONA_PROMPTS", false),
  ENABLE_PERSONA_INTENT_BOOST: getEnvBoolean(
    "ENABLE_PERSONA_INTENT_BOOST",
    false,
  ),
  ENABLE_PERSONA_SETTINGS_UI: getEnvBoolean(
    "ENABLE_PERSONA_SETTINGS_UI",
    false,
  ),

  // 灰度控制
  PERSONA_ROLLOUT_PERCENTAGE: getEnvNumber("PERSONA_ROLLOUT_PERCENTAGE", 0),
} as const;

// 检查用户是否在灰度范围内
export function isUserInPersonaRollout(userId: string): boolean {
  if (!MULTI_PERSONA_FLAGS.ENABLE_MULTI_PERSONA) {
    return false;
  }

  // 基于用户 ID 哈希的稳定灰度
  const hash = hashUserId(userId);
  const percentage = MULTI_PERSONA_FLAGS.PERSONA_ROLLOUT_PERCENTAGE;

  return hash % 100 < percentage;
}

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

### 4.2 灰度发布计划

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            灰度发布计划                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Week 1: 内测阶段 (0-5%)                                                    │
│  ───────────────────────                                                    │
│  • PERSONA_ROLLOUT_PERCENTAGE=5                                             │
│  • 仅开发者和测试账号                                                        │
│  • 密切监控错误率和性能                                                      │
│                                                                             │
│  Week 2: 小规模灰度 (5-20%)                                                 │
│  ─────────────────────────                                                  │
│  • PERSONA_ROLLOUT_PERCENTAGE=20                                            │
│  • 收集用户反馈                                                              │
│  • 优化推断准确率                                                            │
│                                                                             │
│  Week 3: 扩大灰度 (20-50%)                                                  │
│  ─────────────────────────                                                  │
│  • PERSONA_ROLLOUT_PERCENTAGE=50                                            │
│  • 性能基准对比                                                              │
│  • A/B 测试效果验证                                                          │
│                                                                             │
│  Week 4: 全量发布 (50-100%)                                                 │
│  ────────────────────────                                                   │
│  • PERSONA_ROLLOUT_PERCENTAGE=100                                           │
│  • 全量用户可用                                                              │
│  • 持续监控和优化                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 监控指标埋点

```typescript
// src/lib/ai-agent/personas/analytics.ts

import { logger } from "@/lib/logger";

export interface PersonaAnalyticsEvent {
  event: string;
  userId: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export const personaAnalytics = {
  // 推断事件
  trackInference: (
    userId: string,
    result: {
      primaryType: string;
      confidence: number;
      bookmarkCount: number;
      latencyMs: number;
    },
  ) => {
    logEvent({
      event: "persona_inference",
      userId,
      properties: {
        primary_type: result.primaryType,
        confidence: result.confidence,
        bookmark_count: result.bookmarkCount,
        latency_ms: result.latencyMs,
      },
    });
  },

  // 设置变更事件
  trackSettingsChange: (
    userId: string,
    change: {
      from: string | null;
      to: string;
      source: "inferred" | "manual";
    },
  ) => {
    logEvent({
      event: "persona_settings_change",
      userId,
      properties: {
        from_type: change.from,
        to_type: change.to,
        source: change.source,
      },
    });
  },

  // 意图路由事件
  trackIntentRouting: (
    userId: string,
    routing: {
      input: string;
      persona: string;
      intent: string;
      boostApplied: boolean;
      confidence: number;
    },
  ) => {
    logEvent({
      event: "persona_intent_routing",
      userId,
      properties: {
        input_length: routing.input.length,
        persona: routing.persona,
        intent: routing.intent,
        boost_applied: routing.boostApplied,
        confidence: routing.confidence,
      },
    });
  },

  // 错误事件
  trackError: (
    userId: string,
    error: {
      type: string;
      message: string;
      context: string;
    },
  ) => {
    logEvent({
      event: "persona_error",
      userId,
      properties: {
        error_type: error.type,
        error_message: error.message,
        context: error.context,
      },
    });
  },
};

function logEvent(event: Omit<PersonaAnalyticsEvent, "timestamp">) {
  const fullEvent: PersonaAnalyticsEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  // 本地日志
  logger.info("[Persona Analytics]", fullEvent);

  // TODO: 发送到分析服务（如 Mixpanel、Amplitude 等）
  // await analyticsService.track(fullEvent);
}
```

### 4.4 回滚方案

```typescript
// src/lib/ai-agent/personas/rollback.ts

import { MULTI_PERSONA_FLAGS } from "../config/feature-flags";
import { logger } from "@/lib/logger";

/**
 * 紧急回滚检查点
 * 当任一条件触发时，自动禁用 multi-persona 功能
 */
export const ROLLBACK_THRESHOLDS = {
  // 错误率阈值
  ERROR_RATE_THRESHOLD: 5, // 5%

  // 延迟阈值
  P95_LATENCY_THRESHOLD_MS: 500,

  // 准确率阈值（用户手动修正率过高）
  CORRECTION_RATE_THRESHOLD: 50, // 50%
} as const;

/**
 * 检查是否需要回滚
 */
export async function checkRollbackConditions(): Promise<{
  shouldRollback: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];

  // 检查错误率
  const errorRate = await getRecentErrorRate();
  if (errorRate > ROLLBACK_THRESHOLDS.ERROR_RATE_THRESHOLD) {
    reasons.push(
      `Error rate ${errorRate}% exceeds threshold ${ROLLBACK_THRESHOLDS.ERROR_RATE_THRESHOLD}%`,
    );
  }

  // 检查延迟
  const p95Latency = await getP95Latency();
  if (p95Latency > ROLLBACK_THRESHOLDS.P95_LATENCY_THRESHOLD_MS) {
    reasons.push(
      `P95 latency ${p95Latency}ms exceeds threshold ${ROLLBACK_THRESHOLDS.P95_LATENCY_THRESHOLD_MS}ms`,
    );
  }

  // 检查修正率
  const correctionRate = await getCorrectionRate();
  if (correctionRate > ROLLBACK_THRESHOLDS.CORRECTION_RATE_THRESHOLD) {
    reasons.push(
      `Correction rate ${correctionRate}% exceeds threshold ${ROLLBACK_THRESHOLDS.CORRECTION_RATE_THRESHOLD}%`,
    );
  }

  const shouldRollback = reasons.length > 0;

  if (shouldRollback) {
    logger.warn("[Persona Rollback] Rollback conditions triggered", {
      reasons,
    });
  }

  return { shouldRollback, reasons };
}

/**
 * 执行回滚
 */
export async function executeRollback(reasons: string[]): Promise<void> {
  logger.error("[Persona Rollback] Executing rollback", { reasons });

  // 1. 更新 Feature Flag（需要外部配置服务支持）
  // await updateFeatureFlag('ENABLE_MULTI_PERSONA', false);

  // 2. 通知开发团队
  // await sendAlert('Persona feature rolled back', reasons);

  // 3. 记录回滚事件
  logger.info("[Persona Rollback] Rollback completed");
}

// 辅助函数（实际实现需要连接监控服务）
async function getRecentErrorRate(): Promise<number> {
  // TODO: 从监控服务获取
  return 0;
}

async function getP95Latency(): Promise<number> {
  // TODO: 从监控服务获取
  return 0;
}

async function getCorrectionRate(): Promise<number> {
  // TODO: 从分析服务获取
  return 0;
}
```

---

## 五、数据库迁移

```sql
-- supabase/migrations/20251228000001_add_persona_settings.sql

-- 添加 persona_settings 字段到 profiles 表
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS persona_settings JSONB DEFAULT NULL;

-- 添加索引以支持查询
CREATE INDEX IF NOT EXISTS idx_profiles_persona_settings_type
ON profiles ((persona_settings->>'primaryType'))
WHERE persona_settings IS NOT NULL;

-- 添加 RPC 函数：获取画像分布统计
CREATE OR REPLACE FUNCTION get_persona_distribution()
RETURNS TABLE (
  persona_type TEXT,
  user_count BIGINT,
  percentage NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH total AS (
    SELECT COUNT(*) as total_count
    FROM profiles
    WHERE persona_settings IS NOT NULL
  ),
  distribution AS (
    SELECT
      persona_settings->>'primaryType' as persona_type,
      COUNT(*) as user_count
    FROM profiles
    WHERE persona_settings IS NOT NULL
    GROUP BY persona_settings->>'primaryType'
  )
  SELECT
    d.persona_type,
    d.user_count,
    ROUND((d.user_count::NUMERIC / t.total_count) * 100, 2) as percentage
  FROM distribution d
  CROSS JOIN total t
  ORDER BY d.user_count DESC;
$$;

-- 添加 RPC 函数：更新用户画像设置
CREATE OR REPLACE FUNCTION update_user_persona_settings(
  p_user_id UUID,
  p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- 验证用户权限
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 更新设置
  UPDATE profiles
  SET
    persona_settings = p_settings,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING persona_settings INTO v_result;

  RETURN v_result;
END;
$$;
```

---

## 六、任务清单

### 6.1 Phase 4 任务分解

| 序号     | 任务               | 文件/目录                 | 工时    | 优先级 |
| -------- | ------------------ | ------------------------- | ------- | ------ |
| 4.1      | 端到端集成测试     | `__tests__/e2e/`          | 4h      | P0     |
| 4.2      | 性能基准测试       | `__tests__/perf/`         | 3h      | P0     |
| 4.3      | 回归测试套件       | `__tests__/regression/`   | 3h      | P0     |
| 4.4      | 设置页面 UI 组件   | `components/settings/`    | 6h      | P0     |
| 4.5      | API 端点实现       | `app/api/user/persona/`   | 3h      | P0     |
| 4.6      | React Hooks        | `hooks/ai/`               | 2h      | P0     |
| 4.7      | Feature Flags 扩展 | `config/feature-flags.ts` | 2h      | P1     |
| 4.8      | 灰度发布配置       | `config/`, `.env`         | 1h      | P1     |
| 4.9      | 监控埋点           | `personas/analytics.ts`   | 2h      | P1     |
| 4.10     | 回滚机制           | `personas/rollback.ts`    | 2h      | P1     |
| 4.11     | 数据库迁移         | `migrations/`             | 1h      | P0     |
| 4.12     | 文档更新           | `docs/`                   | 2h      | P2     |
| **总计** |                    |                           | **31h** |        |

### 6.2 依赖关系

```
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 4 任务依赖图                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  4.11 数据库迁移 ─────┬──────────────────────────────────────┐  │
│                       │                                      │  │
│  4.7 Feature Flags ───┼─────────┐                            │  │
│                       │         │                            │  │
│                       ▼         ▼                            │  │
│  4.5 API 端点 ────────┼─→ 4.4 设置页面 UI                    │  │
│                       │         │                            │  │
│  4.6 React Hooks ─────┘         │                            │  │
│                                 │                            │  │
│  4.9 监控埋点 ──────────────────┴──────────────────┐         │  │
│                                                    │         │  │
│  4.8 灰度配置 ─────────────────────────────────────┤         │  │
│                                                    │         │  │
│  4.10 回滚机制 ────────────────────────────────────┤         │  │
│                                                    │         │  │
│                                                    ▼         │  │
│  4.1 E2E 测试 ─────────────────────────────→ 4.12 文档      │  │
│  4.2 性能测试 ─────────────────────────────→               │  │
│  4.3 回归测试 ─────────────────────────────→               │  │
│                                                             │  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 验收 Checklist

```markdown
## Phase 4 验收 Checklist

### 功能验收

- [ ] 端到端测试通过率 ≥ 95%
- [ ] 所有 25+ 画像类型正确识别
- [ ] 所有 35+ 意图规则正确路由
- [ ] 手动设置正确保存和加载
- [ ] 推断结果与手动设置正确切换

### 性能验收

- [ ] 推断延迟 P95 < 200ms
- [ ] 设置页面首屏 < 1s
- [ ] API 响应 P95 < 100ms

### 用户体验验收

- [ ] 设置页面流程完成率 ≥ 80%
- [ ] 推断准确率 ≥ 70%（用户确认）
- [ ] 无明显 UI 阻塞或卡顿

### 稳定性验收

- [ ] 错误率 < 1%
- [ ] 无内存泄漏
- [ ] 灰度可控

### 监控验收

- [ ] 关键指标埋点完成
- [ ] 告警规则配置
- [ ] 回滚机制可用

### 文档验收

- [ ] API 文档更新
- [ ] 用户指南更新
- [ ] 运维手册更新
```

---

## 七、风险与缓解

| 风险               | 概率 | 影响 | 缓解措施                        |
| ------------------ | ---- | ---- | ------------------------------- |
| 推断准确率低于预期 | 中   | 中   | 提供手动覆盖选项；持续优化算法  |
| 性能不达标         | 低   | 高   | 缓存推断结果；异步更新          |
| 用户不理解画像概念 | 中   | 低   | 简化 UI 说明；提供推荐默认值    |
| 灰度过程中出现问题 | 低   | 高   | 自动回滚机制；分阶段发布        |
| 与现有功能冲突     | 低   | 中   | 完整回归测试；Feature Flag 隔离 |

---

**文档结束**

> 下一步：开始实施 Phase 4.11 数据库迁移和 Phase 4.7 Feature Flags 扩展
