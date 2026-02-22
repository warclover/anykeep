/**
 * Quota UI Components - 单元测试
 * @module components/knowledge-studio/quota
 *
 * Story 8.3 测试用例:
 * - BlueprintQuotaBar 显示逻辑
 * - BlueprintQuotaWarning 告警逻辑
 * - CreditCostBadge 显示
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import {
  BlueprintQuotaBar,
  BlueprintQuotaWarning,
  CreditCostBadge,
} from "../index";

// ============================================================================
// BlueprintQuotaBar Tests
// ============================================================================

describe("BlueprintQuotaBar", () => {
  describe("基础渲染", () => {
    it("应该在 bar 模式下显示进度条", () => {
      render(<BlueprintQuotaBar used={5} limit={10} mode="bar" />);
      expect(screen.getByText("5 / 10")).toBeInTheDocument();
      expect(screen.getByText("模板生成配额")).toBeInTheDocument();
    });

    it("应该在 minimal 模式下只显示数字", () => {
      render(<BlueprintQuotaBar used={3} limit={10} mode="minimal" />);
      expect(screen.getByText("7 / 10")).toBeInTheDocument(); // remaining / limit
    });

    it("应该在 compact 模式下显示图标和数字", () => {
      render(<BlueprintQuotaBar used={2} limit={10} mode="compact" />);
      expect(screen.getByText("8 / 10")).toBeInTheDocument();
    });
  });

  describe("无限配额", () => {
    it("应该为 Pro 用户显示无限提示", () => {
      render(
        <BlueprintQuotaBar
          used={0}
          limit={-1}
          mode="compact"
          membershipType="pro"
        />,
      );
      expect(screen.getByText("专业版 · 无限使用")).toBeInTheDocument();
    });

    it("应该为 Enterprise 用户显示无限提示", () => {
      render(
        <BlueprintQuotaBar
          used={0}
          limit={-1}
          mode="compact"
          membershipType="enterprise"
        />,
      );
      expect(screen.getByText("企业版 · 无限使用")).toBeInTheDocument();
    });
  });

  describe("告警级别", () => {
    it("应该在使用 95% 以上时显示危险警告", () => {
      render(<BlueprintQuotaBar used={96} limit={100} mode="bar" />);
      expect(screen.getByText("配额即将用尽")).toBeInTheDocument();
    });

    it("应该在使用 80% 以上时显示警告", () => {
      render(<BlueprintQuotaBar used={85} limit={100} mode="bar" />);
      expect(screen.getByText("配额使用已超过 80%")).toBeInTheDocument();
    });

    it("应该在正常使用时显示剩余次数", () => {
      render(<BlueprintQuotaBar used={30} limit={100} mode="bar" />);
      expect(screen.getByText("还可生成 70 次")).toBeInTheDocument();
    });
  });

  describe("重置日期", () => {
    it("应该显示重置日期", () => {
      const resetDate = new Date("2026-02-01");
      render(
        <BlueprintQuotaBar
          used={5}
          limit={10}
          mode="bar"
          resetAt={resetDate}
        />,
      );
      expect(screen.getByText(/配额将于/)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// BlueprintQuotaWarning Tests
// ============================================================================

describe("BlueprintQuotaWarning", () => {
  describe("显示条件", () => {
    it("应该在配额用尽时显示警告", () => {
      render(<BlueprintQuotaWarning remaining={0} limit={3} creditsCost={2} />);
      expect(screen.getByText("本月免费试用次数已用完")).toBeInTheDocument();
    });

    it("应该在配额不足时显示警告", () => {
      render(<BlueprintQuotaWarning remaining={1} limit={3} creditsCost={2} />);
      expect(screen.getByText(/当前剩余 1 点配额/)).toBeInTheDocument();
    });

    it("应该在配额接近用尽时显示警告", () => {
      render(<BlueprintQuotaWarning remaining={2} limit={3} creditsCost={2} />);
      expect(screen.getByText("剩余 2 点配额")).toBeInTheDocument();
    });

    it("不应该在配额充足时显示警告", () => {
      const { container } = render(
        <BlueprintQuotaWarning remaining={10} limit={20} creditsCost={2} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("不应该在无限配额时显示警告", () => {
      const { container } = render(
        <BlueprintQuotaWarning remaining={999999} limit={-1} creditsCost={2} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("变体样式", () => {
    it("应该支持 inline 变体", () => {
      render(
        <BlueprintQuotaWarning
          remaining={0}
          limit={3}
          creditsCost={2}
          variant="inline"
        />,
      );
      expect(screen.getByText("本月免费试用次数已用完")).toBeInTheDocument();
    });

    it("应该支持 banner 变体", () => {
      render(
        <BlueprintQuotaWarning
          remaining={0}
          limit={3}
          creditsCost={2}
          variant="banner"
        />,
      );
      expect(screen.getByText("本月免费额度已用完")).toBeInTheDocument();
    });
  });

  describe("升级按钮", () => {
    it("应该在提供 onUpgrade 时显示升级按钮", () => {
      const handleUpgrade = jest.fn();
      render(
        <BlueprintQuotaWarning
          remaining={0}
          limit={3}
          creditsCost={2}
          onUpgrade={handleUpgrade}
        />,
      );
      expect(screen.getByText("升级会员")).toBeInTheDocument();
    });
  });
});

// ============================================================================
// CreditCostBadge Tests
// ============================================================================

describe("CreditCostBadge", () => {
  it("应该显示消耗点数", () => {
    render(<CreditCostBadge cost={2} />);
    expect(screen.getByText("消耗 2 点配额")).toBeInTheDocument();
  });

  it("应该支持 sm 尺寸", () => {
    render(<CreditCostBadge cost={3} size="sm" />);
    expect(screen.getByText("消耗 3 点配额")).toBeInTheDocument();
  });

  it("应该支持 md 尺寸", () => {
    render(<CreditCostBadge cost={2} size="md" />);
    expect(screen.getByText("消耗 2 点配额")).toBeInTheDocument();
  });
});

// ============================================================================
// Story 8.3 验收测试
// ============================================================================

describe("Story 8.3: 配额用尽提示 UI", () => {
  it("应该在 Free 用户用尽配额时显示升级提示", () => {
    render(
      <BlueprintQuotaWarning
        remaining={0}
        limit={3}
        creditsCost={2}
        membershipType="free"
        variant="banner"
        onUpgrade={() => {
          /* no-op for test */
        }}
      />,
    );

    expect(screen.getByText("本月免费额度已用完")).toBeInTheDocument();
    expect(screen.getByText("升级到专业版")).toBeInTheDocument();
    expect(screen.getByText("下月 1 日自动重置")).toBeInTheDocument();
  });

  it("应该正确显示蓝图消耗点数", () => {
    render(<CreditCostBadge cost={3} />);
    expect(screen.getByText("消耗 3 点配额")).toBeInTheDocument();
  });

  it("应该在配额条中显示正确的剩余次数", () => {
    render(<BlueprintQuotaBar used={1} limit={3} mode="bar" />);
    expect(screen.getByText("还可生成 2 次")).toBeInTheDocument();
  });
});
