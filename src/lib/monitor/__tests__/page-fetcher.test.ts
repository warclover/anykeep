/**
 * 页面内容抓取服务单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  hashContent,
  countWords,
  extractReadableText,
  isUrlMonitorable,
} from "../page-fetcher";

describe("page-fetcher", () => {
  describe("hashContent", () => {
    it("应该为相同内容生成相同哈希", () => {
      const content = "Hello, World!";
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);
      expect(hash1).toBe(hash2);
    });

    it("应该为不同内容生成不同哈希", () => {
      const hash1 = hashContent("Hello");
      const hash2 = hashContent("World");
      expect(hash1).not.toBe(hash2);
    });

    it("应该生成64字符的哈希值", () => {
      const hash = hashContent("Test content");
      expect(hash).toHaveLength(64);
    });

    it("应该处理空字符串", () => {
      const hash = hashContent("");
      expect(hash).toHaveLength(64);
    });

    it("应该处理中文内容", () => {
      const hash = hashContent("你好，世界！");
      expect(hash).toHaveLength(64);
    });
  });

  describe("countWords", () => {
    it("应该正确统计英文单词", () => {
      const count = countWords("Hello world");
      expect(count).toBe(2);
    });

    it("应该正确统计中文字符", () => {
      const count = countWords("你好世界");
      expect(count).toBe(4);
    });

    it("应该正确统计中英文混合", () => {
      const count = countWords("Hello 你好 World 世界");
      expect(count).toBe(6); // 2 English + 4 Chinese
    });

    it("应该处理空字符串", () => {
      const count = countWords("");
      expect(count).toBe(0);
    });

    it("应该处理只有空白的字符串", () => {
      const count = countWords("   \n\t   ");
      expect(count).toBe(0);
    });

    it("应该忽略多余空白", () => {
      const count = countWords("  Hello   world  ");
      expect(count).toBe(2);
    });
  });

  describe("extractReadableText", () => {
    it("应该移除script标签", () => {
      const html = "<p>Hello</p><script>alert('test')</script><p>World</p>";
      const text = extractReadableText(html);
      expect(text).not.toContain("alert");
      expect(text).toContain("Hello");
      expect(text).toContain("World");
    });

    it("应该移除style标签", () => {
      const html = "<p>Hello</p><style>.test{color:red}</style><p>World</p>";
      const text = extractReadableText(html);
      expect(text).not.toContain("color");
      expect(text).toContain("Hello");
    });

    it("应该移除HTML标签", () => {
      const html = "<div><p>Hello</p><span>World</span></div>";
      const text = extractReadableText(html);
      expect(text).not.toContain("<");
      expect(text).not.toContain(">");
      expect(text).toContain("Hello");
      expect(text).toContain("World");
    });

    it("应该解码HTML实体", () => {
      const html = "<p>Hello&nbsp;World &amp; Test</p>";
      const text = extractReadableText(html);
      expect(text).toContain("Hello World & Test");
    });

    it("应该清理多余空白", () => {
      const html = "<p>Hello</p>\n\n\n<p>World</p>";
      const text = extractReadableText(html);
      expect(text).not.toContain("\n");
      expect(text).toBe("Hello World");
    });

    it("应该处理嵌套script标签", () => {
      const html = `
        <html>
          <head>
            <script type="text/javascript">
              function test() {
                return '<script>nested</script>';
              }
            </script>
          </head>
          <body>Content</body>
        </html>
      `;
      const text = extractReadableText(html);
      expect(text).toContain("Content");
      expect(text).not.toContain("function");
    });
  });

  describe("isUrlMonitorable", () => {
    it("应该允许标准HTTP URL", () => {
      const result = isUrlMonitorable("https://example.com/page");
      expect(result.canMonitor).toBe(true);
    });

    it("应该拒绝非HTTP协议", () => {
      const result = isUrlMonitorable("ftp://example.com/file");
      expect(result.canMonitor).toBe(false);
      expect(result.reason).toContain("不支持的协议");
    });

    it("应该拒绝localhost", () => {
      const result = isUrlMonitorable("http://localhost:3000");
      expect(result.canMonitor).toBe(false);
      expect(result.reason).toContain("本地");
    });

    it("应该拒绝内网IP 192.168.x.x", () => {
      const result = isUrlMonitorable("http://192.168.1.1/page");
      expect(result.canMonitor).toBe(false);
      expect(result.reason).toContain("内网");
    });

    it("应该拒绝内网IP 10.x.x.x", () => {
      const result = isUrlMonitorable("http://10.0.0.1/page");
      expect(result.canMonitor).toBe(false);
    });

    it("应该拒绝内网IP 172.16-31.x.x", () => {
      const result = isUrlMonitorable("http://172.16.0.1/page");
      expect(result.canMonitor).toBe(false);
    });

    it("应该拒绝127.x.x.x", () => {
      const result = isUrlMonitorable("http://127.0.0.1/page");
      expect(result.canMonitor).toBe(false);
    });

    it("应该拒绝微信公众号链接", () => {
      const result = isUrlMonitorable("https://mp.weixin.qq.com/s/xxx");
      expect(result.canMonitor).toBe(false);
      expect(result.reason).toContain("微信");
    });

    it("应该拒绝小红书链接", () => {
      const result = isUrlMonitorable("https://www.xiaohongshu.com/explore");
      expect(result.canMonitor).toBe(false);
      expect(result.reason).toContain("小红书");
    });

    it("应该拒绝Twitter/X链接", () => {
      const result1 = isUrlMonitorable("https://twitter.com/user");
      const result2 = isUrlMonitorable("https://x.com/user");
      expect(result1.canMonitor).toBe(false);
      expect(result2.canMonitor).toBe(false);
    });

    it("应该处理无效URL", () => {
      const result = isUrlMonitorable("not-a-valid-url");
      expect(result.canMonitor).toBe(false);
      expect(result.reason).toContain("格式错误");
    });

    it("应该允许B站链接", () => {
      const result = isUrlMonitorable("https://www.bilibili.com/video/BV123");
      expect(result.canMonitor).toBe(true);
    });

    it("应该允许GitHub链接", () => {
      const result = isUrlMonitorable("https://github.com/user/repo");
      expect(result.canMonitor).toBe(true);
    });

    it("应该允许知乎文章", () => {
      // 知乎在登录限制列表中
      const result = isUrlMonitorable("https://zhuanlan.zhihu.com/p/123");
      expect(result.canMonitor).toBe(true); // 知乎不在限制列表中
    });
  });
});
