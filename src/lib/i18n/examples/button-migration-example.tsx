/**
 * UI 文本国际化迁移示例
 *
 * 本文件展示如何将硬编码的中文文本迁移到 i18n 系统
 */

// ============================================================================
// 迁移前：���编码中文文本
// ============================================================================

/**
 * ❌ 迁移前的组件（不推荐）
 *
 * 问题：
 * 1. 文本硬编码在组件中
 * 2. 无法支持多语言
 * 3. 修改文本需要搜索整个代码库
 */
export function ButtonBefore() {
  return (
    <div className="flex gap-2">
      <button className="btn-primary">确认</button>
      <button className="btn-secondary">取消</button>
      <button className="btn-ghost">保存</button>
      <p className="text-sm text-muted-foreground">共 10 项</p>
    </div>
  );
}

// ============================================================================
// 迁移后：使用 i18n 系统
// ============================================================================

/**
 * ✅ 迁移后的组件（推荐）
 *
 * 改进：
 * 1. 使用 useUiText Hook 获取当前语言的文本
 * 2. 支持语言切换
 * 3. 类型安全的文本访问
 */
import { useUiText } from "@/lib/i18n";

export function ButtonAfter() {
  const t = useUiText();

  return (
    <div className="flex gap-2">
      <button className="btn-primary">{t.common.confirm}</button>
      <button className="btn-secondary">{t.common.cancel}</button>
      <button className="btn-ghost">{t.common.save}</button>
      <p className="text-sm text-muted-foreground">
        {t.common.total.replace("{count}", "10")}
      </p>
    </div>
  );
}

// ============================================================================
// 复杂组件迁移示例
// ============================================================================

/**
 * ✅ 书签卡片迁移示例
 *
 * 展示如何迁移包含多个文本的复杂组件
 */
interface BookmarkCardProps {
  title: string;
  folder?: string;
  createdAt: Date;
}

export function BookmarkCard({ title, folder, createdAt }: BookmarkCardProps) {
  const t = useUiText();

  const handleDelete = () => {
    const confirm = window.confirm(t.bookmark.deleteConfirm);
    if (confirm) {
      // 执行删除操作
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold">{title}</h3>
      {folder && (
        <p className="text-sm text-muted-foreground">
          {t.bookmark.folder}: {folder}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t.bookmark.createdAt}: {createdAt.toLocaleDateString()}
      </p>
      <div className="flex gap-2 mt-2">
        <button>{t.common.edit}</button>
        <button onClick={handleDelete}>{t.common.delete}</button>
      </div>
    </div>
  );
}

// ============================================================================
// 语言切换器组件
// ============================================================================

/**
 * ✅ 语言切换器
 *
 * 允许用户在中文和英文之间切换
 */
import { useLanguageSwitch } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, toggleLanguage } = useLanguageSwitch();
  const t = useUiText();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select">{t.settings.language}:</label>
      <select
        id="language-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as "zh-CN" | "en-US")}
        className="border rounded px-2 py-1"
      >
        <option value="zh-CN">简体中文</option>
        <option value="en-US">English</option>
      </select>
      <button onClick={toggleLanguage} className="text-sm underline">
        {locale === "zh-CN" ? "Switch to English" : "切换到中文"}
      </button>
    </div>
  );
}

// ============================================================================
// 工具函数中使用 i18n
// ============================================================================

/**
 * ✅ 工具函数迁移示例
 *
 * 工具函数无法使用 Hook，需要使用静态导入
 */
import { uiText } from "@/lib/i18n";

export function validateEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: uiText.auth.invalidEmail, // "邮箱格式不正确" / "Invalid email format"
    };
  }

  return { valid: true };
}

export function getEmptyMessage(): string {
  return uiText.bookmark.empty; // "暂无收藏" / "No bookmarks yet"
}

// ============================================================================
// 服务端组件中使用 i18n
// ============================================================================

/**
 * ✅ 服务端组件迁移示例
 *
 * 服务端组件无法使用 Hook，需要根据请求获取语言
 */
// import { headers } from "next/headers";
// import { getMessages } from "@/lib/i18n";
//
// // 示例：服务端组件（未使用，仅作为示例代码）
// // async function ServerComponent() {
// //   const headersList = await headers();
// //   const acceptLanguage = headersList.get("accept-language") || "";
// //   const locale = acceptLanguage.includes("en") ? "en-US" : "zh-CN";
// //   const t = getMessages(locale);
// //
// //   return (
// //     <div>
// //       <h1>{t.bookmark.title}</h1>
// //       <p>{t.bookmark.empty}</p>
// //     </div>
// //   );
// // }
