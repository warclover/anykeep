# 智能蓝图系统 v2 集成计划

## 目标

将已完成的 14 个增强蓝图（EnhancedBlueprintEngine）集成到生产环境，实现：
- v2 API 端点暴露新蓝图能力
- 蓝图选择器 UI（14 蓝图 + 权限标识 + 分类筛选）
- Briefing 向导 UI（问答收集 + 动态表单）
- 大纲编辑器 UI（预览/编辑/版本管理）
- 渐进式迁移策略（新旧系统并存）

---

## 阶段 1: v2 API 端点 (P0)

### 1.1 蓝图列表 API

**文件**: `src/app/api/knowledge-studio/v2/blueprints/route.ts`

```typescript
// GET /api/knowledge-studio/v2/blueprints
// 返回所有蓝图及用户访问权限

interface BlueprintListResponse {
  blueprints: Array<{
    blueprintId: string;
    displayName: string;
    description: string;
    icon: string;
    tier: 'free' | 'pro' | 'enterprise';
    category: 'geek' | 'creator' | 'business' | 'professional';
    isNew?: boolean;
    tags?: string[];
    canAccess: boolean;
    upgradeMessage?: string;
  }>;
  userTier: 'free' | 'pro' | 'enterprise';
}
```

### 1.2 Briefing 问题 API

**文件**: `src/app/api/knowledge-studio/v2/briefing/route.ts`

```typescript
// POST /api/knowledge-studio/v2/briefing
// 获取指定蓝图的 Briefing 问题

interface BriefingRequest {
  blueprintId: string;
  materials: Array<{ bookmarkId: string; title: string; content: string }>;
}

interface BriefingResponse {
  enabled: boolean;
  questions: BriefingQuestion[];
  skipAllowed: boolean;
}
```

### 1.3 大纲预览 API

**文件**: `src/app/api/knowledge-studio/v2/outline/route.ts`

```typescript
// POST /api/knowledge-studio/v2/outline
// SSE 流式返回大纲预览

interface OutlineRequest {
  blueprintId: string;
  materials: MaterialInput[];
  briefingContext?: BriefingContext;
  targetLength: 'short' | 'medium' | 'long';
}

// SSE 响应: progress | outline | error | done
```

### 1.4 v2 生成 API

**文件**: `src/app/api/knowledge-studio/v2/generate/route.ts`

```typescript
// POST /api/knowledge-studio/v2/generate
// SSE 流式生成，支持大纲优先模式

interface GenerateV2Request {
  blueprintId: string;
  materials: MaterialInput[];
  briefingContext?: BriefingContext;
  outline?: BlueprintOutline;  // 可选：用户确认的大纲
  targetLength: 'short' | 'medium' | 'long';
  customPrompt?: string;
}

// SSE 响应: progress | content | structured_output | done | error
```

---

## 阶段 2: UI 组件 (P0)

### 2.1 蓝图选择器

**文件**: `src/components/knowledge-studio/v2/blueprint-selector.tsx`

**功能**:
- 展示 14 个蓝图卡片
- 分类 Tab（全部 / 极客 / 创作者 / 商业 / 专业）
- 权限标识（Pro 锁定徽章）
- 搜索/过滤
- 响应式网格布局

**复用组件**:
- `Card`, `Badge`, `Tabs` from shadcn/ui
- 参考 `bookmark-card.tsx` 卡片设计

### 2.2 Briefing 向导

**文件**: `src/components/knowledge-studio/v2/briefing-wizard.tsx`

**功能**:
- 步骤指示器（1/3 → 2/3 → 3/3）
- 问题类型渲染：
  - `single_choice`: RadioGroup
  - `multi_choice`: Checkbox 组
  - `text`: Textarea
  - `range`: Slider
- 跳过按钮（快速模式）
- 答案验证
- 上下文预览

### 2.3 大纲编辑器

**文件**: `src/components/knowledge-studio/v2/outline-editor.tsx`

**功能**:
- 树形大纲展示
- 拖拽排序（dnd-kit）
- 节点编辑（标题/描述）
- 添加/删除节点
- 版本快照对比
- 确认/重新生成按钮

### 2.4 结构化输出查看器

