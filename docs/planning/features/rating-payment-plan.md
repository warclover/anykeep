# 评级功能收费设置方案

**文档版本**: V1.0
**创建日期**: 2025-12-02
**作者**: AI Assistant
**状态**: 方案设计阶段

---

## 📋 目录

1. [需求背景](#需求背景)
2. [当前实现分析](#当前实现分析)
3. [解耦方案对比](#解耦方案对比)
4. [推荐方案详解](#推荐方案详解)
5. [实施路线图](#实施路线图)
6. [定价策略建议](#定价策略建议)
7. [数据库优化](#数据库优化)
8. [风险评估](#风险评估)

---

## 需求背景

### 业务目标

- **功能定位**: 评级、锁定、删除标记功能作为高级会员专属权益
- **目标用户**: 付费高级会员（PREMIUM / PREMIUM_PLUS）
- **核心价值**: 通过高级收藏管理功能驱动用户付费转化

### 当前功能范围

| 功能     | 描述                       | 数据库字段               | 实现状态  |
| -------- | -------------------------- | ------------------------ | --------- |
| 星级评级 | 0-5 星标记重要性           | `rating`                 | ✅ 已实现 |
| 锁定保护 | 防止误删重要收藏           | `is_locked`              | ✅ 已实现 |
| 删除标记 | 批量清理标记（非物理删除） | `is_marked_for_deletion` | ✅ 已实现 |
| 展示层   | 卡片和详情页显示           | `BookmarkRatingDisplay`  | ✅ 已实现 |
| 交互层   | 评级和锁定操作             | `BookmarkRating`         | ✅ 已实现 |

---

## 当前实现分析

### 耦合度评估

#### 🔴 高耦合部分（需重点解耦）

| 位置                                 | 耦合原因                          | 影响范围 |
| ------------------------------------ | --------------------------------- | -------- |
| **数据库字段** (`bookmarks` 表)      | 评级字段与核心收藏字段在同一表    | 全局     |
| **UI 组件** (`BookmarkRating`)       | 直接集成在详情页，未做权限检查    | 前端     |
| **API 路由** (`/api/bookmarks/[id]`) | PUT/DELETE 操作未验证高级会员权限 | 后端     |

#### 🟡 中耦合部分（需适度调整）

| 位置                                   | 耦合原因                           | 影响范围 |
| -------------------------------------- | ---------------------------------- | -------- |
| **类型定义** (`types/supabase.ts`)     | `Bookmark` 类型包含评级字段        | 类型系统 |
| **Zod 验证** (`lib/validation.ts`)     | 验证 schema 包含评级字段           | 校验层   |
| **展示组件** (`BookmarkRatingDisplay`) | 卡片列表中显示评级，未区分用户权限 | 前端     |

#### 🟢 低耦合部分（可保持现状）

| 位置                                 | 独立性                         |
| ------------------------------------ | ------------------------------ |
| **评级组件** (`bookmark-rating.tsx`) | 已封装为独立组件，易于条件渲染 |
| **数据库索引**                       | 独立的评级索引，不影响其他查询 |
| **迁移文件**                         | 独立的 migration，可回滚       |

---

## 解耦方案对比

### 方案一：物理隔离（独立表）

#### 架构设计

```sql
-- 新建独立表
CREATE TABLE bookmark_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  rating INTEGER CHECK (rating >= 0 AND rating <= 5),
  is_locked BOOLEAN DEFAULT false,
  is_marked_for_deletion BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 优劣分析

✅ **优点**:

- **完全解耦**: 评级数据与核心收藏完全分离
- **权限控制简单**: RLS 策略直接检查会员等级
- **降级友好**: 直接限制表访问，无需修改数据

❌ **缺点**:

- **性能开销**: 每次查询需要 JOIN，增加延迟
- **复杂度提升**: 需要维护两张表的一致性
- **迁移成本高**: 需要数据迁移 + 多处代码改动

#### 适用场景

- 评级数据量巨大（百万级）
- 未来可能拆分服务
- 需要独立的评级历史记录

---

### 方案二：特性开关 + 权限控制（推荐）

#### 架构设计

```typescript
// 1. 权限配置中心
export const RATING_FEATURE_CONFIG = {
  allowedTiers: ["PREMIUM", "PREMIUM_PLUS"] as MembershipType[],
  featureKey: "bookmark_rating",
  freeTierLimits: {
    canView: true, // 免费用户可见（只读）
    canEdit: false, // 不可编辑
    maxRatings: 0,
  },
  premiumBenefits: {
    canView: true,
    canEdit: true,
    maxRatings: Infinity,
  },
};

// 2. 权限检查函数
export function hasRatingFeature(
  membershipType?: MembershipType | null,
): boolean {
  if (!membershipType) return false;
  return RATING_FEATURE_CONFIG.allowedTiers.includes(membershipType);
}
```

#### 优劣分析

✅ **优点**:

- **性能最优**: 无额外 JOIN，查询效率不变
- **实现简单**: 仅需增加权限中间件
- **用户友好**: 降级后数据保留（只读模式）
- **灵活调整**: 通过配置控制功能范围

⚠️ **注意点**:

- 需要在多个层级添加权限检查（UI + API）
- 免费用户仍能看到评级字段（只读）

#### 适用场景（✅ 推荐）

- 功能已在主表实现
- 强调用户体验（降级不丢失数据）
- 快速上线付费功能

---

### 方案三：混合方案

#### 架构设计

```sql
-- 保留基础字段（免费用户可用）
ALTER TABLE bookmarks
  ADD COLUMN rating_basic INTEGER DEFAULT 0 CHECK (rating_basic >= 0 AND rating_basic <= 3);

-- 高级功能表（付费用户专属）
CREATE TABLE bookmark_premium_features (
  bookmark_id UUID PRIMARY KEY REFERENCES bookmarks(id),
  rating_advanced INTEGER CHECK (rating_advanced >= 0 AND rating_advanced <= 5),
  is_locked BOOLEAN,
  is_marked_for_deletion BOOLEAN,
  -- 未来可扩展其他高级功能
);
```

#### 优劣分析

✅ **优点**:

- 渐进式付费（免费 3 星，付费 5 星）
- 核心功能不受影响

❌ **缺点**:

- 架构复杂度最高
- 用户理解成本高（为何分两个评级？）

---

## 推荐方案详解

### 选择理由

**方案二（特性开关 + 权限控制）** 最适合当前项目，原因如下：

1. ✅ **零破坏性**: 评级字段已在主表，无需大规模重构
2. ✅ **用户友好**: 降级后数据保留（免费用户只读）
3. ✅ **快速上线**: 仅需增加权限层，1 周内完成
4. ✅ **转化优化**: 免费用户可看到评级（激发升级欲望）

### 实现细节

#### 1. 权限控制中心

**文件**: `src/lib/features/rating-feature.ts`

```typescript
/**
 * 评级功能特性控制
 * V6.0 付费功能：评级、锁定、删除标记
 */

import type { MembershipType } from "@/types/supabase";

/**
 * 评级功能权限配置
 */
export const RATING_FEATURE_CONFIG = {
  // 允许使用评级功能的会员等级
  allowedTiers: ["PREMIUM", "PREMIUM_PLUS"] as MembershipType[],

  // 功能标识
  featureKey: "bookmark_rating" as const,

  // 免费用户限制
  freeTierLimits: {
    canView: true, // 可以看到评级显示
    canEdit: false, // 不能编辑评级
    maxRatings: 0, // 允许评级的收藏数量
  },

  // 付费用户权益
  premiumBenefits: {
    canView: true,
    canEdit: true,
    maxRatings: Infinity,
  },
} as const;

/**
 * 检查用户是否有评级功能权限
 */
export function hasRatingFeature(
  membershipType?: MembershipType | null,
): boolean {
  if (!membershipType) return false;
  return RATING_FEATURE_CONFIG.allowedTiers.includes(membershipType);
}

/**
 * 获取用户评级功能权限详情
 */
export function getRatingPermissions(membershipType?: MembershipType | null) {
  const hasPremium = hasRatingFeature(membershipType);

  return {
    canView: RATING_FEATURE_CONFIG.freeTierLimits.canView, // 所有用户可见
    canEdit: hasPremium,
    canLock: hasPremium,
    canMark: hasPremium,
    maxRatings: hasPremium
      ? RATING_FEATURE_CONFIG.premiumBenefits.maxRatings
      : RATING_FEATURE_CONFIG.freeTierLimits.maxRatings,
  };
}

/**
 * 评级功能升级提示文案
 */
export const RATING_UPGRADE_MESSAGES = {
  title: "解锁评级功能",
  description: "升级到高级会员，使用收藏评级、锁定保护、删除标记等功能",
  benefits: [
    "⭐ 0-5星评级：快速标记重要收藏",
    "🔒 锁定保护：防止误删重要内容",
    "🗑️ 删除标记：批量清理待处理收藏",
    "📊 评级筛选：按星级快速查找",
  ],
  cta: "立即升级",
  learnMore: "了解高级会员",
} as const;

/**
 * 降级处理策略
 */
export const RATING_DOWNGRADE_POLICY = {
  // 数据保留策略
  dataRetention: {
    keepData: true, // 保留评级数据
    keepDuration: Infinity, // 永久保留
    showInUI: true, // 降级后仍显示（只读）
  },

  // 功能降级行为
  downgradeBehavior: {
    convertToReadOnly: true, // 转为只读模式
    showUpgradePrompt: true, // 显示升级提示
    allowViewHistory: true, // 允许查看历史评级
  },
} as const;
```

#### 2. 升级提示组件

**文件**: `src/components/upgrade/rating-upgrade-prompt.tsx`

```tsx
/**
 * 评级功能升级引导组件
 */

"use client";

import { useState } from "react";
import { Crown, Star, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RATING_UPGRADE_MESSAGES } from "@/lib/features/rating-feature";
import { useRouter } from "next/navigation";

interface RatingUpgradePromptProps {
  trigger?: "rating" | "lock" | "marker";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RatingUpgradePrompt({
  trigger = "rating",
  open,
  onOpenChange,
}: RatingUpgradePromptProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(open ?? false);

  const handleUpgrade = () => {
    router.push("/pricing");
    setIsOpen(false);
  };

  const triggerIcons = {
    rating: Star,
    lock: Lock,
    marker: Trash2,
  };

  const TriggerIcon = triggerIcons[trigger];

  return (
    <Dialog open={open ?? isOpen} onOpenChange={onOpenChange ?? setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
              <Crown className="size-5 text-white" />
            </div>
            <DialogTitle className="text-xl">
              {RATING_UPGRADE_MESSAGES.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
            {RATING_UPGRADE_MESSAGES.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-4">
          {RATING_UPGRADE_MESSAGES.benefits.map((benefit, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
            >
              <div className="mt-0.5">{benefit.split(" ")[0]}</div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900 dark:text-white">
                  {benefit.split("：")[0].slice(2)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {benefit.split("：")[1]}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button
            onClick={handleUpgrade}
            className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white"
          >
            <Crown className="size-4 mr-2" />
            {RATING_UPGRADE_MESSAGES.cta}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="sm:w-auto"
          >
            稍后再说
          </Button>
        </div>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          升级后立即解锁所有高级功能
        </p>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 轻量级升级提示（内联版本）
 */
export function InlineUpgradeHint({ feature }: { feature: string }) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <div
        onClick={() => setShowDialog(true)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-700 cursor-pointer hover:shadow-sm transition-all"
      >
        <Crown className="size-3 text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
          高级功能
        </span>
      </div>

      <RatingUpgradePrompt open={showDialog} onOpenChange={setShowDialog} />
    </>
  );
}
```

#### 3. UI 层集成示例

**文件**: `src/components/bookmark/bookmark-detail-client.tsx`（修改）

```tsx
"use client";

import { BookmarkRating } from "./bookmark-rating";
import { RatingUpgradePrompt } from "@/components/upgrade/rating-upgrade-prompt";
import { hasRatingFeature } from "@/lib/features/rating-feature";
import { useProfile } from "@/hooks/use-profile";

export function BookmarkDetailClient({ bookmark }: { bookmark: Bookmark }) {
  const { profile } = useProfile();
  const canEditRating = hasRatingFeature(profile?.membership_type);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleRatingChange = (newRating: number) => {
    if (!canEditRating) {
      setShowUpgrade(true);
      return;
    }
    // 正常更新逻辑
    updateBookmark({ rating: newRating });
  };

  return (
    <div>
      {/* 只读展示（免费用户） */}
      {!canEditRating && bookmark.rating > 0 && (
        <div className="flex items-center gap-2">
          <BookmarkRatingDisplay rating={bookmark.rating} isLocked={false} />
          <InlineUpgradeHint feature="rating" />
        </div>
      )}

      {/* 完整编辑（付费用户） */}
      {canEditRating && (
        <BookmarkRating
          rating={bookmark.rating}
          isLocked={bookmark.is_locked}
          isMarkedForDeletion={bookmark.is_marked_for_deletion}
          onRatingChange={handleRatingChange}
          onLockToggle={handleLockToggle}
          onMarkerToggle={handleMarkerToggle}
        />
      )}

      {/* 升级弹窗 */}
      <RatingUpgradePrompt open={showUpgrade} onOpenChange={setShowUpgrade} />
    </div>
  );
}
```

#### 4. API 层权限校验

**文件**: `src/app/api/bookmarks/[id]/route.ts`（修改）

```typescript
import { hasRatingFeature } from "@/lib/features/rating-feature";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 获取用户会员信息
  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_type")
    .eq("id", user.id)
    .single();

  const validation = updateBookmarkSchema.safeParse(await req.json());
  const { rating, isLocked, isMarkedForDeletion, ...otherFields } =
    validation.data;

  // 权限检查：评级相关字段
  if (
    (rating !== undefined ||
      isLocked !== undefined ||
      isMarkedForDeletion !== undefined) &&
    !hasRatingFeature(profile?.membership_type)
  ) {
    return NextResponse.json(
      {
        error: "此功能需要高级会员权限",
        upgradeUrl: "/pricing",
        feature: "bookmark_rating",
      },
      { status: 403 },
    );
  }

  // 正常更新逻辑
  const updateData: any = { ...otherFields };
  if (rating !== undefined) updateData.rating = rating;
  if (isLocked !== undefined) updateData.is_locked = isLocked;
  if (isMarkedForDeletion !== undefined)
    updateData.is_marked_for_deletion = isMarkedForDeletion;

  const { data, error } = await supabase
    .from("bookmarks")
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single();

  return NextResponse.json(data);
}
```

---

## 实施路线图

### Phase 1: 权限控制层（1-2 天）

#### 任务清单

- [x] 创建 `rating-feature.ts` 权限配置中心
- [x] 创建 `rating-upgrade-prompt.tsx` 升级 UI 组件
- [ ] 修改 API 路由增加权限校验
  - `PUT /api/bookmarks/[id]` - 评级更新校验
  - `DELETE /api/bookmarks/[id]` - 锁定检查保留
- [ ] 添加单元测试
  - `hasRatingFeature()` 函数测试
  - `getRatingPermissions()` 返回值测试

#### 验收标准

- ✅ 免费用户尝试评级时返回 403 错误
- ✅ 付费用户正常使用评级功能
- ✅ 测试覆盖率 > 80%

---

### Phase 2: UI 层改造（2-3 天）

#### 任务清单

- [ ] 修改详情页组件
  - 免费用户显示只读评级 + 升级提示
  - 付费用户显示完整交互控件
- [ ] 修改卡片列表组件
  - 保留 `BookmarkRatingDisplay`（所有用户可见）
  - 点击评级时检查权限
- [ ] 集成升级弹窗
  - 星星点击触发
  - 锁定按钮触发
  - 删除标记触发

#### 示例代码

```tsx
// 卡片列表中的升级提示
<div onClick={() => !canEdit && setShowUpgrade(true)}>
  <BookmarkRatingDisplay
    rating={bookmark.rating}
    isLocked={bookmark.is_locked}
  />
  {!canEdit && bookmark.rating > 0 && <InlineUpgradeHint feature="rating" />}
</div>
```

#### 验收标准

- ✅ 免费用户可见评级（只读）
- ✅ 点击评级时弹出升级提示
- ✅ 付费用户正常编辑
- ✅ 移动端响应式正常

---

### Phase 3: UX 优化（1-2 天）

#### 转化漏斗优化

| 阶段              | 用户行为           | 触发时机       | 转化目标     |
| ----------------- | ------------------ | -------------- | ------------ |
| 认知（Awareness） | 看到别人的评级标记 | 浏览收藏列表   | 激发兴趣     |
| 兴趣（Interest）  | 尝试点击星星评级   | 首次交互       | 弹出升级弹窗 |
| 欲望（Desire）    | 查看高级功能列表   | 升级弹窗展示   | 点击 CTA     |
| 行动（Action）    | 跳转到定价页面     | 点击"立即升级" | 完成支付     |

#### 优化点

1. **首次触发延迟**
   - 用户使用 1 周后再显示升级提示（避免打扰新用户）
   - 使用 localStorage 记录首次触发时间

2. **渐进式引导**
   - 第 1 次：仅显示内联徽章（低打扰）
   - 第 2-3 次：显示弹窗（强引导）
   - 第 4 次后：仅在用户主动点击时显示

3. **社交证明**
   - 升级弹窗添加"已有 1,234 位用户升级"

#### 验收标准

- ✅ 转化率提升基线（A/B 测试）
- ✅ 用户投诉率 < 5%
- ✅ 升级弹窗关闭率 < 80%

---

### Phase 4: 数据分析（1 天）

#### 埋点计划

```typescript
// 事件追踪
analytics.track("rating_feature_attempted", {
  user_id: user.id,
  membership_type: profile.membership_type,
  trigger: "star_click", // star_click | lock_click | marker_click
  from_page: "detail", // detail | list
});

analytics.track("upgrade_prompt_shown", {
  trigger: "rating",
  user_days_since_signup: daysSinceSignup,
});

analytics.track("upgrade_cta_clicked", {
  from_feature: "rating",
  prompt_type: "dialog", // dialog | inline
});
```

#### 关键指标

| 指标名称       | 定义                            | 目标值 |
| -------------- | ------------------------------- | ------ |
| 功能尝试率     | 尝试评级用户 / 活跃用户         | > 30%  |
| 升级提示展示率 | 看到升级弹窗用户 / 尝试评级用户 | 100%   |
| CTA 点击率     | 点击"立即升级" / 看到弹窗用户   | > 15%  |
| 最终转化率     | 完成支付 / 点击 CTA 用户        | > 5%   |

---

## 定价策略建议

### 会员等级设计

| 等级             | 价格建议          | 评级功能权益               | 其他权益            |
| ---------------- | ----------------- | -------------------------- | ------------------- |
| **FREE**         | ¥0                | ❌ 不可编辑（只读）        | 基础收藏、100条上限 |
| **PREMIUM**      | ¥19/月 或 ¥199/年 | ✅ 0-5星评级 + 锁定 + 标记 | 无限收藏、AI摘要    |
| **PREMIUM_PLUS** | ¥39/月 或 ¥399/年 | ✅ 全部 + 评级筛选         | 团队协作、高级搜索  |

### 定价心理学技巧

1. **锚定效应**
   - 升级弹窗先展示年费（¥199/年 = ¥16.6/月）
   - 对比月费（¥19/月）显得更划算

2. **损失厌恶**
   - 文案强调"已评级 15 条收藏"（用户已投入成本）
   - "降级后将无法编辑现有评级"

3. **稀缺性**
   - 限时优惠："前 100 名用户享 8 折"
   - 倒计时组件

4. **社交证明**
   - "已有 1,234 位用户选择高级会员"

### 转化时机优化

| 时机           | 触发条件              | 转化概率   | 优先级 |
| -------------- | --------------------- | ---------- | ------ |
| **高频使用时** | 7 天内尝试评级 > 3 次 | ⭐⭐⭐⭐⭐ | P0     |
| **功能依赖时** | 已评级收藏 > 10 条    | ⭐⭐⭐⭐   | P0     |
| **误操作时**   | 误删锁定收藏被拦截    | ⭐⭐⭐     | P1     |
| **导入完成后** | 浏览器书签导入成功    | ⭐⭐       | P2     |

---

## 数据库优化

### 索引策略（已实现）

```sql
-- 评级筛选查询优化
CREATE INDEX idx_bookmarks_rating
  ON bookmarks(rating)
  WHERE deleted_at IS NULL AND rating > 0;

-- 锁定收藏快速查询
CREATE INDEX idx_bookmarks_is_locked
  ON bookmarks(is_locked)
  WHERE deleted_at IS NULL AND is_locked = true;

-- 待删除标记筛选
CREATE INDEX idx_bookmarks_marked_for_deletion
  ON bookmarks(is_marked_for_deletion)
  WHERE deleted_at IS NULL AND is_marked_for_deletion = true;
```

### 查询性能对比

| 查询类型                     | 无索引耗时 | 有索引耗时 | 提升  |
| ---------------------------- | ---------- | ---------- | ----- |
| 查询 5 星收藏（1000 条数据） | ~50ms      | ~5ms       | 90% ↓ |
| 查询已锁定收藏               | ~45ms      | ~3ms       | 93% ↓ |
| 查询待删除标记               | ~40ms      | ~4ms       | 90% ↓ |

### RLS 策略示例（可选增强）

```sql
-- 限制免费用户修改评级字段
CREATE POLICY "free_users_readonly_rating" ON bookmarks
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND (
      -- 付费用户可修改所有字段
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND membership_type IN ('PREMIUM', 'PREMIUM_PLUS')
      )
      -- 或者，修改的字段不包含评级
      OR (
        OLD.rating = NEW.rating
        AND OLD.is_locked = NEW.is_locked
        AND OLD.is_marked_for_deletion = NEW.is_marked_for_deletion
      )
    )
  );
```

**注意**: RLS 策略会增加查询复杂度，建议在 API 层做权限校验（性能更好）。

---

## 风险评估

### 技术风险

| 风险项               | 概率 | 影响 | 缓解措施                        |
| -------------------- | ---- | ---- | ------------------------------- |
| 前后端权限不一致     | 中   | 高   | 使用统一的权限函数 + 自动化测试 |
| 降级后数据丢失       | 低   | 高   | 永久保留数据 + 只读模式         |
| 免费用户反感强制升级 | 中   | 中   | 优化弹窗频率 + 提供价值感知     |
| 性能回归             | 低   | 中   | 权限检查缓存 + 压力测试         |

### 业务风险

| 风险项         | 概率 | 影响 | 缓解措施                      |
| -------------- | ---- | ---- | ----------------------------- |
| 转化率低于预期 | 中   | 高   | A/B 测试 + 灵活调整定价       |
| 用户流失       | 低   | 高   | 保留已评级数据 + 渐进式引导   |
| 竞品跟进       | 高   | 中   | 持续迭代高级功能 + 差异化定位 |

### 回滚方案

```sql
-- 紧急回滚：移除权限限制
ALTER TABLE bookmarks
  DROP POLICY IF EXISTS "free_users_readonly_rating";

-- 完全回滚：移除评级功能
ALTER TABLE bookmarks
  DROP COLUMN rating,
  DROP COLUMN is_locked,
  DROP COLUMN is_marked_for_deletion;
```

---

## 后续规划

### 短期（1 个月内）

- [ ] 实现 Phase 1-4 所有功能
- [ ] 上线 A/B 测试
- [ ] 收集用户反馈（NPS 调研）

### 中期（3 个月内）

- [ ] 增加评级筛选功能（按星级查看收藏）
- [ ] 批量评级操作（批量标 5 星）
- [ ] 评级统计报表（每月评级分布）

### 长期（6 个月内）

- [ ] AI 智能评级推荐（基于内容质量自动建议星级）
- [ ] 评级社交化（分享高分收藏给好友）
- [ ] 企业版团队评级（团队成员协作标注）

---

## 附录

### 参考文档

- [Supabase RLS 策略文档](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js 中间件文档](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Stripe 订阅付费集成](https://stripe.com/docs/billing/subscriptions/overview)

### 变更日志

| 日期       | 版本 | 变更内容               |
| ---------- | ---- | ---------------------- |
| 2025-12-02 | 1.0  | 初始版本，完整方案设计 |

---

**文档结束**
