/**
 * MD 阅读器详情页布局
 *
 * 注入内联 style 覆盖父级主布局 (main-layout-shell) 的 bg-gray-50 背景色。
 * 使用 <style> 标签而非 CSS 文件，确保在浏览器首次绘制时就生效，
 * 消除 SSR HTML 灰白背景→阅读器主题色的闪烁。
 *
 * 配合 layout.tsx 中的阻塞脚本设置的 data-reader-page 属性使用。
 */

export default function MdCollectionDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* 内联 CSS：确保 SSR HTML 中就包含覆盖规则，不依赖外部 CSS 加载时序 */}
      <style
        dangerouslySetInnerHTML={{
          __html: `.main-layout-shell { background-color: var(--reader-bg, #ffffff) !important; }`,
        }}
      />
      {children}
    </>
  );
}
