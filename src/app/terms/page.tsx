// 标记为动态路由
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "用户协议 - AnyKeep",
  description: "AnyKeep 用户服务协议与使用条款",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background py-8 md:py-12">
      <div className="container mx-auto max-w-3xl px-4 md:px-6">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            用户协议 (Terms of Service)
          </h1>
          <p className="text-muted-foreground text-sm">
            生效日期：2026年1月28日 | 版本：1.0
          </p>
        </header>

        <Separator className="my-6" />

        <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6 md:space-y-8 prose-headings:scroll-mt-20 prose-a:break-all">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              1. 特别提示
            </h2>
            <p className="text-muted-foreground leading-7">
              欢迎使用
              AnyKeep（以下简称&quot;本服务&quot;）。在使用本服务之前，请您务必审慎阅读、充分���解本协议各条款内容，特别是免除或者限制责任的条款、法律适用和争议解决条款。
              <br />
              当您开始使用 AnyKeep
              服务（包括但不限于注册账户、访问网站、使用浏览器扩展）时，即表示您已阅读并同意接受本协议的所有条款约束。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              2. 服务内容
            </h2>
            <p className="text-muted-foreground leading-7">
              AnyKeep 是一款跨平台智能内容聚合工具，提供包括但不限于以下服务：
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>跨平台内容收藏与管理（支持微信公众号、B站、小红书等）</li>
              <li>AI 智能摘要、自动标签生成与语义搜索</li>
              <li>数据跨设备同步与浏览器书签导入</li>
              <li>内容导出与备份</li>
            </ul>
            <p className="text-muted-foreground mt-2 text-sm">
              我们保留随时变更、中断或终止部分或全部服务的权利。对于免费服务，我们不承担因服务终止而产生的任何责任。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              3. 用户账号与安全
            </h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>
                <strong>账号注册：</strong>您保证注册时提供的信息真实、准确。
              </li>
              <li>
                <strong>账号安全：</strong>
                您有责任妥善保管您的账号信息和密码。因您保管不善可能导致的损失，由您自行承担。
              </li>
              <li>
                <strong>禁止行为：</strong>
                您不得恶意注册账号，不得利用本服务进行违法违规活动，不得干扰服务的正常运行。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              4. 数据使用与隐私保护
            </h2>
            <p className="text-muted-foreground leading-7">
              我们重视您的隐私。关于我们如何收集、使用和保护您的个人信息，请参阅我们的
              <Link
                href="/privacy"
                className="text-primary hover:underline font-medium mx-1"
              >
                隐私政策
              </Link>
              。隐私政策构成本协议不可分割的一部分。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              5. 知识产权声明
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p>
                <strong>5.1 用户内容：</strong>
                您通过 AnyKeep
                收藏、保存的内容（如网页链接、摘要笔记），其知识产权归原权利人或您所有。AnyKeep
                不会对这些内容主张所有权。
              </p>
              <p>
                <strong>5.2 平台权利：</strong>
                AnyKeep 的软件系统、界面设计、商标、AI
                算法逻辑等均受版权法及其他知识产权法律保护，归 AnyKeep
                所有。未经授权，您不得复制、修改或逆向工程。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              6. 免责声明
            </h2>
            <p className="text-muted-foreground leading-7 bg-muted/30 p-4 rounded-md border text-sm">
              本服务按&quot;现状&quot;提供。我们在法律允许的范围内，不提供任何形式的明示或默示担保，包括但不限于适销性、特定用途适用性或不侵权担保。
              <br />
              <br />
              对于因使用本服务而导致的任何直接、间接、偶然、特殊或后果性的损害（包括数据丢失、业务中断），我们不承担责任，除��法律另有规定。
              <br />
              <br />
              <strong>AI 生成内容免责：</strong>本服务提供的 AI
              摘要和标签仅供参考，我们不保证其准确性、完整性或客观性。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              7. 协议修改
            </h2>
            <p className="text-muted-foreground leading-7">
              我们有权在必要时修改本协议条款。更新后的协议将在相关页面公布。如果您继续使用本服务，即视为您接受修改后的协议。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              8. 联系方式
            </h2>
            <p className="text-muted-foreground">
              如对本协议有任何疑问，请联系我们或访问 GitHub 项目主页：
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
            href="/privacy"
            className="hover:text-foreground transition-colors py-2 md:py-0"
          >
            查看隐私政策 →
          </Link>
        </div>
      </div>
    </div>
  );
}
