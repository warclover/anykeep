# AnyKeep AI 知识助手 - 完全重构设计方案

> **版本**: 2.0.0
> **创建日期**: 2024-12-22
> **状态**: 待审核
> **对标产品**: YouMind AI 助手
> **设计理念**: 完全重构，不是增量升级

---

## 一、重新定位

### 1.1 为什么要完全重构

**现有 AI 助手的根本问题**：

| 问题         | 现状         | 影响                       |
| ------------ | ------------ | -------------------------- |
| **架构错误** | 纯 RAG 模式  | 只能检索，无法理解用户意图 |
| **能力缺失** | 无法感知数据 | 不知道用户有什么收藏       |
| **价值缺失** | 仅问答       | 无法协助学习、无法执行操作 |
| **体验割裂** | 悬浮按钮入口 | 与主流程脱节               |

**结论**：现有实现是"伪 AI 助手"，需要**完全重构**而非修补。

### 1.2 YouMind 的核心价值（不是功能）

通过实际测试，YouMind AI 助手的核心价值是：

```
┌─────────────────────────────────────────────────────────────────────┐
│                     YouMind 的 AI 价值定位                          │
│                                                                     │
│   不是"对话机器人"，而是"知识工作的 AI 协作者"                      │
│                                                                     │
│   核心价值链：                                                       │
│   收集 → 理解 → 整理 → 创作 → 学习                                   │
│     ↑       ↑       ↑       ↑       ↑                               │
│    AI     AI      AI      AI      AI                                │
│   辅助   深度    智能    辅助    问答                                │
│   收藏   阅读    分类    写作    巩固                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 AnyKeep AI 助手的重新定位

```
┌─────────────────────────────────────────────────────────────────────┐
│                  AnyKeep AI 知识助手 定位                           │
│                                                                     │
│   使命：让收藏的内容真正被理解、被整理、被学习                       │
│                                                                     │
│   三大角色：                                                         │
│                                                                     │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐            │
│   │  📚 阅读助手   │ │  🗂️ 整理专家   │ │  🎓 学习伙伴   │            │
│   │               │ │               │ │               │            │
│   │ - 深度阅读     │ │ - 智能分类     │ │ - 知识问答     │            │
│   │ - 摘要提炼     │ │ - 自动标签     │ │ - 关联发现     │            │
│   │ - 要点整理     │ │ - 文件夹建议   │ │ - 学习计划     │            │
│   │ - 待办生成     │ │ - 去重合并     │ │ - 复习提醒     │            │
│   └───────────────┘ └───────────────┘ └───────────────┘            │
│                                                                     │
│   入口：不是悬浮按钮，而是融入每个使用场景                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、核心设计理念

### 2.1 设计原则

| 原则         | 说明                              | 对比 YouMind    |
| ------------ | --------------------------------- | --------------- |
| **场景驱动** | AI 入口融入使用场景，不是独立功能 | ✅ 同 YouMind   |
| **主动智能** | AI 主动发现问题、提供建议         | ✅ 同 YouMind   |
| **操作闭环** | 不只是建议，能直接执行操作        | ✅ 同 YouMind   |
| **知识连接** | 发现内容之间的关联                | ✅ 同 YouMind   |
| **学习导向** | 帮助用户真正消化收藏的内容        | 🆕 AnyKeep 特色 |

### 2.2 与 YouMind 的差异化

| 维度         | YouMind               | AnyKeep                         |
| ------------ | --------------------- | ------------------------------- |
| **内容来源** | 手动添加、网页剪藏    | 多平台聚合（微信、B站、小红书） |
| **核心场景** | 研究、写作            | 学习、整理                      |
| **AI 重点**  | 内容创作              | 知识整理与学习                  |
| **特色功能** | Memory Bank、思维导图 | 跨平台整理、学习追踪            |

---

## 三、产品架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AnyKeep AI 知识助手                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AI 交互层 (UI)                               │   │
│  │                                                                       │   │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │   │ 全局对话面板 │ │ 内容详情页   │ │ 列表页快捷   │ │ 智能提醒     │   │   │
│  │   │ (右侧抽屉)  │ │ AI 功能区   │ │ AI 操作     │ │ 通知卡片     │   │   │
│  │   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        AI 能力层 (Agent)                             │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │                   Knowledge Agent                            │   │   │
│  │   │   (知识助手核心 - 理解意图、规划行动、执行任务)                │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                        │   │
│  │           ┌──────────────────┼──────────────────┐                    │   │
│  │           ▼                  ▼                  ▼                    │   │
│  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐              │   │
│  │   │ 理解能力     │   │ 整理能力     │   │ 学习能力     │              │   │
│  │   │ Understand   │   │ Organize     │   │ Learn        │              │   │
│  │   ├─────────────┤   ├─────────────┤   ├─────────────┤              │   │
│  │   │ 内容摘要     │   │ 智能分类     │   │ 知识问答     │              │   │
│  │   │ 要点提取     │   │ 标签推荐     │   │ 关联发现     │              │   │
│  │   │ 待办生成     │   │ 文件夹建议   │   │ 学习计划     │              │   │
│  │   │ 关键词提炼   │   │ 去重检测     │   │ 间隔复习     │              │   │
│  │   └─────────────┘   └─────────────┘   └─────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        数据访问层 (Tools)                            │   │
│  │                                                                       │   │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │   │ 查询     │ │ 阅读     │ │ 创建     │ │ 更新     │ │ 搜索     │ │   │
│  │   │ Query    │ │ Read     │ │ Create   │ │ Update   │ │ Search   │ │   │
│  │   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        数据层 (现有 + 新增)                          │   │
│  │                                                                       │   │
│  │   现有：bookmarks, folders, wechat_articles, browser_bookmarks       │   │
│  │   新增：ai_notes, ai_learning_sessions, ai_knowledge_connections     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 AI 入口设计（融入场景）

