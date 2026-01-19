/**
 * 模拟分类引擎（用于演示测试框架）
 *
 * 这是一个简化的模拟实现，用于演示测试框架的工作流程
 * 实际使用时需要替换为真实的分类服务
 */

import type { ClassificationEngine } from '../comparison-runner';

/**
 * 模拟 V4.1 分类引擎
 */
export const mockV4Engine: ClassificationEngine = {
  version: 'v4.1',
  async classify(request) {
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 100));

    // 模拟分类结果（准确率约 85%）
    const shouldBeCorrect = Math.random() > 0.15;
    const confidence = shouldBeCorrect ? 0.75 + Math.random() * 0.15 : 0.6 + Math.random() * 0.1;

    return {
      bookmarkId: request.bookmarkId,
      predictedFolderId: shouldBeCorrect ? 'folder-correct' : 'folder-wrong',
      predictedFolderName: shouldBeCorrect ? 'Correct Folder' : 'Wrong Folder',
      confidence,
      topCandidates: [
        {
          folderId: 'folder-correct',
          folderName: 'Correct Folder',
          confidence: confidence,
        },
        {
          folderId: 'folder-2',
          folderName: 'Folder 2',
          confidence: confidence - 0.1,
        },
        {
          folderId: 'folder-3',
          folderName: 'Folder 3',
          confidence: confidence - 0.2,
        },
      ],
      usedT1: false,
      latencyMs: 100 + Math.random() * 100,
    };
  },
};

/**
 * 模拟 V5.0 分类引擎
 */
export const mockV5Engine: ClassificationEngine = {
  version: 'v5.0',
  async classify(request) {
    // 模拟延迟（V5.0 稍快）
    await new Promise((resolve) => setTimeout(resolve, 80 + Math.random() * 80));

    // 模拟分类结果（准确率约 92%，提升 7%）
    const shouldBeCorrect = Math.random() > 0.08;
    const confidence = shouldBeCorrect ? 0.85 + Math.random() * 0.1 : 0.65 + Math.random() * 0.15;
    const usedT1 = Math.random() > 0.7; // 30% 使用 T1

    return {
      bookmarkId: request.bookmarkId,
      predictedFolderId: shouldBeCorrect ? 'folder-correct' : 'folder-wrong',
      predictedFolderName: shouldBeCorrect ? 'Correct Folder' : 'Wrong Folder',
      confidence,
      topCandidates: [
        {
          folderId: 'folder-correct',
          folderName: 'Correct Folder',
          confidence: confidence,
        },
        {
          folderId: 'folder-2',
          folderName: 'Folder 2',
          confidence: confidence - 0.12,
        },
        {
          folderId: 'folder-3',
          folderName: 'Folder 3',
          confidence: confidence - 0.25,
        },
      ],
      usedT1,
      latencyMs: 80 + Math.random() * 80,
    };
  },
};
