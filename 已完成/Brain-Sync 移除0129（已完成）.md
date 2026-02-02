# Brain-Sync 移除与 Weekly Digest 增强实施方案

**日期**: 2026-01-29
**状态**: 待执行

## 1. 方案背景
将 **“Brain-Sync (背诵)”** 替换为 **“Weekly Digest (回顾简报)”**，将产品定位从“高压力的学习工具”回归到“知识资产管理”。防止收藏夹变成“数字垃圾场”，通过定期的、低压力的回顾激活知识。

## 2. 核心设计理念
*   **减法**: 彻底移除基于 SM-2 算法的间隔复习系统。
*   **加法**: 新增基于 AI 总结的周报系统（邮件 + App 通知）。
*   **理念**: “像一份为你定制的 Newsletter，而不是一张催你还债的考试卷。”

---

## Phase 1: 移除 Brain-Sync 系统 (Cleanup)

按依赖反向顺序清理，确保系统稳定性。

### 1.1 数据库清理 (Migration)
创建迁移文件 `supabase/migrations/20260129000000_cleanup_brain_sync.sql`：

```sql
-- 1. 删除依赖表
DROP TABLE IF EXISTS review_logs;       -- 复习记录
DROP TABLE IF EXISTS review_sessions;   -- 复习会话
DROP TABLE IF EXISTS flashcards;        -- 抽认卡/问题卡
DROP TABLE IF EXISTS mastery_stats;     -- 掌握度统计
DROP TABLE IF EXISTS brain_sync_preferences; -- 用户偏好设置

-- 2. 清理枚举类型
DROP TYPE IF EXISTS review_rating;
DROP TYPE IF EXISTS mastery_level;
```

### 1.2 代码文件删除清单

| 模块 | 路径 | 操作 |
| :--- | :--- | :--- |
| **Feature UI** | `src/app/(main)/brain-sync/` | ❌ 删除整个目录 |
| **Components** | `src/components/brain-sync/` | ❌ 删除整个目录 |
| **Components** | `src/components/knowledge-studio/brain-sync-button.tsx` | ❌ 删除 |
| **API** | `src/app/api/brain-sync/` | ❌ 删除整个目录 |
| **Hooks** | `src/hooks/domain/brain-sync/` | ❌ 删除整个目录 |
| **Hooks** | `src/hooks/domain/knowledge-studio/use-brain-sync-integration.ts` | ❌ 删除 |
| **AI Skills** | `src/lib/ai-skills/skills/active-recall/` | ❌ 删除整个目录 |
| **Shared Lib** | `src/lib/ai-skills/shared/review/` | ❌ 删除整个目录 |
| **Types** | `src/types/brain-sync.ts` | ❌ 删除 |

### 1.3 配置与引用清理
*   **`src/lib/ai-skills/register.ts`**: 移除 `active-recall` 相关 Skill 注册。
*   **`src/lib/ai-skills/config/skill-mappings.ts`**: 移除 `learn:active_recall` 相关意图映射。
*   **`src/components/layout/sidebar.tsx`**: 移除侧边栏 "Brain Sync" 入口。

---

## Phase 2: 构建 Weekly Digest 系统 (Implementation)

### 2.1 数据库设计
创建迁移文件 `supabase/migrations/20260129000001_create_weekly_digest.sql`：

```sql
CREATE TABLE weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 周期定义
  week_start DATE NOT NULL, -- 例如 2026-01-26 (周一)
  week_end DATE NOT NULL,   -- 例如 2026-02-01 (周日)

  -- 发送状态
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  -- 内容快照 (用于前端历史查看)
  items_count INT DEFAULT 0,
  top_picks_ids UUID[] DEFAULT '{}', -- 关联 bookmarks.id
  ai_summary TEXT,                   -- AI 生成的“本周关注焦点”

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 唯一索引：防止重复生成/发送
CREATE UNIQUE INDEX idx_weekly_digests_user_week ON weekly_digests(user_id, week_start);
```

### 2.2 核心服务架构 (`src/lib/digest/`)

1.  **`digest.service.ts` (Data Layer)**
    *   查询本周 `bookmarks` (根据 `created_at`)。
    *   **关键过滤**: 必须排除 `import_batch_id IS NOT NULL` 的数据（批量导入不计入周报）。
    *   **Rediscover 逻辑**: 随机抽取 1 条 `created_at < NOW() - 90 days` 的数据。

2.  **`digest.generator.ts` (AI Layer)**
    *   **Prompt**: "你是一个知识图书管理员。这是用户本周收藏的 N 篇文章标题和标签。请用一段话（100字以内）总结关注焦点，并用幽默鼓励的语气点评。"
    *   **Input**: 仅发送 Title, Folder, Tags (保护隐私，节省 Token)。

3.  **`email.renderer.tsx` (View Layer)**
    *   基于 `@react-email/components`。
    *   包含模块: Header, AI Summary, Top 3 Picks, Rediscover Gem, Footer (Unsubscribe).

### 2.3 基础设施
*   **Edge Function**: `supabase/functions/trigger-weekly-digest`。
    *   定时触发 (pg_cron 或 GitHub Actions)。
    *   逻辑: Fetch Users -> Check Existing Digest -> Generate -> Send via Resend -> Update Status。
*   **Email Service**: 集成 **Resend**。

### 2.4 用户设置
*   在设置页新增 "Email Notifications" 区块。
*   开关: "Weekly Knowledge Digest"。

---

## 3. 风险控制

1.  **零数据处理**: 若用户本周无新收藏，不发送空周报，或发送纯 "Rediscover" 版本（若有旧数据）。
2.  **批量导入干扰**: 严格过滤批量导入数据，防止周报长度爆炸。
3.  **时区问题**: MVP 阶段统一按 UTC 处理周期，发送时间选在周末（涵盖全球大部分时区的休息时间）。

## 4. 执行顺序
1.  ✅ 保存本方案。
2.  [ ] 执行 Phase 1 清理工作（数据库迁移 + 代码删除）。
3.  [ ] 验证系统构建无报错。
4.  [ ] 执行 Phase 2 开发工作。
