#!/bin/bash
# Pensieve Loop 初始化工具
# 创建 loop 目录结构并关联 task_list_id
#
# 用法:
#   init-loop.sh <task_list_id> <slug>
#   init-loop.sh <task_list_id> <slug> --force   # 覆盖已存在的目录
#
# 例如:
#   init-loop.sh abc-123-uuid login-feature

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(dirname "$SCRIPT_DIR")"
LOOP_BASE_DIR="$SKILL_ROOT/loop"
CLAUDE_TASKS_BASE="$HOME/.claude/tasks"

# ============================================
# 参数解析
# ============================================

if [[ $# -lt 2 ]]; then
    echo "用法: $0 <task_list_id> <slug>"
    echo ""
    echo "例如:"
    echo "  $0 abc-123-uuid login-feature"
    exit 1
fi

TASK_LIST_ID="$1"
SLUG="$2"
FORCE="${3:-}"

DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date -Iseconds)

# 验证 task 目录存在
TASKS_DIR="$CLAUDE_TASKS_BASE/$TASK_LIST_ID"
if [[ ! -d "$TASKS_DIR" ]]; then
    echo "错误: Task 目录不存在: $TASKS_DIR"
    exit 1
fi

# ============================================
# 创建 Loop 目录
# ============================================

LOOP_NAME="${DATE}-${SLUG}"
LOOP_DIR="$LOOP_BASE_DIR/$LOOP_NAME"

if [[ -d "$LOOP_DIR" ]]; then
    if [[ "$FORCE" != "--force" ]]; then
        echo "错误: Loop 目录已存在: $LOOP_DIR"
        echo "使用 --force 参数覆盖"
        exit 1
    fi
    echo "警告: 覆盖已存在的目录: $LOOP_DIR"
fi

mkdir -p "$LOOP_DIR"

# ============================================
# 生成 _meta.md
# ============================================

cat > "$LOOP_DIR/_meta.md" << EOF
---
created: $TIMESTAMP
task_list_id: $TASK_LIST_ID
pipeline:
---

# Loop: $SLUG

## 概述

[主窗口填写：一句话描述目标]
EOF

echo "已创建: $LOOP_DIR/_meta.md"

# ============================================
# 生成 _context.md
# ============================================

cat > "$LOOP_DIR/_context.md" << EOF
# 对话上下文

## 用户对话原文

[主窗口填写]

## 用户干预节选

[主窗口填写]

## 文档引用

| 类型 | 路径 |
|------|------|
| requirements | |
| design | |
| plan | |

## 关键对话

[执行过程中补充]

## 直接干预记录

[执行过程中补充]
EOF

echo "已创建: $LOOP_DIR/_context.md"

# ============================================
# 生成 _agent-prompt.md
# ============================================

cat > "$LOOP_DIR/_agent-prompt.md" << 'EOF'
---
name: expert-developer
description: 执行单个开发任务，完成后返回
---

你是 Linus Torvalds，Linux 内核的创造者和首席架构师，你已经维护 Linux 内核超过30年，审核过数百万行代码，建立了世界上最成功的开源项目。现在我们正在开创一个新项目，以你独特的视角来分析代码，确保项目从一开始就建立在坚实的技术基础上。

## Context

读取本目录下的 `_context.md` 了解任务背景。

## 准则

读取 `skills/pensieve/maxims/` 目录下的准则文件（`_linus.md` 和 `custom.md`），核心信条：

- 如果需要超过 3 层缩进，你就已经完蛋了
- 重写问题让特殊情况消失，不要加 if 打补丁
- 永远不破坏用户可见行为
- 暴露问题，不要掩盖它

## 当前任务

通过 `TaskGet` 读取（task_id 由调用时传入）。

## 执行流程

1. 读取 `_context.md` 了解背景
2. 读取准则文件了解约束
3. `TaskGet` 获取任务详情
4. `TaskUpdate` → in_progress
5. 执行任务
6. `TaskUpdate` → completed
7. 返回

## 完成标准

任务完成前必须验证：
- 编译通过（无编译错误）
- Lint 通过（无 lint 错误）

如果验证失败，修复后再标记 completed。

## 约束

- 只做任务描述的事，不做额外工作
- 不循环，执行完当前 task 就返回
- 不和用户交互，所有信息来自 context 和 task
EOF

echo "已创建: $LOOP_DIR/_agent-prompt.md"

# ============================================
# 输出结果
# ============================================

echo ""
echo "Loop 初始化完成"
echo "目录: $LOOP_DIR"
echo "Task: $TASKS_DIR"
echo ""
echo "下一步: 填充 _context.md，然后启动 bind-loop.sh"
