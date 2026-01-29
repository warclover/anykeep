import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Link,
  Hr,
  Preview,
  Tailwind,
  Row,
  Column,
} from "@react-email/components";
import * as React from "react";
import type { LedgerResult } from "../../ledger/types/ledger.types";

/** 周报邮件文案常量 */
const WEEKLY_DIGEST_COPY = {
  /** 默认预览文案（无 AI 摘要时） */
  DEFAULT_PREVIEW: "本周知识回顾",
} as const;

interface WeeklyDigestEmailProps {
  digest: NonNullable<LedgerResult>;
  username?: string;
}

export const WeeklyDigestEmail = ({
  digest,
  username = "知识探索者",
}: WeeklyDigestEmailProps) => {
  const { aiSummary, content } = digest;

  // Extract bookmark items
  const bookmarks = content.filter((c) => c.type === "bookmark").slice(0, 5);
  const rediscover = content.find((c) => c.type === "rediscover");

  return (
    <Html>
      <Head />
      <Preview>
        AnyKeep 周报：
        {aiSummary?.slice(0, 50) ?? WEEKLY_DIGEST_COPY.DEFAULT_PREVIEW}...
      </Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            {/* Header */}
            <Section className="mt-[32px]">
              <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                AnyKeep <strong>Weekly Digest</strong>
              </Heading>
            </Section>

            {/* AI Summary (Persona based) */}
            <Section className="bg-gray-50 p-6 rounded-lg mb-6">
              <Text className="text-black text-[14px] leading-[24px]">
                {aiSummary || `你好 ${username}，这是你本周的收藏汇总。`}
              </Text>
            </Section>

            {/* Top Picks */}
            <Section>
              <Heading
                as="h3"
                className="text-[18px] font-medium text-gray-900 mb-4"
              >
                本周精选 ({digest.itemCount})
              </Heading>

              {bookmarks.map((item) => (
                <Section
                  key={item.id}
                  className="mb-6 border-b border-gray-100 pb-6 last:border-0"
                >
                  <Text className="text-[16px] font-medium text-gray-900 m-0 mb-2">
                    <Link
                      href={item.url}
                      className="text-blue-600 no-underline"
                    >
                      {item.title}
                    </Link>
                  </Text>
                  <Text className="text-[12px] text-gray-500 m-0 mb-3">
                    {item.platform} · {item.time.split(" ")[0]}
                  </Text>

                  {/* Action Bar (Deep Links) */}
                  <Row>
                    <Column>
                      <Link
                        href={`https://anykeep.app/api/action/archive?id=${item.id}`}
                        className="text-[12px] text-gray-500 underline mr-4"
                      >
                        一键归档
                      </Link>
                      <Link
                        href={`https://anykeep.app/api/action/delete?id=${item.id}`}
                        className="text-[12px] text-gray-500 underline text-red-500"
                      >
                        删除
                      </Link>
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>

            {/* Serendipity / Rediscover */}
            {rediscover && (
              <Section className="bg-blue-50 p-6 rounded-lg mt-4 border border-blue-100">
                <Heading
                  as="h3"
                  className="text-[16px] font-medium text-blue-900 m-0 mb-2 flex items-center"
                >
                  ✨ 意外发现
                </Heading>
                <Text className="text-[14px] text-blue-800 m-0 mb-3">
                  你这周关注的内容，让我们想起了这篇旧文：
                </Text>
                <div className="bg-white p-3 rounded border border-blue-100">
                  <Link
                    href={rediscover.url}
                    className="text-[14px] font-medium text-blue-600 block mb-1"
                  >
                    {rediscover.title}
                  </Link>
                  <Text className="text-[12px] text-gray-500 m-0">
                    收藏于 {rediscover.time.split(" ")[0]}
                  </Text>
                </div>
              </Section>
            )}

            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

            <Text className="text-[#666666] text-[12px] leading-[24px]">
              此邮件由 AnyKeep 自动发送。
              <br />
              <Link
                href="https://anykeep.app/settings"
                className="text-gray-500 underline"
              >
                管理通知设置
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WeeklyDigestEmail;
