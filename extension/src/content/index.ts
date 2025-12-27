/**
 * Content Script - 页面内容交互
 *
 * 功能：
 * 1. 文本选择检测和捕获
 * 2. 浮动操作按钮（选中文本时显示）
 * 3. 与 Background 通信
 */

// ============================================
// 常量
// ============================================

const BUTTON_ID = "anykeep-floating-button";
const MIN_SELECTION_LENGTH = 10;

// ============================================
// 状态
// ============================================

let floatingButton: HTMLDivElement | null = null;
let lastSelection: string = "";

// ============================================
// 浮动按钮
// ============================================

/**
 * 创建浮动按钮
 */
function createFloatingButton(): HTMLDivElement {
  const button = document.createElement("div");
  button.id = BUTTON_ID;

  // 样式
  button.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    display: none;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    user-select: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  `;

  // 图标 + 文字
  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>保存到 AnyKeep</span>
  `;

  // 悬停效果
  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.02)";
    button.style.boxShadow =
      "0 6px 16px rgba(99, 102, 241, 0.5), 0 3px 6px rgba(0, 0, 0, 0.15)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
    button.style.boxShadow =
      "0 4px 12px rgba(99, 102, 241, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1)";
  });

  // 点击事件
  button.addEventListener("click", handleSaveSelection);

  document.body.appendChild(button);
  return button;
}

/**
 * 显示浮动按钮
 */
function showFloatingButton(x: number, y: number): void {
  if (!floatingButton) {
    floatingButton = createFloatingButton();
  }

  // 计算位置（避免超出视口）
  const buttonWidth = 150;
  const buttonHeight = 36;
  const padding = 10;

  let posX = x;
  let posY = y + padding;

  // 右边界检查
  if (posX + buttonWidth > window.innerWidth - padding) {
    posX = window.innerWidth - buttonWidth - padding;
  }

  // 左边界检查
  if (posX < padding) {
    posX = padding;
  }

  // 底部边界检查
  if (posY + buttonHeight > window.innerHeight - padding) {
    posY = y - buttonHeight - padding;
  }

  floatingButton.style.left = `${posX}px`;
  floatingButton.style.top = `${posY}px`;
  floatingButton.style.display = "flex";
}

/**
 * 隐藏浮动按钮
 */
function hideFloatingButton(): void {
  if (floatingButton) {
    floatingButton.style.display = "none";
  }
}

// ============================================
// 选择处理
// ============================================

/**
 * 处理文本选择
 */
function handleSelection(): void {
  const selection = window.getSelection();
  if (!selection) return;

  const text = selection.toString().trim();

  // 检查是否有有效选择
  if (text.length < MIN_SELECTION_LENGTH) {
    hideFloatingButton();
    lastSelection = "";
    return;
  }

  // 检查是否点击了浮动按钮
  const activeElement = document.activeElement;
  if (activeElement && activeElement.id === BUTTON_ID) {
    return;
  }

  lastSelection = text;

  // 获取选择范围位置
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // 显示按钮在选择文本下方中央
  const centerX = rect.left + rect.width / 2 - 75; // 75 = 按钮宽度的一半
  const bottomY = rect.bottom;

  showFloatingButton(centerX, bottomY);
}

/**
 * 保存选中文本
 */
function handleSaveSelection(): void {
  if (!lastSelection) return;

  // 获取选中文本的 HTML
  const selection = window.getSelection();
  let html: string | undefined;

  if (selection && selection.rangeCount > 0) {
    try {
      const range = selection.getRangeAt(0);
      const container = document.createElement("div");
      container.appendChild(range.cloneContents());
      html = container.innerHTML;
    } catch {
      // 忽略 HTML 提取错误
    }
  }

  // 发送消息到 Background
  chrome.runtime.sendMessage(
    {
      type: "SAVE_SELECTION",
      payload: {
        text: lastSelection,
        html,
        url: window.location.href,
        title: document.title,
      },
    },
    (response) => {
      if (response?.success) {
        showSaveSuccess();
      } else {
        showSaveError(response?.error || "保存失败");
      }
    },
  );

  hideFloatingButton();
  lastSelection = "";

  // 清除选择
  selection?.removeAllRanges();
}

