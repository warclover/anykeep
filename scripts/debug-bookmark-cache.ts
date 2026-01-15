/**
 * 调试书签缓存工具
 * 用于清除特定文件夹的缓存，解决移动书签后UI不刷新的问题
 *
 * 使用方式：
 * ```bash
 * # 在浏览器控制台执行（需要在 AnyKeep 页面）
 * localStorage.removeItem('anykeep:cache:bookmarks:all:created_desc::')
 * localStorage.removeItem('anykeep:cache:bookmarks::created_desc:32:')
 * location.reload()
 * ```
 *
 * @version 1.0.0
 * @since 2026-01-15
 */

console.log(`
🔧 AnyKeep 缓存调试工具
========================

问题：移动书签后UI不显示新数据

原因：SWR 缓存未失效

解决方案：清除相关缓存并刷新页面

执行以下命令：
`);

// 获取所有相关的缓存键
const cacheKeys = Object.keys(localStorage).filter((key) =>
  key.startsWith("anykeep:cache:bookmarks"),
);

console.log("📋 当前缓存键列表：");
cacheKeys.forEach((key) => {
  console.log(`  - ${key}`);
});

console.log(`
\n🗑️  清除特定文件夹缓存（folder_id=32）：
localStorage.removeItem('anykeep:cache:bookmarks::created_desc:32:');

\n🗑️  清除所有书签缓存：
${cacheKeys.map((key) => `localStorage.removeItem('${key}');`).join("\n")}

\n🔄 刷新页面：
location.reload();
`);

// 提供快捷清除函数
(window as any).clearBookmarkCache = (folderId?: string) => {
  const keysToRemove = cacheKeys.filter((key) => {
    if (!folderId) return true;
    return key.includes(`:${folderId}:`);
  });

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  console.log(`✅ 已清除 ${keysToRemove.length} 个缓存键`);
  console.log("🔄 正在刷新页面...");
  setTimeout(() => location.reload(), 500);
};

console.log(`
\n💡 快捷方式：
// 清除特定文件夹缓存
clearBookmarkCache('32')

// 清除所有书签缓存
clearBookmarkCache()
`);
