# API 路由空函数修复计划

**创建时间**: 2026-01-14  
**优先级**: P0 - 立即修复（影响 API 功能）  
**预计工作量**: 2-3 天

---

## 一、问题分析

### 1.1 审查结果验证

经过详细代码检查，发现审查脚本存在误判。实际情况如下：

| 文件 | 行号 | 函数名 | 审查结果 | 实际状态 | 问题 |
|------|------|--------|---------|---------|------|
| `app/api/agent/regenerate/route.ts` | 256 | `sendChunk` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/agent/unified/route.ts` | 477 | `sendHeartbeat` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/workflow/sse/route.ts` | 90 | `sendEvent` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/knowledge-studio/v2/generate/route.ts` | 238 | `sendEvent` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/knowledge-studio/v2/iterate/route.ts` | 252 | `sendEvent` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/knowledge-studio/v2/outline/route.ts` | 167 | `sendEvent` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/knowledge-studio/reports/[id]/edit/route.ts` | 163 | `sendEvent` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/internal/cron/process-job-queue/route.ts` | 21 | `initSupabaseAdmin` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/internal/cron/process-job-queue/route.ts` | 33 | `getAdmin` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/internal/cron/smart-sorting/route.ts` | 18 | `initSupabaseAdmin` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/internal/cron/smart-sorting/route.ts` | 31 | `getAdmin` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/internal/dev/process-snapshots/route.ts` | 20 | `initSupabaseAdmin` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/internal/dev/process-snapshots/route.ts` | 32 | `getAdmin` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/snapshots/process/route.ts` | 21 | `initSupabaseAdmin` | 空函数 | ✅ **有实现** | 审查脚本误判 |
| `app/api/snapshots/process/route.ts` | 33 | `getAdmin` | 空函数 | ✅ **有实现** | 审查脚本误判 |

### 1.2 结论

**所有被标记为"空函数"的 API 路由函数实际上都有完整实现。**

审查脚本的空函数检测逻辑存在问题，可能因为：
1. 函数体跨多行，正则表达式匹配不准确
2. 函数定义和实现分离，导致误判
3. 代码格式问题（缩进、换行等）

---

## 二、需要进一步检查的问题

虽然这些函数有实现，但可能存在以下问题：

### 2.1 函数实现质量问题

#### 2.1.1 `initSupabaseAdmin` 和 `getAdmin` 重复定义

**问题**: 在 4 个不同的文件中重复定义了相同的函数：
- `app/api/internal/cron/process-job-queue/route.ts`
- `app/api/internal/cron/smart-sorting/route.ts`
- `app/api/internal/dev/process-snapshots/route.ts`
- `app/api/snapshots/process/route.ts`

**影响**:
- 代码重复，维护困难
- 如果修改逻辑，需要在多个地方同步更新
- 违反 DRY 原则

**建议**: 提取到共享工具模块

#### 2.1.2 `sendEvent` 函数模式重复

**问题**: 多个 API 路由中都有类似的 `sendEvent` 函数实现：
- `app/api/workflow/sse/route.ts`
- `app/api/knowledge-studio/v2/generate/route.ts`
- `app/api/knowledge-studio/v2/iterate/route.ts`
- `app/api/knowledge-studio/v2/outline/route.ts`
- `app/api/knowledge-studio/reports/[id]/edit/route.ts`

**模式**:
```typescript
const sendEvent = (chunk: SomeChunkType) => {
  const data = JSON.stringify(chunk);
  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
};
```

**影响**:
- 代码重复
- 如果需要修改 SSE 格式，需要在多个地方更新

**建议**: 提取到共享工具模块

---

## 三、修复计划

### Phase 1: 代码质量优化（推荐）

#### 3.1 提取 Supabase Admin 工具函数

**目标**: 消除 `initSupabaseAdmin` 和 `getAdmin` 的重复定义

**步骤**:

1. **创建共享工具模块**

创建文件: `src/lib/supabase/admin-client.ts`

```typescript
/**
 * Supabase Admin Client 工具
 * 
 * 用于需要绕过 RLS 的场景（如 Cron Job、后台任务等）
 */

import { createClient, createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

let supabaseAdmin: ReturnType<typeof createAdminClient<Database>> | null = null;

/**
 * 初始化 Supabase Admin 客户端
 * 
 * @throws {Error} 如果环境变量缺失
 * @returns Supabase Admin 客户端实例
 */
export function initSupabaseAdmin(): ReturnType<typeof createAdminClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials in environment variables");
  }

  supabaseAdmin = createAdminClient<Database>(url, serviceKey);
  return supabaseAdmin;
}

