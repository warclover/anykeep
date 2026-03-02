-- Enable RLS on notification_preferences (Supabase 安全提醒)
-- 表结构见 20251208000001；若已被 20260201172820 的 DROP 移除则本迁移无操作
-- 策略：已登录用户仅能读写自己的偏好 (user_id = auth.uid())

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_preferences'
  ) THEN
    ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can manage own notification preferences" ON public.notification_preferences;
    CREATE POLICY "Users can manage own notification preferences"
      ON public.notification_preferences
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    COMMENT ON TABLE public.notification_preferences IS '用户通知偏好设置；RLS 已开启，仅允许操作用户自身数据';
  END IF;
END $$;