**不再使用悬浮按钮**，而是将 AI 能力融入每个使用场景：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI 入口分布设计                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 首页列表                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ 📚 AI 智能推荐                                     [展开 ▼] │   │   │
│  │  │ • 你有 5 篇未读的收藏，要我帮你做个摘要吗？                   │   │   │
│  │  │ • 发现 3 组相似内容，建议合并整理                             │   │   │
│  │  │ • 上周收藏的「AI编程」内容，要复习一下吗？                    │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────┐  ┌──────────────────────┐                │   │
│  │  │ 🔖 收藏卡片          │  │ 🔖 收藏卡片          │                │   │
│  │  │ [AI 摘要] [整理] ... │  │ [AI 摘要] [整理] ... │ ← 卡片级 AI 操作│   │
│  │  └──────────────────────┘  └──────────────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  2. 详情页                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ┌────────────────────────────────┬─────────────────────────────┐  │   │
│  │  │                                │ 📚 AI 助手                   │  │   │
│  │  │                                ├─────────────────────────────┤  │   │
│  │  │      文章/视频内容区域          │ [快捷指令]                   │  │   │
│  │  │                                │ • 一键摘要                   │  │   │
│  │  │                                │ • 提取要点                   │  │   │
│  │  │                                │ • 生成待办                   │  │   │
│  │  │                                │ • 找相关内容                 │  │   │
│  │  │                                ├─────────────────────────────┤  │   │
│  │  │                                │ [对话区域]                   │  │   │
│  │  │                                │ 针对这篇内容提问...          │  │   │
│  │  └────────────────────────────────┴─────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  3. 全局对话（右侧抽屉，随时可调出）                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                       ┌───────────────────────────┐│   │
│  │     任意页面                           │ 🤖 AI 知识助手            ││   │
│  │                                       ├───────────────────────────┤│   │
│  │                                       │ [对话历史]                 ││   │
│  │                                       │                           ││   │
│  │                                       │ 用户: 我最近收藏的 AI 相关 ││   │
│  │                                       │       内容有哪些？         ││   │
│  │                                       │                           ││   │
│  │                                       │ AI: 你有 12 篇 AI 相关收藏 ││   │
│  │                                       │     [列出内容...]          ││   │
│  │                                       │     [查看详情] [批量整理]  ││   │
│  │                                       ├───────────────────────────┤│   │
│  │                                       │ 输入问题或选择快捷指令...  ││   │
│  │                                       └───────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 四、核心功能模块

### 4.1 模块一：阅读助手（Understand）

**目标**：帮助用户快速理解收藏的内容

#### 4.1.1 一键摘要

```
用户收藏了一篇长文 → 点击「AI 摘要」
                      ↓
                 AI 阅读全文
                      ↓
              生成结构化摘要：
              ┌─────────────────────────────┐
              │ 📝 AI 摘要                   │
              │                             │
              │ 核心观点：                   │
              │ • 观点1                      │
              │ • 观点2                      │
              │                             │
              │ 关键信息：                   │
              │ • 数据/案例/引用             │
              │                             │
              │ 一句话总结：                 │
              │ "..."                       │
              │                             │
              │ [保存到笔记] [重新生成]       │
              └─────────────────────────────┘
```

#### 4.1.2 要点提取

```
用户看完一个视频 → 点击「提取要点」
                    ↓
              AI 分析字幕/描述
                    ↓
              生成结构化要点：
              ┌─────────────────────────────┐
              │ 📌 核心要点                  │
              │                             │
              │ 1. 第一个重要点              │
              │    └─ 详细解释               │
              │                             │
              │ 2. 第二个重要点              │
              │    └─ 详细解释               │
              │                             │
              │ 💡 实践建议：                │
              │ • 可以做的第一件事           │
              │ • 可以做的第二件事           │
              │                             │
              │ [转为待办] [保存笔记]         │
              └─────────────────────────────┘
```

