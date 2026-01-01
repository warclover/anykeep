-- Migration: Fix synthesis_reports.source_id type
-- Version: 20260101000003
-- Description: 修复 source_id 类型，从 UUID 改为 TEXT 以兼容 folder_id(BIGINT) 和 tag_name
-- Author: AI Assistant
-- Date: 2026-01-01

-- ============================================================================
-- 1. ALTER COLUMN TYPE
-- ============================================================================

ALTER TABLE synthesis_reports
ALTER COLUMN source_id TYPE TEXT;

-- ============================================================================
-- 2. COMMENT
-- ============================================================================

COMMENT ON COLUMN synthesis_reports.source_id IS '来源 ID: folder_id(BIGINT转TEXT) 或 tag_name(TEXT)';
