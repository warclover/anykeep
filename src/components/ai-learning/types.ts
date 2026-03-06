/**
 * AI 学习洞察页面 - 类型定义
 */

export interface ExclusionRecord {
  id: number;
  folder_id: number;
  exclusion_type: string;
  excluded_tag: string | null;
  excluded_source_id: string | null;
  excluded_keyword: string | null;
  weight: number | null;
  created_from: string;
  created_at: string;
}

export interface FolderPreference {
  folderId: number;
  folderName: string;
  usageFrequency: number;
  lastUsed: string;
  associatedTags: string[];
  associatedSources: string[];
}

export interface SourcePreference {
  sourceId: string;
  sourceName: string;
  preferredFolderId: number;
  sampleCount: number;
  confirmationRate: number;
}

export interface TimePreference {
  hour: number;
  topFolders: Array<{ folderId: number; count: number }>;
}

export interface LearningStats {
  totalEvents: number;
  confirmations: number;
  rejections: number;
  modifications: number;
  accuracy: number;
  lastLearningTime: string | null;
}

export interface HealthReport {
  overallScore: number;
  metrics: {
    classificationAccuracy: number;
    confirmationRate: number;
    fastPathHitRate: number;
    userSatisfaction: number;
  };
  trends: {
    accuracyTrend: string;
    activityTrend: string;
  };
  recommendations: string[];
}

export interface InsightsData {
  exclusions: ExclusionRecord[];
  exclusionStats: {
    total: number;
    byType: Record<string, number>;
    byFolder: Record<string, number>;
  };
  preferences: {
    folderPreferences: FolderPreference[];
    sourcePreferences: SourcePreference[];
    timePreferences: TimePreference[];
  } | null;
  learningStats: LearningStats;
  healthReport: HealthReport | null;
  generatedAt: string;
}

export interface AILearningPageClientProps {
  error?: string;
}
