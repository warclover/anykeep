/**
 * 类型定义
 */

export type UserType =
  | "dev_frontend"
  | "dev_backend"
  | "dev_fullstack"
  | "designer_ui"
  | "pm_product"
  | "researcher"
  | "student_cs"
  | "content_creator"
  | "life_organizer"
  | "casual_user"
  | "power_user"
  | "new_user";

export type Domain =
  | "frontend"
  | "backend"
  | "mobile"
  | "devops"
  | "ai_ml"
  | "design"
  | "product"
  | "data_science"
  | "research"
  | "writing"
  | "photography"
  | "cooking"
  | "travel"
  | "finance"
  | "health"
  | "education"
  | "business"
  | "entertainment"
  | "sports"
  | "other";

export interface UserProfile {
  id: string;
  name: string;
  type: UserType;
  domainWeights: Record<Domain, number>;
  folderStructure: FolderStructure;
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
}

export interface FolderStructure {
  folders: Array<{
    id: string;
    name: string;
    domain: Domain;
    parentId?: string;
  }>;
}

export interface Bookmark {
  id: string;
  title: string;
  summary?: string;
  tags?: string[];
  url: string;
  expectedFolder: string; // 预期分类到的文件夹 ID
  domain: Domain;
  createdAt: Date;
}

export interface ClassificationResult {
  folderId: number | null;
  confidence: number;
  usedT1: boolean;
  reasoning?: string;
  totalLatencyMs: number;
  t0LatencyMs: number;
  t1LatencyMs?: number;
  strategy?: string;
  error?: string;
}

export interface TestResult {
  userId: string;
  bookmarkId: string;
  title: string;
  domain: Domain;
  expectedFolder: string;
  expectedFolderName?: string;
  actualFolder: string | null;
  actualFolderName?: string | null;
  confidence: number;
  isCorrect: boolean;
  latencyMs: number;
  strategy?: string;
}

export interface TestMetrics {
  summary: {
    totalUsers: number;
    totalBookmarks: number;
    overallAccuracy: number;
    avgConfidence: number;
    avgLatency: number;
  };
  byUserType: Array<{
    userType: string;
    userCount: number;
    bookmarkCount: number;
    accuracy: number;
    avgConfidence: number;
  }>;
  byDomain: Array<{
    domain: Domain;
    bookmarkCount: number;
    accuracy: number;
    topErrors: Array<{
      expectedFolder: string;
      actualFolder: string;
      count: number;
    }>;
  }>;
  byStrategy: Array<{
    strategy: string;
    usageCount: number;
    usageRate: number;
    accuracy: number;
    avgLatency: number;
  }>;
  errorAnalysis: {
    totalErrors: number;
    errorTypes: {
      falsePositive: number;
      falseNegative: number;
      wrongFolder: number;
    };
    topErrorPatterns: Array<{
      pattern: string;
      count: number;
      examples: Bookmark[];
    }>;
  };
  recommendations: string[];
}

export interface TestReport {
  summary: TestMetrics["summary"];
  byUserType: TestMetrics["byUserType"];
  byDomain: TestMetrics["byDomain"];
  byStrategy: TestMetrics["byStrategy"];
  errorAnalysis: TestMetrics["errorAnalysis"];
  recommendations: string[];
  testDuration: string;
}

export interface DomainTemplate {
  domain: Domain;
  titleTemplates: string[];
  summaryTemplates: string[];
  tagSets: string[][];
  folderNames: string[];
  keywords: string[];
}
