/**
 * p-limit Mock for Jest
 *
 * 模拟 p-limit 的并发限制功能，在测试环境中直接执行函数
 */

function pLimit(concurrency) {
  // 返回一个限流函数
  return function limit(fn) {
    // 直接返回 Promise，不做并发限制（测试环境）
    return async function (...args) {
      return fn(...args);
    };
  };
}

module.exports = pLimit;
module.exports.default = pLimit;