#### 4.1.3 待办生成

```
针对一篇「如何学习XXX」的文章 → 点击「生成待办」
                                ↓
                          AI 提取行动项
                                ↓
                          生成可勾选的待办清单：
                          ┌─────────────────────────────┐
                          │ ✅ 学习待办清单               │
                          │                             │
                          │ 阶段一：准备                 │
                          │ □ 安装必要的工具             │
                          │ □ 准备学习材料               │
                          │                             │
                          │ 阶段二：实践                 │
                          │ □ 完成第一个练习             │
                          │ □ 完成第二个练习             │
                          │                             │
                          │ [保存待办] [导出]            │
                          └─────────────────────────────┘
```

### 4.2 模块二：整理专家（Organize）

**目标**：帮助用户智能整理收藏

#### 4.2.1 智能分类

```
新收藏一篇文章 → AI 自动分析内容
                    ↓
              推荐分类和标签：
              ┌─────────────────────────────┐
              │ 🗂️ 智能分类建议              │
              │                             │
              │ 推荐文件夹：                 │
              │ • 📁 编程学习 (匹配度 92%)   │
              │ • 📁 AI 技术 (匹配度 85%)    │
              │                             │
              │ 推荐标签：                   │
              │ [AI] [编程] [教程] [+自定义] │
              │                             │
              │ 相似收藏：                   │
              │ • 「相似文章1」              │
              │ • 「相似文章2」              │
              │                             │
              │ [确认分类] [自定义]          │
              └─────────────────────────────┘
```

#### 4.2.2 批量整理

```
用户说「帮我整理一下最近一个月的收藏」
                    ↓
              AI 分析所有未整理的收藏
                    ↓
              生成整理建议：
              ┌─────────────────────────────┐
              │ 📊 整理报告                  │
              │                             │
              │ 待整理：42 条收藏            │
              │                             │
              │ 建议分组：                   │
              │ ┌───────────────────────┐   │
              │ │ AI 相关 (15 条)        │   │
              │ │ → 移动到「AI 技术」    │   │
              │ │ [预览] [确认]          │   │
              │ └───────────────────────┘   │
              │ ┌───────────────────────┐   │
              │ │ 前端开发 (8 条)        │   │
              │ │ → 移动到「前端学习」   │   │
              │ │ [预览] [确认]          │   │
              │ └───────────────────────┘   │
              │                             │
              │ [一键执行所有建议]           │
              └─────────────────────────────┘
```

#### 4.2.3 去重合并

```
AI 主动发现：「你有 3 组重复或高度相似的收藏」
                    ↓
              展示重复组：
              ┌─────────────────────────────┐
              │ 🔄 重复检测                  │
              │                             │
              │ 组 1：2 条重复               │
              │ • 「文章A」(12月1日)         │
              │ • 「文章A-重复」(12月5日)    │
              │ [保留第一条] [合并] [忽略]   │
              │                             │
              │ 组 2：3 条高度相似           │
              │ • 「React教程1」             │
              │ • 「React教程2」             │
              │ • 「React入门」              │
              │ [合并为系列] [忽略]          │
              └─────────────────────────────┘
```

### 4.3 模块三：学习伙伴（Learn）

**目标**：帮助用户真正消化收藏的知识

#### 4.3.1 知识问答

```
用户问「我收藏的内容里，有关于 React Hooks 的最佳实践吗？」
                    ↓
              AI 搜索 + 阅读 + 理解
                    ↓
              综合回答：
              ┌─────────────────────────────┐
              │ 🎓 知识回答                  │
              │                             │
              │ 根据你收藏的 3 篇相关文章：  │
              │                             │
              │ React Hooks 最佳实践包括：   │
              │                             │
              │ 1. 状态管理 [1]             │
              │    • useState 适用于简单状态 │
              │    • useReducer 适用于复杂  │
              │                             │
              │ 2. 副作用处理 [2]           │
              │    • 正确的依赖数组设置      │
              │    • 清理函数的使用          │
              │                             │
              │ 参考来源：                   │
              │ [1] 「React Hooks 完全指南」 │
              │ [2] 「Hooks 进阶用法」       │
              │                             │
              │ [深入阅读] [生成学习计划]    │
              └─────────────────────────────┘
```

#### 4.3.2 关联发现

```
用户在阅读一篇「微服务架构」文章
                    ↓
              AI 发现关联内容：
              ┌─────────────────────────────┐
              │ 🔗 相关收藏                  │
              │                             │
              │ 你可能还想看：               │
              │                             │
              │ • 「Docker 容器化部署」      │
              │   ↳ 与微服务部署相关         │
              │                             │
              │ • 「API 网关设计」           │
              │   ↳ 微服务通信的关键组件     │
              │                             │
              │ • 「分布式事务处理」         │
              │   ↳ 微服务数据一致性方案     │
              │                             │
              │ [创建学习路径]               │
              └─────────────────────────────┘
```

