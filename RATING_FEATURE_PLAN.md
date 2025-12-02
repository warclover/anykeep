# 收藏评级与锁定功能实现计划

## 功能概述

为收藏系统添加评级（1-5星）和锁定功能,提升用户对重要内容的管理体验。

---

## Stage 1: 数据库迁移

**Goal**: 添加评级和锁定字段到 bookmarks 表

**Success Criteria**:

- ✅ bookmarks 表新增 `rating` 字段（INTEGER, 0-5）
- ✅ bookmarks 表新增 `is_locked` 字段（BOOLEAN）
- ✅ 迁移文件正确执行
- ✅ RLS 策略允许用户更新这些字段

**Tasks**:

1. 创建迁移文件 `supabase/migrations/xxxxxxx_add_rating_and_lock.sql`
2. 添加 `rating` 字段（默认 0，约束 0-5）
3. 添加 `is_locked` 字段（默认 false）
4. 创建索引（可选,用于筛选高评级内容）
5. 验证 RLS 策略兼容性

**Status**: Not Started

---

## Stage 2: TypeScript 类型定义更新

**Goal**: 更新类型定义以支持新字段

**Success Criteria**:

- ✅ `Bookmark` 类型包含 `rating` 和 `is_locked`
- ✅ 无 TypeScript 编译错误

**Tasks**:

1. 运行 `npm run supabase:gen:types` 自动生成类型
2. 验证 `src/types/supabase.ts` 包含新字段
3. 检查现有组件无类型错误

**Status**: Not Started

---

## Stage 3: 评级UI组件开发

**Goal**: 创建可交互的评级组件

**Success Criteria**:

- ✅ 用户可以点击星星设置评级（1-5星）
- ✅ 锁定图标可切换锁定状态
- ✅ 锁定时删除按钮禁用
- ✅ 组件支持受控模式（接收 value 和 onChange）
- ✅ 响应式设计（移动端友好）

**Tasks**:

1. 创建 `src/components/bookmark/bookmark-rating.tsx`
   - 接收 props: `rating`, `isLocked`, `onRatingChange`, `onLockChange`, `onDelete`
   - 使用 lucide-react 图标：`Star`, `Lock`, `Unlock`, `Trash2`
   - 星星支持悬停预览（hover 时高亮）
   - 锁定时显示视觉反馈（删除按钮禁用 + tooltip）

2. 组件设计规格：

   ```
   [🗑️] [⭐⭐⭐⭐⭐] [🔒]
    删    1-5星评级    锁定

   - 垃圾箱：红色,锁定时灰色禁用
   - 星星：未选中灰色,选中黄色,可悬停
   - 锁定：未锁定显示开锁图标,锁定显示锁图标
   ```

3. 交互逻辑：
   - 点击星星：设置对应评级（1-5）
   - 再次点击当前评级：取消评级（设为 0）
   - 点击锁定：切换锁定状态
   - 点击删除：锁定时禁用 + 提示

**Status**: Not Started

---

## Stage 4: API 接口更新

**Goal**: 支持评级和锁定的 CRUD 操作

**Success Criteria**:

- ✅ PUT /api/bookmarks/:id 支持更新 rating 和 isLocked
- ✅ DELETE /api/bookmarks/:id 检查锁定状态（锁定时返回 403）
- ✅ 所有 API 测试通过

**Tasks**:

1. 更新 `src/app/api/bookmarks/[id]/route.ts`
   - PUT: 允许更新 `rating` 和 `is_locked` 字段
   - DELETE: 添加锁定检查逻辑

2. 错误处理：
   ```typescript
   // 删除前检查
   if (bookmark.is_locked) {
     return NextResponse.json(
       { error: { message: "此收藏已锁定，无法删除" } },
       { status: 403 },
     );
   }
   ```

**Status**: Not Started

---

## Stage 5: 收藏详情页集成

**Goal**: 重构详情页顶部布局并集成评级UI

**Success Criteria**:

- ✅ 缩略图改为自适应高度（对齐右侧四行内容）
- ✅ 元信息拆分为两行
- ✅ 评级UI显示在第4行（文件夹右侧）
- ✅ 用户可以直接评级和锁定
- ✅ 锁定后删除按钮禁用
- ✅ 操作后实时更新UI

**Tasks**:

