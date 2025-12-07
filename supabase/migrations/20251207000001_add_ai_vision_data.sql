-- ============================================
-- 视觉分析功能 - 数据库迁移
-- 版本: V10.0
-- 日期: 2025-12-07
-- 描述: 添加 ai_vision_data 字段，存储 Qwen-VL 视觉分析结果
-- ============================================

-- 这是一个插件化功能，完全独立于现有功能
-- 不修改任何现有列或约束
-- 仅添加新的可选字段

-- 添加视觉分析数据字段 (JSONB)
-- 存储结构示例:
-- {
--   "analyzedAt": "2025-12-07T10:00:00Z",
--   "status": "completed",
--   "images": [
--     {
--       "url": "https://...",
--       "result": {
--         "description": "这是一张架构图...",
--         "ocrText": "提取的文字...",
--         "visualTags": ["架构图", "技术文档"],
--         "imageType": "chart"
--       },
--       "durationMs": 5000
--     }
--   ],
--   "usage": {
--     "promptTokens": 100,
--     "completionTokens": 200,
--     "totalTokens": 300
--   },
--   "modelVersion": "qwen-vl-max"
-- }

ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS ai_vision_data JSONB DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN public.bookmarks.ai_vision_data IS '视觉分析数据 (Qwen-VL)，JSONB 格式，可选字段';

-- 创建 GIN 索引，用于快速查询 visualTags
-- 这允许通过 @> 操作符高效搜索带有特定视觉标签的书签
CREATE INDEX IF NOT EXISTS idx_bookmarks_vision_tags
ON public.bookmarks
USING GIN ((ai_vision_data -> 'images'));

-- 创建部分索引，仅索引有视觉数据的书签
-- 用于快速筛选"已分析"的书签
CREATE INDEX IF NOT EXISTS idx_bookmarks_has_vision
ON public.bookmarks ((ai_vision_data IS NOT NULL))
WHERE ai_vision_data IS NOT NULL;

-- ============================================
-- 辅助函数（可选）
-- ============================================

-- 获取书签的视觉标签（展平为数组）
CREATE OR REPLACE FUNCTION get_vision_tags(vision_data JSONB)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result TEXT[] := '{}';
  image_item JSONB;
  tag TEXT;
BEGIN
  IF vision_data IS NULL OR vision_data -> 'images' IS NULL THEN
    RETURN result;
  END IF;

  FOR image_item IN SELECT * FROM jsonb_array_elements(vision_data -> 'images')
  LOOP
    IF image_item -> 'result' -> 'visualTags' IS NOT NULL THEN
      FOR tag IN SELECT * FROM jsonb_array_elements_text(image_item -> 'result' -> 'visualTags')
      LOOP
        IF NOT tag = ANY(result) THEN
          result := array_append(result, tag);
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_vision_tags(JSONB) IS '从视觉分析数据中提取所有视觉标签（去重）';

-- 检查书签是否有视觉分析数据
CREATE OR REPLACE FUNCTION has_vision_analysis(vision_data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN vision_data IS NOT NULL
    AND vision_data -> 'status' = '"completed"'
    AND jsonb_array_length(COALESCE(vision_data -> 'images', '[]'::JSONB)) > 0;
END;
$$;

COMMENT ON FUNCTION has_vision_analysis(JSONB) IS '检查书签是否有完成的视觉分析数据';

-- ============================================
-- RLS 策略说明
-- ============================================
-- 不需要新增 RLS 策略，因为 ai_vision_data 是 bookmarks 表的列
-- 现有的 bookmarks 表 RLS 策略已经覆盖了这个新列

-- ============================================
-- 迁移完成
-- ============================================
