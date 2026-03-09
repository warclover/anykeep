/**
 * Few-shot 示例库
 *
 * 为每种内容类型提供高质量的 Few-shot 示例，
 * 用于引导 AI 生成符合预期格式和质量的结构化摘要。
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import type { StructuredSummary } from "@/lib/summary/types/ai-summary";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Few-shot 示例结构
 */
export interface FewShotExample {
  /** 输入内容 */
  input: {
    /** 标题 */
    title: string;
    /** 内容片段（前 200 字） */
    contentSnippet: string;
  };
  /** 期望输出 */
  output: StructuredSummary;
}

// ============================================================================
// Few-shot 示例定义
// ============================================================================

/**
 * 技术文章示例
 */
const ARTICLE_EXAMPLES: FewShotExample[] = [
  {
    input: {
      title: "深入理解 React Server Components 的工作原理",
      contentSnippet:
        "React Server Components（RSC）是 React 团队推出的全新架构模式，它允许组件在服务端渲染并将结果以特殊格式流式传输到客户端。与传统 SSR 不同，RSC 不会将组件代码发送到客户端，从而大幅减少 JavaScript 包体积。本文将从底层协议、序列化机制和流式传输三个维度，详细剖析 RSC 的核心工作原理，并结合 Next.js App Router 的实际案例进行说明。",
    },
    output: {
      tldr: "深度解析 React Server Components 的底层协议、序列化机制和流式传输原理",
      key_points: [
        "RSC 组件仅在服务端执行，不会向客户端发送组件代码，显著减少包体积",
        "RSC 使用专有的 Flight 协议进行序列化，支持流式传输渲染结果",
        "与传统 SSR 的本质区别在于组件代码的分发策略和状态管理方式",
        "Next.js App Router 默认采用 RSC 模式，通过 'use client' 指令区分边界",
      ],
      keywords: [
        "React Server Components",
        "Flight 协议",
        "流式渲染",
        "Next.js",
        "SSR",
      ],
      sentiment: "neutral",
      reading_time: 12,
    },
  },
];

/**
 * 编程教程示例
 */
const TUTORIAL_EXAMPLES: FewShotExample[] = [
  {
    input: {
      title: "从零搭建一个生产级 Monorepo：Turborepo + pnpm 实战指南",
      contentSnippet:
        "本教程将手把手教你使用 Turborepo 和 pnpm workspace 搭建一个包含前端应用、组件库和工具包的 Monorepo 项目。我们会覆盖项目初始化、workspace 配置、共享 TypeScript 配置、CI/CD 集成等关键环节。最终你将获得一个可直接用于生产的项目模板，支持增量构建和远程缓存。前置知识要求：熟悉 Node.js 和 TypeScript 基础。",
    },
    output: {
      tldr: "使用 Turborepo + pnpm 从零搭建生产级 Monorepo 的完整实战教程",
      key_points: [
        "使用 pnpm workspace 管理多个子包，实现依赖统一和代码复用",
        "Turborepo 提供增量构建和远程缓存，显著提升 CI/CD 效率",
        "共享 TypeScript 和 ESLint 配置，确保多包代码风格一致",
        "涵盖从初始化到 CI/CD 集成的完整流程，可直接用于生产环境",
      ],
      keywords: [
        "Turborepo",
        "pnpm workspace",
        "Monorepo",
        "增量构建",
        "CI/CD",
      ],
      sentiment: "positive",
      reading_time: 20,
      action_items: [
        "使用 pnpm create turbo@latest 初始化项目",
        "配置 pnpm-workspace.yaml 定义包结构",
        "创建共享 tsconfig 和 eslint-config 包",
        "配置 Turborepo pipeline 定义构建依赖关系",
        "集成 GitHub Actions 并启用 Remote Caching",
      ],
    },
  },
];

/**
 * 科技新闻示例
 */
const NEWS_EXAMPLES: FewShotExample[] = [
  {
    input: {
      title: "OpenAI 发布 GPT-5：多模态推理能力大幅提升，API 价格下降 60%",
      contentSnippet:
        "OpenAI 于今日正式发布 GPT-5 模型，在数学推理、代码生成和多模态理解三个维度实现了显著提升。根据官方基准测试，GPT-5 在 MATH 基准上得分 92.3%，较 GPT-4 提升 15 个百分点。同时，API 调用价格大幅下调 60%，输入 Token 价格降至 $2.5/百万。CEO Sam Altman 表示，GPT-5 将在未来两周内向所有 ChatGPT Plus 用户开放。",
    },
    output: {
      tldr: "OpenAI 发布 GPT-5，推理能力大幅提升且 API 价格下降 60%",
      key_points: [
        "GPT-5 在 MATH 基准测试得分 92.3%，较 GPT-4 提升 15 个百分点",
        "API 价格大幅下调 60%，输入 Token 降至 $2.5/百万 Token",
        "多模态推理、代码生成和数学推理三个方向均有显著进步",
        "将在两周内向所有 ChatGPT Plus 用户开放使用",
      ],
      keywords: ["GPT-5", "OpenAI", "多模态", "API 定价", "大语言模型"],
      sentiment: "positive",
      reading_time: 3,
    },
  },
];

