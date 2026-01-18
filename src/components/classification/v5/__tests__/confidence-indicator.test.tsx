/**
 * ConfidenceIndicator 组件测试
 *
 * @module components/classification/v5/__tests__/confidence-indicator.test
 * @version 1.0.0
 * @since 2026-01-18
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ConfidenceIndicator } from '../confidence-indicator';

describe('ConfidenceIndicator', () => {
  describe('default variant', () => {
    it('should render high confidence (≥85%)', () => {
      render(<ConfidenceIndicator confidence={0.92} />);

      const indicator = screen.getByText('92%');
      expect(indicator).toBeInTheDocument();
    });

    it('should render medium confidence (70-84%)', () => {
      render(<ConfidenceIndicator confidence={0.75} />);

      const indicator = screen.getByText('75%');
      expect(indicator).toBeInTheDocument();
    });

    it('should render low confidence (<70%)', () => {
      render(<ConfidenceIndicator confidence={0.65} />);

      const indicator = screen.getByText('65%');
      expect(indicator).toBeInTheDocument();
    });

    it('should handle edge case: exactly 85%', () => {
      render(<ConfidenceIndicator confidence={0.85} />);

      const indicator = screen.getByText('85%');
      expect(indicator).toBeInTheDocument();
    });

    it('should handle edge case: exactly 70%', () => {
      render(<ConfidenceIndicator confidence={0.70} />);

      const indicator = screen.getByText('70%');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('compact variant', () => {
    it('should render compact high confidence', () => {
      render(<ConfidenceIndicator confidence={0.92} variant="compact" />);

      const indicator = screen.getByText('92%');
      expect(indicator).toBeInTheDocument();
    });

    it('should render compact medium confidence', () => {
      render(<ConfidenceIndicator confidence={0.75} variant="compact" />);

      const indicator = screen.getByText('75%');
      expect(indicator).toBeInTheDocument();
    });

    it('should render compact low confidence', () => {
      render(<ConfidenceIndicator confidence={0.65} variant="compact" />);

      const indicator = screen.getByText('65%');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('detailed variant', () => {
    it('should render detailed high confidence with label', () => {
      render(<ConfidenceIndicator confidence={0.92} variant="detailed" />);

      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('高置信度')).toBeInTheDocument();
    });

    it('should render detailed medium confidence with label', () => {
      render(<ConfidenceIndicator confidence={0.75} variant="detailed" />);

      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('中等置信度')).toBeInTheDocument();
    });

    it('should render detailed low confidence with label', () => {
      render(<ConfidenceIndicator confidence={0.65} variant="detailed" />);

      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('低置信度')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle 0% confidence', () => {
      render(<ConfidenceIndicator confidence={0} />);

      const indicator = screen.getByText('0%');
      expect(indicator).toBeInTheDocument();
    });

    it('should handle 100% confidence', () => {
      render(<ConfidenceIndicator confidence={1.0} />);

      const indicator = screen.getByText('100%');
      expect(indicator).toBeInTheDocument();
    });

    it('should handle decimal precision', () => {
      render(<ConfidenceIndicator confidence={0.8567} />);

      // 应该显示为 86% (四舍五入)
      const indicator = screen.getByText('86%');
      expect(indicator).toBeInTheDocument();
    });
  });
});
