# DELETE API 测试指南

执行完 RLS 修复后，按照以下步骤测试 DELETE 功能。

## 前置条件

✅ 已在 Supabase Dashboard 执行 RLS 修复 SQL
✅ 开发服务器正在运行 (npm run dev)

## 测试步骤

### 方法 1: 使用应用 UI 测试（推荐）

1. **登录应用**
   - 访问: http://localhost:3000
   - 使用测试账号登录

2. **创建测试收藏**
   - 进入首页
   - 点击"新建收藏"按钮
   - 输入测试 URL（如: https://example.com）
   - 提交创建

3. **删除测试收藏**
   - 在收藏卡片上找到删除按钮
   - 点击删除
   - 观察结果

### 方法 2: 使用 API 直接测试

#### 步骤 1: 创建测试收藏

```bash
# 先登录获取 access_token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test-email@example.com",
    "password": "your-password"
  }'

# 记录返回的 access_token

# 创建收藏
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "url": "https://example.com/test-delete",
    "title": "测试删除功能"
  }'

# 记录返回的 bookmark id
```

#### 步骤 2: 测试删除

```bash
# 使用上面获取的 bookmark id
curl -X DELETE http://localhost:3000/api/bookmarks/BOOKMARK_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 方法 3: 使用浏览器 DevTools

1. **打开浏览器开发者工具** (F12)
2. **切换到 Console 标签页**
3. **执行以下代码**:

```javascript
// 创建测试收藏
async function createTestBookmark() {
  const response = await fetch("/api/bookmarks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: "https://example.com/test-delete-" + Date.now(),
      title: "测试删除功能 " + new Date().toLocaleString(),
    }),
  });
  const data = await response.json();
  console.log("创建结果:", data);
  return data.data.id;
}

// 删除收藏
async function deleteBookmark(id) {
  const response = await fetch(`/api/bookmarks/${id}`, {
    method: "DELETE",
  });
  const data = await response.json();
  console.log("删除结果:", data);
  return data;
}

// 完整测试流程
async function testDeleteFlow() {
  try {
    console.log("1️⃣ 创建测试收藏...");
    const bookmarkId = await createTestBookmark();
    console.log("✅ 创建成功，ID:", bookmarkId);

    console.log("");
    console.log("2️⃣ 等待 2 秒...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("3️⃣ 删除收藏...");
    const deleteResult = await deleteBookmark(bookmarkId);
    console.log("✅ 删除成功:", deleteResult);

    console.log("");
    console.log("🎉 测试通过！DELETE API 正常工作");
  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

// 运行测试
testDeleteFlow();
```

## 预期结果

### ✅ 成功情况

```json
{
  "success": true,
  "message": "收藏已删除",
  "data": null
}
```

- 收藏从列表中消失
- `deleted_at` 字段被设置为当前时间
- 不再出现在首页收藏列表中
- 存储统计数字减少

### ❌ 失败情况（如果 RLS 未修复）

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "删除收藏失败",
    "details": "new row violates row-level security policy for table bookmarks"
  }
}
```

## 验证清单

执行测试后，验证以下内容：

### 1. API 响应正确

- [ ] DELETE 请求返回 200 状态码
- [ ] 响应 JSON 包含 `success: true`
- [ ] 没有错误信息

### 2. 数据库状态正确

在 Supabase Dashboard -> Table Editor -> bookmarks 中检查：

- [ ] 记录的 `deleted_at` 字段有值（不是 NULL）
- [ ] 记录仍然存在（软删除）
- [ ] `user_id` 字段未被修改

### 3. UI 状态正确

- [ ] 删除的收藏不再出现在首页列表
- [ ] 收藏总数减少
- [ ] 没有报错提示

### 4. 日志正常

在终端查看开发服务器日志：

```
[Bookmark DELETE] Processing id: xxx, user: xxx
[Bookmark DELETE] Soft delete: setting deleted_at
[Bookmark DELETE] Success: { id: xxx }
```

## 故障排查

### 问题 1: 仍然报 RLS 错误

**原因**: RLS 修复未成功应用
**解决**:

1. 重新检查 Supabase Dashboard SQL Editor 执行结果
2. 确认策略创建成功
3. 运行验证 SQL:

```sql
SELECT * FROM pg_policies
WHERE tablename = 'bookmarks'
AND policyname = 'Users can update own bookmarks';
```

### 问题 2: 403 未授权

**原因**: 用户未登录或 token 过期
**解决**:

1. 检查浏览器 Cookie 中的 session token
2. 重新登录
3. 确保请求包含正确的 Authorization header

### 问题 3: 404 未找到

**原因**: Bookmark ID 不存在或已被删除
**解决**:

1. 确认使用正确的 bookmark ID
2. 检查收藏是否已被删除（查看 deleted_at 字段）

## 测试完成后

### 清理测试数据

```sql
-- 在 Supabase Dashboard SQL Editor 中执行
DELETE FROM bookmarks
WHERE title LIKE '%测试删除%'
OR url LIKE '%test-delete%';
```

### 删除临时文件

```bash
rm apply-rls-fix-direct.mjs
rm scripts/apply-rls-fix.ts
rm src/app/api/admin/apply-migration/route.ts
rm FIX_RLS_GUIDE.md
rm test-delete-api.md
```

## 下一步

测试通过后，继续 Week 3 的下一个任务：

- ✅ 修复 DELETE API RLS 策略
- ✅ 测试删除功能
- ⏳ 图片上传集成到收藏创建
