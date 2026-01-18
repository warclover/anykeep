-- ============================================
-- Classification v5.0 - T1异步纠正队列表
-- 创建日期: 2026-01-18
-- 说明: 用于Optimistic UI模式下的T1结果存储和轮询
-- ============================================

-- 创建T1任务队列表
CREATE TABLE IF NOT EXISTS classification_t1_queue_v5 (
  -- 主键
  id BIGSERIAL PRIMARY KEY,

  -- 事件ID（用于前端轮询）
  event_id TEXT NOT NULL UNIQUE,

  -- 用户ID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 书签ID
  bookmark_id BIGINT NOT NULL,

  -- T0结果
  t0_folder_id BIGINT NOT NULL,
  t0_confidence DECIMAL(3,2) NOT NULL,

  -- T1结果（完成后填充）
  t1_folder_id BIGINT,
  t1_confidence DECIMAL(3,2),
  t1_reasoning TEXT,

  -- 状态: pending(待处理), processing(处理中), completed(已完成), failed(失败)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- 错误信息（如果失败）
  error_message TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- 执行时间（毫秒）
  execution_time_ms INTEGER
);

-- 添加索引
-- 事件ID索引（用于快速查询）
CREATE INDEX IF NOT EXISTS idx_classification_t1_queue_v5_event_id
  ON classification_t1_queue_v5(event_id);

-- 用户ID + 状态索引（用于查询用户的待处理任务）
CREATE INDEX IF NOT EXISTS idx_classification_t1_queue_v5_user_status
  ON classification_t1_queue_v5(user_id, status);

-- 书签ID索引（用于查询特定书签的T1结果）
CREATE INDEX IF NOT EXISTS idx_classification_t1_queue_v5_bookmark
  ON classification_t1_queue_v5(bookmark_id);

-- 创建时间索引（用于清理过期记录）
CREATE INDEX IF NOT EXISTS idx_classification_t1_queue_v5_created_at
  ON classification_t1_queue_v5(created_at);

-- 添加表注释
COMMENT ON TABLE classification_t1_queue_v5 IS 'Classification v5.0 T1异步纠正任务队列';
COMMENT ON COLUMN classification_t1_queue_v5.event_id IS 'T1事件ID，用于前端轮询查询';
COMMENT ON COLUMN classification_t1_queue_v5.status IS '任务状态: pending/processing/completed/failed';
COMMENT ON COLUMN classification_t1_queue_v5.t0_folder_id IS 'T0阶段推荐的文件夹ID';
COMMENT ON COLUMN classification_t1_queue_v5.t1_folder_id IS 'T1阶段纠正后的文件夹ID';

-- 启用RLS
ALTER TABLE classification_t1_queue_v5 ENABLE ROW LEVEL SECURITY;

-- RLS策略：用户只能访问自己的T1任务
CREATE POLICY "Users can view their own T1 tasks"
  ON classification_t1_queue_v5
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own T1 tasks"
  ON classification_t1_queue_v5
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 服务角色可以更新任务状态（用于后台处理）
CREATE POLICY "Service role can update T1 tasks"
  ON classification_t1_queue_v5
  FOR UPDATE
  USING (true);
