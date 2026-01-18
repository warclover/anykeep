/**
 * T1Notification 组件测试
 *
 * @module components/classification/v5/__tests__/t1-notification.test
 * @version 1.0.0
 * @since 2026-01-18
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { T1Notification } from '../t1-notification';

describe('T1Notification', () => {
  const baseProps = {
    t0FolderId: '1',
    t0FolderName: '技术文章',
    t0Confidence: 0.75,
    t1FolderId: '2',
    t1FolderName: 'AI 研究',
    t1Confidence: 0.92,
    reasoning: 'T1 纠正推理说明',
    bookmarkId: '123',
  };

  describe('rendering', () => {
    it('should render T0 and T1 folder names', () => {
      render(<T1Notification {...baseProps} />);

      expect(screen.getByText('技术文章')).toBeInTheDocument();
      expect(screen.getByText('AI 研究')).toBeInTheDocument();
    });

    it('should render confidence values', () => {
      render(<T1Notification {...baseProps} />);

      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/92%/)).toBeInTheDocument();
    });

    it('should render reasoning when provided', () => {
      render(<T1Notification {...baseProps} />);

      expect(screen.getByText('T1 纠正推理说明')).toBeInTheDocument();
    });

    it('should show change indicator when folders differ', () => {
      render(<T1Notification {...baseProps} />);

      expect(screen.getByText('AI 分析后建议调整分类结果')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing reasoning', () => {
      const propsWithoutReasoning = {
        ...baseProps,
        reasoning: '',
      };

      render(<T1Notification {...propsWithoutReasoning} />);

      expect(screen.getByText('技术文章')).toBeInTheDocument();
      expect(screen.getByText('AI 研究')).toBeInTheDocument();
    });

    it('should handle same folder (no change)', () => {
      const propsNoChange = {
        ...baseProps,
        t1FolderId: '1',
        t1FolderName: '技术文章',
        t1Confidence: 0.85,
        reasoning: '确认分类正确',
      };

      render(<T1Notification {...propsNoChange} />);

      expect(screen.getByText('AI 确认了初始分类结果')).toBeInTheDocument();
      expect(screen.getByText('知道了')).toBeInTheDocument();
    });
  });
});
