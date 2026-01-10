// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { randomUUID } from "crypto";

// Configure React act() environment for React 18
// This is required for async state updates in hook tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { TextEncoder, TextDecoder } from "util";
import { TransformStream, ReadableStream, WritableStream } from "stream/web";

// Polyfill crypto.randomUUID for Jest environment
if (typeof globalThis.crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = {
    randomUUID,
  };
} else if (typeof globalThis.crypto.randomUUID === "undefined") {
  globalThis.crypto.randomUUID = randomUUID;
}

// Polyfill TextEncoder/TextDecoder for Jest environment
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.TextDecoder = TextDecoder as any;
}

// Polyfill Web Streams API for Jest environment (required by AI SDK)
if (typeof globalThis.TransformStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.TransformStream = TransformStream as any;
}
if (typeof globalThis.ReadableStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.ReadableStream = ReadableStream as any;
}
if (typeof globalThis.WritableStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.WritableStream = WritableStream as any;
}

// Set test environment variables
// These are required by env.ts but don't need real values in tests
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}
if (!process.env.NODE_ENV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.env as any).NODE_ENV = "test";
}

// =============================================================================
// Global Supabase Server Mock
// =============================================================================
// Mock @/lib/supabase/server to avoid Next.js cookies() context issues in tests
// This must be done here because Jest's moduleNameMapper runs before jest.mock()

jest.mock("@/lib/supabase/server", () => {
  // Default mock responses storage
  const mockResponses: Record<string, unknown> = {};
  // Default thenable response storage (for awaitable chains)
  let defaultThenableResponse: { data: unknown; error: unknown } = {
    data: null,
    error: null,
  };

  const getMockResponse = (key: string) =>
    mockResponses[key] ?? { data: null, error: null };

  // Create a fully chainable mock that supports any chain pattern
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createFlexibleChainMock = (tableName: string): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chainMock: any = {};
    // Track operation type per chain instance
    let operationType: string = "select";

    // Operation methods - track which operation is being performed
    // Note: select() after insert/update/delete is for returning data, not a new operation
    const mutationMethods = ["insert", "update", "delete"];
    for (const method of mutationMethods) {
      chainMock[method] = jest.fn(() => {
        operationType = method;
        return chainMock;
      });
    }
    // select() only sets operation type if no mutation has been done
    chainMock.select = jest.fn(() => {
      if (operationType === "select") {
        operationType = "select";
      }
      // If operationType is already insert/update/delete, keep it
      return chainMock;
    });

    // Filter methods - just return chainMock
    const filterMethods = [
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "like",
      "ilike",
      "is",
      "in",
      "contains",
      "containedBy",
      "range",
      "textSearch",
      "match",
      "not",
      "or",
      "and",
      "filter",
      "order",
      "limit",
      "offset",
      "maybeSingle",
    ];
    for (const method of filterMethods) {
      chainMock[method] = jest.fn(() => chainMock);
    }

    // Terminal method: single - returns resolved response
    // Supports both new format (tableName.single) and legacy format (tableName.operation.single)
    chainMock.single = jest.fn(() => {
      // Check for legacy format first (e.g., "workflows.select.single")
      const legacyKey = `${tableName}.${operationType}.single`;
      if (mockResponses[legacyKey] !== undefined) {
        return Promise.resolve(mockResponses[legacyKey]);
      }
      // Check for new format (e.g., "workflows.single")
      const newKey = `${tableName}.single`;
      if (mockResponses[newKey] !== undefined) {
        return Promise.resolve(mockResponses[newKey]);
      }
      // Fallback to default
      return Promise.resolve({ data: null, error: null });
    });

    // Make chainMock thenable (awaitable) for direct await on chain
    chainMock.then = (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      // Check for legacy format (e.g., "workflows.select.list")
      const legacyKey = `${tableName}.${operationType}.list`;
      if (mockResponses[legacyKey] !== undefined) {
        return Promise.resolve(mockResponses[legacyKey]).then(resolve, reject);
      }
      // Check for new format (e.g., "workflows.list")
      const newKey = `${tableName}.list`;
      if (mockResponses[newKey] !== undefined) {
        return Promise.resolve(mockResponses[newKey]).then(resolve, reject);
      }
      // Check operation-specific thenable (e.g., "workflows.update")
      const operationKey = `${tableName}.${operationType}`;
      if (mockResponses[operationKey] !== undefined) {
        return Promise.resolve(mockResponses[operationKey]).then(
          resolve,
          reject,
        );
      }
      return Promise.resolve(defaultThenableResponse).then(resolve, reject);
    };

    return chainMock;
  };

  const mockClient = {
    from: jest.fn((tableName: string) => {
      return createFlexibleChainMock(tableName);
    }),
    rpc: jest.fn((funcName: string) =>
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
  };

  return {
    createClient: jest.fn(() => Promise.resolve(mockClient)),
    createServiceClient: jest.fn(() => Promise.resolve(mockClient)),
    createServerSupabaseClient: jest.fn(() => Promise.resolve(mockClient)),
    // Expose internals for test configuration
    __mockClient: mockClient,
    __setMockResponse: (key: string, response: unknown) => {
      mockResponses[key] = response;
    },
    __setDefaultThenableResponse: (response: {
      data: unknown;
      error: unknown;
    }) => {
      defaultThenableResponse = response;
    },
    __resetMockResponses: () => {
      Object.keys(mockResponses).forEach((key) => delete mockResponses[key]);
      defaultThenableResponse = { data: null, error: null };
    },
    __getMockResponses: () => mockResponses,
  };
});

// =============================================================================
// Global StateManager Mock
// =============================================================================
// Mock workflow state manager to avoid deep dependency chains in tests
// Tests can configure behavior using __setMockImplementation