1. 修改 `src/components/bookmark/bookmark-detail-client.tsx`（第 320-416 行）

   **核心布局重构**:

   ```tsx
   <div className="flex gap-4 md:gap-6 items-start">
     {/* 缩略图 - 自适应高度 */}
     {!isBrowserPlatform && (
       <div className="relative w-20 md:w-32 flex-shrink-0 self-stretch">
         <img
           src={coverImage}
           alt={bookmark.title}
           className="w-full h-full object-cover rounded-lg"
         />
       </div>
     )}

     {/* 右侧四行内容 */}
     <div className="flex-1 min-w-0 flex flex-col gap-2 md:gap-3">
       {/* 第1行：标题 */}
       <h1 className="text-xl md:text-3xl font-bold ...">{bookmark.title}</h1>

       {/* 第2行：AI 标签 */}
       {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
         <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
           {/* AI 标签内容 */}
         </div>
       )}

       {/* 第3行：元信息（来源、作者、时间） */}
       <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-500">
         {/* source_name, author, publish_time, created_at */}
       </div>

       {/* 第4行：文件夹 + 评级UI */}
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
         {/* 左侧：文件夹 */}
         {bookmark.folders && (
           <div className="flex items-center gap-1 text-sm text-blue-600">
             <Folder className="size-4" />
             <span>{bookmark.folders.name}</span>
           </div>
         )}

         {/* 右侧：评级UI */}
         <BookmarkRating
           rating={rating}
           isLocked={isLocked}
           onRatingChange={handleRatingChange}
           onLockToggle={handleLockToggle}
           onDelete={handleDelete}
         />
       </div>
     </div>
   </div>
   ```

2. 实现状态管理：

   ```typescript
   const [rating, setRating] = useState(bookmark.rating || 0);
   const [isLocked, setIsLocked] = useState(bookmark.is_locked || false);

   const handleRatingChange = async (newRating: number) => {
     try {
       const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ rating: newRating }),
       });
       if (res.ok) {
         setRating(newRating);
         toast.success("评级更新成功");
         router.refresh();
       }
     } catch (error) {
       toast.error("评级更新失败");
     }
   };

   const handleLockToggle = async () => {
     try {
       const newLockState = !isLocked;
       const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ isLocked: newLockState }),
       });
       if (res.ok) {
         setIsLocked(newLockState);
         toast.success(newLockState ? "已锁定" : "已解锁");
         router.refresh();
       }
     } catch (error) {
       toast.error("操作失败");
     }
   };
   ```

3. 删除逻辑修改：

   ```typescript
   const handleDelete = async () => {
     if (isLocked) {
       toast.error("此收藏已锁定，无法删除");
       return;
     }

     if (!confirm("确定要删除这条收藏吗？删除后无法恢复。")) {
       return;
     }

     // 原有删除逻辑...
   };
   ```

4. 移除底部删除按钮（第 614-623 行）- 因为评级UI已包含删除功能

**Status**: Not Started

---

## Stage 6: 收藏卡片显示（已确认必需）

**Goal**: 在卡片视图显示评级状态（仅展示，不可编辑）

**Success Criteria**:

- ✅ 卡片上显示星级评分（静态展示）
- ✅ 锁定图标显示在卡片封面右上角
- ✅ 三种视图模式都支持评级显示：card、list、compact

**Tasks**:

1. 修改 `src/components/bookmark/bookmark-card.tsx`

   **Card 视图（默认卡片）**:
   - 在封面图右上角显示锁定图标（如果已锁定）
   - 在 CardContent 的元信息区域（第 497-540 行）添加评级显示

   ```tsx
   {/* 封面图 */}
   <div className="relative aspect-video overflow-hidden rounded-t-lg">
     <img src={coverImage} ... />

     {/* 平台标识 */}
     <div className="absolute top-2 left-2">
       <PlatformBadge ... />
     </div>

     {/* 锁定图标 - 右上角 */}
     {bookmark.is_locked && (
       <div className="absolute top-2 right-2">
         <div className="bg-yellow-500/90 text-white p-1.5 rounded-md">
           <Lock className="size-4" />
         </div>
       </div>
     )}
   </div>

   {/* CardContent 内评级显示 */}
   <CardContent className="pt-0">
     {/* ...现有内容... */}

     {/* 评级显示（在元信息之前） */}
     {bookmark.rating > 0 && (
       <div className="flex items-center gap-1 mb-2">
         {[...Array(5)].map((_, index) => (
           <Star
             key={index}
             className={cn(
               "size-4",
               index < bookmark.rating
                 ? "fill-yellow-400 text-yellow-400"
                 : "text-gray-300"
             )}
           />
         ))}
       </div>
     )}

     {/* 元信息... */}
   </CardContent>
   ```

   **List 视图**:
   - 在右侧元信息区域显示评级星星（第 329-367 行）
   - 锁定图标在桌面端右上角，移动端与操作按钮区域整合

   **Compact 视图（浏览器书签列表）**:
   - 在标题右侧显示小星星图标（如果有评级）
   - 锁定图标在标题行末尾