#### 4.3.3 学习计划

```
用户说「我想系统学习我收藏的 AI 相关内容」
                    ↓
              AI 分析所有 AI 相关收藏
                    ↓
              生成学习路径：
              ┌─────────────────────────────┐
              │ 📚 AI 学习计划               │
              │                             │
              │ 你有 18 篇 AI 相关收藏       │
              │ 建议学习顺序：               │
              │                             │
              │ Week 1: 基础概念             │
              │ ├─ □ 「机器学习入门」        │
              │ ├─ □ 「深度学习基础」        │
              │ └─ □ 「神经网络原理」        │
              │                             │
              │ Week 2: 实践应用             │
              │ ├─ □ 「TensorFlow 教程」     │
              │ ├─ □ 「PyTorch 入门」        │
              │ └─ □ 「模型训练实战」        │
              │                             │
              │ Week 3: 进阶主题             │
              │ └─ ...                       │
              │                             │
              │ [开始学习] [调整计划]         │
              └─────────────────────────────┘
```

#### 4.3.4 间隔复习

```
AI 主动提醒：「上周学习的 3 篇文章，今天适合复习」
                    ↓
              复习卡片：
              ┌─────────────────────────────┐
              │ 🔔 今日复习                  │
              │                             │
              │ 「React 性能优化」           │
              │ 上次阅读：7 天前              │
              │                             │
              │ 核心要点回顾：               │
              │ • useMemo 和 useCallback    │
              │ • React.memo 使用场景        │
              │ • 虚拟列表优化               │
              │                             │
              │ 快速测试：                   │
              │ Q: useMemo 的作用是什么？    │
              │ [显示答案]                   │
              │                             │
              │ [标记已掌握] [需要再看]       │
              └─────────────────────────────┘
```

---

## 五、技术架构

### 5.1 完全重构的目录结构

```
src/
├── lib/
│   ├── ai/                           # 🆕 AI 核心模块（完全新建）
│   │   ├── core/                     # 核心引擎
│   │   │   ├── knowledge-agent.ts    # 知识助手 Agent
│   │   │   ├── intent-parser.ts      # 意图解析器
│   │   │   ├── action-planner.ts     # 行动规划器
│   │   │   └── response-generator.ts # 响应生成器
│   │   │
│   │   ├── capabilities/             # 能力模块
│   │   │   ├── understand/           # 理解能力
│   │   │   │   ├── summarizer.ts     # 摘要生成
│   │   │   │   ├── key-points.ts     # 要点提取
│   │   │   │   ├── todo-generator.ts # 待办生成
│   │   │   │   └── keyword-extractor.ts
│   │   │   │
│   │   │   ├── organize/             # 整理能力
│   │   │   │   ├── classifier.ts     # 智能分类
│   │   │   │   ├── tag-suggester.ts  # 标签推荐
│   │   │   │   ├── folder-suggester.ts
│   │   │   │   └── deduplicator.ts   # 去重检测
│   │   │   │
│   │   │   └── learn/                # 学习能力
│   │   │       ├── qa-engine.ts      # 问答引擎
│   │   │       ├── connection-finder.ts # 关联发现
│   │   │       ├── learning-planner.ts  # 学习计划
│   │   │       └── review-scheduler.ts  # 复习调度
│   │   │
│   │   ├── tools/                    # 数据访问工具
│   │   │   ├── query-tools.ts        # 查询工具
│   │   │   ├── read-tools.ts         # 读取工具
│   │   │   ├── write-tools.ts        # 写入工具
│   │   │   └── search-tools.ts       # 搜索工具
│   │   │
│   │   ├── prompts/                  # Prompt 管理
│   │   │   ├── system-prompts.ts     # 系统提示词
│   │   │   ├── capability-prompts.ts # 能力提示词
│   │   │   └── templates/            # 模板
│   │   │
│   │   └── types.ts                  # 类型定义
│   │
│   ├── chat/                         # ❌ 删除（完全替换）
│   │   └── (移除所有现有文件)
│   │
│   └── repositories/                 # 现有（保留复用）
│
├── app/api/
│   ├── ai/                           # 🆕 AI API（替换 /api/chat）
│   │   ├── chat/route.ts             # 对话 API
│   │   ├── summarize/route.ts        # 摘要 API
│   │   ├── organize/route.ts         # 整理 API
│   │   ├── learn/route.ts            # 学习 API
│   │   └── suggest/route.ts          # 建议 API
│   │
│   └── chat/                         # ❌ 删除
│       └── (移除)
│
├── components/
│   ├── ai/                           # 🆕 AI 组件（完全新建）
│   │   ├── global/                   # 全局组件
│   │   │   ├── ai-drawer.tsx         # 全局 AI 抽屉
│   │   │   ├── ai-trigger.tsx        # 触发按钮
│   │   │   └── ai-notification.tsx   # 智能通知
│   │   │
│   │   ├── conversation/             # 对话组件
│   │   │   ├── chat-panel.tsx        # 对话面板
│   │   │   ├── message-bubble.tsx    # 消息气泡
│   │   │   ├── quick-commands.tsx    # 快捷指令
│   │   │   └── action-cards.tsx      # 操作卡片
│   │   │
│   │   ├── understand/               # 理解功能组件
│   │   │   ├── summary-card.tsx      # 摘要卡片
│   │   │   ├── key-points-card.tsx   # 要点卡片
│   │   │   └── todo-card.tsx         # 待办卡片
│   │   │
│   │   ├── organize/                 # 整理功能组件
│   │   │   ├── classify-dialog.tsx   # 分类对话框
│   │   │   ├── organize-report.tsx   # 整理报告
│   │   │   └── duplicate-card.tsx    # 重复检测卡片
│   │   │
│   │   └── learn/                    # 学习功能组件
│   │       ├── knowledge-answer.tsx  # 知识回答
│   │       ├── related-content.tsx   # 相关内容
│   │       ├── learning-plan.tsx     # 学习计划
│   │       └── review-card.tsx       # 复习卡片
│   │
│   └── chat/                         # ❌ 删除
│       └── (移除)
│
├── hooks/
│   └── domain/ai/
│       ├── use-ai-chat.ts            # 🆕 AI 对话 Hook
│       ├── use-ai-understand.ts      # 🆕 理解功能 Hook
│       ├── use-ai-organize.ts        # 🆕 整理功能 Hook
│       ├── use-ai-learn.ts           # 🆕 学习功能 Hook
│       └── use-chat.ts               # ❌ 删除
│
└── providers/
    └── ai-provider.tsx               # 🆕 AI 上下文 Provider
```

