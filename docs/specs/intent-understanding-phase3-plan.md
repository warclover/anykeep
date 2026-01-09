# 意图理解增强 Phase 3 - 实施计划

> **版本**: v1.0.0
> **日期**: 2026-01-09
> **前置依赖**: Phase 2 已完成 (commit: 3a573817)
> **状态**: ✅ 已完成

---

## 一、目标概述

### 待优化用例 (8 个)

| 类别      | 用例                       | 当前分类            | 预期分类         | 问题分析               | 状态 |
| --------- | -------------------------- | ------------------- | ---------------- | ---------------------- | ---- |
| 搜索      | "最近收藏的视频在哪"       | query:search (部分) | query:search     | 时间词+媒体类型+疑问词 | ✅   |
| Synthesis | "把这些内容整合成一篇文章" | -                   | create:synthesis | "整合成一篇" 模式      | ✅   |
| Synthesis | "生成一篇综合报告"         | analyze:report      | create:synthesis | "报告"触发 analyze     | ✅   |
| 整理      | "给这些打上标签"           | -                   | organize:tag     | 标签操作识别           | ✅   |
| 整理      | "移到学习文件夹"           | -                   | organize:move    | 移动操作识别           | ✅   |
| 导出      | "备份我的收藏"             | -                   | create:share     | 备份 = 导出            | ✅   |
| 闲聊      | "你能做什么"               | chitchat:general    | chitchat:help    | help 意图识别          | ✅   |

### 预期成果

- P0 核心用例通过率: 当前 ~85% → 目标 ≥95% ✅
- 新增规则数: 8 条 ✅
- 零回归保证 ✅

---

## 二、规则设计

### 2.1 搜索增强

```typescript
// 规则 P3-S1: 媒体类型 + 疑问词查询
// "最近收藏的视频在哪"、"那个文章去哪了"
{
  pattern: /(收藏|保存).{0,5}(的)?.{0,5}(视频|文章|图片|链接|笔记).{0,5}(在哪|去哪|哪里|哪儿)/,
  type: "query",
  subType: "search",
  weight: 89,
}
```

### 2.2 Synthesis 边界优化

```typescript
// 规则 P3-Y1: "整合成一篇" 模式
// "把这些内容整合成一篇文章"
{
  pattern: /(把)?.{0,10}(整合|合并|综合|融合).{0,3}(成|为).{0,3}(一篇|一份)/,
  type: "create",
  subType: "synthesis",
  weight: 96,
}

// 规则 P3-Y2: "生成一篇" + 综合性内容
// "生成一篇综合报告" (优先于 analyze:report)
{
  pattern: /(生成|写|做).{0,3}(一篇|一份).{0,5}(综合|汇总|整体)/,
  type: "create",
  subType: "synthesis",
  weight: 97,
}
```

### 2.3 整理操作增强

```typescript
// 规则 P3-O1: 标签操作
// "给这些打上标签"、"添加标签"、"贴个标签"
{
  pattern: /(给|为|帮).{0,5}(打上|添加|贴|加上).{0,3}(标签|tag)/i,
  type: "organize",
  subType: "tag",
  weight: 85,
}

// 规则 P3-O2: 移动操作
// "移到学习文件夹"、"放到工作目录"
{
  pattern: /(移到|移动到|放到|挪到|转到).{0,10}(文件夹|目录|分类)/,
  type: "organize",
  subType: "move",
  weight: 86,
}
```

### 2.4 导出增强

```typescript
// 规则 P3-E1: 备份信号
// "备份我的收藏" = 导出
{
  pattern: /备份.{0,5}(我的|全部|所有)?.{0,5}(收藏|书签|内容)/,
  type: "create",
  subType: "share",
  weight: 84,
}
```

### 2.5 闲聊帮助增强

```typescript
// 规则 P3-C1: 能力询问
// "你能做什么"、"你会什么"、"有什么功能"
{
  pattern: /(你|你们)(能|会|可以)(做|干)什么|(有|支持)(什么|哪些)(功能|能力)/,
  type: "chitchat",
  subType: "help",
  weight: 82,
}
```

---

## 三、消歧规则

```typescript
// P3-D1: create:synthesis vs analyze:report
// "综合报告" → synthesis 优先
{
  id: "synthesis-vs-report-comprehensive",
  conflicts: ["create", "analyze"],
  pattern: /(综合|汇总|整体).{0,5}报告/,
  winner: "create",
  priority: 108,
  reason: "综合性报告 → synthesis 而非 analyze:report",
}
```

---

## 四、实施步骤

### Step 1: 搜索 + Synthesis 规则 (3 条)

- [x] 添加规则 P3-S1、P3-Y1、P3-Y2
- [x] 更新 P0 测试用例
- [x] 运行测试验证

### Step 2: 整理 + 导出规则 (3 条)

- [x] 添加规则 P3-O1、P3-O2、P3-E1
- [x] 更新 P0 测试用例
- [x] 运行测试验证

### Step 3: 闲聊 + 消歧规则 (2 条)

- [x] 添加规则 P3-C1
- [x] 添加消歧规则 P3-D1
- [x] 更新 P0 测试用例
- [x] 运行测试验证

### Step 4: 回归测试

- [x] 运行完整 Router 测试套件
- [x] 确保 Phase 1+2 用例无回归

---

## 五、验收标准

### 功能验收

- [x] 所有 8 个待优化用例正确分类
- [x] P0 核心用例通过率 ≥95%

### 回归验收

- [x] Phase 1+2 的测试无回归
- [x] Router 模块 499 测试全部通过 ✅

---

**审批签名**: ******\_\_\_******

**审批日期**: ******\_\_\_******
