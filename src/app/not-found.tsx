/**
 * 404 错误页面
 * 当用户访问不存在的页面时显示
 *
 * ⚠️ 架构约束（Next.js 14 App Router）：
 * - 此组件被根 layout.tsx 包裹（提供 <html>、<body>、RootProviders）
 * - 不要导入 RootProviders（会拉入巨大的 client bundle → webpack 模块解析崩溃）
 * - 不要定义 <html>/<body>（会与 layout.tsx 冲突）
 * - 使用原生 <a> 而非 Next.js Link，避免拉入额外的客户端模块
 */

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold">404</h1>
        <h2 className="mb-6 text-2xl font-semibold">页面未找到</h2>
        <p className="mb-8 text-gray-500">抱歉，您访问的页面不存在</p>
        <a
          href="/home"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          返回首页
        </a>
      </div>
    </div>
  );
}
