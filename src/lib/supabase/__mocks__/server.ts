/**
 * Supabase Server Client Mock
 *
 * 用于 Jest 测试环境，自动替换 @/lib/supabase/server
 * 避免 Next.js cookies() 上下文依赖问题
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

// 默认 mock 数据
const defaultMockData = {
  data: null,
  error: null,
};

// 可配置的 mock 响应
let mockResponses: Record<string, unknown> = {};

/**
 * 设置 mock 响应（供测试用例配置）
 */
export function __setMockResponse(key: string, response: unknown): void {
  mockResponses[key] = response;
}

/**
 * 重置所有 mock 响应
 */
export function __resetMockResponses(): void {
  mockResponses = {};
}

/**
 * 获取 mock 响应
 */
function getMockResponse(key: string): unknown {
  return mockResponses[key] ?? defaultMockData;
}

/**
 * 创建链式调用 mock
 */
function createChainMock(tableName: string) {
  const chain = {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() =>
          Promise.resolve(getMockResponse(`${tableName}.select.single`)),
        ),
        order: jest.fn(() => ({
          limit: jest.fn(() =>
            Promise.resolve(getMockResponse(`${tableName}.select.list`)),
          ),
        })),
      })),
      or: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            order: jest.fn(() =>
              Promise.resolve(getMockResponse(`${tableName}.select.list`)),
            ),
          })),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() =>
          Promise.resolve(getMockResponse(`${tableName}.insert.single`)),
        ),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() =>
        Promise.resolve(getMockResponse(`${tableName}.update`)),
      ),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() =>
        Promise.resolve(getMockResponse(`${tableName}.delete`)),
      ),
    })),
    upsert: jest.fn(() =>
      Promise.resolve(getMockResponse(`${tableName}.upsert`)),
    ),
  };
  return chain;
}

/**
 * Mock Supabase 客户端
 */
const mockSupabaseClient = {
  from: jest.fn((tableName: string) => createChainMock(tableName)),
  rpc: jest.fn((funcName: string, _params?: unknown) =>
    Promise.resolve(getMockResponse(`rpc.${funcName}`)),
  ),
  auth: {
    getUser: jest.fn(() =>
      Promise.resolve({ data: { user: null }, error: null }),
    ),
    getSession: jest.fn(() =>
      Promise.resolve({ data: { session: null }, error: null }),
    ),
  },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
      download: jest.fn(() => Promise.resolve({ data: null, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: "" } })),
    })),
  },
};

/**
 * 创建服务端 Supabase 客户端 (Mock)
 */
export async function createClient() {
  return mockSupabaseClient;
}

/**
 * 创建 Service Role 客户端 (Mock)
 */
export async function createServiceClient() {
  return mockSupabaseClient;
}

/**
 * 别名
 */
export const createServerSupabaseClient = createClient;

/**
 * 导出 mock 客户端供测试直接访问
 */
export const __mockClient = mockSupabaseClient;
