/**
 * 书签生成器
 */

import { DOMAIN_TEMPLATES } from "../templates/domains";
import type { Bookmark, Domain, UserProfile } from "../types";

export class BookmarkGenerator {
  /**
   * 为用户生成书签
   */
  generateBookmarks(profile: UserProfile, count: number): Bookmark[] {
    const bookmarks: Bookmark[] = [];

    // 根据用户领域权重分布生成书签
    const domainCounts = this.distributeByWeights(profile.domainWeights, count);

    for (const [domain, domainCount] of Object.entries(domainCounts)) {
      if (domainCount > 0) {
        for (let i = 0; i < domainCount; i++) {
          const bookmark = this.generateBookmarkForDomain(
            domain as Domain,
            profile,
          );
          bookmarks.push(bookmark);
        }
      }
    }

    // 打乱顺序（模拟真实收藏时间线）
    return this.shuffle(bookmarks);
  }

  /**
   * 为特定领域生成书签
   */
  private generateBookmarkForDomain(
    domain: Domain,
    profile: UserProfile,
  ): Bookmark {
    const template = DOMAIN_TEMPLATES[domain];

    // 生成标题
    const title = this.generateTitle(template, profile);

    // 生成摘要
    const summary = this.generateSummary(template, profile, title);

    // 生成标签
    const tags = this.generateTags(template, profile);

    // 确定预期文件夹（基于领域和用户文件夹结构）
    const expectedFolder = this.determineExpectedFolder(domain, profile);

    return {
      id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      summary,
      tags,
      url: this.generateFakeUrl(domain),
      expectedFolder,
      domain,
      createdAt: this.generateRandomDate(),
    };
  }

  /**
   * 生成标题
   */
  private generateTitle(
    template: (typeof DOMAIN_TEMPLATES)[Domain],
    profile: UserProfile,
  ): string {
    const titleTemplate = this.randomChoice(template.titleTemplates);

    // 填充模板变量
    return this.fillTemplate(titleTemplate, {
      framework: this.randomChoice(template.keywords),
      topic: this.randomChoice(this.getTopicsForDomain(template.domain)),
      action: this.randomChoice(["教程", "指南", "实践", "深入", "入门"]),
      level: this.randomChoice(["入门", "进阶", "高级", "专家"]),
      tool: this.randomChoice(template.keywords),
      method: this.randomChoice(["方法", "技巧", "策略", "实践"]),
      style: this.randomChoice(["现代", "简约", "复古", "创意"]),
      language: this.randomChoice(["Python", "JavaScript", "Java", "Go"]),
      platform: this.randomChoice(["iOS", "Android", "Web"]),
      destination: this.randomChoice(["日本", "欧洲", "东南亚", "国内"]),
      dish: this.randomChoice(["红烧肉", "宫保鸡丁", "麻婆豆腐", "糖醋排骨"]),
      cuisine: this.randomChoice(["川菜", "粤菜", "湘菜", "鲁菜"]),
      sport: this.randomChoice(["跑步", "健身", "游泳", "瑜伽"]),
      subject: this.randomChoice(["数学", "物理", "化学", "生物"]),
      field: this.randomChoice(["计算机", "生物", "物理", "化学"]),
    });
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    template: (typeof DOMAIN_TEMPLATES)[Domain],
    profile: UserProfile,
    title: string,
  ): string | undefined {
    if (profile.contentFeatures.summaryStyle === "none") {
      return undefined;
    }

    const summaryTemplate = this.randomChoice(template.summaryTemplates);
    return this.fillTemplate(summaryTemplate, {
      topic: this.extractTopicFromTitle(title),
      framework: this.randomChoice(template.keywords),
      tool: this.randomChoice(template.keywords),
      method: this.randomChoice(["方法", "技巧", "策略"]),
      style: this.randomChoice(["现代", "简约", "创意"]),
      language: this.randomChoice(["Python", "JavaScript", "Java"]),
      platform: this.randomChoice(["iOS", "Android", "Web"]),
      destination: this.randomChoice(["日本", "欧洲", "东南亚"]),
      dish: this.randomChoice(["红烧肉", "宫保鸡丁", "麻婆豆腐"]),
      sport: this.randomChoice(["跑步", "健身", "游泳"]),
      field: this.randomChoice(["计算机", "生物", "物理"]),
    });
  }

  /**
   * 生成标签
   */
  private generateTags(
    template: (typeof DOMAIN_TEMPLATES)[Domain],
    profile: UserProfile,
  ): string[] | undefined {
    if (!profile.contentFeatures.useTags) {
      return undefined;
    }

    const tagSet = this.randomChoice(template.tagSets);
    return tagSet;
  }

