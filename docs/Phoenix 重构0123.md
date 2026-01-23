# 🦅 AnyKeep Phoenix 重构 - 分期实施方案 v2.0

## 项目讨论会纪要 | 2026-01-23

**主持人**：🧙 BMad Master
**与会专家**：📋 John (PM) | 📊 Mary (Analyst) | 🏗️ Winston (Architect) | 💻 Amelia (Dev) | 🎨 Sally (UX)
**审批人**：Xiafe (CEO)

---

## 一、问题诊断

### 1.1 现状分析

AnyKeep 已患上典型的 **"功能蔓延症"（Feature Creep）**：

| 症状     | 数据佐证                           |
| -------- | ---------------------------------- |
| 功能膨胀 | 30 个 Skills，但核心只需 10 个     |
| 价值稀释 | 用户使用 80% 集中在 3-5 个功能     |
| 开发负担 | 2000+ 文件，维护成本高企           |
| 愿景偏离 | 从"书签智能分类"变成"全能知识管理" |

### 1.2 用户行为分析

| 功能分类      | 预估使用率 | 建议          |
| ------------- | ---------- | ------------- |
| 搜索 + 浏览   | 60%        | ⭐ 核心强化   |
| 分类 + 标签   | 25%        | ⭐ 核心强化   |
| 导入 + 导出   | 10%        | ✅ 保留       |
| 复习/合成/TTS | < 5%       | ❌ 删除或隐藏 |

---

## 二、CEO 审批决策

### ✅ 决策点 1：Knowledge Studio

**决策**：A. 完全删除（偏离��心）

### ✅ 决策点 2：TTS 音频功能

**决策**：保持不变（对用户有用，继续保留）

### ✅ 决策点 3：audio-library 页面

**决策**：B. 独立保留（用户可能有已生成音频）

### ✅ 决策点 4：classification-debugger

**决策**：A. 删除（正式产品不需要）

---

## 三、删除清单

### 3.1 待删除模块

| 模块                                | 文件数          | 删除难度 | Sprint   |
| ----------------------------------- | --------------- | -------- | -------- |
| **Brain-Sync (active-recall)**      | 4 个 .ts 文件   | 🟢 低    | Sprint 1 |
| **主题合成器 (thematic-synthesis)** | 5 个 .ts 文件   | 🟢 低    | Sprint 1 |
| **Synthesis 组件**                  | 17 个 .tsx 文件 | 🟢 低    | Sprint 1 |
| **Knowledge Studio**                | ~20 个文件      | 🟢 低    | Sprint 1 |
| **Workflow 引擎**                   | ~58 个 .ts 文件 | 🔴 高    | Sprint 2 |
| **classification-debugger**         | 1 个页面        | 🟢 低    | Sprint 3 |

### 3.2 待删除页面

| 页面                    | 路径                       | 删除理由           | Sprint   |
| ----------------------- | -------------------------- | ------------------ | -------- |
| brain-sync              | `/brain-sync`              | 复习系统删除       | Sprint 1 |
| synthesis               | `/synthesis/*`             | 合成器删除         | Sprint 1 |
| knowledge-studio        | `/knowledge-studio/*`      | CEO 决策删除       | Sprint 1 |
| ai-test                 | `/ai-test`                 | 开发调试页         | Sprint 1 |
| learning-hub            | `/learning-hub`            | 与 brain-sync 重叠 | Sprint 1 |
| workflows               | `/workflows`               | Workflow 引擎删除  | Sprint 2 |
| classification-debugger | `/classification-debugger` | CEO 决策删除       | Sprint 3 |

### 3.3 待删除 Skills

| Skill ID                 | 名称       | 删除理由                 | Sprint   |
| ------------------------ | ---------- | ------------------------ | -------- |
| `active_recall`          | Brain-Sync | 偏离核心（复习 ≠ 收藏）  | Sprint 1 |
| `thematic_synthesis`     | 主题合成   | 过重，Token 消耗大       | Sprint 1 |
| `learning_path`          | 学习路径   | 与复习系统重叠           | Sprint 3 |
| `knowledge_review`       | 知识回顾   | 与复习系统重叠           | Sprint 3 |
| `reading_planner`        | 阅读规划   | 低频，非核心             | Sprint 3 |
| `share_bundle`           | 分享包     | 低频，可后续加回         | Sprint 3 |
| `periodic_report`        | 周期报告   | 可用 insight_report 替代 | Sprint 3 |
| `bilibili_transcript`    | B站字幕    | 平台特定，低优先级       | Sprint 3 |
| `wechat_digest`          | 微信摘要   | 平台特定，低优先级       | Sprint 3 |
| `content_change_monitor` | 内容监控   | 复杂，非 MVP             | Sprint 3 |
| `inbox_digest`           | 收件箱摘要 | 低频使用                 | Sprint 3 |

### 3.4 保留的核心 Skills（10 个）

