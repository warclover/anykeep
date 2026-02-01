-- ============================================================================
-- 修复 notification_types 表 RLS 策略
-- 日期: 2026-02-01
-- 说明: 限制只有认证用户才能读取通知类型配置
-- ============================================================================

-- 删除过于宽松的策略
DROP POLICY IF EXISTS "notification_types_read_only" ON notification_types;

-- 创建更严格的策略：只有认证用户可读取
CREATE POLICY "notification_types_authenticated_read" ON notification_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 添加注释说明
COMMENT ON POLICY "notification_types_authenticated_read" ON notification_types
  IS '只有认证用户可读取通知类型配置，防止未授权访问';