/**
 * 获取已初始化的 Supabase Admin 客户端
 * 
 * @throws {Error} 如果客户端未初始化
 * @returns Supabase Admin 客户端实例
 */
export function getSupabaseAdmin(): ReturnType<typeof createAdminClient<Database>> {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized. Call initSupabaseAdmin() first.");
  }
  return supabaseAdmin;
}

/**
 * 重置 Admin 客户端（用于测试）
 */
export function resetSupabaseAdmin(): void {
  supabaseAdmin = null;
}
```

2. **更新所有使用位置**

需要更新的文件：
- `app/api/internal/cron/process-job-queue/route.ts`
- `app/api/internal/cron/smart-sorting/route.ts`
- `app/api/internal/dev/process-snapshots/route.ts`
- `app/api/snapshots/process/route.ts`

**更新示例**:
```typescript
// 旧代码
import { createClient } from "@supabase/supabase-js";
let supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

const initSupabaseAdmin = () => {
  // ... 实现
};

const getAdmin = () => {
  // ... 实现
};

// 新代码
import { initSupabaseAdmin, getSupabaseAdmin } from "@/lib/supabase/admin-client";

// 使用时
const admin = initSupabaseAdmin();
// 或
const admin = getSupabaseAdmin();
```

**预计工作量**: 2-3 小时

#### 3.2 提取 SSE 发送工具函数

**目标**: 统一 SSE 事件发送逻辑

**步骤**:

1. **创建 SSE 工具模块**

创建文件: `src/lib/utils/sse-helper.ts`

```typescript
/**
 * Server-Sent Events (SSE) 工具函数
 */

import { TextEncoder } from "util";

/**
 * 创建 SSE 事件发送函数
 * 
 * @param controller ReadableStream 控制器
 * @param encoder TextEncoder 实例
 * @returns 发送事件的函数
 */
export function createSSESender<T>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): (chunk: T) => void {
  return (chunk: T) => {
    const data = JSON.stringify(chunk);
    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
  };
}

/**
 * 创建带错误处理的 SSE 发送函数
 * 
 * @param controller ReadableStream 控制器
 * @param encoder TextEncoder 实例
 * @param onError 错误处理回调
 * @returns 发送事件的函数
 */
export function createSSESenderWithError<T>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  onError?: (error: Error) => void,
): (chunk: T) => void {
  return (chunk: T) => {
    try {
      const data = JSON.stringify(chunk);
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err);
      } else {
        console.error("SSE send error:", err);
      }
    }
  };
}

/**
 * 发送 SSE 错误事件
 * 
 * @param controller ReadableStream 控制器
 * @param encoder TextEncoder 实例
 * @param error 错误对象或消息
 */
export function sendSSEError(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  error: Error | string,
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorChunk = {
    type: "error",
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };
  const data = JSON.stringify(errorChunk);
  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
}

/**
 * 发送 SSE 完成事件
 * 
 * @param controller ReadableStream 控制器
 * @param encoder TextEncoder 实例
 * @param data 可选的完成数据
 */
export function sendSSEDone<T = unknown>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  data?: T,
): void {
  const doneChunk = {
    type: "done",
    ...(data && { data }),
    timestamp: new Date().toISOString(),
  };
  const jsonData = JSON.stringify(doneChunk);
  controller.enqueue(encoder.encode(`data: ${jsonData}\n\n`));
  controller.close();
}
```

2. **更新使用位置**

需要更新的文件：
- `app/api/workflow/sse/route.ts`
- `app/api/knowledge-studio/v2/generate/route.ts`
- `app/api/knowledge-studio/v2/iterate/route.ts`
- `app/api/knowledge-studio/v2/outline/route.ts`
- `app/api/knowledge-studio/reports/[id]/edit/route.ts`

**更新示例**:
```typescript
// 旧代码
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    const sendEvent = (chunk: SomeChunkType) => {
      const data = JSON.stringify(chunk);
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    };
    // ... 使用 sendEvent
  },
});

// 新代码
import { createSSESender, sendSSEError, sendSSEDone } from "@/lib/utils/sse-helper";

