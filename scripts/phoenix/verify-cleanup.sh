#!/bin/bash

# 🦅 Project Phoenix - 清理验证脚本
# 验证所有待删除的功能模块是否已彻底清理

set -e

echo "🔍 Project Phoenix - 代码清理验证"
echo "=================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 验证计数器
PASS=0
FAIL=0

# 函数：检查关键字
check_keyword() {
  local keyword=$1
  local exclude_pattern=$2
  
  echo -n "检查 '$keyword' 关键字... "
  
  # 搜索代码文件（排除文档、测试、node_modules）
  local count=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/__tests__/*" \
    ! -path "*.test.ts" \
    ! -path "*.spec.ts" \
    -exec grep -l "$keyword" {} \; 2>/dev/null | wc -l)
  
  if [ "$count" -eq 0 ]; then
    echo -e "${GREEN}✓ 通过${NC} (0 个文件)"
    ((PASS++))
  else
    echo -e "${RED}✗ 失败${NC} (发现 $count 个文件)"
    ((FAIL++))
    
    # 显示具体文件
    echo "  发现的文件："
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
      ! -path "*/node_modules/*" \
      ! -path "*/__tests__/*" \
      -exec grep -l "$keyword" {} \; 2>/dev/null | head -5 | sed 's/^/    - /'
  fi
}

# 函数：检查目录是否存在
check_directory_removed() {
  local dir=$1
  
  echo -n "检查目录 '$dir' 是否已删除... "
  
  if [ ! -d "$dir" ]; then
    echo -e "${GREEN}✓ 通过${NC} (目录不存在)"
    ((PASS++))
  else
    echo -e "${RED}✗ 失败${NC} (目录仍存在)"
    ((FAIL++))
  fi
}

# 函数：检查数据库表
check_database_table() {
  local table=$1
  
  echo -n "检查数据库表 '$table' 是否已删除... "
  
  # 在迁移文件中搜索 CREATE TABLE
  local found=$(find supabase/migrations -type f -name "*.sql" \
    -exec grep -l "CREATE TABLE.*$table" {} \; 2>/dev/null | wc -l)
  
  if [ "$found" -eq 0 ]; then
    echo -e "${GREEN}✓ 通过${NC} (未找到 CREATE TABLE)"
    ((PASS++))
  else
    echo -e "${YELLOW}⚠ 警告${NC} (仍有迁移文件引用此表)"
  fi
}

echo "📦 第一阶段：Brain-Sync 清理验证"
echo "-----------------------------------"
check_keyword "brain-sync"
check_keyword "BrainSync"
check_keyword "brain_sync"
check_keyword "flashcard"
check_keyword "review.*session"
check_directory_removed "src/components/brain-sync"
check_directory_removed "src/app/api/brain-sync"
check_directory_removed "src/hooks/domain/brain-sync"
check_directory_removed "src/lib/ai-skills/skills/active-recall"
check_database_table "flashcards"
check_database_table "review_sessions"
echo ""

echo "⚙️ 第二阶段：Workflow 引擎清理验证"
echo "-----------------------------------"
check_keyword "workflow.*engine"
check_keyword "WorkflowEngine"
check_keyword "workflow.*trigger"
check_keyword "workflow.*action"
check_directory_removed "src/lib/workflow"
check_directory_removed "src/app/api/workflow"
check_database_table "workflows"
check_database_table "workflow_executions"
echo ""

echo "🔬 第三阶段：Synthesizer 清理验证"
echo "-----------------------------------"
check_keyword "synthesizer"
check_keyword "Synthesizer"
check_keyword "synthesis.*report"
check_keyword "SynthesisReport"
check_directory_removed "src/app/api/synthesis"
check_database_table "synthesis_reports"
echo ""

echo "📊 清理验证总结"
echo "=================================="
echo -e "通过: ${GREEN}$PASS${NC}"
echo -e "失败: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ 所有验证通过！代码清理完成。${NC}"
  exit 0
else
  echo -e "${RED}✗ 发现 $FAIL 个问题，请检查上述详情。${NC}"
  exit 1
fi
