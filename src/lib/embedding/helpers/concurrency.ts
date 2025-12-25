/**
 * 并发控制辅助函数
 *
 * V4.2.5: 用于防止 API 过载
 *
 * @module embedding/helpers/concurrency
 * @version 1.0.0
 * @since 2025-12-25
 */

/**
 * 带并发限制的 Promise 执行器
 *
 * @param tasks 异步任务数组
 * @param concurrency 最大并发数
 * @returns 所有任务的执行结果
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then((result) => {
      results.push(result);
    });

    const e = p.then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}
