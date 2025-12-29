-- Migration: Add 'cancelled' status to synthesis_reports
-- Version: 1.0.0
-- Date: 2025-12-29
-- Description: 修复 CHECK 约束，添加 'cancelled' 状态支持

-- =============================================================================
-- 修复 synthesis_reports 表的 status CHECK 约束
-- =============================================================================

-- 删除现有的 CHECK 约束
ALTER TABLE synthesis_reports
  DROP CONSTRAINT IF EXISTS synthesis_reports_status_check;

-- 添加新的 CHECK 约束（包含 cancelled 状态）
ALTER TABLE synthesis_reports
  ADD CONSTRAINT synthesis_reports_status_check
  CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'cancelled'));

-- =============================================================================
-- 添加注释
-- =============================================================================

COMMENT ON COLUMN synthesis_reports.status IS '报告状态: pending-等待生成, generating-生成中, completed-已完成, failed-失败, cancelled-已取消';