  /**
   * 确定预期文件夹
   */
  private determineExpectedFolder(
    domain: Domain,
    profile: UserProfile,
  ): string {
    // 从用户的文件夹结构中查找匹配的文件夹
    const domainFolders = profile.folderStructure.folders.filter(
      (f) => f.domain === domain,
    );

    if (domainFolders.length > 0) {
      return this.randomChoice(domainFolders).id;
    }

    // 如果没有匹配的文件夹，返回一个占位符（将在后续步骤中创建）
    return `expected_folder_${domain}_${profile.id}`;
  }

  /**
   * 根据权重分布分配数量
   */
  private distributeByWeights(
    weights: Record<Domain, number>,
    total: number,
  ): Record<Domain, number> {
    const counts: Record<Domain, number> = {};

    for (const [domain, weight] of Object.entries(weights)) {
      counts[domain as Domain] = Math.round(weight * total);
    }

    // 确保总数正确（处理四舍五入误差）
    const actualTotal = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const diff = total - actualTotal;

    if (diff !== 0) {
      // 调整权重最大的领域
      const maxDomain = Object.entries(weights).reduce((max, [d, w]) =>
        w > max[1] ? [d, w] : max,
      )[0] as Domain;
      counts[maxDomain] += diff;
    }

    return counts;
  }

  /**
   * 获取领域相关主题
   */
  private getTopicsForDomain(domain: Domain): string[] {
    const topicMap: Record<Domain, string[]> = {
      frontend: ["组件", "状态管理", "路由", "性能优化", "Hooks", "生命周期"],
      backend: ["API设计", "数据库", "缓存", "微服务", "认证", "安全"],
      mobile: ["原生开发", "跨平台", "性能", "UI", "推送", "支付"],
      devops: ["容器化", "CI/CD", "监控", "日志", "部署", "自动化"],
      ai_ml: ["机器学习", "深度学习", "神经网络", "算法", "模型训练"],
      design: ["UI设计", "UX设计", "配色", "排版", "图标", "原型"],
      product: ["需求分析", "用户研究", "竞品分析", "原型设计", "数据分析"],
      data_science: ["数据分析", "可视化", "统计", "机器学习", "数据清洗"],
      research: ["研究方法", "实验设计", "数据分析", "论文写作", "文献综述"],
      writing: ["写作技巧", "文案", "创意", "结构", "风格", "编辑"],
      photography: ["构图", "光线", "后期", "器材", "技巧", "风格"],
      cooking: ["菜谱", "技巧", "食材", "调味", "烘焙", "健康"],
      travel: ["攻略", "景点", "美食", "住宿", "交通", "预算"],
      finance: ["理财", "投资", "基金", "股票", "保险", "规划"],
      health: ["运动", "饮食", "养生", "医疗", "保健", "心理健康"],
      education: ["课程", "学习", "考试", "复习", "资料", "方法"],
      business: ["管理", "策略", "营销", "运营", "创业", "分析"],
      entertainment: ["电影", "音乐", "游戏", "综艺", "娱乐", "休闲"],
      sports: ["训练", "技巧", "装备", "比赛", "健身", "营养"],
      other: ["杂项", "未分类", "其他"],
    };

    return topicMap[domain] || ["主题", "内容", "相关"];
  }

  /**
   * 填充模板
   */
  private fillTemplate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
    return result;
  }

  /**
   * 从标题提取主题
   */
  private extractTopicFromTitle(title: string): string {
    // 简单实现：返回标题的前几个词
    return title.split(" ").slice(0, 2).join(" ");
  }

  /**
   * 生成假 URL
   */
  private generateFakeUrl(domain: Domain): string {
    const domains: Record<Domain, string[]> = {
      frontend: ["github.com", "medium.com", "dev.to"],
      backend: ["stackoverflow.com", "github.com", "medium.com"],
      design: ["dribbble.com", "behance.net", "figma.com"],
      product: ["producthunt.com", "medium.com", "uxdesign.cc"],
      research: ["arxiv.org", "researchgate.net", "scholar.google.com"],
      other: ["example.com", "test.com", "demo.com"],
    };

    const baseDomains = domains[domain] || domains.other;
    const baseDomain = this.randomChoice(baseDomains);
    const path = `/article/${Math.random().toString(36).substr(2, 9)}`;

    return `https://${baseDomain}${path}`;
  }

  /**
   * 生成随机日期（过去 90 天内）
   */
  private generateRandomDate(): Date {
    const now = Date.now();
    const daysAgo = Math.floor(Math.random() * 90);
    return new Date(now - daysAgo * 24 * 60 * 60 * 1000);
  }

  /**
   * 随机选择
   */
  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 打乱数组
   */
  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
