# 快速开始指南

## 前置条件

1. 确保项目已安装依赖：`npm install`
2. 确保环境变量已配置（`.env.local`）
3. 确保开发服务器可以运行（用于调用分类 API）

## 运行测试

### 方式 1: 使用 tsx 直接运行

```bash
# 安装 tsx（如果还没有）
npm install -D tsx

# 运行完整测试
npx tsx scripts/classification-realistic-test/index.ts

# 快速测试（少量数据）
npx tsx scripts/classification-realistic-test/index.ts --quick

# 详细日志
npx tsx scripts/classification-realistic-test/index.ts --verbose

# 指定用户类型
npx tsx scripts/classification-realistic-test/index.ts --user-types=dev_frontend,designer_ui
```

### 方式 2: 添加到 package.json（推荐）

在项目根目录的 `package.json` 中添加：

```json
{
  "scripts": {
    "test:classification:realistic": "tsx scripts/classification-realistic-test/index.ts",
    "test:classification:realistic:quick": "tsx scripts/classification-realistic-test/index.ts --quick",
    "test:classification:realistic:verbose": "tsx scripts/classification-realistic-test/index.ts --verbose"
  }
}
```

然后运行：

```bash
npm run test:classification:realistic
```

## 查看报告

测试完成后，报告保存在：

```
reports/classification-realistic-test/
├── report-2026-01-20.md          # Markdown 报告
├── report-2026-01-20.json        # JSON 报告（用于程序化分析）
└── detailed-results-*.json       # 详细结果数据
```

## 注意事项

1. **API 端点配置**：确保 `index.ts` 中的 API 端点正确（默认 `http://localhost:3000/api/classification/v5/classify`）
2. **数据库连接**：测试会创建测试用户和书签，建议使用测试数据库
3. **性能考虑**：完整测试可能需要较长时间，建议先用 `--quick` 模式验证

## 故障排查

### 问题：API 调用失败

**解决方案**：

- 检查开发服务器是否运行
- 检查 API 端点是否正确
- 检查环境变量配置

### 问题：类型错误

**解决方案**：

- 确保 TypeScript 版本 >= 4.5
- 运行 `npm run type-check` 检查类型

### 问题：内存不足

**解决方案**：

- 使用 `--quick` 模式减少数据量
- 使用 `--user-types` 限制测试用户类型
