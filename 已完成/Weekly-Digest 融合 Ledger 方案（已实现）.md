# Weekly Digest 融合 Ledger 架构方案 (Phase 2)

**日期**: 2026-01-29
**状态**: 已执行 (Phase 2 Completed)
**架构策略**: 复用并扩展 Ledger 系统，而非重复造轮子。

---

## 1. 核心架构变更

将 "Weekly Digest" 定义为 Ledger 系统的一种特殊类型 (`knowledge`)，复用现有的账本生成、存储和调度机制。

| 功能模块 | 原 Ledger 功能 | 扩展后的 Weekly Digest |
| :--- | :--- | :--- |
| **表结构** | `ledgers` (财务账本) | 复用 `ledgers` 表，新增 `type='knowledge'` |
| **数据项** | `ledger_entries` (财务条目) | 复用 `ledger_entries` 表，新增 `entry_type='bookmark'` |
| **生成逻辑** | `FinancialLedgerGenerator` | 新增 `KnowledgeLedgerGenerator` |
| **触发机制** | Cron (`generate-weekly-ledger`) | 复用 Cron，增加多策略调度 |
| **通知** | (无) | 新增 `EmailNotificationService` |

---

## 2. 实施步骤详解

### Step 1: 数据库扩展 (Migration)
创建迁移文件 `supabase/migrations/20260129000002_extend_ledger_for_digest.sql`：

```sql
-- 1. 扩展 ledgers 表
ALTER TABLE ledgers
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'financial' CHECK (type IN ('financial', 'knowledge')),
ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'none' CHECK (email_status IN ('none', 'pending', 'sent', 'failed')),
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_summary TEXT, -- 用于存储 AI 生成的周评
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'; -- 用于存储 Persona、标签分布等元数据

-- 2. 扩展 ledger_entries 表
ALTER TABLE ledger_entries
ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'financial' CHECK (entry_type IN ('financial', 'bookmark', 'rediscover')),
ADD COLUMN IF NOT EXISTS bookmark_id UUID REFERENCES bookmarks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'; -- 用于存储关联度等信息

-- 3. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_ledgers_type_week ON ledgers(user_id, type, start_date);
```

### Step 2: 服务层改造 (增加 AI 深度与 Persona)

**`KnowledgeLedgerGenerator` 的新逻辑流程：**

1.  **收集 (Collect)**: 获取本周收藏数据（过滤掉批量导入）。
2.  **画像 (Profile)**: 分析标签分布 -> 确定 **Persona** (如：硬核极客、生活美学家、深度思考者)。
3.  **联想 (Associate)**: 拿本周 Top 1 收藏 -> 向量检索 -> 找到 **"Rediscover Gem"** (关联度高的旧文)。
4.  **生成 (Generate)**:
    *   **Prompt**: "你现在是[Persona]，请用你的口吻点评..."
    *   **Input**: 本周清单 + 关联旧文。
5.  **存储 (Store)**:
    *   `ledgers.ai_summary`: 存储 AI 点评。
    *   `ledgers.metadata`: `{ "persona": "geek", "top_tags": ["coding", "ai"] }`
    *   `ledger_entries` (针对旧文): `{ "type": "rediscover", "metadata": { "related_to": "new_id", "similarity": 0.85 } }`

### Step 3: 邮件服务与模板 (`src/lib/email/`)

1.  **集成 Resend**: 配置 API Key。
2.  **邮件模板**: 使用 `@react-email/components` 创建 `WeeklyDigestEmail`。
    *   **Header**: "AnyKeep 周报"
    *   **AI Summary**: 展示 Persona 风格的点评。
    *   **Content**: 本周收藏 Top 5，每项下方提供 **Action Bar** (Deep Link: `anykeep://action/archive?id=xxx`)。
    *   **Rediscover**: "你可能忘记的关联" (展示新旧关联)。
    *   **Footer**: Unsubscribe 链接。

### Step 4: 调度与用户偏好 (`src/app/api/internal/cron/`)

修改 `generate-weekly-ledger/route.ts`，加入用户偏好检查：

```typescript
// 伪代码
export async function GET() {
  const users = await getActiveUsers();
  for (const user of users) {
    // 1. 生成财务账本 (保持原有)
    await ledgerService.generate(user.id, 'financial');

    // 2. 生成知识周报 (新增)
    // 关键：检查用户设置 settings.notifications.weeklyDigest
    if (user.settings?.notifications?.weeklyDigest) {
      const digest = await ledgerService.generate(user.id, 'knowledge');
      // 3. 发送邮件
      if (digest && digest.email_status === 'pending') {
        await emailService.send(digest);
        await ledgerService.markEmailSent(digest.id);
      }
    }
  }
}
```

---

## 3. 优势分析

1.  **情感价值**: 动态 Persona 让周报不再冰冷。
2.  **智力惊喜**: 跨时空关联激活沉睡知识。
3.  **极简交互**: 邮件内 Deep Link 一键处理，降低整理门槛。
4.  **免打扰**: 严格遵循用户设置，默认开启但可随时关闭。

## 4. 执行计划 (Completed)

1.  [x] 执行数据库迁移 (Step 1)。
2.  [x] 重构 Ledger Service 支持多态与 Persona (Step 2)。
3.  [x] 开发邮件模板与发送服务 (Step 3)。
4.  [x] 更新 Cron Job 逻辑并集成用户设置 (Step 4)。
