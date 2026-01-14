const pptxgen = require('pptxgenjs');
const path = require('path');

// 动态导入 html2pptx
async function main() {
  const html2pptx = require(path.join(__dirname, '../../.claude/skills/pptx/scripts/html2pptx.js'));

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = '终端服务软件 - 机器人检测数据管理解决方案';
  pptx.author = '终端服务软件销售团队';
  pptx.company = '终端服务软件';
  pptx.subject = '机器人检测中心专案演示';

  const slidesDir = path.join(__dirname, 'slides');
  const slideFiles = [
    'slide01-cover.html',
    'slide02-pain-points.html',
    'slide03-solution.html',
    'slide04-capability1.html',
    'slide05-capability2.html',
    'slide06-capability3.html',
    'slide07-value.html',
    'slide08-scenarios.html',
    'slide09-cooperation.html',
    'slide10-contact.html'
  ];

  console.log('开始生成演示文稿...');

  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i];
    const slidePath = path.join(slidesDir, slideFile);
    console.log(`处理幻灯片 ${i + 1}/10: ${slideFile}`);

    try {
      await html2pptx(slidePath, pptx);
      console.log(`  ✓ 完成`);
    } catch (error) {
      console.error(`  ✗ 错误: ${error.message}`);
      throw error;
    }
  }

  const outputPath = path.join(__dirname, '终端服务软件-机器人检测方案.pptx');
  await pptx.writeFile({ fileName: outputPath });
  console.log(`\n演示文稿已生成: ${outputPath}`);
}

main().catch(err => {
  console.error('生成失败:', err);
  process.exit(1);
});
