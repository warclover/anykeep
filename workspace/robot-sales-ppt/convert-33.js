const html2pptx = require('c:/anykeep/.claude/skills/pptx/scripts/html2pptx.js');
const PptxGenJS = require('pptxgenjs');
const path = require('path');

async function main() {
  const pptx = new PptxGenJS();

  // 设置 16:9 幻灯片尺寸
  pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 });
  pptx.layout = 'CUSTOM';

  // 转换 HTML 幻灯片
  const htmlPath = path.join(__dirname, 'slides', '33-tech-arch.html');

  console.log('Converting slide: 33-tech-arch.html');
  await html2pptx(htmlPath, pptx);

  // 保存文件
  const outputPath = path.join(__dirname, '33-beautified.pptx');
  await pptx.writeFile({ fileName: outputPath });
  console.log(`\nPPTX saved to: ${outputPath}`);
}

main().catch(console.error);
