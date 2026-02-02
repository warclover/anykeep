#!/bin/bash
# Pensieve Loop 绑定进程
# 必须通过 Claude Code 的后台任务功能运行（run_in_background: true）
#
# 用法：bind-loop.sh <task_list_id> <loop_dir>
#
# 工作原理：
# 1. 创建标记文件 /tmp/pensieve-loop-{task_list_id}
# 2. 标记文件内容包含 loop 目录路径
# 3. 进程保持运行，Stop hook 检测标记文件存在即触发
# 4. 进程退出时自动清理标记文件（trap）

set -euo pipefail

# 自定位：无论从哪里调用，都能找到插件根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

TASK_LIST_ID="${1:-}"
LOOP_DIR_INPUT="${2:-}"

if [[ -z "$TASK_LIST_ID" || -z "$LOOP_DIR_INPUT" ]]; then
    echo "❌ 错误: 缺少参数" >&2
    echo "" >&2
    echo "用法: bind-loop.sh <task_list_id> <loop_dir>" >&2
    echo "" >&2
    echo "参数说明:" >&2
    echo "  <task_list_id>  TaskCreate 返回的 taskListId" >&2
    echo "  <loop_dir>      init-loop.sh 输出的目录路径" >&2
    echo "" >&2
    echo "正确示例:" >&2
    echo "  ./bind-loop.sh abc-123-uuid skills/pensieve/loop/2026-01-27-login" >&2
    echo "" >&2
    echo "⚠️  必须用 run_in_background: true 运行，否则会阻塞！" >&2
    exit 1
fi

# 转换为绝对路径（支持相对路径输入）
if [[ "$LOOP_DIR_INPUT" = /* ]]; then
    LOOP_DIR="$LOOP_DIR_INPUT"
else
    LOOP_DIR="$(cd "$LOOP_DIR_INPUT" 2>/dev/null && pwd)" || {
        echo "错误: 无法解析路径 $LOOP_DIR_INPUT" >&2
        exit 1
    }
fi

MARKER_FILE="/tmp/pensieve-loop-$TASK_LIST_ID"

# 会话 PID：与 loop-controller.sh 使用相同逻辑查找
get_shell_pid() {
    local pid="$$"
    while [[ "$pid" -gt 1 ]]; do
        local comm
        comm=$(ps -o comm= -p "$pid" 2>/dev/null | sed 's/^[[:space:]]*//')
        comm=$(basename "$comm")
        if [[ "$comm" == "claude" ]]; then
            ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' '
            return 0
        fi
        pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
        [[ -z "$pid" ]] && break
    done
    return 1
}

SESSION_PID="$(get_shell_pid || true)"

# 清理函数（进程退出时自动清理标记文件）
cleanup() {
    rm -f "$MARKER_FILE"
    echo "[$(date '+%H:%M:%S')] Loop 绑定已解除: $TASK_LIST_ID"
}

trap cleanup EXIT INT TERM

# 写入标记文件（JSON 格式，方便 hook 解析）
if [[ -f "$MARKER_FILE" ]]; then
    # 已存在：只更新 session_pid 和 pid，保留其他状态
    jq --arg session_pid "$SESSION_PID" \
       --arg pid "$$" \
       '.session_pid = $session_pid | .pid = ($pid | tonumber)' \
       "$MARKER_FILE" > "${MARKER_FILE}.tmp"
    mv "${MARKER_FILE}.tmp" "$MARKER_FILE"
else
    # 不存在：创建新文件
    cat > "$MARKER_FILE" << EOF
{
  "task_list_id": "$TASK_LIST_ID",
  "loop_dir": "$LOOP_DIR",
  "started_at": "$(date -Iseconds)",
  "session_pid": "$SESSION_PID",
  "pid": $$,
  "tasks_started": false
}
EOF
fi

echo "[$(date '+%H:%M:%S')] Loop 绑定成功"
echo "  task_list_id: $TASK_LIST_ID"
echo "  loop_dir: $LOOP_DIR"
echo "  session_pid: $SESSION_PID"
echo "  marker: $MARKER_FILE"
echo ""
echo "此进程将保持运行。marker 文件删除后自动退出。"

# 保持运行，定期检查 marker 文件是否存在
while [[ -f "$MARKER_FILE" ]]; do
    sleep 5
done
