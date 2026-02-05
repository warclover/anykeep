# UI 文本国际化迁移指南

本文档说明如何将硬编码的中文文本迁移到国际化系统。

## 快速开始

### 1. 使用 Hook（推荐）

```tsx
// 之前
function MyComponent() {
  return <Button>确认</Button>;
}

// 之后
import { useUiText } from "@/lib/i18n";

function MyComponent() {
  const t = useUiText();
  return <Button>{t.common.confirm}</Button>;
}
```

### 2. 使用静态常量（非组件或工具函数）

```tsx
// 之前
export function validate() {
  throw new Error("邮箱格式不正确");
}

// 之后
import { uiText } from "@/lib/i18n";

export function validate() {
  throw new Error(uiText.auth.invalidEmail);
}
```

### 3. 带参数的文本

```tsx
// 语言文件中定义
// "deleteMultipleConfirm": "确定要删除选中的 {count} 个收藏吗？"

// 使用时
function DeleteConfirm({ count }: { count: number }) {
  const t = useUiText();
  const message = t.bookmark.deleteMultipleConfirm.replace(
    "{count}",
    String(count),
  );
  return <Alert>{message}</Alert>;
}
```

## 迁移优先级

### 高优先级

- 用户可见的按钮文本
- 表单标签和占位符
- 错误消息和提示
- 导航菜单项

### 中优先级

- 工具提示 (tooltip)
- 空状态消息
- 成功/失败提示

### 低优先级

- 控制台日志
- 开发者调试信息
- 内部注释

## 添加新的翻译

1. 编辑 `src/lib/messages/zh-CN.json` 添加中文文本
2. 编辑 `src/lib/messages/en-US.json` 添加英文翻译
3. 使用类型安全的路径访问

```json
// zh-CN.json
{
  "myFeature": {
    "title": "我的功能",
    "description": "��是一个新功能"
  }
}

// en-US.json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is a new feature"
  }
}
```

## 语言切换

用户可以通过设置页面切换语言，也可以在代码中实现语言切换按钮：

```tsx
import { useLanguageSwitch } from "@/lib/i18n";

function LanguageSwitcher() {
  const { locale, setLocale, toggleLanguage } = useLanguageSwitch();

  return (
    <Select value={locale} onValueChange={setLocale}>
      <SelectItem value="zh-CN">简体中文</SelectItem>
      <SelectItem value="en-US">English</SelectItem>
    </Select>
  );
}
```

## 注意事项

1. **不要拼接字符串** - 使用参数替换

   ```tsx
   // ❌ 错误
   const message = `已选择 ${count} 项`;

   // ✅ 正确
   const message = t.batch.selected.replace("{count}", String(count));
   ```

2. **复数处理** - 中文不需要复数，但英文需要

   ```json
   // zh-CN.json
   "total": "共 {count} 项"

   // en-US.json
   "total": "{count} items total"
   ```

3. **日期和数字格式** - 使用 `date-fns` 或 `Intl` API

   ```tsx
   import { format } from "date-fns";
   import { zhCN, enUS } from "date-fns/locale";

   const locale = useLocale();
   const dateLocale = locale === "zh-CN" ? zhCN : enUS;
   format(new Date(), "PPPP", { locale: dateLocale });
   ```

## 待迁移文件清单

根据代码分析，以下文件包含硬编码中文文本（约 399 个文件）：

### 优先迁移（高频使用）

- [ ] `src/components/bookmark/bookmark-card.tsx`
- [ ] `src/components/batch/batch-page-client.tsx`
- [ ] `src/components/ai/ai-message-enhanced.tsx`
- [ ] `src/components/folders/folder-card.tsx`
- [ ] `src/components/settings/settings-page-client.tsx`
- [ ] `src/components/layout/app-sidebar.tsx`
- [ ] `src/components/layout/mobile-menu.tsx`

### 按模块迁移

- [ ] `src/components/bookmark/**/*` (~50 文件)
- [ ] `src/components/folders/**/*` (~30 文件)
- [ ] `src/components/ai/**/*` (~40 文件)
- [ ] `src/components/batch/**/*` (~15 文件)
- [ ] `src/components/settings/**/*` (~25 文件)
- [ ] `src/components/layout/**/*` (~20 文件)

## 进度跟踪

- [ ] Phase 1: 核心组件迁移（导航、按钮、表单）
- [ ] Phase 2: 功能模块迁移（收藏、文件夹、AI）
- [ ] Phase 3: 设置页面迁移
- [ ] Phase 4: 错误消息和提示迁移
- [ ] Phase 5: 测试文件迁移（可选）
