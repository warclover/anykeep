# 文件夹智能标签优化 - 部署指南

**版本**: v1.1.0
**日期**: 2026-01-15
**目的**: 解决新文件夹冷启动问题，提升智能分类准确度

---

## 🎯 优化目标

**问题**：新建文件夹（如"lims+实验室"）由于 `top_tags` 只包含文件夹名称本身，导致分类系统无法准确匹配，错误分类到其他文件夹。

**解决方案**：
1. **智能拆词**：将 "lims+实验室" 拆分为 `["lims", "实验室"]`
2. **同义词扩展**：添加相关术语 `["实验室信息管理系统", "Laboratory Information Management System", "实验室管理", ...]`
3. **增强匹配**：丰富的标签提升向量搜索之外的辅助匹配质量

---

## 📦 文件清单

### 新增文件

| 文件路径 | 说明 |
|---------|------|
| `src/lib/classification/utils/folder-tag-generator.ts` | 智能标签生成器（拆词+同义词） |
| `supabase/migrations/20260115000001_add_smart_tags_folder_profile_v2.sql` | 数据库迁移（v2 函数） |
| `scripts/update-folder-smart-tags.ts` | 批量更新脚本 |
| `docs/FOLDER_SMART_TAGS_DEPLOYMENT.md` | 本文档 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/lib/classification/folder-profile-manager.ts` | `initializeFolderNameProfile` 集成智能标签生成器 |

---

## 🚀 部署步骤

### 步骤 1: 应用数据库迁移

```bash
# 推送迁移到 Supabase（远程）
npx supabase db push

# 或者本地开发环境
npx supabase db reset  # ⚠️ 仅用于开发，会清空数据
```

**验证迁移成功**：

在 Supabase Dashboard → SQL Editor 执行：

```sql
-- 检查函数是否存在
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE 'update_folder_name_embedding%'
ORDER BY routine_name;

-- 应该返回：
-- update_folder_name_embedding (v1)
-- update_folder_name_embedding_v2 (v1.1)
```

---

### 步骤 2: 批量更新现有文件夹标签

#### 2.1 试运行（推荐）

先使用 `--dry-run` 预览效果：

```bash
npx tsx scripts/update-folder-smart-tags.ts --dry-run
```

**预期输出**：

```
========================================
批量更新文件夹智能标签
========================================

⚠️  试运行模式：不会实际更新数据库

📂 查询所有文件夹...
   找到 19 个文件夹

🏷️  生成智能标签...

   [2] claude 学习
       标签: claude, 学习, 学习资料 (+ 2 more)
   [14] 可持续发展
       标签: 可持续发展, 可持续, sustainability (+ 2 more)
   [32] lims+实验室
       标签: lims, 实验室, 实验室信息管理系统 (+ 4 more)
   ...

✅ 共生成 19 个文件夹的智能标签

⚠️  试运行模式结束，未执行数据库更新
   移除 --dry-run 参数以实际更新
```

#### 2.2 正式更新

确认无误后，执行实际更新：

```bash
npx tsx scripts/update-folder-smart-tags.ts
```

**预期输出**：

```
========================================
批量更新文件夹智能标签
========================================

📂 查询所有文件夹...
   找到 19 个文件夹

🏷️  生成智能标签...
   (省略...)

💾 更新数据库...
   批次 1/1 (19 个文件夹)

========================================
更新完成
========================================
✅ 成功: 19 个
❌ 失败: 0 个
📊 总计: 19 个
```

---

### 步骤 3: 验证智能标签效果

在 Supabase Dashboard → SQL Editor 执行：

```sql
-- 查看 lims+实验室 文件夹的智能标签
SELECT
  f.id,
  f.name,
  fp.top_tags,
  fp.updated_at
FROM folders f
JOIN folder_profiles fp ON fp.folder_id = f.id
WHERE f.name LIKE '%lims%' OR f.name LIKE '%实验室%';
```

**预期结果**：

```
id  | name          | top_tags                                      | updated_at
----|---------------|-----------------------------------------------|-------------------
32  | lims+实验室    | {lims,实验室,实验室信息管理系统,Laboratory...} | 2026-01-15 12:00:00
```

---

## 🧪 测试验证

### 测试 1: 新建文件夹自动生成智能标签

1. 在 AnyKeep 中创建新文件夹 "AI+机器学习"
2. 查询数据库：

```sql
SELECT f.id, f.name, fp.top_tags
FROM folders f
JOIN folder_profiles fp ON fp.folder_id = f.id
WHERE f.name = 'AI+机器学习';
```

**预期标签**：
```json
["ai", "机器学习", "ml", "machine learning", "人工智能"]
```

---

### 测试 2: 智能分类匹配测试

#### 方式 A: 通过 UI 测试（推荐）

1. 在 AnyKeep 中添加一个关于实验室的新收藏（标题包含"实验室管理"）
2. 触发智能分类
3. 验证是否正确分类到 "lims+实验室" 文件夹

#### 方式 B: 通过浏览器控制台测试

```javascript
// 在浏览器中登录 AnyKeep，打开控制台（F12）

