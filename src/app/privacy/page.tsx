// 标记为动态路由
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "隐私政策 - AnyKeep",
  description: "AnyKeep 智能收藏助手隐私政策说明",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background py-8 md:py-12">
      <div className="container mx-auto max-w-3xl px-4 md:px-6">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            隐私政策 (Privacy Policy)
          </h1>
          <p className="text-muted-foreground text-sm">
            更新日期：2026年1月28日 | 生效日期：2026年1月28日
          </p>
        </header>

        <Separator className="my-6" />

        <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6 md:space-y-8 prose-headings:scroll-mt-20 prose-a:break-all">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              1. 概述
            </h2>
            <p className="text-muted-foreground leading-7">
              AnyKeep（以下简称&quot;我们&quot;）非常重视您的隐私保护。本隐私政策旨在向您说明在您使用
              AnyKeep
              网页应用、移动端应用及浏览器扩展时，我们如何收集、使用、存储和保护您的个人信息。
              <br />
              一旦您使用我们的服务，即表示您同意本政策所述的数据处理方式。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              2. 我们收集的信息
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground/90">
                  2.1 账户信息
                </h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                  <li>
                    <strong>必要信息：</strong>
                    电子邮件地址（用于唯一身份识别、登录验证及重要通知）。
                  </li>
                  <li>
                    <strong>可选信息：</strong>用户名、头像等个人资料信息。
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground/90">
                  2.2 收藏内容数据
                </h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
                  <li>您主动保存的网页链接（URL）、标题及页面摘要。</li>
                  <li>您创建的文件夹结构、标签体系。</li>
                  <li>
                    AnyKeep AI 系统为您生成的内容摘要、分类建议及关联推荐数据。
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2 text-foreground/90">
                  2.3 浏览器扩展数据
                </h3>
                <p className="text-muted-foreground text-sm leading-6">
                  我们的浏览器扩展（Chrome/Edge Extension）仅在您
                  <strong>主动点击</strong>&quot;保存到
                  AnyKeep&quot;或使用快捷键触发保存时，才会读取当前活动标签页的
                  URL 和标题。
                  <br />
                  <span className="font-medium text-foreground/80">
                    严正声明：
                  </span>
                  我们绝不会在后台静默跟踪、记录或上传您的浏览历史记录。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              3. 信息使用方式
            </h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-7">
              <li>
                <strong>核心服务提供：</strong>处理您的收藏请求，执行 AI
                智能分类与摘要生成。
              </li>
              <li>
                <strong>功能改进：</strong>
                分析匿名化的使用数据以优化算法准确率（如分类推荐）。
              </li>
              <li>
                <strong>服务通知：</strong>
                发送账户安全提醒、服务变更通知（不包含营销广告，除非您明确订阅）。
              </li>
              <li>
                <strong>客户支持：</strong>响应您的反馈、故障申报及使用咨询。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              4. 数据存储与安全
            </h2>
            <div className="bg-muted/30 p-4 rounded-md border text-sm text-muted-foreground space-y-2">
              <p>
                <strong>存储架构：</strong>您的数据存储在基于 Supabase
                构建的安全云数据库中。
              </p>
              <p>
                <strong>安全机制：</strong>我们采用行级安全策略（RLS - Row Level
                Security）从数据库底层确保数据隔离，只有通过身份验证的您本人才能访问您的私有数据。
              </p>
              <p>
                <strong>传输加密：</strong>
                客户端与服务器之间的所有数据传输均采用 HTTPS/TLS 强加密协议。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              5. 第三方信息共享
            </h2>
            <p className="text-muted-foreground leading-7">
              我们承诺<strong>不会</strong>
              出售您的个人信息。仅在以下特定情形下可能会共享必要信息：
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>
                <strong>AI 服务提供商：</strong>
                为了生成摘要，部分匿名化的文本内容可能会发送至 OpenAI/Anthropic
                等合规 AI 接口处理（不包含您的个人身份信息）。
              </li>
              <li>
                <strong>法律合规：</strong>
                响应法律程序、法院命令或政府强制性要求。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              6. 用户权利
            </h2>
            <p className="text-muted-foreground mb-2">
              您可以随时行使以下权利：
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>访问、修正或导出您的个人数据。</li>
              <li>
                删除特定收藏内容或彻底注销账号（注销后数据将物理删除且不可恢复）。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              7. 联系我们
            </h2>
            <p className="text-muted-foreground">
              如对本政策有任何疑问，请通过 GitHub 项目主页联系我们：
              <a
                href="https://github.com/anykeep/anykeep"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                https://github.com/anykeep/anykeep
              </a>
            </p>
          </section>
        </article>

        <div className="mt-8 md:mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <Link
            href="/home"
            className="hover:text-foreground transition-colors py-2 md:py-0"
          >
            ← 返回首页
          </Link>
          <Link
            href="/terms"
            className="hover:text-foreground transition-colors py-2 md:py-0"
          >
            查看用户协议 →
          </Link>
        </div>
      </div>
    </div>
  );
}
