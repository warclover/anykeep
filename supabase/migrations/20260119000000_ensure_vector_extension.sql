-- 确保 pgvector 扩展已启用
-- 这个迁移确保 vector 类型可用

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
