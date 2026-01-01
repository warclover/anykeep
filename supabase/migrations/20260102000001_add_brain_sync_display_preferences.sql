/**
 * 添加 Brain-Sync 显示偏好字段
 *
 * - show_menu_badge: 是否在菜单栏显示待回顾数量徽章（默认关闭）
 * - show_sidebar_reminder: 是否显示侧边栏灵感回顾提醒（默认关闭）
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

-- 添加显示偏好列
ALTER TABLE review_preferences
ADD COLUMN IF NOT EXISTS show_menu_badge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_sidebar_reminder BOOLEAN DEFAULT false;

-- 添加列注释
COMMENT ON COLUMN review_preferences.show_menu_badge IS '是否在菜单栏显示待回顾数量徽章（默认关闭）';
COMMENT ON COLUMN review_preferences.show_sidebar_reminder IS '是否显示侧边栏灵感回顾提醒（默认关闭）';