// 模拟添加收藏并分类
fetch('/api/classification/classify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '实验室信息管理系统入门指南',
    url: 'https://example.com/lims-guide',
    platform: 'web'
  })
}).then(r => r.json()).then(data => {
  console.log('分类结果:', data);
  console.log('目标文件夹:', data.result?.folderName);
  console.log('置信度:', data.result?.confidence);
});
```

**预期结果**：
- 目标文件夹: "lims+实验室"
- 置信度: ≥ 70%

---

## 🔍 故障排查

### 问题 1: 迁移失败 "function already exists"

**原因**: 之前运行过迁移

**解决**：

```bash
# 检查当前迁移状态
npx supabase migration list

# 如果已应用，跳过即可
```

---

### 问题 2: 批量更新脚本失败 "SUPABASE_SERVICE_ROLE_KEY not found"

**原因**: 缺少环境变量

**解决**：

在项目根目录的 `.env.local` 中添加：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

从 Supabase Dashboard → Settings → API 获取密钥。

---

### 问题 3: 分类仍然错误

**检查清单**：

1. ✅ 数据库迁移已应用
2. ✅ 批量更新脚本已成功执行
3. ✅ 目标文件夹的 `top_tags` 已更新

如果以上都正常，可能是向量匹配质量问题，执行：

```sql
-- 查看候选文件夹的相似度得分
SELECT * FROM search_folders_unified(
  'user-id-here'::uuid,
  '[嵌入向量]'::vector(1024),
  10
);
```

---

## 📊 效果评估

### 关键指标

| 指标 | 优化前 | 优化后 | 改进 |
|------|--------|--------|------|
| **新文件夹标签数** | 1（仅文件夹名） | 5-15（拆词+同义词） | **5-15x** |
| **冷启动匹配准确率** | 估计 50-60% | 预期 75-85% | **+15-25%** |
| **误分类率** | 较高（如 lims → 可持续发展） | 显著降低 | - |

### 监控建议

在 Supabase Dashboard 创建监控查询：

```sql
-- 监控分类准确率（每日）
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_classifications,
  AVG(confidence) AS avg_confidence
FROM classification_decisions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🔄 回滚方案

如果优化导致问题，可以快速回滚：

### 回滚步骤

1. **恢复旧标签**（如果有备份）：

```sql
-- 恢复为文件夹名称
UPDATE folder_profiles fp
SET top_tags = ARRAY[f.name::TEXT]
FROM folders f
WHERE f.id = fp.folder_id;
```

2. **禁用 v1.1 函数**（应用层回退）：

在 `src/lib/classification/folder-profile-manager.ts` 中，将 `update_folder_name_embedding_v2` 改为 `update_folder_name_embedding`。

---

## 📝 后续优化建议

1. **扩展同义词词典**：根据用户反馈添加更多领域术语
2. **用户自定义同义词**：允许用户为文件夹添加自定义标签
3. **AI 辅助标签生成**：使用 LLM 为文件夹名称生成更丰富的语义标签
4. **A/B 测试**：对比优化前后的分类准确率

---

## ✅ 部署检查清单

部署前请确认：

- [ ] 已阅读本文档全部内容
- [ ] 已备份数据库（可选但推荐）
- [ ] 已应用数据库迁移
- [ ] 已执行批量更新脚本（先 --dry-run，后正式更新）
- [ ] 已验证智能标签生成效果
- [ ] 已测试智能分类匹配
- [ ] 已创建监控查询

部署后请：

- [ ] 观察分类准确率 7 天
- [ ] 收集用户反馈
- [ ] 根据反馈调整同义词词典

---

## 📞 支持

如有问题，请：
1. 检查本文档的"故障排查"部分
2. 查看服务器日志：`FolderProfileManager`、`FolderTagGenerator` 关键词
3. 在 GitHub Issues 提交问题

---

**祝部署顺利！** 🎉
