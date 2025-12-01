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
  ]),
  // Custom rules for code quality
  {
    rules: {
      // 禁止使用 any 类型
      "@typescript-eslint/no-explicit-any": "error",

      // 限制 console 使用（仅允许 warn 和 error，且需要在开发环境判断）
      "no-console": ["warn", {
        allow: ["warn", "error"]
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
    }
  }
]);

export default eslintConfig;
