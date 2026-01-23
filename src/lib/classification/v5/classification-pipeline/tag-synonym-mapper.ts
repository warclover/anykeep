/**
 * 标签同义词映射器
 *
 * 处理中英文、缩写、别名等同义词映射
 * 用于提升 AI 标签匹配的召回率
 *
 * @module @/lib/classification/v5/classification-pipeline/tag-synonym-mapper
 * @version 1.0.0
 * @since 2026-01-23
 */

import { createLogger } from "@/lib/logger";

const logger = createLogger("tag-synonym-mapper");

/**
 * 同义词组定义
 * 每组内的词互为同义词
 */
const SYNONYM_GROUPS: string[][] = [
  // 编程语言
  ["javascript", "js", "ecmascript", "es6", "es2015"],
  ["typescript", "ts"],
  ["python", "py"],
  ["golang", "go"],
  ["csharp", "c#", "c sharp"],
  ["cpp", "c++", "cplusplus"],
  ["java", "jdk", "jvm"],
  ["rust", "rustlang"],
  ["swift", "swiftlang"],
  ["kotlin", "kt"],
  ["ruby", "rb"],
  ["php", "php8"],

  // 前端框架
  ["react", "reactjs", "react.js"],
  ["vue", "vuejs", "vue.js"],
  ["angular", "angularjs", "angular.js"],
  ["nextjs", "next.js", "next"],
  ["nuxtjs", "nuxt.js", "nuxt"],
  ["svelte", "sveltejs", "sveltekit"],
  ["solidjs", "solid.js", "solid"],
  ["tailwind", "tailwindcss", "tailwind css"],
  ["shadcn", "shadcn-ui", "shadcn/ui"],

  // 后端框架
  ["nodejs", "node.js", "node"],
  ["expressjs", "express.js", "express"],
  ["nestjs", "nest.js", "nest"],
  ["django", "django框架"],
  ["flask", "flask框架"],
  ["spring", "springboot", "spring boot"],

  // 数据库
  ["postgresql", "postgres", "pg"],
  ["mongodb", "mongo"],
  ["mysql", "mariadb"],
  ["redis", "缓存数据库"],
  ["elasticsearch", "es", "elastic"],

  // 云服务
  ["aws", "amazon web services", "亚马逊云"],
  ["gcp", "google cloud", "谷歌云"],
  ["azure", "microsoft azure", "微软云"],
  ["阿里云", "aliyun", "alibaba cloud"],
  ["腾讯云", "tencent cloud"],

  // 开发概念 - 中英文
  ["前端", "frontend", "front-end", "前端开发"],
  ["后端", "backend", "back-end", "后端开发"],
  ["全栈", "fullstack", "full-stack", "全栈开发"],
  ["人工智能", "ai", "artificial intelligence"],
  ["机器学习", "ml", "machine learning"],
  ["深度学习", "dl", "deep learning"],
  ["大语言模型", "llm", "large language model"],
  ["自然语言处理", "nlp", "natural language processing"],
  ["计算机视觉", "cv", "computer vision"],

  // 架构模式
  ["微服务", "microservice", "microservices"],
  ["单体应用", "monolith", "monolithic"],
  ["无服务器", "serverless"],
  ["容器化", "containerization", "docker", "kubernetes", "k8s"],

  // 开发实践
  ["持续集成", "ci", "continuous integration"],
  ["持续部署", "cd", "continuous deployment"],
  ["测试驱动开发", "tdd", "test driven development"],
  ["敏捷开发", "agile", "scrum"],
  ["代码审查", "code review", "cr"],

  // 产品与设计
  ["用户体验", "ux", "user experience"],
  ["用户界面", "ui", "user interface"],
  ["产品设计", "product design"],
  ["交互设计", "interaction design", "ixd"],

  // 商业与创业
  ["独立开发", "indie dev", "indie developer", "独立开发者"],
  ["创业", "startup", "entrepreneurship"],
  ["产品策略", "product strategy"],
  ["商业模式", "business model"],
  ["增长黑客", "growth hacking"],

  // 效率工具
  ["生产力", "productivity", "效率"],
  ["时间管理", "time management"],
  ["知识管理", "knowledge management", "pkm"],
  ["第二大脑", "second brain"],
];

/**
 * 标签同义词映射器类
 */
export class TagSynonymMapper {
  /** 标签到同义词组索引的映射 */
  private tagToGroupIndex: Map<string, number>;
  /** 同义词组列表 */
  private groups: string[][];

  constructor(customGroups?: string[][]) {
    this.groups = [...SYNONYM_GROUPS, ...(customGroups || [])];
    this.tagToGroupIndex = new Map();
    this.buildIndex();
  }

  /**
   * 构建索引
   */
  private buildIndex(): void {
    for (let groupIndex = 0; groupIndex < this.groups.length; groupIndex++) {
      const group = this.groups[groupIndex];
      for (const tag of group) {
        this.tagToGroupIndex.set(tag.toLowerCase(), groupIndex);
      }
    }
    logger.debug({ groupCount: this.groups.length }, "同义词索引构建完成");
  }

  /**
   * 获取标签的所有同义词
   */
  getSynonyms(tag: string): string[] {
    const normalizedTag = tag.toLowerCase().trim();
    const groupIndex = this.tagToGroupIndex.get(normalizedTag);

    if (groupIndex === undefined) {
      return [normalizedTag];
    }

    return this.groups[groupIndex];
  }

  /**
   * 检查两个标签是否同义
   */
  areSynonyms(tag1: string, tag2: string): boolean {
    const normalized1 = tag1.toLowerCase().trim();
    const normalized2 = tag2.toLowerCase().trim();

    if (normalized1 === normalized2) {
      return true;
    }

    const groupIndex1 = this.tagToGroupIndex.get(normalized1);
    const groupIndex2 = this.tagToGroupIndex.get(normalized2);

    return (
      groupIndex1 !== undefined &&
      groupIndex2 !== undefined &&
      groupIndex1 === groupIndex2
    );
  }

  /**
   * 扩展标签列表，包含所有同义词
   */
  expandTags(tags: string[]): string[] {
    const expanded = new Set<string>();

    for (const tag of tags) {
      const synonyms = this.getSynonyms(tag);
      for (const synonym of synonyms) {
        expanded.add(synonym);
      }
    }

    return Array.from(expanded);
  }

  /**
   * 检查标签是否与目标匹配（包含同义词检查）
   */
  matchesWithSynonyms(tag: string, target: string): boolean {
    const normalizedTag = tag.toLowerCase().trim();
    const normalizedTarget = target.toLowerCase().trim();

    // 直接匹配
    if (normalizedTag === normalizedTarget) {
      return true;
    }

    // 包含匹配
    if (
      normalizedTag.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedTag)
    ) {
      return true;
    }

    // 同义词匹配
    return this.areSynonyms(normalizedTag, normalizedTarget);
  }

  /**
   * 在标签列表中查找与目标匹配的标签（包含同义词）
   */
  findMatchingTags(tags: string[], target: string): string[] {
    return tags.filter((tag) => this.matchesWithSynonyms(tag, target));
  }

  /**
   * 添加自定义同义词组
   */
  addSynonymGroup(group: string[]): void {
    const groupIndex = this.groups.length;
    this.groups.push(group);

    for (const tag of group) {
      this.tagToGroupIndex.set(tag.toLowerCase(), groupIndex);
    }

    logger.debug({ group }, "添加自定义同义词组");
  }

  /**
   * 获取同义词组数量
   */
  getGroupCount(): number {
    return this.groups.length;
  }
}

// 导出单例实例
export const tagSynonymMapper = new TagSynonymMapper();
