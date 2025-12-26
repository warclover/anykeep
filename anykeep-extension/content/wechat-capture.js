/**
 * AnyKeep WeChat Article Capture
 *
 * 微信公众号文章内容抓取脚本
 * 在微信文章页面注入，提供一键保存功能
 */

(function () {
  "use strict";

  // =============================================================================
  // 配置
  // =============================================================================

  const CONFIG = {
    // 浮动按钮位置
    buttonPosition: { right: "20px", bottom: "100px" },
    // 保存按钮显示延迟（ms）
    showDelay: 1000,
    // 消息显示时长（ms）
    toastDuration: 3000,
  };

  // =============================================================================
  // 工具函数
  // =============================================================================

  /**
   * 检测是否为微信公众号文章页
   */
  function isWechatArticlePage() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    // 检查域名
    if (hostname !== "mp.weixin.qq.com") {
      return false;
    }

    // 检查 URL 路径
    if (!url.includes("/s/") && !url.includes("/s?")) {
      return false;
    }

    // 检查页面特征元素
    const richMediaContent = document.getElementById("js_content");
    const articleTitle = document.getElementById("activity-name");

    return !!(richMediaContent || articleTitle);
  }

  /**
   * 提取文章元数据
   */
  function extractArticleMetadata() {
    // 标题
    const titleEl =
      document.getElementById("activity-name") ||
      document.querySelector('meta[property="og:title"]');
    const title = titleEl
      ? titleEl.textContent?.trim() || titleEl.getAttribute("content")
      : document.title;

    // 作者/公众号名称
    const authorEl =
      document.getElementById("js_name") ||
      document.querySelector('meta[property="og:article:author"]');
    const author = authorEl
      ? authorEl.textContent?.trim() || authorEl.getAttribute("content")
      : "";

    // 发布时间
    const publishTimeEl = document.getElementById("publish_time");
    const publishTime = publishTimeEl ? publishTimeEl.textContent?.trim() : "";

    // 摘要
    const descEl = document.querySelector('meta[property="og:description"]');
    const description = descEl ? descEl.getAttribute("content") : "";

    // 封面图
    const coverEl = document.querySelector('meta[property="og:image"]');
    const coverImage = coverEl ? coverEl.getAttribute("content") : "";

    // 公众号 ID
    const bizMatch = window.location.href.match(/__biz=([^&]+)/);
    const biz = bizMatch ? bizMatch[1] : "";

    return {
      url: window.location.href,
      title: title || "未知标题",
      author: author || "未知公众号",
      publishTime,
      description: description || "",
      coverImage: coverImage || "",
      biz,
      platform: "WECHAT_OFFICIAL_ACCOUNT",
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * 提取文章完整 HTML 内容
   */
  function extractArticleContent() {
    const contentEl = document.getElementById("js_content");
    if (!contentEl) {
      return { html: "", wordCount: 0 };
    }

    // 克隆节点避免修改原页面
    const clone = contentEl.cloneNode(true);

    // 处理懒加载图片
    const lazyImages = clone.querySelectorAll("img[data-src]");
    lazyImages.forEach((img) => {
      const dataSrc = img.getAttribute("data-src");
      if (dataSrc && !img.getAttribute("src")) {
        img.setAttribute("src", dataSrc);
      }
    });

    const html = clone.innerHTML;
    const textContent = clone.textContent || "";
    const wordCount = textContent.replace(/\s+/g, "").length;

    return { html, wordCount };
  }

  // =============================================================================
  // UI 组件
  // =============================================================================

  /**
   * 创建浮动保存按钮
   */
  function createFloatingButton() {
    // 检查是否已存在
    if (document.getElementById("anykeep-save-btn")) {
      return;
    }

    const button = document.createElement("button");
    button.id = "anykeep-save-btn";
    button.className = "anykeep-floating-btn";
    button.innerHTML = `
      <svg class="anykeep-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="anykeep-btn-text">保存到 AnyKeep</span>
    `;

    button.addEventListener("click", handleSaveClick);

    document.body.appendChild(button);
  }

  /**
   * 创建 Toast 消息
   */
  function showToast(message, type = "info") {
    // 移除已有的 toast
    const existing = document.querySelector(".anykeep-toast");
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.className = `anykeep-toast anykeep-toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // 自动移除
    setTimeout(() => {
      toast.classList.add("anykeep-toast-hide");
      setTimeout(() => toast.remove(), 300);
    }, CONFIG.toastDuration);
  }

  /**
   * 显示保存中状态
   */
  function showSavingState() {
    const button = document.getElementById("anykeep-save-btn");
    if (button) {
      button.classList.add("anykeep-saving");
      button.querySelector(".anykeep-btn-text").textContent = "保存中...";
    }
  }

  /**
   * 恢复按钮状态
   */
  function resetButtonState() {
    const button = document.getElementById("anykeep-save-btn");
    if (button) {
      button.classList.remove("anykeep-saving");
      button.querySelector(".anykeep-btn-text").textContent = "保存到 AnyKeep";
    }
  }

  // =============================================================================
  // 保存逻辑
  // =============================================================================

  /**
   * 处理保存按钮点击
   */
  async function handleSaveClick() {
    try {
      showSavingState();

      // 1. 提取文章数据
      const metadata = extractArticleMetadata();
      const content = extractArticleContent();

      const articleData = {
        ...metadata,
        ...content,
      };

      // 2. 发送到 background script
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_ARTICLE",
        data: articleData,
      });

      if (response.success) {
        showToast("文章已保存到 AnyKeep！", "success");
      } else {
        throw new Error(response.error || "保存失败");
      }
    } catch (error) {
      console.error("[AnyKeep] Save failed:", error);

      if (error.message.includes("未登录") || error.message.includes("login")) {
        showToast("请先登录 AnyKeep", "error");
        // 发送消息打开登录页
        chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
      } else {
        showToast(error.message || "保存失败，请稍后重试", "error");
      }
    } finally {
      resetButtonState();
    }
  }

  // =============================================================================
  // 初始化
  // =============================================================================

  /**
   * 初始化脚本
   */
  function initialize() {
    // 检查是否为微信文章页
    if (!isWechatArticlePage()) {
      console.log("[AnyKeep] Not a WeChat article page, skipping...");
      return;
    }

    console.log("[AnyKeep] WeChat article detected, initializing...");

    // 延迟显示按钮（等待页面加载完成）
    setTimeout(() => {
      createFloatingButton();
    }, CONFIG.showDelay);

    // 监听来自 popup 的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "GET_ARTICLE_DATA") {
        const metadata = extractArticleMetadata();
        const content = extractArticleContent();
        sendResponse({ success: true, data: { ...metadata, ...content } });
      }
      return true;
    });
  }

  // 页面加载完成后初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
