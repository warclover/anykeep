#!/bin/bash
# Pensieve Loop 共享函数库

# ============================================
# Skill 目录查找
# ============================================

# 查找 pensieve skill 目录
# 按优先级检查: 项目级 > 用户级
# 返回: skill 目录路径（stdout），或返回非零退出码
find_skill_root() {
    # 项目级
    if [[ -d "$PWD/.claude/skills/pensieve" ]]; then
        echo "$PWD/.claude/skills/pensieve"
        return 0
    fi

    # 用户级
    if [[ -d "$HOME/.claude/skills/pensieve" ]]; then
        echo "$HOME/.claude/skills/pensieve"
        return 0
    fi

    return 1
}

# ============================================
# _meta.md 读取
# ============================================

# 从 _meta.md 读取 task_list_id 字段
# 参数: $1 = _meta.md 文件路径
# 返回: task_list_id 值或空字符串
read_task_list_id_from_meta() {
    local meta_file="$1"
    [[ ! -f "$meta_file" ]] && echo "" && return 0

    sed -n '/^---$/,/^---$/p' "$meta_file" | grep "^task_list_id:" | sed 's/^task_list_id: *//'
}

# ============================================
# Loop 目录扫描
# ============================================

# 扫描找到有 pending task 的 loop 目录
# 参数: $1 = loop 基础目录
# 返回: loop 目录路径（stdout），或返回非零退出码
find_active_loop() {
    local loop_base_dir="$1"

    for loop_dir in "$loop_base_dir"/????-??-??-*/; do
        [[ ! -d "$loop_dir" ]] && continue

        local meta_file="$loop_dir/_meta.md"
        [[ ! -f "$meta_file" ]] && continue

        local task_list_id
        task_list_id=$(read_task_list_id_from_meta "$meta_file")
        [[ -z "$task_list_id" ]] && continue

        local tasks_dir="$HOME/.claude/tasks/$task_list_id"
        [[ ! -d "$tasks_dir" ]] && continue

        # 检查是否有 pending 或 in_progress task
        for task_file in "$tasks_dir"/*.json; do
            [[ -f "$task_file" ]] || continue
            local status
            status=$(jq -r '.status' "$task_file" 2>/dev/null)
            if [[ "$status" == "pending" || "$status" == "in_progress" ]]; then
                echo "${loop_dir%/}"
                return 0
            fi
        done
    done

    return 1
}

# 扫描找到指定 loop 名称的目录
# 参数: $1 = loop 基础目录, $2 = loop 名称（如 2026-01-24-feature）
# 返回: loop 目录路径或空
find_loop_by_name() {
    local loop_base_dir="$1"
    local loop_name="$2"
    local loop_dir="$loop_base_dir/$loop_name"

    if [[ -d "$loop_dir" ]]; then
        echo "$loop_dir"
        return 0
    fi

    return 1
}
