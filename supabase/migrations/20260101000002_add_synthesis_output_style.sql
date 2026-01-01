-- Migration: Add output_style column to synthesis_reports
-- Version: 20260101000002
-- Description: 添加输出风格字段，支持概要/叙事/对比/批判四种风格 [S1]
-- Author: AI Assistant
-- Date: 2026-01-01

-- ============================================================================
-- 1. ADD COLUMN
-- ============================================================================

ALTER TABLE synthesis_reports
ADD COLUMN IF NOT EXISTS output_style TEXT NOT NULL DEFAULT 'narrative'
CHECK (output_style IN ('summary', 'narrative', 'comparison', 'critical'));

-- ============================================================================
-- 2. COMMENT
-- ============================================================================

COMMENT ON COLUMN synthesis_reports.output_style IS '输出风格: summary(概要式), narrative(叙事式), comparison(对比式), critical(批判式)';