jest.mock("@/lib/workflow/state/state-manager", () => {
  // Default mock implementations storage
  const mockImplementations: Record<string, jest.Mock> = {
    createExecution: jest.fn(),
    getExecution: jest.fn(),
    updateStatus: jest.fn(),
    updateCurrentStep: jest.fn(),
    recordStepResult: jest.fn(),
    listExecutions: jest.fn(),
  };

  // Default return values
  const defaultReturns: Record<string, unknown> = {
    createExecution: Promise.resolve(null),
    getExecution: Promise.resolve(null),
    updateStatus: Promise.resolve(undefined),
    updateCurrentStep: Promise.resolve(undefined),
    recordStepResult: Promise.resolve(undefined),
    listExecutions: Promise.resolve([]),
  };

  // Create mock instance
  const mockStateManager = {
    createExecution: jest.fn((...args) => {
      const impl = mockImplementations.createExecution;
      if (impl.getMockImplementation()) {
        return impl(...args);
      }
      return defaultReturns.createExecution;
    }),
    getExecution: jest.fn((...args) => {
      const impl = mockImplementations.getExecution;
      if (impl.getMockImplementation()) {
        return impl(...args);
      }
      return defaultReturns.getExecution;
    }),
    updateStatus: jest.fn((...args) => {
      const impl = mockImplementations.updateStatus;
      if (impl.getMockImplementation()) {
        return impl(...args);
      }
      return defaultReturns.updateStatus;
    }),
    updateCurrentStep: jest.fn((...args) => {
      const impl = mockImplementations.updateCurrentStep;
      if (impl.getMockImplementation()) {
        return impl(...args);
      }
      return defaultReturns.updateCurrentStep;
    }),
    recordStepResult: jest.fn((...args) => {
      const impl = mockImplementations.recordStepResult;
      if (impl.getMockImplementation()) {
        return impl(...args);
      }
      return defaultReturns.recordStepResult;
    }),
    listExecutions: jest.fn((...args) => {
      const impl = mockImplementations.listExecutions;
      if (impl.getMockImplementation()) {
        return impl(...args);
      }
      return defaultReturns.listExecutions;
    }),
  };

  return {
    StateManager: jest.fn(() => mockStateManager),
    getStateManager: jest.fn(() => mockStateManager),
    // Expose internals for test configuration
    __mockStateManager: mockStateManager,
    __setMockReturn: (method: string, value: unknown) => {
      defaultReturns[method] = value;
    },
    __resetMockReturns: () => {
      Object.keys(defaultReturns).forEach((key) => {
        if (key === "createExecution" || key === "getExecution") {
          defaultReturns[key] = Promise.resolve(null);
        } else if (key === "listExecutions") {
          defaultReturns[key] = Promise.resolve([]);
        } else {
          defaultReturns[key] = Promise.resolve(undefined);
        }
      });
      // Clear all mock calls
      Object.values(mockStateManager).forEach((mock) => {
        if (typeof mock === "function" && "mockClear" in mock) {
          (mock as jest.Mock).mockClear();
        }
      });
    },
  };
});

// =============================================================================
// Global ExecutionEngine Mock
// =============================================================================
// Mock workflow execution engine to avoid deep dependency chains in tests
// This mock is applied globally. For tests needing the real implementation,
// use jest.resetModules() and dynamically import the real module.

jest.mock("@/lib/workflow/engine/execution-engine", () => {
  // Create mock instance
  const mockExecutionEngine = {
    execute: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockReturnValue(true),
    isRunning: jest.fn().mockReturnValue(false),
  };

  return {
    ExecutionEngine: jest.fn(() => mockExecutionEngine),
    getExecutionEngine: jest.fn(() => mockExecutionEngine),
    // Expose internals for test configuration
    __mockExecutionEngine: mockExecutionEngine,
    __resetMocks: () => {
      mockExecutionEngine.execute.mockClear().mockResolvedValue(undefined);
      mockExecutionEngine.cancel.mockClear().mockReturnValue(true);
      mockExecutionEngine.isRunning.mockClear().mockReturnValue(false);
    },
  };
});

// =============================================================================
// Global SemanticMatcher Mock
// =============================================================================
// Mock semantic matcher to avoid embedding API calls in tests

jest.mock("@/lib/workflow/integration/semantic-matcher", () => {
  // Create mock match function
  const mockMatchFn = jest.fn().mockResolvedValue({
    matched: false,
    confidence: 0,
  });

  // Create mock instance
  const mockSemanticMatcher = {
    match: mockMatchFn,
    precomputeEmbeddings: jest.fn().mockResolvedValue([]),
    clearCache: jest.fn(),
    getCacheStats: jest
      .fn()
      .mockReturnValue({ messageCount: 0, referenceCount: 0 }),
  };

  return {
    SemanticMatcher: jest.fn(() => mockSemanticMatcher),
    getSemanticMatcher: jest.fn(() => mockSemanticMatcher),
    resetSemanticMatcher: jest.fn(),
    // Expose internals for test configuration
    __mockSemanticMatcher: mockSemanticMatcher,
    __mockMatchFn: mockMatchFn,
    __setMockMatchResponse: (response: unknown) => {
      mockMatchFn.mockResolvedValue(response);
    },
    __resetMocks: () => {
      mockMatchFn
        .mockClear()
        .mockResolvedValue({ matched: false, confidence: 0 });
      mockSemanticMatcher.precomputeEmbeddings
        .mockClear()
        .mockResolvedValue([]);
      mockSemanticMatcher.clearCache.mockClear();
      mockSemanticMatcher.getCacheStats
        .mockClear()
        .mockReturnValue({ messageCount: 0, referenceCount: 0 });
    },
  };
});
