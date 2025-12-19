/**
 * 主内容区包装器
 *
 * Phase 6 优化：CSS Grid 布局下，主内容区固定在第二列
 * - 不再响应侧边栏宽度变化（由 Grid 自动处理）
 * - 消除 marginLeft 过渡动画导致的 Layout Thrashing
 * - 仅保留基础样式，提高渲染性能
 */

interface MainContentWrapperProps {
  children: React.ReactNode;
}

export function MainContentWrapper({ children }: MainContentWrapperProps) {
  return (
    <main className="min-w-0 h-full overflow-y-auto p-4 md:p-6 pb-20 lg:pb-6">
      {children}
    </main>
  );
}