**文件**: `src/components/knowledge-studio/v2/structured-output-viewer.tsx`

**功能**:
- 根据输出类型渲染：
  - `feature_matrix`: 表格组件
  - `swot`: 四象限布局
  - `script_timeline`: 时间线组件
  - `sections`: 折叠面板
  - `checklist`: 任务列表
  - `markdown`: Markdown 渲染

---

## 阶段 3: 页面路由 (P1)

### 3.1 v2 主页面

**文件**: `src/app/(main)/knowledge-studio/v2/page.tsx`

```
/knowledge-studio/v2
├── 蓝图选择器 (BlueprintSelector)
├── 素材选择器 (BookmarkPicker) - 复用现有组件
└── 生成按钮
```

### 3.2 蓝图工作流页面

**文件**: `src/app/(main)/knowledge-studio/v2/[blueprintId]/page.tsx`

```
/knowledge-studio/v2/[blueprintId]
├── 蓝图信息头部
├── Briefing 向导 (可选)
├── 大纲编辑器 (可选)
├── 生成进度
└── 结构化输出查看器
```

---

## 阶段 4: 渐进式迁移 (P2)

### 4.1 Feature Flag

```typescript
// src/lib/feature-flags.ts
export const ENABLE_BLUEPRINT_V2 = process.env.ENABLE_BLUEPRINT_V2 === 'true';
```

### 4.2 入口策略

1. **侧边栏**: 新增 "知识工坊 Beta" 入口
2. **原页面**: 添加 "试用新版" 引导横幅
3. **Pro 用户**: 自动启用 v2 作为默认

### 4.3 数据迁移

- `synthesis_reports` 表添加 `blueprint_version` 字段
- 新报告标记为 `v2`，旧报告保持 `v1`
- 两个版本报告在历史列表中统一展示

---

## 实现优先级

| 优先级 | 任务 | 预计工作量 |
|--------|------|-----------|
| P0-1 | 蓝图列表 API | 1h |
| P0-2 | v2 生成 API | 3h |
| P0-3 | 蓝图选择器 UI | 2h |
| P0-4 | 大纲编辑器 UI | 3h |
| P1-1 | Briefing 向导 UI | 2h |
| P1-2 | 结构化输出查看器 | 2h |
| P1-3 | v2 页面路由 | 2h |
| P2-1 | 渐进式迁移 | 2h |

**总计**: ~17h

---

## 关键文件参考

### 现有代码复用

| 组件 | 路径 | 复用点 |
|------|------|--------|
| SSE 流式响应 | `api/knowledge-studio/generate/route.ts` | TextEncoder + ReadableStream |
| 书签选择器 | `components/knowledge-studio/bookmark-picker.tsx` | 素材选择 |
| 配额管理 | `lib/knowledge-studio/quota/` | 计费逻辑 |
| 蓝图注册表 | `lib/knowledge-studio/blueprint/blueprint-registry.ts` | 蓝图发现 |

### 新蓝图系统核心

| 模块 | 路径 |
|------|------|
| 增强引擎基类 | `blueprint/enhanced-blueprint-engine.ts` |
| 注册表 | `blueprint/blueprint-registry.ts` |
| Briefing 注入 | `blueprint/briefing-injector.ts` |
| 大纲生成器 | `blueprint/outline-generator.ts` |
| 内容生成器 | `blueprint/content-generator.ts` |
| 结构化输出 | `blueprint/structured-output/` |

---

## 验收标准

1. **API 端点**
   - [ ] 4 个 v2 API 端点正常工作
   - [ ] SSE 流式响应正确
   - [ ] 权限检查正确（tier-based）

2. **UI 组件**
   - [ ] 蓝图选择器展示 14 个蓝图
   - [ ] Briefing 向导支持所有问题类型
   - [ ] 大纲编辑器支持编辑/拖拽
   - [ ] 结构化输出正确渲染

3. **集成测试**
   - [ ] 完整工作流：选择蓝图 → Briefing → 大纲 → 生成 → 输出
   - [ ] Pro 蓝图访问控制正确
   - [ ] 错误处理和回退机制

4. **迁移**
   - [ ] v1/v2 系统并存无冲突
   - [ ] Feature Flag 控制正常
   - [ ] 历史报告兼容展示