| Skill ID              | 名称       | 理由         |
| --------------------- | ---------- | ------------ |
| `search`              | 语义搜索   | ⭐ 核心功能  |
| `classify`            | 智能分类   | ⭐ 核心功能  |
| `summary`             | 内容摘要   | ⭐ 核心功能  |
| `batch_organize`      | 批量整理   | 高频使用     |
| `duplicate_cleanup`   | 重复清理   | 高频使用     |
| `quick_digest`        | 快速摘要   | 高频使用     |
| `smart_tagging`       | 智能标签   | 高频使用     |
| `data_export`         | 数据导出   | 必需功能     |
| `insight_report`      | 洞察报告   | 保留精简版   |
| `folder_health_check` | 文件夹健康 | 与 v6.0 配合 |

### 3.5 保留功能（CEO 特批）

| 功能                   | 理由                   |
| ---------------------- | ---------------------- |
| **TTS 语音朗读**       | 对用户有用，差异化功能 |
| **audio-library 页面** | 用户可能有已生成音频   |
| `tts_synthesis` Skill  | 配合 TTS 功能保留      |

---

## 四、分期实施时间表

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phoenix 重构路线图                            │
├─────────────────────────────────────────────────────────────────┤
│ Sprint 1 (Week 1): 🟢 低风险清理                                 │
│   Day 1: 创建备份分支 + Brain-Sync 删除                          │
│   Day 2: 主题合成器删除 + Knowledge Studio 删除                  │
│   Day 3: 非核心页面删除 (ai-test, learning-hub)                 │
│   Day 4: 测试修复 + 文档更新                                     │
│   Day 5: Sprint 1 验收 ✅                                        │
├─────────────────────────────────────────────────────────────────┤
│ Sprint 2 (Week 2): 🟡 Workflow 引擎解耦                          │
│   Day 1: IntentRouter 解耦 WorkflowIntentMatcher                │
│   Day 2: UnifiedEngine 移除 Workflow 模式                        │
│   Day 3: 删除 src/lib/workflow/ 核心目录                         │
│   Day 4: 删除 Workflow API Routes + 前端组件                     │
│   Day 5: Sprint 2 验收 + Feature Flags 清理 ✅                   │
├─────────────────────────────────────────────────────────────────┤
│ Sprint 3 (Week 3): 🔵 Skills 裁剪 + 导航精简                     │
│   Day 1-2: 删除 11 个非核心 Skills                               │
│   Day 3: 侧边栏导航重构 + classification-debugger 删除           │
│   Day 4: 全量测试 + Bug 修复                                     │
│   Day 5: Sprint 3 验收 + CLAUDE.md 同步 ✅                       │
├─────────────────────────────────────────────────────────────────┤
│ Sprint 4-6 (Week 4-6): ⭐ v6.0 核心开发                          │
│   Week 4: L1 贝叶斯引擎 (前端本地分类)                           │
│   Week 5: L2 向量优化 + 垃圾命名透视                             │
│   Week 6: L3 懒人治理 Toast + 集成测试                           │
├─────────────────────────────────────────────────────────────────┤
│ Sprint 7-8 (Week 7-8): 🎯 打磨验收                               │
│   Week 7: 性能优化 + UI/UX 精简                                  │
│   Week 8: 最终验收 + 发布准备                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 五、Sprint 1 详细任务清单

### Day 1: 备份 + Brain-Sync 删除

```bash
# 1. 创建备份分支
git checkout -b backup-before-phoenix-20260123
git push origin backup-before-phoenix-20260123
git checkout -b phoenix-sprint-1

# 2. 扫描 Brain-Sync 依赖
grep -r "active-recall\|brain-sync\|ActiveRecall\|BrainSync" src/ --include="*.ts" --include="*.tsx"
```

**删除文件清单**：

```
├── src/lib/ai-skills/skills/active-recall/  (4 files)
├── src/app/(main)/brain-sync/page.tsx
├── src/app/api/brain-sync/ (如有)
└── 相关测试文件
```

**修改文件**：

```typescript
// src/lib/ai-skills/register.ts → 移除 active_recall 注册
// src/lib/ai-agent/config/feature-flags.ts → 移除 ENABLE_ACTIVE_RECALL
// 侧边栏组件 → 移除 Brain-Sync 入口
```

### Day 2: 主题合成器 + Knowledge Studio 删除

**主题合成器删除**：

```
├── src/lib/ai-skills/skills/thematic-synthesis/  (5 files)
├── src/components/synthesis/                      (17 files)
├── src/app/(main)/synthesis/                      (3 pages)
├── src/app/api/synthesis/                         (如有)
└── 相关测试文件
```

**Knowledge Studio 删除**：

```
├── src/app/(main)/knowledge-studio/              (所有页面)
├── src/components/knowledge-studio/              (如有)
└── 相关 API routes
```

### Day 3: 非核心页面删除

| 页面         | 路径            | 操作 |
| ------------ | --------------- | ---- |
| ai-test      | `/ai-test`      | 删除 |
| learning-hub | `/learning-hub` | 删除 |

### Day 4-5: 测试修复 + 验收

**验证点**：

- [ ] `npm run build` 成功
- [ ] `npm run type-check` 通过
- [ ] `npm test` 通过率 ≥ 95%
- [ ] 侧边栏导航正确更新

---

