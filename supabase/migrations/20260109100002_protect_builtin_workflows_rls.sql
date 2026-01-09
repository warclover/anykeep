-- =====================================================
-- 工作流系统安全修复: 内置工作流 RLS 保护增强
-- 版本: 1.0.1
-- 日期: 2026-01-09
--
-- 安全问题: 内置工作流的 UPDATE/DELETE 策略不够严格
-- 修复方案: 明确禁止修改/删除内置工作流
-- =====================================================

-- =====================================================
-- 删除旧策略
-- =====================================================
DROP POLICY IF EXISTS "Users can update their own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can delete their own workflows" ON workflows;

-- =====================================================
-- 创建增强的保护策略
-- =====================================================

-- 用户只能更新自己的非内置工作流
CREATE POLICY "Users can update their own non-builtin workflows"
  ON workflows FOR UPDATE
  USING (
    auth.uid() = user_id
    AND category != 'builtin'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND category != 'builtin'
  );

-- 用户只能删除自己的非内置工作流
CREATE POLICY "Users can delete their own non-builtin workflows"
  ON workflows FOR DELETE
  USING (
    auth.uid() = user_id
    AND category != 'builtin'
  );

-- =====================================================
-- 添加内置工作流保护注释
-- =====================================================
COMMENT ON POLICY "Users can update their own non-builtin workflows" ON workflows IS
  '安全策略：用户只能修改自己创建的工作流，内置工作流受保护';

COMMENT ON POLICY "Users can delete their own non-builtin workflows" ON workflows IS
  '安全策略：用户只能删除自己创建的工作流，内置工作流受保护';

-- =====================================================
-- 添加内置工作流不可变约束触发器（额外保护层）
-- =====================================================
CREATE OR REPLACE FUNCTION protect_builtin_workflows()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.category = 'builtin' THEN
    RAISE EXCEPTION 'Cannot modify builtin workflows'
      USING HINT = 'Builtin workflows are read-only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_builtin_workflows_trigger ON workflows;
CREATE TRIGGER protect_builtin_workflows_trigger
  BEFORE UPDATE OR DELETE ON workflows
  FOR EACH ROW
  WHEN (OLD.category = 'builtin')
  EXECUTE FUNCTION protect_builtin_workflows();

COMMENT ON FUNCTION protect_builtin_workflows() IS
  '触发器函数：阻止修改或删除内置工作流，作为 RLS 策略的额外保护层';