### 5.2 核心类设计

#### 5.2.1 KnowledgeAgent（知识助手核心）

```typescript
// src/lib/ai/core/knowledge-agent.ts

/**
 * 知识助手 Agent
 * 核心决策和协调中心
 */
export class KnowledgeAgent {
  private intentParser: IntentParser;
  private actionPlanner: ActionPlanner;
  private responseGenerator: ResponseGenerator;
  private capabilities: Map<string, Capability>;

  constructor(private context: AgentContext) {
    this.intentParser = new IntentParser();
    this.actionPlanner = new ActionPlanner();
    this.responseGenerator = new ResponseGenerator();

    // 注册能力模块
    this.capabilities = new Map([
      ["understand", new UnderstandCapability()],
      ["organize", new OrganizeCapability()],
      ["learn", new LearnCapability()],
    ]);
  }

  /**
   * 处理用户输入
   */
  async process(input: UserInput): Promise<AsyncGenerator<AgentEvent>> {
    // 1. 解析意图
    const intent = await this.intentParser.parse(input);

    // 2. 规划行动
    const plan = await this.actionPlanner.plan(intent, this.context);

    // 3. 执行行动并生成响应
    return this.execute(plan);
  }

  /**
   * 执行行动计划
   */
  private async *execute(plan: ActionPlan): AsyncGenerator<AgentEvent> {
    for (const action of plan.actions) {
      yield { type: "action_start", action };

      const capability = this.capabilities.get(action.capability);
      if (!capability) {
        yield {
          type: "error",
          message: `Unknown capability: ${action.capability}`,
        };
        continue;
      }

      const result = await capability.execute(action, this.context);
      yield { type: "action_result", action, result };
    }

    // 生成最终响应
    const response = await this.responseGenerator.generate(plan, this.context);
    yield { type: "response", response };
  }
}
```

#### 5.2.2 能力模块接口

```typescript
// src/lib/ai/capabilities/types.ts

/**
 * 能力模块接口
 */
export interface Capability {
  name: string;
  description: string;
  actions: ActionDefinition[];
  execute(action: Action, context: AgentContext): Promise<ActionResult>;
}

/**
 * 理解能力
 */
export class UnderstandCapability implements Capability {
  name = "understand";
  description = "理解和提炼内容";

  actions = [
    { name: "summarize", description: "生成摘要" },
    { name: "extract_key_points", description: "提取要点" },
    { name: "generate_todo", description: "生成待办" },
    { name: "extract_keywords", description: "提取关键词" },
  ];

  async execute(action: Action, context: AgentContext): Promise<ActionResult> {
    switch (action.name) {
      case "summarize":
        return this.summarize(action.params, context);
      case "extract_key_points":
        return this.extractKeyPoints(action.params, context);
      // ...
    }
  }

  private async summarize(params: SummarizeParams, context: AgentContext) {
    // 1. 读取内容
    const content = await context.tools.read.readBookmarkContent(
      params.bookmarkId,
    );

    // 2. 调用 LLM 生成摘要
    const summary = await context.llm.generate({
      prompt: SUMMARIZE_PROMPT,
      content,
      format: "structured",
    });

    return { type: "summary", data: summary };
  }
}
```

