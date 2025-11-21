[根目录](../CLAUDE.md) > **.spec-workflow**

# Spec-Workflow 模块 - AI 上下文文档

## 模块职责

Spec-Workflow 是一个**规范工作流模板系统**，为项目提供标准化的文档模板，支持：

- 需求文档 (Requirements)
- 设计文档 (Design)
- 任务分解 (Tasks)
- 产品概述 (Product)
- 技术栈说明 (Tech)
- 项目结构 (Structure)

---

## 入口与启动

本模块为**纯模板文件集合**，无需启动服务。

**模板加载优先级**：
1. 优先检查 `user-templates/` 目录下的自定义模板
2. 如无自定义模板，使用 `templates/` 目录下的默认模板

---

## 对外接口

### 模板文件

| 模板文件 | 用途 |
|----------|------|
| `templates/requirements-template.md` | 需求文档模板（用户故事、验收标准） |
| `templates/design-template.md` | 设计文档模板（架构、组件、数据模型） |
| `templates/tasks-template.md` | 任务分解模板（开发任务清单） |
| `templates/product-template.md` | 产品概述模板（愿景、用户、功能） |
| `templates/tech-template.md` | 技术栈模板（语言、框架、工具） |
| `templates/structure-template.md` | 项目结构模板（目录、命名、组织） |

### 模板变量

模板支持以下占位符：
- `{{projectName}}` - 项目名称
- `{{featureName}}` - 功能名称
- `{{date}}` - 当前日期
- `{{author}}` - 文档作者

---

## 关键依赖与配置

本模块为纯静态文件，无外部依赖。

---

## 目录结构

```
.spec-workflow/
├── templates/                    # 默认模板目录
│   ├── requirements-template.md  # 需求文档模板
│   ├── design-template.md        # 设计文档模板
│   ├── tasks-template.md         # 任务分解模板
│   ├── product-template.md       # 产品概述模板
│   ├── tech-template.md          # 技术栈模板
│   └── structure-template.md     # 项目结构模板
├── user-templates/               # 用户自定义模板目录
│   └── README.md                 # 自定义模板使用说明
└── CLAUDE.md                     # 本模块 AI 上下文文档
```

---

## 数据模型

不适用（纯模板文件模块）

---

## 测试与质量

### 模板验证
- 确保所有模板文件为有效的 Markdown 格式
- 检查模板变量占位符语法正确
- 验证模板结构完整性

---

## 常见问题 (FAQ)

### Q: 如何创建自定义模板？

1. 在 `user-templates/` 目录下创建同名文件
2. 例如：创建 `user-templates/requirements-template.md` 会覆盖默认需求模板
3. 自定义模板会被优先加载

### Q: 模板更新后如何保留自定义？

自定义模板存放在 `user-templates/` 目录中，与默认模板分离，不会被覆盖。

---

## 相关文件清单

| 文件路径 | 说明 | 行数 |
|----------|------|------|
| `templates/requirements-template.md` | 需求文档模板 | 51 行 |
| `templates/design-template.md` | 设计文档模板 | 97 行 |
| `templates/tasks-template.md` | 任务分解模板 | 140 行 |
| `templates/product-template.md` | 产品概述模板 | 52 行 |
| `templates/tech-template.md` | 技术栈模板 | 100 行 |
| `templates/structure-template.md` | 项目结构模板 | 146 行 |
| `user-templates/README.md` | 自定义模板说明 | 65 行 |

---

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2025-11-21 | 1.0.0 | 初始化模块 AI 上下文文档 |