const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    const sendEvent = createSSESender<SomeChunkType>(controller, encoder);
    // ... 使用 sendEvent
  },
});
```

**预计工作量**: 3-4 小时

---

### Phase 2: 审查脚本修复（可选）

#### 3.3 修复空函数检测逻辑

**问题**: 审查脚本的空函数检测存在误判

**步骤**:

1. **改进检测逻辑**

更新 `scripts/code-audit.ts` 中的 `checkEmptyFunctions` 函数：

```typescript
// 改进的空函数检测
function checkEmptyFunctions(): Issue[] {
  const issues: Issue[] = [];
  const files = getAllFiles(srcDir, ['.ts', '.tsx']);
  
  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 使用更精确的正则表达式
    // 匹配空函数体：{ } 或 {; } 或只有空白字符
    const emptyFunctionRegex = /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*:\s*[^{]*\{[\s\n]*\}/g;
    const emptyArrowRegex = /(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{[\s\n]*\}/g;
    
    // 更准确的方法：使用 AST 解析（需要 @typescript-eslint/parser）
    // 或者检查函数体是否只包含空白字符和注释
    const lines = content.split('\n');
    
    // 查找函数定义
    lines.forEach((line, index) => {
      // 检查是否是函数定义行
      if (line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/)) {
        // 检查下一行是否是空函数体
        let braceCount = 0;
        let hasContent = false;
        let i = index;
        
        while (i < lines.length && braceCount >= 0) {
          const currentLine = lines[i];
          braceCount += (currentLine.match(/\{/g) || []).length;
          braceCount -= (currentLine.match(/\}/g) || []).length;
          
          // 检查是否有实际内容（非空白、非注释）
          if (braceCount > 0 && currentLine.trim() && !currentLine.trim().startsWith('//') && !currentLine.trim().startsWith('*')) {
            hasContent = true;
            break;
          }
          
          if (braceCount === 0 && i > index) {
            break;
          }
          
          i++;
        }
        
        if (!hasContent && braceCount === 0) {
          issues.push({
            file,
            line: index + 1,
            severity: 'warning',
            message: '发现空函数',
            code: line.trim(),
          });
        }
      }
    });
  }
  
  return issues;
}
```

**预计工作量**: 2-3 小时

---

## 四、实施计划

### 4.1 时间安排

| 阶段 | 任务 | 预计时间 | 优先级 |
|------|------|---------|--------|
| Phase 1.1 | 提取 Supabase Admin 工具 | 2-3 小时 | P1 |
| Phase 1.2 | 提取 SSE 发送工具 | 3-4 小时 | P1 |
| Phase 2 | 修复审查脚本 | 2-3 小时 | P2 |
| **总计** | | **7-10 小时** | |

### 4.2 实施顺序

1. **第一步**: 提取 Supabase Admin 工具（影响 4 个文件）
2. **第二步**: 提取 SSE 发送工具（影响 5 个文件）
3. **第三步**: 运行测试，确保功能正常
4. **第四步**: 修复审查脚本（可选）

### 4.3 验收标准

- [ ] 所有 API 路由功能正常
- [ ] 代码重复消除
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 代码审查通过

---

## 五、风险评估

### 5.1 风险点

1. **重构风险**: 修改共享工具可能影响多个 API 路由
2. **测试覆盖**: 需要确保所有使用位置都有测试覆盖
3. **向后兼容**: 需要确保重构不影响现有功能

### 5.2 缓解措施

1. **分步实施**: 先提取工具，再逐步迁移使用位置
2. **充分测试**: 每个步骤完成后运行完整测试套件
3. **代码审查**: 每个 PR 都需要代码审查
4. **回滚计划**: 保留旧代码，确认无误后再删除

---

## 六、后续优化建议

### 6.1 代码质量

1. **统一错误处理**: SSE 错误处理逻辑可以进一步统一
2. **类型安全**: 为 SSE 事件类型添加更严格的类型定义
3. **日志记录**: 添加统一的日志记录机制

### 6.2 工具改进

1. **审查脚本**: 改进空函数检测逻辑，减少误判
2. **自动化测试**: 添加 API 路由的自动化测试
3. **代码分析**: 定期运行代码质量分析工具

---

## 七、总结

### 7.1 关键发现

1. **审查脚本误判**: 所有被标记为"空函数"的 API 路由函数实际上都有完整实现
2. **代码重复**: 存在明显的代码重复，需要提取到共享模块
3. **改进空间**: 可以通过重构提升代码质量和可维护性

### 7.2 建议

**推荐方案**: 执行 Phase 1（代码质量优化），原因：
- 消除代码重复，提升可维护性
- 统一实现模式，降低维护成本
- 不影响现有功能，风险可控

**可选方案**: Phase 2（审查脚本修复）可以后续进行，不影响功能。

---

**文档状态**: 待审核  
**下一步**: 等待审核确认后开始实施
