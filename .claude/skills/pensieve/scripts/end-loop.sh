#!/bin/bash
# Pensieve Loop 结束工具
# 通过 task_list_id 终止指定的 loop
#
# 用法:
#   end-loop.sh <task_list_id>   # 结束指定 loop
#   end-loop.sh --all            # 结束所有活跃的 loop

set -euo pipefail

# ============================================
# 参数解析
# ============================================

if [[ $# -lt 1 ]]; then
    echo "❌ 错误: 缺少参数" >&2
    echo "" >&2
    echo "用法:" >&2
    echo "  $0 <task_list_id>   # 结束指定 loop" >&2
    echo "  $0 --all            # 结束所有活跃的 loop" >&2
    echo "" >&2
    echo "参数说明:" >&2
    echo "  <task_list_id>  Phase 1 TaskCreate 返回的 taskListId" >&2
    echo "" >&2
    echo "正确示例:" >&2
    echo "  ./end-loop.sh abc-123-uuid" >&2
    echo "  ./end-loop.sh --all" >&2
    exit 1
fi

# ============================================
# 结束单个 loop
# ============================================

end_loop_by_marker() {
    local marker="$1"
    [[ -f "$marker" ]] || return 1

    local task_id loop_dir pid
    task_id=$(jq -r '.task_list_id' "$marker" 2>/dev/null) || return 1
    loop_dir=$(jq -r '.loop_dir' "$marker" 2>/dev/null) || return 1

    echo "结束 Loop: $task_id"
    echo "  目录: $loop_dir"

    # 删除 marker 文件（后台进程会自动检测并退出）
    rm -f "$marker"
    echo "  已清理"
    echo ""
}

# ============================================
# 主逻辑
# ============================================

if [[ "$1" == "--all" ]]; then
    echo "结束所有活跃的 loop..."
    echo ""

    found=false
    for marker in /tmp/pensieve-loop-*; do
        [[ -f "$marker" ]] || continue
        found=true
        end_loop_by_marker "$marker"
    done

    if [[ "$found" == false ]]; then
        echo "没有活跃的 loop"
    fi
else
    TASK_LIST_ID="$1"
    MARKER="/tmp/pensieve-loop-$TASK_LIST_ID"

    if [[ ! -f "$MARKER" ]]; then
        echo "错误: 找不到 loop marker: $MARKER"
        echo ""
        echo "活跃的 loop:"
        for marker in /tmp/pensieve-loop-*; do
            [[ -f "$marker" ]] || continue
            task_id=$(jq -r '.task_list_id' "$marker" 2>/dev/null) || continue
            echo "  - $task_id"
        done
        exit 1
    fi

    end_loop_by_marker "$MARKER"
    echo "Loop 已结束"
fi