## 六、Sprint 2 详细任务清单

### Workflow 引擎删除步骤（手术式）

**Step 1: IntentRouter 解耦** (Day 1)

```typescript
// src/lib/ai-skills/router/intent-router.ts
// 1. 移除 WorkflowIntentMatcher 导入
// 2. 移除 workflow 模式判断逻辑
// 3. 验证构建
```

**Step 2: UnifiedEngine 解耦** (Day 2)

```typescript
// src/lib/ai-skills/engine/unified-engine.ts
// 1. 移除 WorkflowModeExecutor 导入
// 2. 只保留 Atomic + Orchestration 两种模式
// 3. 验证构建
```

**Step 3: 删除核心目录** (Day 3)

```
删除顺序（按依赖层级）：
1. src/lib/workflow/integration/      # 先删集成层
2. src/lib/workflow/triggers/         # 再删触发器
3. src/lib/workflow/orchestrator/     # 再删编排器
4. src/lib/workflow/                  # 最后删根目录
```

**Step 4: 清理前端** (Day 4)

```
├── src/hooks/workflow/
├── src/components/workflow/
├── src/app/api/workflow/
├── src/app/api/workflows/
└── src/app/(main)/workflows/page.tsx
```

**Step 5: Feature Flags 清理** (Day 5)

```typescript
// src/lib/ai-agent/config/feature-flags.ts
// 删除 Workflow 相关 Flags
```

---

## 七���Sprint 3 详细任务清单

### Day 1-2: 删除非核心 Skills

删除以下 11 个 Skills：

- `learning_path`
- `knowledge_review`
- `reading_planner`
- `share_bundle`
- `periodic_report`
- `bilibili_transcript`
- `wechat_digest`
- `content_change_monitor`
- `inbox_digest`
- `link_health_check`
- `related_discovery`

### Day 3: 导航精简

**删除页面**：

- `/classification-debugger`

**保留的核心页面**（≤15个）：

```
首页 (/home)
├── 搜索 (/search)
├── 分类管理 (/folders)
├── 标签管理 (/tags)
├── 批量操作 (/batch)
├── 数据导出 (/export)
├── 浏览器导入 (/import)
├── Skills 浏览 (/skills-browser)
├── 音频库 (/audio-library) ← 保留
├── 设置 (/settings)
└── 个人中心 (/profile)
```

### Day 4-5: 全量测试 + CLAUDE.md 同步

---

## 八、验收标准

| 指标       | Sprint 1 | Sprint 2 | Sprint 3 | 最终     |
| ---------- | -------- | -------- | -------- | -------- |
| 构建成功   | ✅ 0错误 | ✅ 0错误 | ✅ 0错误 | ✅ 0错误 |
| 测试通过率 | ≥95%     | ≥95%     | ≥98%     | ≥99%     |
| 删除文件数 | ~70      | ~100     | ~30      | ~200     |
| 页面数     | 48→40    | 40→38    | 38→15    | ≤15      |
| Skills 数  | 30→28    | 28→28    | 28→11    | 11       |

---

## 九、风险与应对

| 风险                      | 概率 | 应对措施                   |
| ------------------------- | ---- | -------------------------- |
| Workflow 删除导致构建失败 | 高   | 逐文件删除，每步验证构建   |
| 测试用例大面积失败        | 中   | 同步删除相关测试文件       |
| 遗漏隐藏依赖              | 中   | 使用 grep 全量扫描后再删除 |
| 功能误删                  | 低   | 删除前创建 git 分支备份    |

---

## 十、立即可执行的命令

### 10.1 创建备份分支

```bash
git checkout -b backup-before-phoenix-20260123
git push origin backup-before-phoenix-20260123
git checkout main
```

### 10.2 生成删除清单

```bash
# 扫描 Workflow 依赖
grep -r "from.*workflow" src/ --include="*.ts" --include="*.tsx" > workflow-deps.txt

# 扫描 active-recall 依赖
grep -r "from.*active-recall" src/ --include="*.ts" > active-recall-deps.txt

# 扫描 synthesis 依赖
grep -r "from.*synthesis" src/ --include="*.ts" --include="*.tsx" > synthesis-deps.txt

# 扫描 knowledge-studio 依赖
grep -r "knowledge-studio\|KnowledgeStudio" src/ --include="*.ts" --include="*.tsx" > knowledge-studio-deps.txt
```

---

## 审批记录

| 审批项                  | 决策        | 审批人 | 日期       |
| ----------------------- | ----------- | ------ | ---------- |
| Knowledge Studio        | ✅ 完全删除 | Xiafe  | 2026-01-23 |
| TTS 音频功能            | ✅ 保留     | Xiafe  | 2026-01-23 |
| audio-library 页面      | ✅ 独立保留 | Xiafe  | 2026-01-23 |
| classification-debugger | ✅ 删除     | Xiafe  | 2026-01-23 |
| 整体方案                | ✅ 通过     | Xiafe  | 2026-01-23 |

---

**文档状态**：✅ 已审批，可执行
**下一步**：执行 Sprint 1 Day 1 任务
**负责人**：开发团队