### 5.3 数据库扩展

```sql
-- AI 笔记（用户通过 AI 生成的内容）
CREATE TABLE ai_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL CHECK (note_type IN ('summary', 'key_points', 'todo', 'custom')),
  source_bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 学习会话（追踪学习进度）
CREATE TABLE ai_learning_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  total_items INT DEFAULT 0,
  completed_items INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 学习项目
CREATE TABLE ai_learning_items (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES ai_learning_sessions(id) ON DELETE CASCADE NOT NULL,
  bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE CASCADE NOT NULL,
  order_index INT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  mastery_level INT DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 知识关联
CREATE TABLE ai_knowledge_connections (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bookmark_id_a BIGINT REFERENCES bookmarks(id) ON DELETE CASCADE NOT NULL,
  bookmark_id_b BIGINT REFERENCES bookmarks(id) ON DELETE CASCADE NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('similar', 'related', 'prerequisite', 'sequel')),
  strength FLOAT DEFAULT 0.5 CHECK (strength BETWEEN 0 AND 1),
  ai_generated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bookmark_id_a, bookmark_id_b)
);

-- 对话历史
CREATE TABLE ai_conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  context_type TEXT CHECK (context_type IN ('global', 'bookmark', 'folder', 'learning_session')),
  context_id TEXT,  -- 对应的 ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT REFERENCES ai_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  metadata JSONB,  -- 工具调用、引用等
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE ai_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users can manage own ai_notes" ON ai_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own learning_sessions" ON ai_learning_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own learning_items" ON ai_learning_items FOR ALL USING (
  EXISTS (SELECT 1 FROM ai_learning_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can manage own knowledge_connections" ON ai_knowledge_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own conversations" ON ai_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own messages" ON ai_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);
```

---

## 六、开发工作量评估

### 6.1 工作量对比

| 项目           | 增量升级方案（之前） | 完全重构方案（本方案） | 增加量            |
| -------------- | -------------------- | ---------------------- | ----------------- |
| **后端核心**   | 40h                  | 120h                   | +80h (+200%)      |
| **API 路由**   | 4h                   | 20h                    | +16h (+400%)      |
| **前端 Hook**  | 6h                   | 30h                    | +24h (+400%)      |
| **UI 组件**    | 16h                  | 80h                    | +64h (+400%)      |
| **数据库设计** | 4h                   | 16h                    | +12h (+300%)      |
| **测试**       | 12h                  | 40h                    | +28h (+233%)      |
| **集成调试**   | -                    | 24h                    | +24h (新增)       |
| **文档**       | 4h                   | 12h                    | +8h (+200%)       |
| **总计**       | **86h**              | **342h**               | **+256h (+298%)** |

### 6.2 详细任务分解

#### Phase 1: 基础架构（Week 1-3）

| 任务                    | 类型   | 工时    | 优先级 |
| ----------------------- | ------ | ------- | ------ |
| AI 模块目录结构创建     | 架构   | 4h      | P0     |
| 类型定义和接口设计      | 架构   | 8h      | P0     |
| KnowledgeAgent 核心实现 | 后端   | 24h     | P0     |
| IntentParser 实现       | 后端   | 12h     | P0     |
| ActionPlanner 实现      | 后端   | 12h     | P0     |
| ResponseGenerator 实现  | 后端   | 8h      | P0     |
| 数据库迁移脚本          | 数据库 | 8h      | P0     |
| /api/ai/chat 路由       | API    | 8h      | P0     |
| AIProvider 上下文       | 前端   | 4h      | P0     |
| useAIChat Hook          | 前端   | 8h      | P0     |
| **小计**                |        | **96h** |        |

#### Phase 2: 理解能力（Week 4-5）

| 任务                        | 类型 | 工时    | 优先级 |
| --------------------------- | ---- | ------- | ------ |
| UnderstandCapability 实现   | 后端 | 16h     | P0     |
| Summarizer 摘要生成         | 后端 | 8h      | P0     |
| KeyPointsExtractor 要点提取 | 后端 | 8h      | P0     |
| TodoGenerator 待办生成      | 后端 | 6h      | P0     |
| /api/ai/summarize 路由      | API  | 4h      | P0     |
| SummaryCard 组件            | 前端 | 6h      | P0     |
| KeyPointsCard 组件          | 前端 | 6h      | P0     |
| TodoCard 组件               | 前端 | 6h      | P0     |
| useAIUnderstand Hook        | 前端 | 6h      | P0     |
| 详情页 AI 功能区集成        | 前端 | 8h      | P0     |
| **小计**                    |      | **74h** |        |

#### Phase 3: 整理能力（Week 6-7）

