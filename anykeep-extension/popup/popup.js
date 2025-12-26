/**
 * AnyKeep Popup Script
 *
 * 扩展弹出窗口交互逻辑
 */

// =============================================================================
// DOM 元素
// =============================================================================

const elements = {
  // 状态容器
  loadingState: document.getElementById("loading-state"),
  loginState: document.getElementById("login-state"),
  mainState: document.getElementById("main-state"),

  // 登录相关
  loginBtn: document.getElementById("login-btn"),

  // 用户信息
  userAvatar: document.getElementById("user-avatar"),
  userName: document.getElementById("user-name"),
  userEmail: document.getElementById("user-email"),

  // 队列状态
  queueStatus: document.getElementById("queue-status"),
  queueCount: document.getElementById("queue-count"),
  syncBtn: document.getElementById("sync-btn"),

  // 状态消息
  statusMessage: document.getElementById("status-message"),

  // 文章相关
  notWechat: document.getElementById("not-wechat"),
  articlePreview: document.getElementById("article-preview"),
  articleCover: document.getElementById("article-cover"),
  articleTitle: document.getElementById("article-title"),
  articleAuthor: document.getElementById("article-author"),
  articleWords: document.getElementById("article-words"),
  saveBtn: document.getElementById("save-btn"),
};

// =============================================================================
// 状态管理
// =============================================================================

let currentState = "loading";
let currentArticle = null;
let isAuthenticated = false;
let currentUser = null;

/**
 * 切换显示状态
 */
function setState(state) {
  currentState = state;

  // 隐藏所有状态
  elements.loadingState.classList.add("hidden");
  elements.loginState.classList.add("hidden");
  elements.mainState.classList.add("hidden");

  // 显示对应状态
  switch (state) {
    case "loading":
      elements.loadingState.classList.remove("hidden");
      break;
    case "login":
      elements.loginState.classList.remove("hidden");
      break;
    case "main":
      elements.mainState.classList.remove("hidden");
      break;
  }
}

/**
 * 显示状态消息
 */
function showStatusMessage(message, type = "info") {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.classList.remove("hidden");

  // 3 秒后自动隐藏
  setTimeout(() => {
    elements.statusMessage.classList.add("hidden");
  }, 3000);
}

/**
 * 更新用户信息显示
 */
function updateUserInfo(user) {
  if (user) {
    elements.userName.textContent = user.name || user.email?.split("@")[0] || "用户";
    elements.userEmail.textContent = user.email || "";
    elements.userAvatar.textContent = (user.name || user.email || "U")[0].toUpperCase();
  }
}

/**
 * 更新文章预览
 */
function updateArticlePreview(article) {
  if (!article) {
    elements.articlePreview.classList.add("hidden");
    elements.notWechat.classList.remove("hidden");
    return;
  }

  elements.notWechat.classList.add("hidden");
  elements.articlePreview.classList.remove("hidden");

  elements.articleTitle.textContent = article.title || "未知标题";

  // 封面图
  if (article.coverImage) {
    elements.articleCover.src = article.coverImage;
    elements.articleCover.style.display = "block";
  } else {
    elements.articleCover.style.display = "none";
  }

  // 作者
  const authorSpan = elements.articleAuthor.querySelector("span:last-child");
  if (authorSpan) {
    authorSpan.textContent = article.author || "未知公众号";
  }

  // 字数
  const wordsSpan = elements.articleWords.querySelector("span:last-child");
  if (wordsSpan) {
    wordsSpan.textContent = `${(article.wordCount || 0).toLocaleString()} 字`;
  }
}

/**
 * 更新离线队列状态
 */
async function updateQueueStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_QUEUE_STATUS" });
    if (response.success && response.queue.length > 0) {
      elements.queueCount.textContent = response.queue.length;
      elements.queueStatus.classList.remove("hidden");
    } else {
      elements.queueStatus.classList.add("hidden");
    }
  } catch (error) {
    console.error("[Popup] Failed to get queue status:", error);
  }
}

// =============================================================================
// 事件处理
// =============================================================================

/**
 * 登录按钮点击
 */
elements.loginBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
  window.close();
});

/**
 * 同步按钮点击
 */
elements.syncBtn.addEventListener("click", async () => {
  elements.syncBtn.disabled = true;
  elements.syncBtn.textContent = "同步中...";

  try {
    await chrome.runtime.sendMessage({ type: "SYNC_QUEUE" });
    await updateQueueStatus();
    showStatusMessage("同步完成", "success");
  } catch (error) {
    showStatusMessage("同步失败", "error");
  } finally {
    elements.syncBtn.disabled = false;
    elements.syncBtn.textContent = "立即同步";
  }
});

/**
 * 保存按钮点击
 */
elements.saveBtn.addEventListener("click", async () => {
  if (!currentArticle) return;

  elements.saveBtn.disabled = true;
  elements.saveBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
      <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"></circle>
    </svg>
    保存中...
  `;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_ARTICLE",
      data: currentArticle,
    });

    if (response.success) {
      if (response.queued) {
        showStatusMessage(response.message, "info");
      } else {
        showStatusMessage("文章已保存！", "success");
      }

      // 更新按钮状态
      elements.saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        已保存
      `;
      elements.saveBtn.style.background = "#10b981";
    } else {
      throw new Error(response.error || "保存失败");
    }
  } catch (error) {
    console.error("[Popup] Save failed:", error);
    showStatusMessage(error.message || "保存失败", "error");

    // 恢复按钮
    elements.saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      保存到 AnyKeep
    `;
    elements.saveBtn.disabled = false;
  }
});

// =============================================================================
// 初始化
// =============================================================================

/**
 * 检查当前标签页是否为微信文章
 */
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      return null;
    }

    // 检查是否为微信文章页面
    const isWechat = tab.url.includes("mp.weixin.qq.com/s");

    if (!isWechat) {
      return null;
    }

    // 从 content script 获取文章数据
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "GET_ARTICLE_DATA",
      });

      if (response && response.success) {
        return response.data;
      }
    } catch (error) {
      console.error("[Popup] Failed to get article data:", error);
    }

    return null;
  } catch (error) {
    console.error("[Popup] Failed to check current tab:", error);
    return null;
  }
}

/**
 * 初始化
 */
async function initialize() {
  setState("loading");

  try {
    // 1. 检查认证状态
    const authResponse = await chrome.runtime.sendMessage({ type: "CHECK_AUTH" });

    if (!authResponse.authenticated) {
      setState("login");
      return;
    }

    isAuthenticated = true;
    currentUser = authResponse.user;

    // 2. 显示主状态
    setState("main");
    updateUserInfo(currentUser);

    // 3. 更新队列状态
    await updateQueueStatus();

    // 4. 检查当前页面
    currentArticle = await checkCurrentTab();
    updateArticlePreview(currentArticle);

  } catch (error) {
    console.error("[Popup] Initialization failed:", error);
    setState("login");
  }
}

// 启动初始化
initialize();