// ============================================
// 反馈提示
// ============================================

/**
 * 显示保存成功提示
 */
function showSaveSuccess(): void {
  showToast("✓ 已保存到 AnyKeep", "success");
}

/**
 * 显示保存失败提示
 */
function showSaveError(message: string): void {
  showToast(`✗ ${message}`, "error");
}

/**
 * 显示 Toast 提示
 */
function showToast(message: string, type: "success" | "error"): void {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    z-index: 2147483647;
    padding: 12px 20px;
    background: ${type === "success" ? "#10b981" : "#ef4444"};
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: transform 0.3s ease;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  // 动画进入
  requestAnimationFrame(() => {
    toast.style.transform = "translateX(-50%) translateY(0)";
  });

  // 3秒后移除
  setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(100px)";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// ============================================
// 消息处理
// ============================================

/**
 * 处理来自 Background 的消息
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "GET_PAGE_SELECTION": {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || "";

      let html: string | undefined;
      if (selection && selection.rangeCount > 0 && text) {
        try {
          const range = selection.getRangeAt(0);
          const container = document.createElement("div");
          container.appendChild(range.cloneContents());
          html = container.innerHTML;
        } catch {
          // 忽略
        }
      }

      sendResponse({ text, html });
      break;
    }

    case "GET_PAGE_CONTENT": {
      // 获取页面主要内容
      const content = extractMainContent();
      sendResponse({ content });
      break;
    }

    case "SHOW_SAVE_SUCCESS": {
      showSaveSuccess();
      sendResponse({ success: true });
      break;
    }

    case "SHOW_SAVE_ERROR": {
      showSaveError(message.payload?.message || "保存失败");
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ error: "Unknown message type" });
  }

  return true;
});

// ============================================
// 页面内容提取
// ============================================

/**
 * 提取页面主要内容
 */
function extractMainContent(): string {
  // 尝试找到主要内容区域
  const selectors = [
    "article",
    "main",
    '[role="main"]',
    ".post-content",
    ".article-content",
    ".entry-content",
    ".content",
    "#content",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return cleanText(element.textContent || "");
    }
  }

  // 降级：获取 body 内容
  return cleanText(document.body.textContent || "");
}

/**
 * 清理文本
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ") // 合并空白
    .replace(/\n+/g, "\n") // 合并换行
    .trim()
    .slice(0, 10000); // 限制长度
}

// ============================================
// 事件监听
// ============================================

// 监听鼠标抬起事件（选择完成）
document.addEventListener("mouseup", (event) => {
  // 延迟处理，确保选择已完成
  setTimeout(() => {
    // 检查是否点击了浮动按钮
    const target = event.target as HTMLElement;
    if (target.id === BUTTON_ID || target.closest(`#${BUTTON_ID}`)) {
      return;
    }

    handleSelection();
  }, 10);
});

// 监听键盘选择（Shift + 方向键等）
document.addEventListener("keyup", (event) => {
  if (event.shiftKey) {
    setTimeout(handleSelection, 10);
  }
});

// 点击其他区域时隐藏按钮
document.addEventListener("mousedown", (event) => {
  const target = event.target as HTMLElement;
  if (target.id !== BUTTON_ID && !target.closest(`#${BUTTON_ID}`)) {
    hideFloatingButton();
  }
});

// 滚动时隐藏按钮
document.addEventListener("scroll", hideFloatingButton, { passive: true });

// ============================================
// 初始化
// ============================================

// 确保不在 iframe 中重复初始化
if (window === window.top) {
  console.log("[AnyKeep] Content script loaded");
}