| 任务                       | 类型 | 工时    | 优先级 |
| -------------------------- | ---- | ------- | ------ |
| OrganizeCapability 实现    | 后端 | 16h     | P0     |
| Classifier 智能分类        | 后端 | 10h     | P0     |
| TagSuggester 标签推荐      | 后端 | 8h      | P0     |
| FolderSuggester 文件夹建议 | 后端 | 6h      | P1     |
| Deduplicator 去重检测      | 后端 | 8h      | P1     |
| /api/ai/organize 路由      | API  | 4h      | P0     |
| ClassifyDialog 组件        | 前端 | 8h      | P0     |
| OrganizeReport 组件        | 前端 | 10h     | P0     |
| DuplicateCard 组件         | 前端 | 6h      | P1     |
| useAIOrganize Hook         | 前端 | 6h      | P0     |
| 新建收藏时的智能分类       | 前端 | 6h      | P0     |
| **小计**                   |      | **88h** |        |

#### Phase 4: 学习能力（Week 8-10）

| 任务                      | 类型 | 工时    | 优先级 |
| ------------------------- | ---- | ------- | ------ |
| LearnCapability 实现      | 后端 | 16h     | P0     |
| QAEngine 问答引擎         | 后端 | 12h     | P0     |
| ConnectionFinder 关联发现 | 后端 | 10h     | P1     |
| LearningPlanner 学习计划  | 后端 | 10h     | P1     |
| ReviewScheduler 复习调度  | 后端 | 8h      | P2     |
| /api/ai/learn 路由        | API  | 4h      | P0     |
| KnowledgeAnswer 组件      | 前端 | 8h      | P0     |
| RelatedContent 组件       | 前端 | 6h      | P1     |
| LearningPlan 组件         | 前端 | 10h     | P1     |
| ReviewCard 组件           | 前端 | 6h      | P2     |
| useAILearn Hook           | 前端 | 6h      | P0     |
| **小计**                  |      | **96h** |        |

#### Phase 5: UI 集成与优化（Week 11-12）

| 任务                    | 类型 | 工时    | 优先级 |
| ----------------------- | ---- | ------- | ------ |
| AIDrawer 全局抽屉       | 前端 | 12h     | P0     |
| AItrigger 触发按钮      | 前端 | 4h      | P0     |
| AINotification 智能通知 | 前端 | 8h      | P1     |
| QuickCommands 快捷指令  | 前端 | 8h      | P0     |
| 首页 AI 推荐卡片        | 前端 | 10h     | P1     |
| 删除旧 chat 组件和代码  | 清理 | 4h      | P0     |
| 端到端测试              | 测试 | 20h     | P0     |
| 性能优化                | 优化 | 12h     | P1     |
| 文档编写                | 文档 | 12h     | P1     |
| **小计**                |      | **90h** |        |

### 6.3 人力资源需求

| 角色          | 工时     | 预计周期 | 人数建议   |
| ------------- | -------- | -------- | ---------- |
| **后端开发**  | 180h     | 12周     | 1-2人      |
| **前端开发**  | 130h     | 12周     | 1人        |
| **全栈/集成** | 32h      | 12周     | 与上面重叠 |
| **总计**      | **342h** | **12周** | **2-3人**  |

**如果单人开发**：约 3-4 个月（按每周 30h 有效工作时间）

### 6.4 里程碑计划

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          开发里程碑                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  M1: 基础可用 (Week 3)                                                      │
│  ├─ KnowledgeAgent 核心运行                                                 │
│  ├─ 基础对话功能                                                            │
│  └─ 能回答"我有多少收藏"                                                    │
│                                                                             │
│  M2: 理解能力 (Week 5)                                                      │
│  ├─ 一键摘要功能                                                            │
│  ├─ 要点提取功能                                                            │
│  └─ 详情页 AI 功能区上线                                                    │
│                                                                             │
│  M3: 整理能力 (Week 7)                                                      │
│  ├─ 智能分类建议                                                            │
│  ├─ 标签推荐                                                                │
│  └─ 新建收藏时的智能分类                                                    │
│                                                                             │
│  M4: 学习能力 (Week 10)                                                     │
│  ├─ 知识问答功能                                                            │
│  ├─ 关联内容发现                                                            │
│  └─ 学习计划生成                                                            │
│                                                                             │
│  M5: 完整上线 (Week 12)                                                     │
│  ├─ 全局 AI 抽屉                                                            │
│  ├─ 快捷指令系统                                                            │
│  ├─ 智能通知                                                                │
│  └─ 完整测试和优化                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 七、与 YouMind 的对标对比

### 7.1 功能对比

