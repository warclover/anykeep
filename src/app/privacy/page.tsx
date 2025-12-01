// 标记为动态路由
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私政策 - AnyKeep",
  description: "AnyKeep 智能收藏助手隐私政策",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold mb-8">隐私政策</h1>
        <p className="text-muted-foreground mb-6">最后更新日期：2025年1月</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">概述</h2>
            <p className="text-muted-foreground">
              AnyKeep（以下简称「我们」）非常重视用户隐私。本隐私政策说明了我们在您使用
              AnyKeep 网页应用和浏览器扩展时如何收集、使用和保护您的信息。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">我们收集的信息</h2>
            <h3 className="text-lg font-medium mb-2">账户信息</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>电子邮件地址（用于账户注册和登录）</li>
              <li>用户名（可选）</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">收藏内容</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>您主动保存的网页 URL 和标题</li>
              <li>您创建的文件夹和标签</li>
              <li>AI 生成的摘要和建议标签</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">浏览器扩展</h3>
            <p className="text-muted-foreground">
              我们的浏览器扩展仅在您主动点击保存时才会读取当前页面的 URL
              和标题。 我们不会跟踪或记录您的浏览历史。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">我们如何使用信息</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>提供、维护和改进我们的服务</li>
              <li>处理您的收藏请求和内容分析</li>
              <li>发送服务相关通知</li>
              <li>提供客户支持</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">信息存储与安全</h2>
            <p className="text-muted-foreground">
              您的数据存储在 Supabase
              提供的安全数据库中，采用行级安全策略（RLS）确保
              用户只能访问自己的数据。我们使用 HTTPS 加密传输所有数据。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">信息共享</h2>
            <p className="text-muted-foreground">
              我们不会出售、交易或以其他方式将您的个人信息转让给第三方，除非：
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
              <li>获得您的明确同意</li>
              <li>法律要求</li>
              <li>保护我们或他人的权利、财产或安全</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">您的权利</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>访问和导出您的数据</li>
              <li>更正不准确的信息</li>
              <li>删除您的账户和数据</li>
              <li>撤回同意</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Cookie 使用</h2>
            <p className="text-muted-foreground">
              我们使用必要的 Cookie 来维持您的登录状态和偏好设置。 这些 Cookie
              对于服务的正常运行是必需的。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">政策变更</h2>
            <p className="text-muted-foreground">
              我们可能会不时更新本隐私政策。任何变更都会在此页面上发布，
              并更新「最后更新日期」。建议您定期查看本政策。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">联系我们</h2>
            <p className="text-muted-foreground">
              如果您对本隐私政策有任何疑问，请通过以下方式联系我们：
            </p>
            <p className="text-muted-foreground mt-2">
              GitHub:{" "}
              <a
                href="https://github.com/anykeep/anykeep"
                className="text-primary hover:underline"
              >
                https://github.com/anykeep/anykeep
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t">
          <a href="/home" className="text-primary hover:underline">
            ← 返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