/**
 * 观点评论示例
 */
const OPINION_EXAMPLES: FewShotExample[] = [
  {
    input: {
      title: "为什么我认为 Tailwind CSS 正在伤害前端工程化",
      contentSnippet:
        "Tailwind CSS 无疑是近年来最流行的 CSS 框架之一，但我认为它的广泛采用正在对前端工程化产生负面影响。首先，utility-first 的理念本质上是将样式逻辑内联到 HTML 中，这违背了关注点分离原则。其次，当项目规模增大时，className 字符串会变得极其冗长且难以维护。更关键的是，团队成员需要记忆大量非标准的类名缩写，增加了认知负担。我并非否定 Tailwind 的价值，但我们需要正视它带来的工程化隐患。",
    },
    output: {
      tldr: "作者认为 Tailwind CSS 的 utility-first 模式违背关注点分离，在大型项目中存在工程化隐患",
      key_points: [
        "核心论点：utility-first 将样式内联到 HTML，违背关注点分离原则",
        "大型项目中 className 字符串冗长难维护，降低代码可读性",
        "非标准类名缩写增加团队认知负担和学习成本",
        "作者承认 Tailwind 的价值但呼吁正视其工程化弊端",
      ],
      keywords: [
        "Tailwind CSS",
        "关注点分离",
        "前端工程化",
        "CSS 框架",
        "代码可维护性",
      ],
      sentiment: "negative",
      reading_time: 6,
    },
  },
];

/**
 * 技术视频示例
 */
const VIDEO_EXAMPLES: FewShotExample[] = [
  {
    input: {
      title: "【实战演示】10 分钟用 Cursor AI 重构一个 React 组件",
      contentSnippet:
        "本期视频我将现场演示如何使用 Cursor AI 编辑器对一个 500 行的 React 表单组件进行重构。我们会将巨型组件拆分为多个子组件，提取自定义 Hook 管理表单状态，并利用 Cursor 的 AI 辅助功能自动生成 TypeScript 类型和单元测试。整个过程仅需 10 分钟，展示 AI 辅助开发如何显著提升代码质量和开发效率。适合有一定 React 基础的开发者观看。",
    },
    output: {
      tldr: "演示使用 Cursor AI 在 10 分钟内完成 React 大组件重构的全流程",
      key_points: [
        "将 500 行巨型组件拆分为职责单一的子组件",
        "提取自定义 Hook 统一管理表单状态逻辑",
        "利用 Cursor AI 辅助生成 TypeScript 类型和单元测试",
        "展示 AI 辅助开发在代码重构场景下的效率提升",
      ],
      keywords: ["Cursor AI", "React 重构", "组件拆分", "AI 编程", "代码质量"],
      sentiment: "positive",
      reading_time: 10,
    },
  },
];

/**
 * 工具推荐示例
 */
const TOOL_EXAMPLES: FewShotExample[] = [
  {
    input: {
      title: "Biome：取代 ESLint + Prettier 的下一代前端工具链",
      contentSnippet:
        "Biome 是一个用 Rust 编写的高性能前端工具链，目标是统一代码检查（lint）和格式化（format）功能，替代 ESLint + Prettier 的组合。根据官方基准测试，Biome 的格式化速度比 Prettier 快 25 倍，lint 速度比 ESLint 快 15 倍。它开箱即用，几乎不需要配置，支持 JavaScript、TypeScript、JSX、JSON 和 CSS。迁移成本极低，提供一键迁移命令 biome migrate，可自动转换现有的 ESLint 和 Prettier 配置。",
    },
    output: {
      tldr: "Biome 是 Rust 编写的前端工具链，统一 lint 和 format，性能远超 ESLint + Prettier",
      key_points: [
        "Rust 实现，格式化比 Prettier 快 25 倍，lint 比 ESLint 快 15 倍",
        "统一代码检查和格式化功能，减少工具链配置复杂度",
        "开箱即用，支持 JS/TS/JSX/JSON/CSS，几乎零配置",
        "提供 biome migrate 一键迁移命令，迁移成本极低",
      ],
      keywords: ["Biome", "Rust", "ESLint", "Prettier", "前端工具链"],
      sentiment: "positive",
      reading_time: 5,
      action_items: [
        "使用 npm install --save-dev @biomejs/biome 安装",
        "运行 biome migrate 自动转换现有 ESLint/Prettier 配置",
        "在 CI/CD 中替换 eslint 和 prettier 命令为 biome check",
      ],
    },
  },
];

/**
 * 案例分析示例
 */
