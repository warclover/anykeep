import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Custom ignores:
    "figma1121/**",  // Figma 设计导出文件
    "scripts/**",  // 脚本文件
    "*.mjs",  // 脚本文件（如 apply-rls-fix-direct.mjs）
    "supabase/**",  // Supabase 相关文件
    "*.md",  // Markdown 文件
    "browser-extension/.wxt/**",  // WXT 自动生成文件
    "browser-extension/.output/**",  // 浏览器扩展编译输出
    "browser-extension/node_modules/**",  // 浏览器扩展依赖
    "coverage/**",  // 测试覆盖率报告
    "public/sw.js",  // Service Worker（自动生成）
    ".backups/**",  // 代码审查备份文件
    ".backup/**",  // 备份文件
    "__mocks__/**",  // Jest 测试 mocks
    "_bmad/**",  // BMAD 模块模板文件
    "anykeep-extension/**",  // 旧版浏览器扩展（独立项目）
    // Extension 目录
    "extension/dist/**",  // 浏览器扩展编译输出
    "extension/scripts/**",  // 扩展构建脚本（CommonJS）
    "extension/*.config.js",  // 扩展配置文件
  ]),
  // Custom rules for code quality
  {
    rules: {
      // 禁止使用 any 类型
      "@typescript-eslint/no-explicit-any": "error",

      // 限制 console 使用 - 推荐使用 logger 或 clientLogger
      // 生产代码禁止 console.log，允许 console.error/info（便于调试和测试输出）
      // 测试文件允许所有 console 方法（见下方 overrides）
      "no-console": ["error", {
        allow: ["error", "info"]
      }],

      // 强制使用类型导入
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports"
        }
      ],

      // 禁止未使用的变量（允许以 _ 开头的参数和变量）
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],

      // 要求显式返回类型（仅对导出的函数）
      "@typescript-eslint/explicit-module-boundary-types": "off",

      // 禁止空函数
      "@typescript-eslint/no-empty-function": "warn",

      // 要求使用 const 声明不会被重新赋值的变量
      "prefer-const": "error",

      // 禁止不必要的分号
      "no-extra-semi": "error",

      // 强制使用 === 和 !==
      "eqeqeq": ["error", "always", { null: "ignore" }],

      // React Compiler 规则 - 关闭 memoization 保留检查（兼容性问题）
      // eslint-disable-next-line 对此规则无效，需要在配置中关闭
      "react-hooks/preserve-manual-memoization": "off",
    }
  }
]);

export default eslintConfig;
