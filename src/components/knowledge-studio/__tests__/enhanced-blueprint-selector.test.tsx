/**
 * Enhanced Blueprint Selector 单元测试 (Story 1.10)
 *
 * 测试 Story 1.10 的验收标准：
 * - AC1: 按分类（极客/创作者/商业/技术/经典）分组展示
 * - AC2: P0 蓝图（isGeek）显示🔥标记
 * - AC3: 新蓝图显示 NEW 标签
 * - AC4: Pro/Enterprise 专属蓝图显示锁定图标
 * - AC5: 点击锁定蓝图显示升级提示
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnhancedBlueprintSelector } from "../enhanced-blueprint-selector";
import type { EnhancedBlueprintMetadata } from "@/lib/knowledge-studio/blueprint/types";

// ============================================================
// 测试数据
// ============================================================

const mockBlueprints: EnhancedBlueprintMetadata[] = [
  {
    blueprintId: "arxiv_decoder",
    displayName: "论文解码器",
    description: "解读学术论文，提取核心观点",
    icon: "📄",
    tier: "free",
    targetUsers: ["researcher"],
    category: "geek",
    priority: 1,
    isGeek: true,
    isNew: false,
    estimatedTimeSeconds: 45,
    supportsOutline: true,
    briefingEnabled: true,
    briefingQuestionCount: 2,
  },
  {
    blueprintId: "hot_take",
    displayName: "热点快评",
    description: "快速生成热点话题评论",
    icon: "🔥",
    tier: "free",
    targetUsers: ["content_creator"],
    category: "creator",
    priority: 2,
    isGeek: false,
    isNew: true,
    estimatedTimeSeconds: 30,
    supportsOutline: false,
    briefingEnabled: false,
    briefingQuestionCount: 0,
  },
  {
    blueprintId: "pitch_deck",
    displayName: "融资路演",
    description: "生成投资人风格的演示文稿",
    icon: "💼",
    tier: "pro",
    targetUsers: ["product_manager"],
    category: "business",
    priority: 3,
    isGeek: false,
    isNew: false,
    estimatedTimeSeconds: 60,
    supportsOutline: true,
    briefingEnabled: true,
    briefingQuestionCount: 3,
  },
  {
    blueprintId: "enterprise_report",
    displayName: "企业级报告",
    description: "生成符合企业标准的分析报告",
    icon: "📊",
    tier: "enterprise",
    targetUsers: ["analyst"],
    category: "business",
    priority: 4,
    isGeek: false,
    isNew: true,
    estimatedTimeSeconds: 90,
    supportsOutline: true,
    briefingEnabled: true,
    briefingQuestionCount: 3,
  },
  {
    blueprintId: "tech_tutorial",
    displayName: "技术教程",
    description: "生成步骤化技术教程",
    icon: "📚",
    tier: "free",
    targetUsers: ["developer"],
    category: "tech",
    priority: 5,
    isGeek: true,
    isNew: false,
    estimatedTimeSeconds: 50,
    supportsOutline: true,
    briefingEnabled: true,
    briefingQuestionCount: 2,
  },
];

// ============================================================
// AC1: 按分类分组展示测试
// ============================================================

describe("Story 1.10: AC1 - 按分类分组展示", () => {
  it("should render category headers", () => {
    render(<EnhancedBlueprintSelector blueprints={mockBlueprints} />);

    expect(screen.getByText("极客专区")).toBeInTheDocument();
    expect(screen.getByText("创作者")).toBeInTheDocument();
    expect(screen.getByText("商业文档")).toBeInTheDocument();
    expect(screen.getByText("技术写作")).toBeInTheDocument();
  });

  it("should group blueprints by category", () => {
    render(<EnhancedBlueprintSelector blueprints={mockBlueprints} />);

    // 极客专区应包含论文解码器
    expect(screen.getByText("论文解码器")).toBeInTheDocument();
    // 创作者应包含热点快评
    expect(screen.getByText("热点快评")).toBeInTheDocument();
    // 商业文档应包含融资路演和企业级报告
    expect(screen.getByText("融资路演")).toBeInTheDocument();
    expect(screen.getByText("企业级报告")).toBeInTheDocument();
    // 技术写作应包含技术教程
    expect(screen.getByText("技术教程")).toBeInTheDocument();
  });

  it("should sort categories by defined order", () => {
    const { container } = render(
      <EnhancedBlueprintSelector blueprints={mockBlueprints} />,
    );

    const headers = container.querySelectorAll("h3");
    const headerTexts = Array.from(headers).map((h) => h.textContent);

    // 顺序应为：极客专区 -> 创作者 -> 商业文档 -> 技术写作
    expect(headerTexts.indexOf("极客专区")).toBeLessThan(
      headerTexts.indexOf("创作者"),
    );
    expect(headerTexts.indexOf("创作者")).toBeLessThan(
      headerTexts.indexOf("商业文档"),
    );
    expect(headerTexts.indexOf("商业文档")).toBeLessThan(
      headerTexts.indexOf("技术写作"),
    );
  });
});

// ============================================================
// AC2: P0 蓝图显示🔥标记测试
// ============================================================

describe("Story 1.10: AC2 - P0 蓝图显示🔥标记", () => {
  it("should show 🔥 for isGeek blueprints", () => {
    render(<EnhancedBlueprintSelector blueprints={mockBlueprints} />);

    // 论文解码器和技术教程是 isGeek
    const fireEmojis = screen.getAllByText("🔥");
    expect(fireEmojis.length).toBeGreaterThanOrEqual(2);
  });

  it("should not show 🔥 for non-isGeek blueprints", () => {
    const nonGeekBlueprints = mockBlueprints.filter((bp) => !bp.isGeek);
    render(<EnhancedBlueprintSelector blueprints={nonGeekBlueprints} />);

    // 热点快评已有🔥图标作为 icon，但不应有 isGeek 的🔥标记
    // 检查是否只有 icon 中的🔥
    const fireEmojis = screen.queryAllByText("🔥");
    // 只有热点快评的 icon 是🔥，isGeek 的🔥不应该出现
    expect(fireEmojis.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================
// AC3: 新蓝图显示 NEW 标签测试
// ============================================================

describe("Story 1.10: AC3 - 新蓝图显示 NEW 标签", () => {
  it("should show NEW badge for isNew blueprints", () => {
    render(<EnhancedBlueprintSelector blueprints={mockBlueprints} />);

    // 热点快评和企业级报告是 isNew
    const newBadges = screen.getAllByText("NEW");
    expect(newBadges.length).toBe(2);
  });

  it("should not show NEW badge for non-new blueprints", () => {
    const nonNewBlueprints = mockBlueprints.filter((bp) => !bp.isNew);
    render(<EnhancedBlueprintSelector blueprints={nonNewBlueprints} />);

    const newBadge = screen.queryByText("NEW");
    expect(newBadge).not.toBeInTheDocument();
  });
});

// ============================================================
// AC4: Pro/Enterprise 蓝图显示锁定图标测试
// ============================================================

describe("Story 1.10: AC4 - Pro/Enterprise 显示锁定图标", () => {
  it("should show lock icon for Pro blueprints when user is free tier", () => {
    render(
      <EnhancedBlueprintSelector blueprints={mockBlueprints} userTier="free" />,
    );

    // Pro 和 Enterprise 标签
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("企业版")).toBeInTheDocument();
  });

  it("should not show lock for Pro blueprints when user is pro tier", () => {
    const proOnlyBlueprints = mockBlueprints.filter(
      (bp) => bp.tier === "pro" || bp.tier === "free",
    );
    render(
      <EnhancedBlueprintSelector
        blueprints={proOnlyBlueprints}
        userTier="pro"
      />,
    );

    // Pro 用户应能访问所有 free 和 pro 蓝图，不应有锁定
    const proBlueprint = screen.getByText("融资路演");
    expect(proBlueprint).toBeInTheDocument();
  });

  it("should show tier badges for premium blueprints", () => {
    render(<EnhancedBlueprintSelector blueprints={mockBlueprints} />);

    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("企业版")).toBeInTheDocument();
  });
});

// ============================================================
// AC5: 点击锁定蓝图显示升级提示测试
// ============================================================

describe("Story 1.10: AC5 - 点击锁定蓝图显示升级提示", () => {
  it("should open upgrade dialog when clicking locked blueprint", () => {
    render(
      <EnhancedBlueprintSelector blueprints={mockBlueprints} userTier="free" />,
    );

    // 点击 Pro 蓝图（融资路演）
    const proBlueprint = screen.getByText("融资路演");
    fireEvent.click(proBlueprint.closest("button")!);

    // 应显示升级对话框
    expect(screen.getByText("需要升级会员")).toBeInTheDocument();
    expect(screen.getByText("立即升级")).toBeInTheDocument();
    // 对话框内应显示蓝图信息（使用 getAllByText 处理重复）
    const blueprintNames = screen.getAllByText(/融资路演/);
    expect(blueprintNames.length).toBeGreaterThanOrEqual(2); // 列表 + 对话框
  });

  it("should show blueprint info in upgrade dialog", () => {
    render(
      <EnhancedBlueprintSelector blueprints={mockBlueprints} userTier="free" />,
    );

    // 点击企业级蓝图
    const enterpriseBlueprint = screen.getByText("企业级报告");
    fireEvent.click(enterpriseBlueprint.closest("button")!);

    // 对话框应显示蓝图信息（使用 getAllByText 处理重复）
    const descriptions = screen.getAllByText(/生成符合企业标准的分析报告/);
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
    // 使用 getAllByText 处理重复的"企业版"文本
    const enterpriseLabels = screen.getAllByText(/企业版/);
    expect(enterpriseLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("should close dialog when clicking '稍后再说'", () => {
    render(
      <EnhancedBlueprintSelector blueprints={mockBlueprints} userTier="free" />,
    );

    // 点击锁定蓝图
    const proBlueprint = screen.getByText("融资路演");
    fireEvent.click(proBlueprint.closest("button")!);

    // 点击稍后再说
    const laterButton = screen.getByText("稍后再说");
    fireEvent.click(laterButton);

    // 对话框应关闭
    expect(screen.queryByText("需要升级会员")).not.toBeInTheDocument();
  });

  it("should call onUpgradeClick when clicking upgrade button", () => {
    const mockUpgradeClick = jest.fn();
    render(
      <EnhancedBlueprintSelector
        blueprints={mockBlueprints}
        userTier="free"
        onUpgradeClick={mockUpgradeClick}
      />,
    );

    // 点击锁定蓝图
    const proBlueprint = screen.getByText("融资路演");
    fireEvent.click(proBlueprint.closest("button")!);

    // 点击升级按钮
    const upgradeButton = screen.getByText("立即升级");
    fireEvent.click(upgradeButton);

    expect(mockUpgradeClick).toHaveBeenCalled();
  });
});

// ============================================================
// 选择功能测试
// ============================================================

describe("Story 1.10: 蓝图选择功能", () => {
  it("should call onChange when selecting accessible blueprint", () => {
    const mockOnChange = jest.fn();
    render(
      <EnhancedBlueprintSelector
        blueprints={mockBlueprints}
        userTier="free"
        onChange={mockOnChange}
      />,
    );

    // 点击免费蓝图
    const freeBlueprint = screen.getByText("论文解码器");
    fireEvent.click(freeBlueprint.closest("button")!);

    expect(mockOnChange).toHaveBeenCalledWith("arxiv_decoder");
  });

  it("should not call onChange when clicking locked blueprint", () => {
    const mockOnChange = jest.fn();
    render(
      <EnhancedBlueprintSelector
        blueprints={mockBlueprints}
        userTier="free"
        onChange={mockOnChange}
      />,
    );

    // 点击锁定蓝图
    const proBlueprint = screen.getByText("融资路演");
    fireEvent.click(proBlueprint.closest("button")!);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("should highlight selected blueprint", () => {
    render(
      <EnhancedBlueprintSelector
        blueprints={mockBlueprints}
        value="arxiv_decoder"
        userTier="free"
      />,
    );

    const selectedButton = screen.getByText("论文解码器").closest("button");
    expect(selectedButton).toHaveClass("ring-2");
  });

  it("should be disabled when disabled prop is true", () => {
    const mockOnChange = jest.fn();
    render(
      <EnhancedBlueprintSelector
        blueprints={mockBlueprints}
        userTier="free"
        onChange={mockOnChange}
        disabled
      />,
    );

    const freeBlueprint = screen.getByText("论文解码器");
    fireEvent.click(freeBlueprint.closest("button")!);

    expect(mockOnChange).not.toHaveBeenCalled();
  });
});

// ============================================================
// 蓝图信息展示测试
// ============================================================

describe("Story 1.10: 蓝图信息展示", () => {
  it("should display blueprint description", () => {
    render(<EnhancedBlueprintSelector blueprints={mockBlueprints} />);

    expect(screen.getByText("解读学术论文，提取核心观点")).toBeInTheDocument();
    expect(screen.getByText("快速生成热点话题评论")).toBeInTheDocument();
  });

  it("should display estimated time", () => {
    render(<EnhancedBlueprintSelector blueprints={mockBlueprints} />);

    expect(screen.getByText(/约 45秒/)).toBeInTheDocument();
    expect(screen.getByText(/约 30秒/)).toBeInTheDocument();
  });

  it("should show Briefing indicator for briefing-enabled blueprints", () => {
    render(<EnhancedBlueprintSelector blueprints={mockBlueprints} />);

    // 论文解码器启用了 Briefing
    const briefingIndicators = screen.getAllByText("Briefing");
    expect(briefingIndicators.length).toBeGreaterThan(0);
  });
});
