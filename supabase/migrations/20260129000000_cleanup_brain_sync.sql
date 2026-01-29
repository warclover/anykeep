-- Brain-Sync cleanup migration
-- 1. 删除依赖表 (顺序关键)
DROP TABLE IF EXISTS review_logs;       -- 复习记录
DROP TABLE IF EXISTS review_sessions;   -- 复习会话
DROP TABLE IF EXISTS flashcards;        -- 抽认卡/问题卡
DROP TABLE IF EXISTS mastery_stats;     -- 掌握度统计
DROP TABLE IF EXISTS brain_sync_preferences; -- 用户偏好设置

-- 2. 清理枚举类型
DROP TYPE IF EXISTS review_rating;
DROP TYPE IF EXISTS mastery_level;
