# 目录命名规范

> **版本**: 1.0.0
> **创建日期**: 2025-12-24
> **状态**: 生效中

## 概述

本文档定义 AnyKeep 项目的目录命名规范，确保代码库结构一致性和可维护性。

---

## 核心原则

### 1. 单数 vs 复数规则

| 类型              | 命名规则 | 示例                                               |
| ----------------- | -------- | -------------------------------------------------- |
| **模块目录**      | 单数     | `folder`, `bookmark`, `classification`, `ai-agent` |
| **服务/层级集合** | 复数     | `services`, `repositories`, `strategies`           |
| **工具/辅助集合** | 复数     | `utils`, `helpers`, `types`, `constants`           |
| **功能性子目录**  | 单数     | `config`, `router`, `client`, `core`               |

### 2. 命名格式

- **目录名**: 使用 `kebab-case`（小写 + 连字符）
- **示例**: `ai-skills`, `browser-bookmark`, `folder-evolution`
- **禁止**: `aiSkills`, `browserBookmark`（camelCase）

### 3. 特殊目录

| 目录     | 命名        | 说明                |
| -------- | ----------- | ------------------- |
| 测试目录 | `__tests__` | Jest 标准命名       |
| 类型定义 | `types`     | TypeScript 类型集合 |
| 配置     | `config`    | 配置文件集合        |
| 文档     | `docs`      | 文档集合            |

---

## 标准目录结构

### 模块级别 (`src/lib/<module>/`)

```
src/lib/<module>/
├── __tests__/           # 测试文件
├── config/              # 配置定义
├── types/               # 类型定义
├── constants/           # 常量定义
├── utils/               # 工具函数
├── services/            # 业务服务层
├── repositories/        # 数据访问层
├── strategies/          # 策略实现
├── prompts/             # AI 提示词
├── client/              # 客户端适配
├── router/              # 路由逻辑
├── docs/                # 模块文档
└── index.ts             # 模块导出
```

### 组件级别 (`src/components/`)

```
src/components/
├── ui/                  # 基础 UI 组件
├── <feature>/           # 功能组件（单数）
│   ├── <component>.tsx
│   ├── hooks/           # 组件专用 hooks
│   └── index.ts
```

---

## 当前目录审计

### ✅ 已符合规范

| 目录                                | 类型     | 命名    |
| ----------------------------------- | -------- | ------- |
| `src/lib/classification`            | 模块     | ✅ 单数 |
| `src/lib/folder`                    | 模块     | ✅ 单数 |
| `src/lib/ai-skills`                 | 模块     | ✅ 单数 |
| `src/lib/classification/services`   | 服务集合 | ✅ 复数 |
| `src/lib/classification/strategies` | 策略集合 | ✅ 复数 |
| `src/lib/classification/config`     | 配置     | ✅ 单数 |

### ⚠️ 待清理（Phase 1 Task 1.3）

| 目录                          | 问题                 | 计划                   |
| ----------------------------- | -------------------- | ---------------------- |
| ~~`src/lib/folders`~~         | 已弃用重复目录       | ✅ 已删除 (2025-12-24) |
| `src/lib/folder-operations`   | 待合并到 folder 模块 | Phase 1                |
| `src/lib/folder-organization` | 待合并到 folder 模块 | Phase 1                |

---

## 迁移指南

### 重命名目录时

1. 创建新目录
2. 移动所有文件
3. 更新所有导入路径（使用 IDE 重构功能）
4. 保留旧目录作为兼容层（可选）
5. 运行测试验证
6. 删除旧目录

### 导入路径更新脚本

```bash
# 使用 sed 批量替换导入路径
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's|@/lib/old-path|@/lib/new-path|g'
```

---

## 检查清单

新建目录时，请确认：

- [ ] 模块目录使用单数命名
- [ ] 集合目录使用复数命名
- [ ] 使用 kebab-case 格式
- [ ] 有对应的 index.ts 导出
- [ ] 符合标准目录结构

---

## 变更记录

| 日期       | 版本  | 变更                        |
| ---------- | ----- | --------------------------- |
| 2025-12-24 | 1.0.0 | 初始版本，删除 folders 目录 |
