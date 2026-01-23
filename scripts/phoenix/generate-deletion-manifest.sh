#!/bin/bash

# 🦅 Project Phoenix - 生成删除文件清单
# 根据关键字搜索生成待删除文件列表

set -e

OUTPUT_FILE="deletion-manifest.txt"

echo "🦅 Project Phoenix - 删除文件清单生成器"
echo "========================================"
echo ""

# 清空输出文件
> $OUTPUT_FILE

echo "📋 正在生成删除清单..."
echo ""

# 函数：添加分类标题
add_section() {
  echo "" >> $OUTPUT_FILE
  echo "# $1" >> $OUTPUT_FILE
  echo "# $(date '+%Y-%m-%d %H:%M:%S')" >> $OUTPUT_FILE
  echo "" >> $OUTPUT_FILE
}

# 函数：查找并添加文件
find_and_add() {
  local pattern=$1
  local description=$2
  
  echo "  正在查找: $description"
  
  find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/node_modules/*" \
    -exec grep -l "$pattern" {} \; 2>/dev/null | while read file; do
    echo "$file" >> $OUTPUT_FILE
  done
}

# 函数：添加目录
add_directory() {
  local dir=$1
  local description=$2
  
  echo "  正在添加目录: $description"
  
  if [ -d "$dir" ]; then
    echo "# 目录: $dir" >> $OUTPUT_FILE
    find "$dir" -type f | while read file; do
      echo "$file" >> $OUTPUT_FILE
    done
  fi
}

# ===== Brain-Sync 相关 =====
add_section "Brain-Sync 复习系统"
add_directory "src/components/brain-sync" "Brain-Sync 组件"
add_directory "src/app/api/brain-sync" "Brain-Sync API"
add_directory "src/app/(main)/brain-sync" "Brain-Sync 页面"
add_directory "src/hooks/domain/brain-sync" "Brain-Sync Hooks"
add_directory "src/lib/ai-skills/skills/active-recall" "Active Recall Skill"
add_directory "src/lib/ai-agent/tools/active-recall" "Active Recall Tools"
add_directory "src/lib/ai-skills/shared/review" "Review 共享模块"
add_directory "supabase/functions/generate-weekly-queue" "复习队列生成函数"
add_directory "supabase/functions/send-review-reminder" "复习提醒函数"

# Types
find_and_add "brain.*sync.*type" "Brain-Sync 类型定义"
if [ -f "src/types/brain-sync.ts" ]; then
  echo "src/types/brain-sync.ts" >> $OUTPUT_FILE
fi

# ===== Workflow 引擎 =====
add_section "Workflow 自动化引擎"
add_directory "src/lib/workflow" "Workflow 引擎核心"
add_directory "src/app/api/workflow" "Workflow API"
add_directory "src/app/api/automation" "Automation API"

# ===== Synthesizer =====
add_section "Synthesizer 主题合成器"
add_directory "src/app/api/synthesis" "Synthesis API"
add_directory "src/lib/synthesis" "Synthesis 服务"
find_and_add "synthesis.*report" "Synthesis Report 相关"

# ===== 数据库迁移 =====
add_section "数据库迁移文件"
find supabase/migrations -type f -name "*brain*sync*.sql" 2>/dev/null | while read file; do
  echo "$file" >> $OUTPUT_FILE
done
find supabase/migrations -type f -name "*flashcard*.sql" 2>/dev/null | while read file; do
  echo "$file" >> $OUTPUT_FILE
done
find supabase/migrations -type f -name "*review*.sql" 2>/dev/null | while read file; do
  echo "$file" >> $OUTPUT_FILE
done
find supabase/migrations -type f -name "*workflow*.sql" 2>/dev/null | while read file; do
  echo "$file" >> $OUTPUT_FILE
done
find supabase/migrations -type f -name "*synthesis*.sql" 2>/dev/null | while read file; do
  echo "$file" >> $OUTPUT_FILE
done

# ===== 测试文件 =====
add_section "测试文件"
find src -type f \( -name "*.test.ts" -o -name "*.spec.ts" \) \
  -exec grep -l "brain.*sync\|workflow\|synthesis" {} \; 2>/dev/null | while read file; do
  echo "$file" >> $OUTPUT_FILE
done

echo ""
echo "✅ 删除清单已生成: $OUTPUT_FILE"
echo ""

# 统计
TOTAL_FILES=$(grep -v "^#" $OUTPUT_FILE | grep -v "^$" | wc -l)
echo "📊 统计信息:"
echo "  - 总文件数: $TOTAL_FILES"
echo "  - Brain-Sync: $(grep -A 100 "# Brain-Sync" $OUTPUT_FILE | grep -v "^#" | grep -v "^$" | wc -l)"
echo "  - Workflow: $(grep -A 100 "# Workflow" $OUTPUT_FILE | grep -v "^#" | grep -v "^$" | wc -l)"
echo "  - Synthesizer: $(grep -A 100 "# Synthesizer" $OUTPUT_FILE | grep -v "^#" | grep -v "^$" | wc -l)"
echo ""

# 生成删除脚本
DELETE_SCRIPT="execute-deletion.sh"
echo "#!/bin/bash" > $DELETE_SCRIPT
echo "# 自动生成的删除脚本 - 请在执行前仔细检查" >> $DELETE_SCRIPT
echo "# 生成时间: $(date)" >> $DELETE_SCRIPT
echo "" >> $DELETE_SCRIPT
echo "set -e" >> $DELETE_SCRIPT
echo "" >> $DELETE_SCRIPT
echo "echo '⚠️  即将删除以下文件，确认请输入 YES:'" >> $DELETE_SCRIPT
echo "read -p '> ' CONFIRM" >> $DELETE_SCRIPT
echo "" >> $DELETE_SCRIPT
echo "if [ \"\$CONFIRM\" != \"YES\" ]; then" >> $DELETE_SCRIPT
echo "  echo '❌ 取消删除'" >> $DELETE_SCRIPT
echo "  exit 1" >> $DELETE_SCRIPT
echo "fi" >> $DELETE_SCRIPT
echo "" >> $DELETE_SCRIPT
echo "echo '🗑️  开始删除...'" >> $DELETE_SCRIPT
echo "" >> $DELETE_SCRIPT

grep -v "^#" $OUTPUT_FILE | grep -v "^$" | while read file; do
  echo "echo '  删除: $file'" >> $DELETE_SCRIPT
  echo "rm -f '$file'" >> $DELETE_SCRIPT
done

chmod +x $DELETE_SCRIPT

echo "🚀 删除执行脚本已生成: $DELETE_SCRIPT"
echo ""
echo "⚠️  注意事项:"
echo "  1. 请先备份代码: git branch backup-before-phoenix"
echo "  2. 检查 $OUTPUT_FILE 确认文件列表"
echo "  3. 执行删除: bash $DELETE_SCRIPT"
echo "  4. 验证清理: bash scripts/phoenix/verify-cleanup.sh"
echo ""