| 功能             | YouMind | AnyKeep AI（重构后） | 状态     |
| ---------------- | ------- | -------------------- | -------- |
| **项目级上下文** | ✅      | ✅ 文件夹级上下文    | 对标     |
| **内容摘要**     | ✅      | ✅ 一键摘要          | 对标     |
| **要点提取**     | ✅      | ✅ 结构化要点        | 对标     |
| **待办生成**     | ✅      | ✅ 可勾选待办        | 对标     |
| **智能分类**     | ✅      | ✅ 标签+文件夹建议   | 对标     |
| **知识问答**     | ✅      | ✅ 基于收藏的问答    | 对标     |
| **关联发现**     | ✅      | ✅ 相关内容推荐      | 对标     |
| **笔记创建**     | ✅      | ✅ AI 笔记           | 对标     |
| **思维导图**     | ✅      | ⏳ 后续迭代          | 延后     |
| **Memory Bank**  | ✅      | ⏳ 后续迭代          | 延后     |
| **学习计划**     | ❌      | ✅ 学习路径规划      | **超越** |
| **间隔复习**     | ❌      | ✅ 复习提醒          | **超越** |
| **多平台聚合**   | ❌      | ✅ 微信/B站/小红书   | **超越** |

### 7.2 体验对比

| 维度         | YouMind      | AnyKeep AI（重构后）  |
| ------------ | ------------ | --------------------- |
| **AI 入口**  | 右侧固定面板 | 右侧抽屉 + 场景内嵌入 |
| **快捷指令** | 预设按钮     | 预设按钮 + 上下文感知 |
| **操作确认** | 直接执行     | 重要操作需确认        |
| **响应速度** | 流式输出     | 流式输出              |
| **多轮对话** | 支持         | 支持                  |
| **历史记录** | 支持         | 支持                  |

---

## 八、风险与挑战

### 8.1 技术风险

| 风险             | 影响 | 缓解措施                                     |
| ---------------- | ---- | -------------------------------------------- |
| **LLM 能力依赖** | 高   | 选择成熟的模型（GPT-4/Claude），准备降级策略 |
| **内容理解质量** | 高   | Prompt Engineering + 输出验证 + 用户反馈     |
| **成本控制**     | 中   | 缓存、限流、分级模型策略                     |
| **响应延迟**     | 中   | 流式响应、异步处理、预计算                   |

### 8.2 产品风险

| 风险             | 影响 | 缓解措施                         |
| ---------------- | ---- | -------------------------------- |
| **用户期望过高** | 中   | 明确 AI 能力边界，渐进式功能开放 |
| **功能过于复杂** | 中   | 优先核心功能，简化交互流程       |
| **数据隐私担忧** | 高   | 本地处理选项、隐私说明、数据加密 |

---

## 九、验收标准

### 9.1 功能验收

| 场景                           | 预期结果                      |
| ------------------------------ | ----------------------------- |
| 详情页点击「一键摘要」         | 3秒内开始生成，结构化摘要输出 |
| 详情页点击「提取要点」         | 生成带层级的要点列表          |
| 详情页点击「生成待办」         | 生成可勾选的待办清单          |
| 新建收藏时                     | 自动推荐标签和文件夹          |
| 全局对话「我有多少收藏」       | 准确返回统计数据              |
| 全局对话「帮我整理上周的收藏」 | 生成整理建议，可一键执行      |
| 全局对话「XX是什么」           | 基于收藏内容回答，带引用      |
| 全局对话「生成学习计划」       | 根据收藏生成结构化学习路径    |

### 9.2 性能验收

| 指标                     | 目标  |
| ------------------------ | ----- |
| 首次响应延迟（流式开始） | < 2s  |
| 摘要生成完成             | < 15s |
| 分类建议响应             | < 3s  |
| 问答首次响应             | < 3s  |
| 并发用户支持             | 100+  |

---

## 十、总结

### 10.1 方案对比

| 维度       | 增量升级（之前）         | 完全重构（本方案）               |
| ---------- | ------------------------ | -------------------------------- |
| **架构**   | 在现有 chat 模块上打补丁 | 全新 AI 模块，干净架构           |
| **能力**   | 7 个 Tools               | 3 大能力模块（理解、整理、学习） |
| **体验**   | 悬浮按钮入口             | 场景融入 + 全局抽屉              |
| **价值**   | 功能增强                 | 真正的知识助手                   |
| **工作量** | 86h                      | 342h (+298%)                     |
| **周期**   | 8 周                     | 12 周 (+50%)                     |

### 10.2 核心收益

1. **产品差异化**：不是"又一个 AI 问答"，而是真正能帮助用户学习和整理的知识助手
2. **用户价值**：让收藏的内容真正被理解、被整理、被学习
3. **技术领先**：对标 YouMind，在学习辅助方面有超越
4. **架构清晰**：完全重构，为未来扩展打好基础

### 10.3 建议

**推荐选择完全重构方案**，理由：

1. 现有 AI 助手几乎无可用价值，修补不如重来
2. 增量升级会导致代码混乱，技术债务累积
3. 完全重构虽然工作量大，但产出的是真正有价值的功能
4. 12 周的周期可接受，是一次性投入

---

**文档状态**: 待审核
**下一步**: 用户审核后，删除现有 chat 模块，开始 Phase 1 开发