2. 创建评级显示组件（纯展示）:

   ```tsx
   // src/components/bookmark/bookmark-rating-display.tsx
   export function BookmarkRatingDisplay({
     rating,
     isLocked,
     variant = "default",
   }: {
     rating: number;
     isLocked: boolean;
     variant?: "default" | "compact";
   }) {
     if (rating === 0 && !isLocked) return null;

     return (
       <div className="flex items-center gap-1.5">
         {rating > 0 && (
           <div className="flex items-center gap-0.5">
             {[...Array(5)].map((_, i) => (
               <Star
                 key={i}
                 className={cn(
                   variant === "compact" ? "size-3" : "size-4",
                   i < rating
                     ? "fill-yellow-400 text-yellow-400"
                     : "text-gray-300",
                 )}
               />
             ))}
           </div>
         )}
         {isLocked && (
           <Lock
             className={cn(
               "text-yellow-600",
               variant === "compact" ? "size-3" : "size-4",
             )}
           />
         )}
       </div>
     );
   }
   ```

**Status**: Not Started

---

## UI 布局细节（已确认 ✅）

### 详情页顶部布局方案

**当前布局（第 320-416 行）**:

```
[Card Header]
  [缩略图 64x64]   [标题文本]                    [平台标识]
                   [AI 标签]
                   [来源 · 作者 · 发布时间 · 收藏时间 · 文件夹]
```

**新布局设计（用户确认版）**:

```
[Card Header]
  [自适应      第1行: [标题文本]                           [平台标识]
   高度缩略图]  第2行: [AI 标签]
  （对齐四行）  第3行: [公众号名称][作者][发布时间][收藏时间]
               第4行: [收藏文件夹] [🗑️ ⭐⭐⭐⭐⭐ 🔒]  ← 新增评级UI
```

**关键布局变更**:

1. ✅ 评级UI放在**最下面一行**（第4行）
2. ✅ 评级UI与文件夹信息同行，靠右对齐
3. ✅ 缩略图改为**自适应高度**，对齐右侧四行内容的总高度
4. ✅ 元信息拆分为两行：
   - 第3行：公众号名称、作者、发布时间、收藏时间
   - 第4行：文件夹 + 评级UI
5. ✅ 卡片视图也显示评级（仅展示，不可编辑）

**响应式处理**:

- 移动端：评级UI可能需要换行到独立一行（如果与文件夹挤在一起）
- 桌面端：评级UI与文件夹同行，使用 flex justify-between 布局

---

## 技术细节

### 数据库字段设计

```sql
ALTER TABLE public.bookmarks
ADD COLUMN rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
ADD COLUMN is_locked BOOLEAN DEFAULT false;

CREATE INDEX idx_bookmarks_rating ON public.bookmarks(rating)
  WHERE deleted_at IS NULL AND rating > 0;
```

### API Payload 示例

```typescript
// PUT /api/bookmarks/:id
{
  "rating": 4,        // 0-5
  "isLocked": true    // boolean
}

// Response
{
  "data": {
    "id": 123,
    "rating": 4,
    "is_locked": true,
    ...
  }
}
```

---

## 风险与注意事项

1. **数据迁移**：现有收藏的 rating 默认为 0（未评级），is_locked 默认为 false
2. **RLS 策略**：确保用户只能更新自己的收藏评级
3. **UI 响应式**：评级UI在移动端可能需要调整布局（图标缩小或垂直排列）
4. **删除逻辑**：需要在多处检查锁定状态（详情页、卡片、批量操作）

---

## 实施总结

### ✅ 需求已确认

1. **详情页布局（已明确）**:
   - 缩略图：自适应高度，对齐右侧四行
   - 第1行：标题 + 平台标识
   - 第2行：AI 标签
   - 第3行：公众号名称、作者、发布时间、收藏时间
   - 第4行：文件夹 + 评级UI（🗑️ ⭐⭐⭐⭐⭐ 🔒）

2. **卡片视图（已确认）**:
   - 封面右上角显示锁定图标
   - 元信息区域显示评级星星（仅展示）

### 📅 实施计划

| 阶段        | 任务                             | 预计时间        | 状态      |
| ----------- | -------------------------------- | --------------- | --------- |
| **Stage 1** | 数据库迁移（rating + is_locked） | 15分钟          | ⏳ 待开始 |
| **Stage 2** | TypeScript 类型更新              | 10分钟          | ⏳ 待开始 |
| **Stage 3** | 评级UI组件开发                   | 1小时           | ⏳ 待开始 |
| **Stage 4** | API 接口更新                     | 30分钟          | ⏳ 待开始 |
| **Stage 5** | 详情页布局重构 + 集成            | 1小时           | ⏳ 待开始 |
| **Stage 6** | 卡片视图评级显示                 | 45分钟          | ⏳ 待开始 |
| **总计**    | -                                | **约 3.5 小时** | -         |

### 🚀 下一步

**等待用户最终确认**：

- ✅ 详情页布局方案
- ✅ 卡片视图评级显示
- ✅ 整体实施计划

**确认后立即开始执行 Stage 1-6**