const CASE_STUDY_EXAMPLES: FewShotExample[] = [
  {
    input: {
      title: "字节跳动如何将首屏加载时间从 3.2s 优化到 0.8s",
      contentSnippet:
        "本文记录了字节跳动某核心业务前端团队将移动端 H5 页面首屏加载时间从 3.2 秒优化至 0.8 秒的完整过程。优化分三个阶段进行：第一阶段通过代码分割和 Tree Shaking 将 JS 包体积从 1.2MB 减少到 380KB；第二阶段引入 SSR + 流式渲染，将 FCP 从 2.1s 降至 0.6s；第三阶段优化资源加载策略，采用关键 CSS 内联和图片懒加载。最终 LCP 指标达到 0.8s，用户转化率提升 23%。",
    },
    output: {
      tldr: "字节跳动通过代码分割、SSR 流式渲染和资源加载优化，将首屏加载从 3.2s 降至 0.8s",
      key_points: [
        "代码分割 + Tree Shaking 将 JS 包体积从 1.2MB 减少到 380KB",
        "SSR + 流式渲染使 FCP 从 2.1s 降至 0.6s",
        "关键 CSS 内联 + 图片懒加载进一步优化资源加载",
        "LCP 最终达到 0.8s，用户转化率提升 23%",
        "优化分三阶段渐进推进，每阶段聚焦不同瓶颈",
      ],
      keywords: ["性能优化", "首屏加载", "SSR", "代码分割", "Core Web Vitals"],
      sentiment: "positive",
      reading_time: 15,
    },
  },
];

/**
 * API 文档 / 参考资料示例
 */
const REFERENCE_EXAMPLES: FewShotExample[] = [
  {
    input: {
      title: "Supabase JavaScript SDK - 实时订阅 API 参考",
      contentSnippet:
        "Realtime 模块允许你监听 PostgreSQL 数据库的实时变更。使用 supabase.channel() 创建频道，通过 .on() 方法订阅 INSERT、UPDATE、DELETE 事件。支持行级过滤（filter）和自定义 Payload 转换。基本用法：const channel = supabase.channel('room1').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => { console.log(payload.new) }).subscribe()。取消订阅使用 supabase.removeChannel(channel)。",
    },
    output: {
      tldr: "Supabase Realtime API 参考：通过 channel 和 on 方法订阅 PostgreSQL 数据库实时变更",
      key_points: [
        "使用 supabase.channel() 创建频道，.on() 订阅数据库变更事件",
        "支持 INSERT/UPDATE/DELETE 三种事件类型的监听",
        "支持行级过滤（filter）精确控制订阅范围",
        "使用 supabase.removeChannel() 取消订阅释放资源",
      ],
      keywords: ["Supabase", "Realtime", "WebSocket", "PostgreSQL", "实时订阅"],
      sentiment: "neutral",
      reading_time: 4,
    },
  },
];

// ============================================================================
// 导出
// ============================================================================

/**
 * 全部 Few-shot 示例，按内容类型索引
 */
export const FEW_SHOT_EXAMPLES: Record<string, FewShotExample[]> = {
  article: ARTICLE_EXAMPLES,
  tutorial: TUTORIAL_EXAMPLES,
  news: NEWS_EXAMPLES,
  opinion: OPINION_EXAMPLES,
  video: VIDEO_EXAMPLES,
  tool: TOOL_EXAMPLES,
  case_study: CASE_STUDY_EXAMPLES,
  reference: REFERENCE_EXAMPLES,
};

/**
 * 将 StructuredSummary 格式化为 JSON 字符串（缩进 2 空格）
 */
function formatOutput(output: StructuredSummary): string {
  return JSON.stringify(output, null, 2);
}

/**
 * 获取指定内容类型的格式化 Few-shot 示例文本
 *
 * 返回可直接拼入 Prompt 的参考示例文本。
 * 如果指定类型没有示例，回退到 article 类型。
 *
 * @param contentType - 内容类型标识
 * @returns 格式化的示例文本
 *
 * @example
 * ```typescript
 * const examples = getFewShotExamples("tutorial");
 * // 返回:
 * // 【参考示例】
 * // 输入标题：从零搭建一个生产级 Monorepo...
 * // 输入内容片段：本教程将手把手教你...
 * // 期望输出：
 * // { "tldr": "...", ... }
 * ```
 */
export function getFewShotExamples(contentType: string): string {
  const examples =
    FEW_SHOT_EXAMPLES[contentType] ?? FEW_SHOT_EXAMPLES["article"];

  if (!examples || examples.length === 0) {
    return "";
  }

  const parts: string[] = [];

  for (const example of examples) {
    parts.push(
      [
        "【参考示例】",
        `输入标题：${example.input.title}`,
        `输入内容片段：${example.input.contentSnippet}`,
        "期望输出：",
        formatOutput(example.output),
      ].join("\n"),
    );
  }

  return parts.join("\n\n");
}
