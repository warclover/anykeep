/**
 * Prism-Light 共享配置
 *
 * 使用 prism-light 替代完整 Prism 构建，按需注册 16 种常用语言。
 * 未注册的语言仍会正常显示代码文本，只是不会有语法高亮。
 *
 * 预计减少客户端 JS 300-500 kB（移除 200+ 未使用的语言定义）。
 */

import PrismLight from "react-syntax-highlighter/dist/esm/prism-light";

// 按需导入语言定义（覆盖 90%+ 常用场景）
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";

// 样式 ESM 导入（替代动态 CJS 导入，支持 tree-shaking）
export { default as darkTheme } from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
export { default as lightTheme } from "react-syntax-highlighter/dist/esm/styles/prism/vs";

// 注册语言（含常用别名）
PrismLight.registerLanguage("javascript", javascript);
PrismLight.registerLanguage("js", javascript);
PrismLight.registerLanguage("typescript", typescript);
PrismLight.registerLanguage("ts", typescript);
PrismLight.registerLanguage("jsx", jsx);
PrismLight.registerLanguage("tsx", tsx);
PrismLight.registerLanguage("python", python);
PrismLight.registerLanguage("py", python);
PrismLight.registerLanguage("bash", bash);
PrismLight.registerLanguage("sh", bash);
PrismLight.registerLanguage("shell", bash);
PrismLight.registerLanguage("json", json);
PrismLight.registerLanguage("css", css);
PrismLight.registerLanguage("sql", sql);
PrismLight.registerLanguage("markdown", markdown);
PrismLight.registerLanguage("md", markdown);
PrismLight.registerLanguage("yaml", yaml);
PrismLight.registerLanguage("yml", yaml);
PrismLight.registerLanguage("go", go);
PrismLight.registerLanguage("rust", rust);
PrismLight.registerLanguage("java", java);
PrismLight.registerLanguage("c", c);
PrismLight.registerLanguage("cpp", cpp);

export { PrismLight as SyntaxHighlighter };
