/**
 * Provider 组合工具
 *
 * 用于简化多层 Provider 嵌套，提升代码可读性
 *
 * @module utils/compose-providers
 * @version 1.0.0
 * @since 2025-12-24
 *
 * @example
 * ```typescript
 * // 基础用法 - 无 props 的 Providers
 * const CoreProviders = composeProviders(
 *   UserProvider,
 *   SessionProvider,
 *   SidebarProvider
 * );
 *
 * // 带 props 的 Provider - 使用 withProps
 * const ThemedProviders = composeProviders(
 *   withProps(ThemeProvider, { defaultTheme: 'system', enableSystem: true }),
 *   UserProvider
 * );
 *
 * // 在组件中使用
 * function App({ children }) {
 *   return <CoreProviders>{children}</CoreProviders>;
 * }
 * ```
 */

import type { ReactNode, ComponentType, JSX } from "react";
import React from "react";

// ============================================
// 类型定义
// ============================================

/**
 * 基础 Provider 组件类型
 *
 * 只接受 children 属性的简单 Provider
 */
export type SimpleProviderComponent = ComponentType<{ children: ReactNode }>;

/**
 * 带 Props 的 Provider 组件类型
 */
export type ProviderWithProps<P extends object = object> = ComponentType<
  P & { children: ReactNode }
>;

/**
 * Provider 配置项
 *
 * 可以是简单的 Provider 组件，或者是带预设 props 的配置
 */
export type ProviderConfig =
  | SimpleProviderComponent
  | {
      Provider: ProviderWithProps<Record<string, unknown>>;
      props: Record<string, unknown>;
    };

// ============================================
// 核心函数
// ============================================

/**
 * 组合多个 Provider 为单个组件
 *
 * 按传入顺序嵌套 Providers，第一个 Provider 在最外层
 *
 * @param providers - Provider 配置列表
 * @returns 组合后的 Provider 组件
 *
 * @example
 * ```typescript
 * const Providers = composeProviders(
 *   UserProvider,        // 最外层
 *   ThemeProvider,       // 中间层
 *   SidebarProvider      // 最内层
 * );
 *
 * // 等价于：
 * <UserProvider>
 *   <ThemeProvider>
 *     <SidebarProvider>
 *       {children}
 *     </SidebarProvider>
 *   </ThemeProvider>
 * </UserProvider>
 * ```
 */
export function composeProviders(
  ...providers: ProviderConfig[]
): SimpleProviderComponent {
  return providers.reduce<SimpleProviderComponent>(
    (AccumulatedProviders, currentConfig) => {
      // 处理带 props 的 Provider 配置
      if (
        typeof currentConfig === "object" &&
        "Provider" in currentConfig &&
        "props" in currentConfig
      ) {
        const { Provider, props } = currentConfig;
        return function ComposedProvider({
          children,
        }: {
          children: ReactNode;
        }): JSX.Element {
          return (
            <AccumulatedProviders>
              <Provider {...props}>{children}</Provider>
            </AccumulatedProviders>
          );
        };
      }

      // 处理简单的 Provider 组件
      const Provider = currentConfig as SimpleProviderComponent;
      return function ComposedProvider({
        children,
      }: {
        children: ReactNode;
      }): JSX.Element {
        return (
          <AccumulatedProviders>
            <Provider>{children}</Provider>
          </AccumulatedProviders>
        );
      };
    },
    // 初始值：透传 children 的空组件
    function IdentityProvider({ children }: { children: ReactNode }) {
      return <>{children}</>;
    },
  );
}

/**
 * 为 Provider 预设 props
 *
 * 用于在 composeProviders 中使用带 props 的 Provider
 *
 * @param Provider - Provider 组件
 * @param props - 预设的 props（会与 children 合并）
 * @returns Provider 配置对象
 *
 * @example
 * ```typescript
 * const Providers = composeProviders(
 *   withProps(ThemeProvider, {
 *     attribute: 'class',
 *     defaultTheme: 'system',
 *     enableSystem: true
 *   }),
 *   UserProvider
 * );
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withProps<P extends Record<string, any>>(
  Provider: ComponentType<P & { children: ReactNode }>,
  props: Omit<P, "children">,
): ProviderConfig {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Provider: Provider as any,
    props,
  };
}

/**
 * 创建带 Suspense 边界的 Provider
 *
 * 用于需要 Suspense 包裹的 Provider（如使用 useSearchParams 的组件）
 *
 * @param Provider - Provider 组件
 * @param fallback - Suspense fallback 组件
 * @returns 包裹了 Suspense 的 Provider 组件
 *
 * @example
 * ```typescript
 * const Providers = composeProviders(
 *   HomePageProvider,
 *   withSuspense(NavigationProvider, <LoadingSpinner />),
 *   KeepAliveProvider
 * );
 * ```
 */
export function withSuspense(
  Provider: SimpleProviderComponent,
  fallback: ReactNode = null,
): SimpleProviderComponent {
  return function SuspendedProvider({
    children,
  }: {
    children: ReactNode;
  }): JSX.Element {
    return (
      <React.Suspense fallback={fallback}>
        <Provider>{children}</Provider>
      </React.Suspense>
    );
  };
}

/**
 * 条件性 Provider
 *
 * 根据条件决定是否应用 Provider
 *
 * @param Provider - Provider 组件
 * @param condition - 条件，为 true 时应用 Provider
 * @returns 条件性 Provider 组件
 *
 * @example
 * ```typescript
 * const Providers = composeProviders(
 *   UserProvider,
 *   withCondition(DevToolsProvider, process.env.NODE_ENV === 'development')
 * );
 * ```
 */
export function withCondition(
  Provider: SimpleProviderComponent,
  condition: boolean,
): SimpleProviderComponent {
  if (!condition) {
    return function PassthroughProvider({ children }: { children: ReactNode }) {
      return <>{children}</>;
    };
  }
  return Provider;
}
