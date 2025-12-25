/**
 * 语义匹配器
 *
 * 基于领域关键词的语义相似度计算
 *
 * @module ai-generator/folder/semantic-matcher
 * @version 1.0.0
 */

/**
 * 领域关键词映射表（2025 年更新版）
 */
const SEMANTIC_KEYWORDS: Record<string, string[]> = {
  前端: [
    // 框架
    "react",
    "vue",
    "angular",
    "svelte",
    "solid",
    "qwik",
    // 元框架
    "next.js",
    "nextjs",
    "nuxt",
    "remix",
    "astro",
    "gatsby",
    // 语言
    "javascript",
    "typescript",
    "css",
    "html",
    "sass",
    "less",
    // 构建工具
    "webpack",
    "vite",
    "turbopack",
    "esbuild",
    "rollup",
    "parcel",
    // UI 库
    "tailwind",
    "shadcn",
    "radix",
    "chakra",
    "mui",
    "antd",
    // 包管理
    "npm",
    "pnpm",
    "yarn",
    "bun",
    // 其他
    "web",
    "前端",
    "组件",
    "状态管理",
    "redux",
    "zustand",
    "jotai",
  ],
  后端: [
    // 语言
    "java",
    "python",
    "node",
    "golang",
    "go",
    "rust",
    "php",
    "ruby",
    "c#",
    "dotnet",
    // 运行时
    "nodejs",
    "deno",
    "bun",
    // 框架
    "spring",
    "springboot",
    "django",
    "fastapi",
    "flask",
    "express",
    "nestjs",
    "koa",
    "gin",
    "fiber",
    "actix",
    "axum",
    // 数据库
    "mysql",
    "postgresql",
    "postgres",
    "mongodb",
    "redis",
    "sqlite",
    // ORM
    "prisma",
    "drizzle",
    "typeorm",
    "sequelize",
    "sqlalchemy",
    // BaaS
    "supabase",
    "firebase",
    "appwrite",
    "pocketbase",
    // 其他
    "api",
    "graphql",
    "rest",
    "grpc",
    "微服务",
    "后端",
    "服务端",
  ],
  设计: [
    // 工具
    "figma",
    "sketch",
    "adobe",
    "photoshop",
    "illustrator",
    "xd",
    "canva",
    "framer",
    "principle",
    "protopie",
    // 概念
    "ui",
    "ux",
    "用户体验",
    "交互",
    "界面",
    "视觉",
    "原型",
    "设计系统",
    "design system",
    "组件库",
    "图标",
    "动效",
  ],
  产品: [
    "需求",
    "功能",
    "用户研究",
    "pm",
    "prd",
    "产品经理",
    "竞品",
    "迭代",
    "用户体验",
    "增长",
    "留存",
    "转化",
    "mvp",
    "敏捷",
    "scrum",
    "okr",
    "北极星指标",
    "用户画像",
    "产品规划",
    "路线图",
    "roadmap",
  ],
  数据: [
    // 分析工具
    "sql",
    "pandas",
    "numpy",
    "excel",
    "tableau",
    "powerbi",
    "superset",
    // 数据库
    "clickhouse",
    "duckdb",
    "snowflake",
    "bigquery",
    "databricks",
    // 数据工程
    "spark",
    "flink",
    "kafka",
    "airflow",
    "dbt",
    "etl",
    // 可视化
    "可视化",
    "echarts",
    "d3",
    "plotly",
    // 概念
    "分析",
    "bi",
    "统计",
    "数据分析",
    "数据科学",
    "数据工程",
  ],
  移动: [
    // 原生
    "ios",
    "android",
    "swift",
    "kotlin",
    "swiftui",
    "jetpack compose",
    // 跨平台
    "flutter",
    "react native",
    "expo",
    "capacitor",
    "ionic",
    "tauri",
    // 小程序
    "小程序",
    "微信小程序",
    "uniapp",
    "taro",
    // 概念
    "移动开发",
    "app",
    "移动端",
  ],
  运维: [
    // 容器化
    "docker",
    "kubernetes",
    "k8s",
    "podman",
    "containerd",
    // CI/CD
    "devops",
    "ci/cd",
    "github actions",
    "gitlab ci",
    "jenkins",
    "argocd",
    // 云平台
    "aws",
    "azure",
    "gcp",
    "阿里云",
    "腾讯云",
    "华为云",
    // 基础设施
    "terraform",
    "pulumi",
    "ansible",
    "helm",
    // 边缘/Serverless
    "vercel",
    "cloudflare",
    "netlify",
    "serverless",
    "边缘计算",
    // 服务器
    "linux",
    "nginx",
    "caddy",
    "traefik",
    // 监控
    "prometheus",
    "grafana",
    "监控",
    "日志",
    "elk",
  ],
  AI: [
    // 基础概念
    "机器学习",
    "深度学习",
    "神经网络",
    "自然语言",
    "nlp",
    "cv",
    "计算机视觉",
    // 大模型通用术语
    "llm",
    "大模型",
    "大语言模型",
    "生成式ai",
    "aigc",
    "prompt",
    "提示词",
    // Anthropic/Claude 系列
    "claude",
    "anthropic",
    "claude code",
    "sonnet",
    "opus",
    "haiku",
    // OpenAI 系列
    "openai",
    "chatgpt",
    "gpt",
    "gpt-4",
    "gpt-4o",
    "gpt-4-turbo",
    "o1",
    "o1-pro",
    "o3",
    // Google 系列
    "gemini",
    "bard",
    "palm",
    "gemma",
    "google ai",
    // Meta 系列
    "llama",
    "llama2",
    "llama3",
    "meta ai",
    // 其他国际模型
    "mistral",
    "mixtral",
    "cohere",
    "perplexity",
    "groq",
    // 国产大模型
    "deepseek",
    "通义千问",
    "qwen",
    "文心一言",
    "ernie",
    "智谱",
    "glm",
    "chatglm",
    "kimi",
    "moonshot",
    "豆包",
    "字节",
    "讯飞星火",
    "百川",
    "minimax",
    "零一万物",
    "yi",
    // AI 编程工具
    "copilot",
    "github copilot",
    "cursor",
    "windsurf",
    "cline",
    "aider",
    "tabnine",
    "codeium",
    "replit",
    "v0",
    "bolt",
    "ai编程",
    "ai coding",
    // AI 开发框架
    "langchain",
    "llamaindex",
    "semantic kernel",
    "autogen",
    "crewai",
    "dify",
    // RAG 与向量
    "rag",
    "embedding",
    "向量",
    "向量数据库",
    "pinecone",
    "weaviate",
    "milvus",
    "chroma",
    "qdrant",
    "faiss",
    // Agent 相关
    "ai agent",
    "agent",
    "智能体",
    "mcp",
    "function calling",
    "tool use",
    "autogpt",
    "babyagi",
    "agents",
    // 训练技术
    "fine-tuning",
    "微调",
    "rlhf",
    "dpo",
    "lora",
    "qlora",
    "peft",
    "sft",
    "预训练",
    "对齐",
    "alignment",
    // 推理优化
    "量化",
    "quantization",
    "gguf",
    "ggml",
    "ollama",
    "vllm",
    "tgi",
    "推理",
    "inference",
    "本地部署",
    // 多模态 AI
    "多模态",
    "multimodal",
    "vision",
    "图像生成",
    "text-to-image",
    "midjourney",
    "mj",
    "dall-e",
    "stable diffusion",
    "sd",
    "sdxl",
    "flux",
    "comfyui",
    "automatic1111",
    "webui",
    // AI 视频
    "sora",
    "runway",
    "pika",
    "kling",
    "可灵",
    "ai视频",
    "text-to-video",
    // AI 语音
    "语音合成",
    "tts",
    "whisper",
    "语音识别",
    "asr",
    "elevenlabs",
    // AI 应用场景
    "ai助手",
    "智能助手",
    "对话机器人",
    "chatbot",
    "知识库",
    "ai写作",
    "ai绘画",
    "ai视频",
    "ai音乐",
    "ai翻译",
  ],
  学习: [
    "教程",
    "学习",
    "入门",
    "进阶",
    "实战",
    "课程",
    "培训",
    "笔记",
    "总结",
    "指南",
    "手册",
    "文档",
    "博客",
    "视频教程",
    "在线课程",
    "学习路径",
    "知识体系",
  ],
};

