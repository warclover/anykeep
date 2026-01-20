/**
 * 用户画像生成器
 */

import { USER_PROFILE_TEMPLATES } from "../templates/user-profiles";
import type { UserProfile, UserType, Domain } from "../types";

export class UserProfileGenerator {
  /**
   * 生成用户画像
   */
  generateProfiles(count?: number): UserProfile[] {
    const templates = USER_PROFILE_TEMPLATES;
    const profiles: UserProfile[] = [];

    // 如果指定数量，随机选择模板
    const selectedTemplates = count
      ? this.randomSelect(templates, count)
      : templates;

    for (const template of selectedTemplates) {
      profiles.push(this.generateFromTemplate(template));
    }

    return profiles;
  }

  /**
   * 从模板生成用户画像
   */
  private generateFromTemplate(
    template: (typeof USER_PROFILE_TEMPLATES)[0],
  ): UserProfile {
    return {
      id: `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: template.name,
      type: template.type,
      domainWeights: this.generateDomainWeights(template),
      folderStructure: {
        folders: [], // 将在后续步骤中生成
      },
      behavior: template.behavior,
      contentFeatures: template.contentFeatures,
    };
  }

  /**
   * 生成领域权重分布
   */
  private generateDomainWeights(
    template: (typeof USER_PROFILE_TEMPLATES)[0],
  ): Record<Domain, number> {
    const weights: Record<Domain, number> = {};
    const totalWeight = template.domainDistribution.reduce(
      (sum, d) => sum + d.weight,
      0,
    );

    for (const { domain, weight } of template.domainDistribution) {
      weights[domain] = weight / totalWeight;
    }

    // 填充其他领域为 0
    const allDomains: Domain[] = [
      "frontend",
      "backend",
      "mobile",
      "devops",
      "ai_ml",
      "design",
      "product",
      "data_science",
      "research",
      "writing",
      "photography",
      "cooking",
      "travel",
      "finance",
      "health",
      "education",
      "business",
      "entertainment",
      "sports",
      "other",
    ];

    for (const domain of allDomains) {
      if (!(domain in weights)) {
        weights[domain] = 0;
      }
    }

    return weights;
  }

  /**
   * 随机选择模板
   */
  private randomSelect<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
  }
}
