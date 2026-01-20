/**
 * 用户画像模板定义
 */

import type { UserProfile, UserType, Domain } from "../types";

export interface UserProfileTemplate {
  name: string;
  type: UserType;
  domainDistribution: Array<{ domain: Domain; weight: number }>;
  behavior: {
    bookmarkFrequency: "low" | "medium" | "high";
    folderNamingStyle: "descriptive" | "generic" | "mixed";
    organizationLevel: "organized" | "casual" | "chaotic";
  };
  contentFeatures: {
    avgTitleLength: number;
    useTags: boolean;
    tagStyle: "detailed" | "simple" | "none";
    summaryStyle: "ai" | "manual" | "none";
  };
  folderCount: { min: number; max: number };
  bookmarkCount: { min: number; max: number };
}

/**
 * 12 种用户画像模板
 */
export const USER_PROFILE_TEMPLATES: UserProfileTemplate[] = [
  {
    name: "前端开发工程师",
    type: "dev_frontend",
    domainDistribution: [
      { domain: "frontend", weight: 0.8 },
      { domain: "design", weight: 0.15 },
      { domain: "devops", weight: 0.05 },
    ],
    behavior: {
      bookmarkFrequency: "high",
      folderNamingStyle: "descriptive",
      organizationLevel: "organized",
    },
    contentFeatures: {
      avgTitleLength: 35,
      useTags: true,
      tagStyle: "detailed",
      summaryStyle: "ai",
    },
    folderCount: { min: 15, max: 20 },
    bookmarkCount: { min: 200, max: 300 },
  },
  {
    name: "后端开发工程师",
    type: "dev_backend",
    domainDistribution: [
      { domain: "backend", weight: 0.85 },
      { domain: "devops", weight: 0.1 },
      { domain: "data_science", weight: 0.05 },
    ],
    behavior: {
      bookmarkFrequency: "high",
      folderNamingStyle: "descriptive",
      organizationLevel: "organized",
    },
    contentFeatures: {
      avgTitleLength: 32,
      useTags: true,
      tagStyle: "detailed",
      summaryStyle: "ai",
    },
    folderCount: { min: 12, max: 18 },
    bookmarkCount: { min: 150, max: 250 },
  },
  {
    name: "全栈开发工程师",
    type: "dev_fullstack",
    domainDistribution: [
      { domain: "frontend", weight: 0.4 },
      { domain: "backend", weight: 0.4 },
      { domain: "devops", weight: 0.1 },
      { domain: "design", weight: 0.1 },
    ],
    behavior: {
      bookmarkFrequency: "high",
      folderNamingStyle: "mixed",
      organizationLevel: "organized",
    },
    contentFeatures: {
      avgTitleLength: 30,
      useTags: true,
      tagStyle: "simple",
      summaryStyle: "ai",
    },
    folderCount: { min: 20, max: 30 },
    bookmarkCount: { min: 300, max: 500 },
  },
  {
    name: "UI 设计师",
    type: "designer_ui",
    domainDistribution: [
      { domain: "design", weight: 0.9 },
      { domain: "frontend", weight: 0.1 },
    ],
    behavior: {
      bookmarkFrequency: "medium",
      folderNamingStyle: "descriptive",
      organizationLevel: "organized",
    },
    contentFeatures: {
      avgTitleLength: 28,
      useTags: true,
      tagStyle: "detailed",
      summaryStyle: "manual",
    },
    folderCount: { min: 10, max: 15 },
    bookmarkCount: { min: 100, max: 200 },
  },
  {
    name: "产品经理",
    type: "pm_product",
    domainDistribution: [
      { domain: "product", weight: 0.6 },
      { domain: "design", weight: 0.2 },
      { domain: "business", weight: 0.2 },
    ],
    behavior: {
      bookmarkFrequency: "high",
      folderNamingStyle: "mixed",
      organizationLevel: "organized",
    },
    contentFeatures: {
      avgTitleLength: 25,
      useTags: true,
      tagStyle: "simple",
      summaryStyle: "manual",
    },
    folderCount: { min: 15, max: 25 },
    bookmarkCount: { min: 200, max: 400 },
  },
  {
    name: "科研人员",
    type: "researcher",
    domainDistribution: [
      { domain: "research", weight: 0.85 },
      { domain: "data_science", weight: 0.1 },
      { domain: "education", weight: 0.05 },
    ],
    behavior: {
      bookmarkFrequency: "high",
      folderNamingStyle: "descriptive",
      organizationLevel: "organized",
    },
    contentFeatures: {
      avgTitleLength: 40,
      useTags: true,
      tagStyle: "detailed",
      summaryStyle: "ai",
    },
    folderCount: { min: 20, max: 30 },
    bookmarkCount: { min: 300, max: 600 },
  },
  {
    name: "CS 学生",
    type: "student_cs",
    domainDistribution: [
      { domain: "education", weight: 0.4 },
      { domain: "frontend", weight: 0.3 },
      { domain: "backend", weight: 0.3 },
    ],
    behavior: {
      bookmarkFrequency: "medium",
      folderNamingStyle: "mixed",
      organizationLevel: "casual",
    },
    contentFeatures: {
      avgTitleLength: 22,
      useTags: false,
      tagStyle: "none",
      summaryStyle: "none",
    },
    folderCount: { min: 10, max: 15 },
    bookmarkCount: { min: 100, max: 200 },
  },
  {
    name: "内容创作者",
    type: "content_creator",
    domainDistribution: [
      { domain: "writing", weight: 0.5 },
      { domain: "design", weight: 0.3 },
      { domain: "photography", weight: 0.2 },
    ],
    behavior: {
      bookmarkFrequency: "medium",
      folderNamingStyle: "descriptive",
      organizationLevel: "organized",
    },
    contentFeatures: {
      avgTitleLength: 26,
      useTags: true,
      tagStyle: "simple",
      summaryStyle: "manual",
    },
    folderCount: { min: 15, max: 20 },
    bookmarkCount: { min: 200, max: 350 },
  },
  {
    name: "生活整理者",
    type: "life_organizer",
    domainDistribution: [
      { domain: "cooking", weight: 0.25 },
      { domain: "travel", weight: 0.2 },
      { domain: "finance", weight: 0.2 },
      { domain: "health", weight: 0.2 },
      { domain: "entertainment", weight: 0.15 },
    ],
    behavior: {
      bookmarkFrequency: "high",
      folderNamingStyle: "mixed",
      organizationLevel: "organized",
    },
    contentFeatures: {
      avgTitleLength: 20,
      useTags: true,
      tagStyle: "simple",
      summaryStyle: "none",
    },
    folderCount: { min: 20, max: 30 },
    bookmarkCount: { min: 400, max: 600 },
  },
  {
    name: "普通用户",
    type: "casual_user",
    domainDistribution: [
      { domain: "entertainment", weight: 0.3 },
      { domain: "other", weight: 0.7 },
    ],
    behavior: {
      bookmarkFrequency: "low",
      folderNamingStyle: "generic",
      organizationLevel: "chaotic",
    },
    contentFeatures: {
      avgTitleLength: 18,
      useTags: false,
      tagStyle: "none",
      summaryStyle: "none",
    },
    folderCount: { min: 5, max: 10 },
    bookmarkCount: { min: 50, max: 100 },
  },
  {
    name: "重度用户",
    type: "power_user",
    domainDistribution: [
      { domain: "frontend", weight: 0.2 },
      { domain: "backend", weight: 0.2 },
      { domain: "design", weight: 0.15 },
      { domain: "product", weight: 0.15 },
      { domain: "data_science", weight: 0.1 },
      { domain: "other", weight: 0.2 },
    ],
    behavior: {
      bookmarkFrequency: "high",
      folderNamingStyle: "descriptive",
      organizationLevel: "organized",
    },
    contentFeatures: {
      avgTitleLength: 30,
      useTags: true,
      tagStyle: "detailed",
      summaryStyle: "ai",
    },
    folderCount: { min: 30, max: 50 },
    bookmarkCount: { min: 500, max: 1000 },
  },
  {
    name: "新用户",
    type: "new_user",
    domainDistribution: [
      { domain: "frontend", weight: 0.5 },
      { domain: "other", weight: 0.5 },
    ],
    behavior: {
      bookmarkFrequency: "low",
      folderNamingStyle: "generic",
      organizationLevel: "chaotic",
    },
    contentFeatures: {
      avgTitleLength: 20,
      useTags: false,
      tagStyle: "none",
      summaryStyle: "none",
    },
    folderCount: { min: 0, max: 3 },
    bookmarkCount: { min: 0, max: 20 },
  },
];