/**
 * 计算语义相似度得分
 *
 * @param folderName - 文件夹名称（小写）
 * @param tags - 标签数组
 * @returns 相似度得分（0-25）
 */
export function calculateSemanticSimilarity(
  folderName: string,
  tags: string[],
): number {
  let maxScore = 0;

  for (const [category, keywords] of Object.entries(SEMANTIC_KEYWORDS)) {
    if (folderName.includes(category.toLowerCase())) {
      for (const tag of tags) {
        const tagLower = tag.toLowerCase();
        for (const keyword of keywords) {
          if (tagLower.includes(keyword) || keyword.includes(tagLower)) {
            maxScore = Math.max(maxScore, 25);
            break;
          }
        }
      }
    } else {
      for (const keyword of keywords) {
        if (folderName.includes(keyword)) {
          if (
            tags.some((t) => t.toLowerCase().includes(category.toLowerCase()))
          ) {
            maxScore = Math.max(maxScore, 20);
          }
          break;
        }
      }
    }
  }

  return maxScore;
}

/**
 * 从标题提取关键词作为文件夹名建议
 */
export function extractKeyword(title: string): string {
  const keywords = [
    "前端",
    "后端",
    "编程",
    "技术",
    "AI",
    "人工智能",
    "产品",
    "设计",
    "UI",
    "UX",
    "运营",
    "营销",
    "管理",
    "创业",
    "投资",
    "理财",
    "生活",
    "健康",
    "学习",
    "教程",
    "读书",
    "影视",
    "音乐",
    "游戏",
    "美食",
    "旅行",
    "时尚",
    "科技",
    "新闻",
  ];

  for (const keyword of keywords) {
    if (title.includes(keyword)) {
      return keyword;
    }
  }

  return "";
}

/**
 * 从标题和标签中提取主导主题（降级策略）
 */
export function extractDominantTopic(titles: string[], tags: string[]): string {
  const tagCount = new Map<string, number>();
  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    if (normalized.length >= 2 && normalized.length <= 10) {
      tagCount.set(normalized, (tagCount.get(normalized) || 0) + 1);
    }
  }

  let maxTag = "";
  let maxCount = 0;
  for (const [tag, count] of tagCount) {
    if (count > maxCount) {
      maxCount = count;
      maxTag = tag;
    }
  }

  if (maxTag) {
    return maxTag;
  }

  const titleText = titles.join(" ");
  const commonKeywords = [
    "前端",
    "后端",
    "React",
    "Vue",
    "Node",
    "Python",
    "AI",
    "机器学习",
    "深度学习",
    "产品",
    "设计",
    "运营",
    "营销",
    "投资",
    "创业",
    "效率",
    "工具",
  ];

  for (const keyword of commonKeywords) {
    if (titleText.includes(keyword)) {
      return keyword;
    }
  }

  return "";
}
