/**
 * 样式处理器
 *
 * @module wechat-article/processors
 * @description 从 <style> 标签提取 CSS 并内联到元素
 */

// =============================================================================
// 类型定义
// =============================================================================

interface CssRule {
  selector: string;
  declarations: string;
}

// =============================================================================
// CSS 解析
// =============================================================================

/**
 * 从 HTML 中提取所有 <style> 标签内容
 */
export function extractStyles(html: string): string[] {
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  return styleMatches.map((match) => {
    const content = match.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    return content ? content[1] : "";
  });
}

/**
 * 解析 CSS 文本为规则数组
 *
 * 简化版解析，支持：
 * - 类选择器 (.class)
 * - ID 选择器 (#id)
 * - 元素选择器 (div, p, span)
 * - 复合选择器 (div.class, .class1.class2)
 *
 * 不支持：
 * - 媒体查询 (@media)
 * - 关键帧 (@keyframes)
 * - 伪类/伪元素 (:hover, ::before)
 */
export function parseCssRules(css: string): CssRule[] {
  const rules: CssRule[] = [];

  // 移除注释
  let cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // 移除 @media 和 @keyframes 块
  cleaned = cleaned.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/gi, "");
  cleaned = cleaned.replace(/@keyframes[^{]*\{[\s\S]*?\}\s*\}/gi, "");
  cleaned = cleaned.replace(/@-webkit-keyframes[^{]*\{[\s\S]*?\}\s*\}/gi, "");

  // 匹配 CSS 规则: selector { declarations }
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(cleaned)) !== null) {
    const selector = match[1].trim();
    const declarations = match[2].trim();

    // 跳过空规则
    if (!selector || !declarations) continue;

    // 处理逗号分隔的多选择器
    const selectors = selector.split(",").map((s) => s.trim());

    for (const sel of selectors) {
      // 跳过包含伪类/伪元素的选择器
      if (sel.includes(":")) continue;

      // 跳过包含子选择器的复杂选择器（暂不支持）
      if (sel.includes(">") || sel.includes("+") || sel.includes("~")) continue;

      rules.push({
        selector: sel,
        declarations,
      });
    }
  }

  return rules;
}

/**
 * 将 CSS 规则转换为选择器到样式的映射
 *
 * 合并同一选择器的多个规则
 */
export function buildStyleMap(rules: CssRule[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const rule of rules) {
    const existing = map.get(rule.selector);
    if (existing) {
      // 合并样式，后面的覆盖前面的
      map.set(rule.selector, `${existing}; ${rule.declarations}`);
    } else {
      map.set(rule.selector, rule.declarations);
    }
  }

  return map;
}

// =============================================================================
// 样式内联
// =============================================================================

/**
 * 检查元素是否匹配选择器
 *
 * 支持的选择器格式：
 * - .class
 * - #id
 * - element
 * - element.class
 * - .class1.class2
 */
function matchesSelector(
  tagName: string,
  classes: string[],
  id: string | null,
  selector: string,
): boolean {
  // ID 选择器
  if (selector.startsWith("#")) {
    const targetId = selector.slice(1);
    if (id === targetId) return true;
    // ID + 类组合: #id.class
    if (selector.includes(".")) {
      const [idPart, ...classParts] = selector.split(".");
      if (idPart === `#${id}` && classParts.every((c) => classes.includes(c))) {
        return true;
      }
    }
    return false;
  }

  // 类选择器: .class 或 .class1.class2
  if (selector.startsWith(".")) {
    const selectorClasses = selector.split(".").filter(Boolean);
    return selectorClasses.every((c) => classes.includes(c));
  }

  // 元素选择器: element 或 element.class
  const parts = selector.split(".");
  const elementPart = parts[0].toLowerCase();
  const classParts = parts.slice(1);

  // 检查元素名称
  if (elementPart && elementPart !== tagName.toLowerCase()) {
    return false;
  }

  // 检查类名
  if (classParts.length > 0) {
    return classParts.every((c) => classes.includes(c));
  }

  // 纯元素选择器
  return !!elementPart;
}

/**
 * 将 CSS 样式内联到 HTML 元素
 *
 * @param html - 原始 HTML
 * @param styleMap - 选择器到样式的映射
 * @returns 内联样式后的 HTML
 */
export function inlineStyles(html: string, styleMap: Map<string, string>): string {
  if (styleMap.size === 0) return html;

  // 正则匹配所有开始标签
  return html.replace(
    /<(\w+)([^>]*)>/g,
    (match, tagName: string, attrs: string) => {
      // 提取 class 属性
      const classMatch = attrs.match(/class="([^"]*)"/i);
      const classes = classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [];

      // 提取 id 属性
      const idMatch = attrs.match(/id="([^"]*)"/i);
      const id = idMatch ? idMatch[1] : null;

      // 收集匹配的样式
      const matchedStyles: string[] = [];

      for (const [selector, styles] of styleMap) {
        if (matchesSelector(tagName, classes, id, selector)) {
          matchedStyles.push(styles);
        }
      }

      if (matchedStyles.length === 0) {
        return match;
      }

      // 合并新样式
      const newStyles = matchedStyles.join("; ");

      // 检查是否已有 style 属性
      const existingStyleMatch = attrs.match(/style="([^"]*)"/i);
      if (existingStyleMatch) {
        // 合并：现有样式优先（内联样式优先级更高）
        const existingStyles = existingStyleMatch[1];
        const mergedStyles = `${newStyles}; ${existingStyles}`;
        const newAttrs = attrs.replace(
          /style="[^"]*"/i,
          `style="${mergedStyles}"`,
        );
        return `<${tagName}${newAttrs}>`;
      }

      // 添加新的 style 属性
      return `<${tagName}${attrs} style="${newStyles}">`;
    },
  );
}

// =============================================================================
// 主处理函数
// =============================================================================

/**
 * 处理 HTML，将 <style> 标签中的 CSS 内联到元素
 *
 * @param html - 包含 <style> 标签的 HTML
 * @returns 内联样式后的 HTML（不含 <style> 标签）
 */
export function processStylesInline(html: string): string {
  // 1. 提取所有 <style> 内容
  const styles = extractStyles(html);

  if (styles.length === 0) {
    return html;
  }

  // 2. 解析 CSS 规则
  const allRules: CssRule[] = [];
  for (const css of styles) {
    allRules.push(...parseCssRules(css));
  }

  // 3. 构建样式映射
  const styleMap = buildStyleMap(allRules);

  // 4. 移除 <style> 标签
  let result = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // 5. 内联样式到元素
  result = inlineStyles(result, styleMap);

  return result;
}
