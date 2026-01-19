/**
 * 智能分类 v5.0 - 测试执行脚本
 *
 * 快速启动测试的入口脚本
 */

import { SyntheticLabRunner } from './run-synthetic-lab.js';
import { mockV4Engine, mockV5Engine } from './engines/mock-engines.js';

/**
 * 运行演示测试
 */
async function runDemoTest() {
  console.log('🧪 智能分类 v5.0 - 合成用户实验室测试\n');
  console.log('📝 注意：当前使用模拟引擎进行演示\n');

  try {
    // 创建测试运行器
    const runner = new SyntheticLabRunner({
      outputDir: './test-results',
      saveDataset: true,
      saveReport: true,
      personaTypes: ['hardcore-dev'], // 只测试硬核开发者画像
    });

    // 运行测试
    await runner.runFullTest(mockV4Engine, mockV5Engine);

    console.log('\n✅ 测试完成！');
    console.log('📁 测试结果已保存到: ./test-results');
    console.log('\n📊 查看报告:');
    console.log('   - Markdown: ./test-results/report-hardcore-dev.md');
    console.log('   - JSON: ./test-results/report-hardcore-dev.json');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
runDemoTest();
