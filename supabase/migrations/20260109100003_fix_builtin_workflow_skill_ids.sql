-- =====================================================
-- 工作流系统修复: 内置工作流 Skill ID 修正
-- 版本: 1.0.1
-- 日期: 2026-01-09
--
-- 问题: 部分内置工作流引用了不存在的 Skill ID
-- 修复: 更新为正确的 Skill ID 或替代方案
-- =====================================================

-- =====================================================
-- 更新 "新用户导入整理" 工作流
-- 修复: 移除不存在的 count_bookmarks 步骤
-- =====================================================
UPDATE workflows
SET definition = '{
  "id": "new_user_onboarding",
  "name": "新用户导入整理",
  "description": "导入浏览器书签后自动去重、分类、打标签，快速完成首次整理",
  "version": "1.0.1",
  "category": "builtin",
  "triggers": [
    {"type": "event", "eventType": "browser_bookmark_import_completed", "condition": "event.isFirstImport == true"},
    {"type": "manual"},
    {"type": "conversation", "patterns": ["整理导入的书签", "导入书签整理"]}
  ],
  "steps": [
    {"id": "remove_duplicates", "name": "智能去重", "type": "skill", "config": {"skillId": "duplicate_cleanup"}},
    {"id": "classify_bookmarks", "name": "智能分类", "type": "skill", "config": {"skillId": "batch_organize"}},
    {"id": "generate_tags", "name": "智能打标签", "type": "skill", "config": {"skillId": "smart_tagging"}}
  ],
  "config": {"timeout": 180000, "notifyOnComplete": true, "notifyOnFailure": true}
}'::jsonb,
    updated_at = NOW()
WHERE definition->>'id' = 'new_user_onboarding';

-- =====================================================
-- 更新 "定期备份" 工作流
-- 修复: 移除不存在的 count_bookmarks 步骤
-- =====================================================
UPDATE workflows
SET definition = '{
  "id": "periodic_backup",
  "name": "定期备份",
  "description": "自动导出全量数据到指定格式（JSON/Markdown）",
  "version": "1.0.1",
  "category": "builtin",
  "triggers": [
    {"type": "schedule", "schedule": {"type": "cron", "value": "0 3 * * 0"}},
    {"type": "manual"},
    {"type": "conversation", "patterns": ["备份数据", "导出备份"]}
  ],
  "steps": [
    {"id": "export_json", "name": "导出 JSON 格式", "type": "skill", "config": {"skillId": "data_export", "inputMapping": {"format": "json"}}},
    {"id": "export_markdown", "name": "导出 Markdown 格式", "type": "skill", "config": {"skillId": "data_export", "inputMapping": {"format": "markdown"}}}
  ],
  "config": {"timeout": 300000, "notifyOnComplete": true, "notifyOnFailure": true}
}'::jsonb,
    updated_at = NOW()
WHERE definition->>'id' = 'periodic_backup';

-- =====================================================
-- 更新 "每日精选推送" 工作流
-- 修复: search_bookmarks → search, rank_bookmarks → insight_report
-- =====================================================
UPDATE workflows
SET definition = '{
  "id": "daily_digest",
  "name": "每日精选推送",
  "description": "从未读列表推荐 3-5 条今日阅读内容",
  "version": "1.0.1",
  "category": "builtin",
  "triggers": [
    {"type": "schedule", "schedule": {"type": "cron", "value": "0 8 * * *"}},
    {"type": "conversation", "patterns": ["今日推荐", "每日精选", "今天读什么"]}
  ],
  "steps": [
    {"id": "get_unread", "name": "获取未读列表", "type": "skill", "config": {"skillId": "search", "inputMapping": {"query": "未读 OR is:unread", "limit": 50}}},
    {"id": "analyze_and_rank", "name": "分析并推荐", "type": "skill", "config": {"skillId": "insight_report", "inputMapping": {"reportType": "daily_digest"}}},
    {"id": "generate_summaries", "name": "生成摘要", "type": "skill", "config": {"skillId": "quick_digest"}}
  ],
  "config": {"timeout": 60000, "notifyOnComplete": true, "notifyOnFailure": false}
}'::jsonb,
    updated_at = NOW()
WHERE definition->>'id' = 'daily_digest';

-- =====================================================
-- 更新 "文件夹清理" 工作流
-- 修复: analyze_folder_overlap → folder_health_check (已包含重叠分析)
-- =====================================================
UPDATE workflows
SET definition = '{
  "id": "folder_cleanup",
  "name": "文件夹清理",
  "description": "检测空文件夹、合并相似文件夹、优化结构",
  "version": "1.0.1",
  "category": "builtin",
  "triggers": [
    {"type": "manual"},
    {"type": "conversation", "patterns": ["清理文件夹", "整理文件夹", "文件夹优化"]}
  ],
  "steps": [
    {"id": "analyze_folders", "name": "分析文件夹结构", "type": "skill", "config": {"skillId": "folder_health_check", "inputMapping": {"includeOverlapAnalysis": true}}},
    {"id": "present_findings", "name": "呈现分析结果", "type": "aggregate", "requiresConfirmation": true}
  ],
  "config": {"timeout": 120000, "notifyOnComplete": true, "notifyOnFailure": true}
}'::jsonb,
    updated_at = NOW()
WHERE definition->>'id' = 'folder_cleanup';

-- =====================================================
-- 验证更新结果
-- =====================================================
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count
  FROM workflows
  WHERE category = 'builtin'
    AND definition->>'version' = '1.0.1';

  RAISE NOTICE 'Fixed % builtin workflows', fixed_count;
END $$;
