# Brain-Sync 移除实施方案 (Phase 1)

**日期**: 2026-01-29
**状态**: 待执行
**目标**: 安全、彻底地移除基于 SM-2 算法的间隔复习系统，确保不影响核心业务稳定性。

---

## 1. 核心风险控制策略：安全拆除协议

为防止“误伤”其他模块，执行 **“先解耦，后删除”** 策略：

1.  **外部解耦 (Unplug)**: ���移除 Sidebar、Settings、AI Hub 等外部引用，确保断开所有连接。
2.  **系统注销 (Unregister)**: 从 AI Skill 注册表、路由常量、限流器中移除配置。
3.  **核心删除 (Remove)**: 物理删除业务代码目录。
4.  **数据清理 (Drop)**: 最后删除数据库表结构。

---

## 2. 实施步骤详解

### Step 1: 外部解耦 (Surgical Detachment)
修改以下文件，移除对 Brain-Sync 组件和 Hooks 的引用：

*   **`src/components/layout/app-sidebar.tsx` & `mobile-menu.tsx`**
    *   移除菜单项链接。
    *   移除 `useBrainSyncStats` Hook 调用（及复习数量角标）。
*   **`src/components/settings/settings-page-client.tsx`**
    *   移除 `BrainSyncSettingsCard` 组件。
*   **`src/components/knowledge-studio/report-editor.tsx`**
    *   移除 `BrainSyncButton` 按钮。
*   **`src/components/ai-hub/ai-hub-client.tsx`**
    *   移除 `knowledge_review` 和 `active_recall` 快捷入口。

### Step 2: 系统注销 (System Unregister)
*   **`src/lib/ai-skills/register.ts`**
    *   删除 `activeRecallSkill` 的导入和注册。
*   **`src/lib/ai-skills/config/skill-mappings.ts`**
    *   删除 `learn:active_recall` 相关的意图映射。
*   **`src/lib/ai-agent/tools/index.ts`**
    *   删除 `active-recall` 工具导出。
*   **`src/lib/constants/api-paths.ts`**
    *   删除 `API_PATHS.brainSync` 相关常量。
*   **`src/lib/utils/rate-limiter.ts`**
    *   移除针对 `/brain-sync` 的限流规则。

### Step 3: 核心代码删除 (Core Removal)
在确保 TypeScript 检查通过后，物理删除以下目录/文件：

| 类型 | 路径 |
| :--- | :--- |
| **页面** | `src/app/(main)/brain-sync/` |
| **API** | `src/app/api/brain-sync/` |
| **组件** | `src/components/brain-sync/` |
| **组件** | `src/components/knowledge-studio/brain-sync-button.tsx` |
| **Hooks** | `src/hooks/domain/brain-sync/` |
| **Hooks** | `src/hooks/domain/knowledge-studio/use-brain-sync-integration.ts` |
| **Skill** | `src/lib/ai-skills/skills/active-recall/` |
| **Lib** | `src/lib/ai-skills/shared/review/` |
| **Types** | `src/types/brain-sync.ts` |

### Step 4: 数据库清理 (Data Cleanup)
创建迁移文件 `supabase/migrations/20260129000000_cleanup_brain_sync.sql`：

```sql
-- 1. 删除依赖表 (顺序关键)
DROP TABLE IF EXISTS review_logs;       -- 复习记录
DROP TABLE IF EXISTS review_sessions;   -- 复习会话
DROP TABLE IF EXISTS flashcards;        -- 抽认卡/问题卡
DROP TABLE IF EXISTS mastery_stats;     -- 掌握度统计
DROP TABLE IF EXISTS brain_sync_preferences; -- 用户偏好设置

-- 2. 清理枚举类型
DROP TYPE IF EXISTS review_rating;
DROP TYPE IF EXISTS mastery_level;
```

---

## 3. 验证计划
每执行一个 Step，均需运行以下检查：

```bash
# 类型检查（确保无悬空引用）
npm run type-check

# 构建检查（确保 Next.js 构建正常）
npm run build
```

## 4. 回滚策略
*   由于涉及物理文件删除，操作前确保 Git 工作区干净。
*   若 Step 1 或 Step 2 出现大量不可解的类型错误，使用 `git checkout .` 放弃更改，重新评估依赖关系。
