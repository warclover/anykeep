-- =====================================================
-- 工作流系统 Phase 4: 内置工作流种子数据
-- 版本: 1.0.0
-- 日期: 2026-01-08
-- =====================================================

-- =====================================================
-- 插入内置工作流
-- =====================================================
INSERT INTO workflows (id, name, description, category, enabled, definition, created_at)
VALUES
  -- P0: 新用户导入整理
  (
    gen_random_uuid(),
    '新用户导入整理',
    '导入浏览器书签后自动去重、分类、打标签，快速完成首次整理',
    'builtin',
    true,
    '{
      "id": "new_user_onboarding",
      "name": "新用户导入整理",
      "description": "导入浏览器书签后自动去重、分类、打标签，快速完成首次整理",
      "version": "1.0.0",
      "category": "builtin",
      "triggers": [
        {"type": "event", "eventType": "browser_bookmark_import_completed", "condition": "event.isFirstImport == true"},
        {"type": "manual"},
        {"type": "conversation", "patterns": ["整理导入的书签", "导入书签整理"]}
      ],
      "steps": [
        {"id": "analyze_imported", "name": "分析导入数据", "type": "skill", "config": {"skillId": "count_bookmarks"}},
        {"id": "remove_duplicates", "name": "智能去重", "type": "skill", "config": {"skillId": "duplicate_cleanup"}},
        {"id": "classify_bookmarks", "name": "智能分类", "type": "skill", "config": {"skillId": "batch_organize"}},
        {"id": "generate_tags", "name": "智能打标签", "type": "skill", "config": {"skillId": "smart_tagging"}}
      ],
      "config": {"timeout": 180000, "notifyOnComplete": true, "notifyOnFailure": true}
    }'::jsonb,
    NOW()
  ),

  -- P0: 书签健康巡检
  (
    gen_random_uuid(),
    '书签健康巡检',
    '检测失效链接、内容变更、重复书签，生成健康报告',
    'builtin',
    true,
    '{
      "id": "bookmark_health",
      "name": "书签健康巡检",
      "description": "检测失效链接、内容变更、重复书签，生成健康报告",
      "version": "1.0.0",
      "category": "builtin",
      "triggers": [
        {"type": "manual"},
        {"type": "conversation", "patterns": ["检查书签健康", "书签巡检", "链接检查"]}
      ],
      "steps": [
        {"id": "check_links", "name": "检测失效链接", "type": "skill", "config": {"skillId": "link_health_check"}, "onError": "continue"},
        {"id": "detect_duplicates", "name": "检测重复书签", "type": "skill", "config": {"skillId": "duplicate_cleanup"}, "onError": "continue"},
        {"id": "generate_report", "name": "生成健康报告", "type": "aggregate"}
      ],
      "config": {"timeout": 300000, "notifyOnComplete": true, "notifyOnFailure": true}
    }'::jsonb,
    NOW()
  ),

  -- P1: 主题深挖
  (
    gen_random_uuid(),
    '主题深挖',
    '聚合某主题所有书签，生成知识图谱和学习计划',
    'builtin',
    true,
    '{
      "id": "topic_deep_dive",
      "name": "主题深挖",
      "description": "聚合某主题所有书签，生成知识图谱和学习计划",
      "version": "1.0.0",
      "category": "builtin",
      "triggers": [
        {"type": "manual"},
        {"type": "conversation", "patterns": ["深度学习", "系统学习", "主题深挖"]}
      ],
      "steps": [
        {"id": "search_related", "name": "搜索相关书签", "type": "skill", "config": {"skillId": "related_discovery"}},
        {"id": "generate_synthesis", "name": "生成主题合成", "type": "skill", "config": {"skillId": "thematic_synthesis"}},
        {"id": "create_learning_path", "name": "生成学习路径", "type": "skill", "config": {"skillId": "learning_path"}},
        {"id": "extract_knowledge", "name": "提取知识点", "type": "skill", "config": {"skillId": "knowledge_extract"}}
      ],
      "config": {"timeout": 120000, "notifyOnComplete": true, "notifyOnFailure": true}
    }'::jsonb,
    NOW()
  ),

  -- P1: 定期备份
  (
    gen_random_uuid(),
    '定期备份',
    '自动导出全量数据到指定格式（JSON/Markdown）',
    'builtin',
    true,
    '{
      "id": "periodic_backup",
      "name": "定期备份",
      "description": "自动导出全量数据到指定格式（JSON/Markdown）",
      "version": "1.0.0",
      "category": "builtin",
      "triggers": [
        {"type": "schedule", "schedule": {"type": "cron", "value": "0 3 * * 0"}},
        {"type": "manual"},
        {"type": "conversation", "patterns": ["备份数据", "导出备份"]}
      ],
      "steps": [
        {"id": "count_data", "name": "统计数据量", "type": "skill", "config": {"skillId": "count_bookmarks"}},
        {"id": "export_json", "name": "导出 JSON 格式", "type": "skill", "config": {"skillId": "data_export", "inputMapping": {"format": "json"}}},
        {"id": "export_markdown", "name": "导出 Markdown 格式", "type": "skill", "config": {"skillId": "data_export", "inputMapping": {"format": "markdown"}}}
      ],
      "config": {"timeout": 300000, "notifyOnComplete": true, "notifyOnFailure": true}
    }'::jsonb,
    NOW()
  ),

  -- P1: 每日精选推送（默认关闭，需要用户在设置中手动开启）
  (
    gen_random_uuid(),
    '每日精选推送',
    '从未读列表推荐 3-5 条今日阅读内容',
    'builtin',
    false,
    '{
      "id": "daily_digest",
      "name": "每日精选推送",
      "description": "从未读列表推荐 3-5 条今日阅读内容",
      "version": "1.0.0",
      "category": "builtin",
      "triggers": [
        {"type": "schedule", "schedule": {"type": "cron", "value": "0 8 * * *"}},
        {"type": "conversation", "patterns": ["今日推荐", "每日精选", "今天读什么"]}
      ],
      "steps": [
        {"id": "get_unread", "name": "获取未读列表", "type": "skill", "config": {"skillId": "search_bookmarks"}},
        {"id": "score_and_rank", "name": "评分排序", "type": "skill", "config": {"skillId": "rank_bookmarks"}},
        {"id": "generate_summaries", "name": "生成摘要", "type": "skill", "config": {"skillId": "quick_digest"}}
      ],
      "config": {"timeout": 60000, "notifyOnComplete": true, "notifyOnFailure": false}
    }'::jsonb,
    NOW()
  ),

  -- P2: 文件夹清理
  (
    gen_random_uuid(),
    '文件夹清理',
    '检测空文件夹、合并相似文件夹、优化结构',
    'builtin',
    true,
    '{
      "id": "folder_cleanup",
      "name": "文件夹清理",
      "description": "检测空文件夹、合并相似文件夹、优化结构",
      "version": "1.0.0",
      "category": "builtin",
      "triggers": [
        {"type": "manual"},
        {"type": "conversation", "patterns": ["清理文件夹", "整理文件夹", "文件夹优化"]}
      ],
      "steps": [
        {"id": "analyze_folders", "name": "分析文件夹结构", "type": "skill", "config": {"skillId": "folder_health_check"}},
        {"id": "detect_duplicates", "name": "检测重复结构", "type": "skill", "config": {"skillId": "analyze_folder_overlap"}},
        {"id": "present_findings", "name": "呈现分析结果", "type": "aggregate", "requiresConfirmation": true}
      ],
      "config": {"timeout": 120000, "notifyOnComplete": true, "notifyOnFailure": true}
    }'::jsonb,
    NOW()
  )
ON CONFLICT DO NOTHING;
